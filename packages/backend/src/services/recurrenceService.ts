import { RRule } from 'rrule';

/** A serialized event — start/end are ISO strings, participants are flat objects. */
interface SerializedEvent {
  id: string;
  title: string;
  recurrenceRule: string | null;
  start: string; // ISO
  end: string;   // ISO
  allDay: boolean;
  [key: string]: unknown;
}

export const recurrenceService = {
  /**
   * Expand a recurring event into virtual occurrence objects within [from, to].
   * Accepts a SERIALIZED event (start/end as ISO strings) so the resulting
   * occurrences inherit the same properly-shaped participants/transport data.
   */
  expand(event: SerializedEvent, from: Date, to: Date): SerializedEvent[] {
    const dtstart  = new Date(event.start);
    const dtend    = new Date(event.end);
    const durationMs = dtend.getTime() - dtstart.getTime();

    if (!event.recurrenceRule) {
      return [{ ...event, isOccurrence: true, originalId: event.id }];
    }

    let rule: RRule;
    try {
      const options = RRule.parseString(event.recurrenceRule);
      options.dtstart = dtstart;
      rule = new RRule(options);
    } catch {
      return [{ ...event, isOccurrence: true, originalId: event.id }];
    }

    const occurrences = rule.between(from, to, true);

    return occurrences.map((occ) => {
      const occEnd = new Date(occ.getTime() + durationMs);
      return {
        ...event,
        id: `${event.id}:${occ.toISOString()}`,
        originalId: event.id,
        start: occ.toISOString(),
        end: occEnd.toISOString(),
        isOccurrence: true,
      };
    });
  },

  validateRRule(rruleStr: string): boolean {
    try {
      RRule.fromString(rruleStr);
      return true;
    } catch {
      return false;
    }
  },

  describeRRule(rruleStr: string, lang: 'cs' | 'en' = 'cs'): string {
    try {
      const rule = RRule.fromString(rruleStr);
      return rule.toText();
    } catch {
      return lang === 'cs' ? 'Opakující se' : 'Recurring';
    }
  },
};

