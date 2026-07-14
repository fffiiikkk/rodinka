/**
 * scheduleImportService — bulk recurring-event import for school timetables.
 *
 * CSV columns (header required):
 *   title, eventType, dayOfWeek, startTime, endTime, location, description
 *
 * dayOfWeek: Po | Ut | St | Ct | Pa | So | Ne  (or Mon..Sun)
 * times:     HH:mm
 * eventType: EventType.slug — unknown slugs are a warning (not an error)
 */
import { prisma } from '../db.js';
import { createError } from '../middleware/errorHandler.js';

export const CSV_TEMPLATE = `title,eventType,dayOfWeek,startTime,endTime,location,description
Matematika,predmet-matematika,Po,08:00,08:45,Třída 5.A,
Čeština,predmet-cestina,Po,08:55,09:40,Třída 5.A,paní Nováková
Angličtina,predmet-anglictina,Ut,08:00,08:45,Třída 5.A,
Přírodověda,predmet-prirodoveda,Ut,08:55,09:40,Třída 5.A,
Tělocvik,predmet-telocvik,St,08:00,09:40,Tělocvična,
Matematika,predmet-matematika,Ct,08:00,08:45,Třída 5.A,
Čeština,predmet-cestina,Ct,08:55,09:40,Třída 5.A,
Výtvarná výchova,predmet-vytvarna,Pa,08:00,09:40,Výtvarná dílna,
`;

const DAY_MAP: Record<string, string> = {
  // Czech
  po: 'MO', ut: 'TU', st: 'WE', ct: 'TH', pa: 'FR', so: 'SA', ne: 'SU',
  // English full
  monday: 'MO', tuesday: 'TU', wednesday: 'WE', thursday: 'TH', friday: 'FR', saturday: 'SA', sunday: 'SU',
  // English short
  mon: 'MO', tue: 'TU', wed: 'WE', thu: 'TH', fri: 'FR', sat: 'SA', sun: 'SU',
};

export interface ParsedRow {
  rowIndex: number;
  title: string;
  eventTypeSlug: string;
  dayOfWeek: string;   // rrule BYDAY value: MO..SU
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
  location: string;
  description: string;
  errors: string[];
  warnings: string[];
}

function parseTime(value: string): { valid: boolean; h: number; m: number } {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { valid: false, h: 0, m: 0 };
  const h = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  if (h > 23 || m > 59) return { valid: false, h: 0, m: 0 };
  return { valid: true, h, m };
}

export function parseCsv(csvText: string): ParsedRow[] {
  const lines = csvText.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Skip header
  const headerOffset = lines[0]!.toLowerCase().startsWith('title') ? 1 : 0;
  const rows: ParsedRow[] = [];

  for (let i = headerOffset; i < lines.length; i++) {
    const cols = lines[i]!.split(',').map((c) => c.trim());
    const [title = '', eventTypeSlug = '', dayRaw = '', startTimeRaw = '', endTimeRaw = '', location = '', description = ''] = cols;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!title) errors.push('Chybí název (title)');

    const dayKey = dayRaw.toLowerCase().replace(/[.\s]/g, '');
    const dayOfWeek = DAY_MAP[dayKey] ?? '';
    if (!dayOfWeek) errors.push(`Neplatný den: "${dayRaw}" (použijte Po,Ut,St,Ct,Pa,So,Ne)`);

    const startT = parseTime(startTimeRaw);
    const endT = parseTime(endTimeRaw);
    if (!startT.valid) errors.push(`Neplatný čas začátku: "${startTimeRaw}" (formát HH:mm)`);
    if (!endT.valid) errors.push(`Neplatný čas konce: "${endTimeRaw}" (formát HH:mm)`);
    if (startT.valid && endT.valid && (endT.h * 60 + endT.m) <= (startT.h * 60 + startT.m)) {
      errors.push('Čas konce musí být po čase začátku');
    }

    if (!eventTypeSlug) warnings.push('Typ události není zadán — použije se obecná barva');

    rows.push({
      rowIndex: i - headerOffset + 1,
      title,
      eventTypeSlug,
      dayOfWeek,
      startTime: startT.valid ? `${String(startT.h).padStart(2, '0')}:${String(startT.m).padStart(2, '0')}` : startTimeRaw,
      endTime: endT.valid ? `${String(endT.h).padStart(2, '0')}:${String(endT.m).padStart(2, '0')}` : endTimeRaw,
      location,
      description,
      errors,
      warnings,
    });
  }

  return rows;
}

