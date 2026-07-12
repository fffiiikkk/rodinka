import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import DatePicker from '../ui/DatePicker.js';

type Frequency = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

const WEEKDAYS_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BYDAY_MAP = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

interface Props {
  value: string | null;
  onChange: (rrule: string | null) => void;
  startDate?: string; // yyyy-MM-dd — used to default the day-of-week
}

function buildRRule(freq: Frequency, days: number[], until: string | null, count: string): string | null {
  if (freq === 'none') return null;
  if (freq === 'daily') {
    let r = 'FREQ=DAILY';
    if (until) r += `;UNTIL=${until.replace(/-/g, '')}T000000Z`;
    else if (count) r += `;COUNT=${count}`;
    return r;
  }
  if (freq === 'monthly') {
    let r = 'FREQ=MONTHLY';
    if (until) r += `;UNTIL=${until.replace(/-/g, '')}T000000Z`;
    else if (count) r += `;COUNT=${count}`;
    return r;
  }
  // weekly / biweekly
  const interval = freq === 'biweekly' ? 2 : 1;
  const byDay = days.length > 0 ? days.map((d) => BYDAY_MAP[d]).join(',') : 'MO';
  let r = `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${byDay}`;
  if (until) r += `;UNTIL=${until.replace(/-/g, '')}T000000Z`;
  else if (count) r += `;COUNT=${count}`;
  return r;
}

function parseRRule(rrule: string | null): { freq: Frequency; days: number[]; until: string | null; count: string } {
  if (!rrule) return { freq: 'none', days: [], until: null, count: '' };
  const upper = rrule.toUpperCase();
  let freq: Frequency = 'none';
  if (upper.includes('FREQ=DAILY')) freq = 'daily';
  else if (upper.includes('FREQ=MONTHLY')) freq = 'monthly';
  else if (upper.includes('FREQ=WEEKLY')) {
    const intervalMatch = upper.match(/INTERVAL=(\d+)/);
    freq = intervalMatch && parseInt(intervalMatch[1]!) >= 2 ? 'biweekly' : 'weekly';
  }

  const daysMatch = upper.match(/BYDAY=([A-Z,]+)/);
  const days: number[] = daysMatch
    ? daysMatch[1]!.split(',').map((d) => BYDAY_MAP.indexOf(d)).filter((i) => i >= 0)
    : [];

  const untilMatch = upper.match(/UNTIL=(\d{8})/);
  let until: string | null = null;
  if (untilMatch) {
    const u = untilMatch[1]!;
    until = `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`;
  }

  const countMatch = upper.match(/COUNT=(\d+)/);
  const count = countMatch ? countMatch[1]! : '';

  return { freq, days, until, count };
}

function humanReadable(freq: Frequency, days: number[], lang: string): string {
  if (freq === 'none') return '';
  const dayLabels = lang === 'cs' ? WEEKDAYS_CS : WEEKDAYS_EN;
  if (freq === 'daily') return lang === 'cs' ? 'Každý den' : 'Every day';
  if (freq === 'monthly') return lang === 'cs' ? 'Každý měsíc' : 'Every month';
  const selectedDays = days.map((d) => dayLabels[d]).join(', ');
  if (freq === 'weekly') return lang === 'cs' ? `Každý týden: ${selectedDays}` : `Every week: ${selectedDays}`;
  return lang === 'cs' ? `Každý druhý týden: ${selectedDays}` : `Every 2 weeks: ${selectedDays}`;
}

