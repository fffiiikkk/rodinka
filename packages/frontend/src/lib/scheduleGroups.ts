/**
 * Groups same-day events that share a scheduleImportId into a single cluster.
 * Events without a scheduleImportId are returned unchanged in the "ungrouped" list.
 */

export interface GroupableEvent {
  id: string;
  start: string;
  end: string;
  title: string;
  scheduleImportId?: string | null;
  [key: string]: unknown;
}

export interface ScheduleGroup {
  scheduleImportId: string;
  date: string; // yyyy-MM-dd
  events: GroupableEvent[];
  /** Earliest start time HH:mm */
  startTime: string;
  /** Latest end time HH:mm */
  endTime: string;
  /** Total block count */
  count: number;
}

export interface GroupedResult<T extends GroupableEvent> {
  groups: ScheduleGroup[];
  ungrouped: T[];
}

export function groupByScheduleImport<T extends GroupableEvent>(events: T[]): GroupedResult<T> {
  const groupMap = new Map<string, GroupableEvent[]>(); // key = importId::date
  const ungrouped: T[] = [];

  for (const ev of events) {
    if (!ev.scheduleImportId) {
      ungrouped.push(ev);
      continue;
    }
    const date = ev.start.slice(0, 10);
    const key = `${ev.scheduleImportId}::${date}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(ev);
  }

  const groups: ScheduleGroup[] = [];
  for (const [key, evs] of groupMap) {
    const [importId, date] = key.split('::') as [string, string];
    const sorted = evs.sort((a, b) => a.start.localeCompare(b.start));
    const startTime = sorted[0]!.start.slice(11, 16);
    const endTime = sorted[sorted.length - 1]!.end.slice(11, 16);
    groups.push({ scheduleImportId: importId, date, events: sorted, startTime, endTime, count: sorted.length });
  }

  return { groups, ungrouped };
}