export const scheduleImportService = {
  async commit(params: {
    name: string;
    targetUserId: string;
    validFrom: string;
    validTo?: string | null;
    rows: ParsedRow[];
    adminId: string;
  }) {
    const { name, targetUserId, validFrom, validTo, rows, adminId } = params;

    // Validate target user exists
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw createError(404, 'Uživatel nenalezen', 'NOT_FOUND');

    const hasErrors = rows.some((r) => r.errors.length > 0);
    if (hasErrors) throw createError(400, 'CSV obsahuje chyby — opravte je před importem', 'VALIDATION_ERROR');

    // Look up event types by slug
    const slugs = [...new Set(rows.map((r) => r.eventTypeSlug).filter(Boolean))];
    const eventTypes = slugs.length
      ? await prisma.eventType.findMany({ where: { slug: { in: slugs } } })
      : [];
    const typeBySlug = new Map(eventTypes.map((t) => [t.slug, t.id]));

    const validFromDate = new Date(validFrom);

    // Create the ScheduleImport record
    const importRecord = await prisma.scheduleImport.create({
      data: { name, targetUserId, createdById: adminId, validFrom: validFromDate, validTo: validTo ? new Date(validTo) : null },
    });

    // Find the first occurrence of each day-of-week >= validFrom
    function nextWeekday(from: Date, rruleDay: string): Date {
      const DAY_IDX: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
      const target = DAY_IDX[rruleDay] ?? 1;
      const d = new Date(from);
      while (d.getDay() !== target) d.setDate(d.getDate() + 1);
      return d;
    }

    let created = 0;
    for (const row of rows) {
      const [sh, sm] = row.startTime.split(':').map(Number);
      const [eh, em] = row.endTime.split(':').map(Number);
      const firstDay = nextWeekday(validFromDate, row.dayOfWeek);

      const startDate = new Date(firstDay);
      startDate.setHours(sh!, sm!, 0, 0);
      const endDate = new Date(firstDay);
      endDate.setHours(eh!, em!, 0, 0);

      const until = validTo
        ? `;UNTIL=${new Date(validTo).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
        : '';
      const rrule = `FREQ=WEEKLY;BYDAY=${row.dayOfWeek}${until}`;

      await prisma.event.create({
        data: {
          title: row.title,
          description: row.description || undefined,
          eventTypeId: row.eventTypeSlug ? (typeBySlug.get(row.eventTypeSlug) ?? null) : null,
          start: startDate,
          end: endDate,
          allDay: false,
          location: row.location || undefined,
          recurrenceRule: rrule,
          status: 'APPROVED',
          createdById: adminId,
          scheduleImportId: importRecord.id,
          participants: { create: [{ userId: targetUserId }] },
        },
      });
      created++;
    }

    return { importId: importRecord.id, created };
  },

  async replace(importId: string, params: {
    name: string;
    targetUserId: string;
    validFrom: string;
    validTo?: string | null;
    rows: ParsedRow[];
    adminId: string;
  }) {
    // Delete existing events for this import (cascade handles participants)
    await prisma.event.deleteMany({ where: { scheduleImportId: importId } });
    await prisma.scheduleImport.delete({ where: { id: importId } });
    return this.commit(params);
  },

  async list() {
    return prisma.scheduleImport.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        targetUser: { select: { id: true, name: true, nickname: true, role: true } },
        _count: { select: { events: true } },
      },
    });
  },

  async remove(importId: string) {
    await prisma.event.deleteMany({ where: { scheduleImportId: importId } });
    await prisma.scheduleImport.delete({ where: { id: importId } });
  },
};