export default function RecurrenceEditor({ value, onChange, startDate }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('cs') ? 'cs' : 'en';
  const labels = lang === 'cs' ? WEEKDAYS_CS : WEEKDAYS_EN;

  // Default the day-of-week selection to the event's start day
  const defaultDay = startDate ? (new Date(startDate + 'T12:00:00').getDay() + 6) % 7 : 0; // 0=Mon

  const parsed = parseRRule(value);
  const [freq, setFreq] = useState<Frequency>(parsed.freq);
  const [days, setDays] = useState<number[]>(parsed.days.length > 0 ? parsed.days : [defaultDay]);
  const [endMode, setEndMode] = useState<'never' | 'until' | 'count'>(
    parsed.until ? 'until' : parsed.count ? 'count' : 'never'
  );
  const [until, setUntil] = useState<string | null>(parsed.until);
  const [count, setCount] = useState<string>(parsed.count);

  // When startDate changes, update default day selection (only if user hasn't customized it)
  useEffect(() => {
    if (!value && startDate) {
      const d = (new Date(startDate + 'T12:00:00').getDay() + 6) % 7;
      setDays([d]);
    }
  }, [startDate, value]);

  // Propagate changes upward
  useEffect(() => {
    const rrule = buildRRule(freq, days, endMode === 'until' ? until : null, endMode === 'count' ? count : '');
    onChange(rrule);
  }, [freq, days, endMode, until, count]);

  const toggleDay = (d: number) => {
    setDays((prev) =>
      prev.includes(d) ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d].sort()
    );
  };

  const FREQ_OPTIONS: { id: Frequency; label: string }[] = [
    { id: 'none', label: lang === 'cs' ? 'Bez opakování' : 'No repeat' },
    { id: 'daily', label: lang === 'cs' ? 'Každý den' : 'Daily' },
    { id: 'weekly', label: lang === 'cs' ? 'Každý týden' : 'Weekly' },
    { id: 'biweekly', label: lang === 'cs' ? 'Každé 2 týdny' : 'Every 2 weeks' },
    { id: 'monthly', label: lang === 'cs' ? 'Každý měsíc' : 'Monthly' },
  ];

  const showDayPicker = freq === 'weekly' || freq === 'biweekly';
  const preview = humanReadable(freq, days, lang);

  return (
    <div className="space-y-3">
      <label className="label flex items-center gap-1.5">
        <RefreshCw size={14} className="text-ink-muted" />
        {lang === 'cs' ? 'Opakování' : 'Recurrence'}
      </label>

      {/* Frequency selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {FREQ_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFreq(id)}
            className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-all text-center ${
              freq === id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-ink-muted hover:border-primary/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Day of week picker */}
      {showDayPicker && (
        <div>
          <p className="text-xs text-ink-muted mb-1.5">{lang === 'cs' ? 'Dny v týdnu' : 'Days of week'}</p>
          <div className="flex gap-1">
            {labels.map((label, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => toggleDay(idx)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  days.includes(idx)
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-ink-muted hover:border-primary/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* End condition */}
      {freq !== 'none' && (
        <div className="space-y-2">
          <p className="text-xs text-ink-muted">{lang === 'cs' ? 'Konec opakování' : 'Ends'}</p>
          <div className="flex gap-1.5">
            {([
              { id: 'never', label: lang === 'cs' ? 'Bez konce' : 'Never' },
              { id: 'until', label: lang === 'cs' ? 'Do data' : 'Until' },
              { id: 'count', label: lang === 'cs' ? 'Počet' : 'Count' },
            ] as { id: 'never' | 'until' | 'count'; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setEndMode(id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  endMode === id
                    ? 'bg-surface-overlay border-primary text-primary'
                    : 'border-border text-ink-muted hover:border-primary/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {endMode === 'until' && (
            <DatePicker
              value={until ?? ''}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(v) => setUntil(v || null)}
            />
          )}

          {endMode === 'count' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={200}
                className="input w-24"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="10"
              />
              <span className="text-sm text-ink-muted">{lang === 'cs' ? 'opakování' : 'occurrences'}</span>
            </div>
          )}
        </div>
      )}

      {/* Human-readable preview */}
      {preview && (
        <p className="text-xs text-primary font-medium bg-primary/8 px-3 py-1.5 rounded-lg">
          🔄 {preview}
        </p>
      )}
    </div>
  );
}
