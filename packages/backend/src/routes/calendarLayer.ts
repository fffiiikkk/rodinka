/**
 * GET /api/calendar-layer?from=ISO&to=ISO
 *
 * Returns birthday and nameday events for all active users that fall within
 * the requested date range.  These are "virtual" (not stored in Event table),
 * generated on the fly from User.dateOfBirth and the Czech nameday calendar.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { CZECH_NAME_DAYS } from '../lib/nameDays.js';
import { fileUrl } from '../lib/s3.js';

const router = Router();
router.use(requireAuth);

const QuerySchema = z.object({
  from: z.string().datetime(),
  to:   z.string().datetime(),
});

/** Extract first name from full name ("Jan Novák" → "Jan", "Jan" → "Jan") */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name.trim();
}

/** "MM-DD" for a Date in local time */
function toMMDD(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}-${day}`;
}

/** All MM-DD values between from and to (inclusive, cross-year aware) */
function mmddRange(from: Date, to: Date): string[] {
  const result: string[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    result.push(toMMDD(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return [...new Set(result)];
}

/** Given "MM-DD" and a reference year range, produce all matching full ISO dates */
function datesForMMDD(mmdd: string, fromYear: number, toYear: number): string[] {
  const dates: string[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    dates.push(`${y}-${mmdd}`);
  }
  return dates;
}

export interface CalendarLayerEvent {
  id: string;
  type: 'birthday' | 'nameday';
  date: string;        // YYYY-MM-DD
  userId: string;
  userName: string;
  userPhotoUrl: string | null;
  userColor: string;
  label: string;       // e.g. "🎂 Narozeniny Jakuba" / "🌸 Jmeniny Jana"
  age?: number;        // for birthdays
  nameDayName?: string; // the name being celebrated
}

function userColor(id: string): string {
  const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#84cc16'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

router.get('/', async (req, res, next) => {
  try {
    const { from, to } = QuerySchema.parse(req.query);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const fromYear = fromDate.getFullYear();
    const toYear = toDate.getFullYear();

    const users = await prisma.user.findMany({
      where: { isActive: true, username: { not: 'system' } },
      select: { id: true, name: true, dateOfBirth: true, photoPath: true, nameDayOverride: true },
    });

    const events: CalendarLayerEvent[] = [];

    // Build a set of all MM-DD values in the range for fast lookup
    const rangeMMDDs = new Set(mmddRange(fromDate, toDate));

    for (const user of users) {
      const fName = firstName(user.name);
      const color = userColor(user.id);
      const photoUrl = user.photoPath ? fileUrl(user.photoPath) : null;

      // ── Birthdays ─────────────────────────────────────
      if (user.dateOfBirth) {
        const dob = new Date(user.dateOfBirth);
        const bMMDD = toMMDD(dob);
        if (rangeMMDDs.has(bMMDD)) {
          for (const dateStr of datesForMMDD(bMMDD, fromYear, toYear)) {
            const d = new Date(dateStr);
            if (d >= fromDate && d <= toDate) {
              const age = d.getFullYear() - dob.getFullYear();
              events.push({
                id: `birthday-${user.id}-${dateStr}`,
                type: 'birthday',
                date: dateStr,
                userId: user.id,
                userName: user.name,
                userPhotoUrl: photoUrl,
                userColor: color,
                label: `🎂 ${user.name} (${age} let)`,
                age,
              });
            }
          }
        }
      }

      // ── Namedays ──────────────────────────────────────
      // Use admin-set override first, fall back to automatic first-name lookup
      const nameDayMMDD = user.nameDayOverride ?? findFirstNameDay(fName);
      if (nameDayMMDD && rangeMMDDs.has(nameDayMMDD)) {
        for (const dateStr of datesForMMDD(nameDayMMDD, fromYear, toYear)) {
          const d = new Date(dateStr);
          if (d >= fromDate && d <= toDate) {
            const nameDayName = CZECH_NAME_DAYS[nameDayMMDD] ?? fName;
            events.push({
              id: `nameday-${user.id}-${dateStr}`,
              type: 'nameday',
              date: dateStr,
              userId: user.id,
              userName: user.name,
              userPhotoUrl: photoUrl,
              userColor: color,
              label: `🌸 Jmeniny: ${user.name}`,
              nameDayName,
            });
          }
        }
      }
    }

    // Sort by date
    events.sort((a, b) => a.date.localeCompare(b.date));
    res.json({ events });
  } catch (e) { next(e); }
});

/** Case-insensitive first-name lookup in the nameday map */
function findFirstNameDay(name: string): string | null {
  const search = name.toLowerCase().normalize('NFC');
  for (const [key, entry] of Object.entries(CZECH_NAME_DAYS)) {
    const parts = entry.split(/\s+a\s+|\s*[,(]/);
    for (const part of parts) {
      const clean = part.trim().replace(/[.)]/g, '').toLowerCase().normalize('NFC');
      if (clean === search) return key;
    }
  }
  return null;
}

export default router;
