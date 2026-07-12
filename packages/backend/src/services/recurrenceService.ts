import { RRule } from 'rrule';

interface EventBase {
  id: string;
  title: string;
  recurrenceRule: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  [key: string]: unknown;
}

export const recurrenceService = {
  /**
   * Expand a recurring event into virtual occurrence objects within [from, to].
   * Each occurrence is the base event's data with overridden start/end.
   */
  expand(event: EventBase, from: Date, to: Date): unknown[] {
    if (!event.recurrenceRule) return [serializeOccurrence(event, event.start, event.end)];

    let rule: RRule;
    try {
      const options = RRule.parseString(event.recurrenceRule);
      // Use event start as DTSTART so the rule is anchored to the event
      options.dtstart = event.start;
      rule = new RRule(options);
    } catch {
      return [serializeOccurrence(event, event.start, event.end)];
    }

    const durationMs = event.end.getTime() - event.start.getTime();
    const occurrences = rule.between(from, to, true);

    return occurrences.map((occ) => {
      const occEnd = new Date(occ.getTime() + durationMs);
      return serializeOccurrence(event, occ, occEnd);
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

function serializeOccurrence(event: EventBase, start: Date, end: Date): unknown {
  return {
    ...event,
    id: `${event.id}:${start.toISOString()}`,
    originalId: event.id,
    start: start.toISOString(),
    end: end.toISOString(),
    isOccurrence: true,
  };
}
