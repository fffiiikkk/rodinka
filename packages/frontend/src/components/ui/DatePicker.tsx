/**
 * DatePicker — mobile-first calendar dropdown, visually matched to TimePicker.
 *
 * Props:
 *   value    "YYYY-MM-DD"
 *   onChange (val: string) => void
 *   min / max  optional "YYYY-MM-DD" bounds
 */
import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

interface Props {
  value: string;
  onChange: (val: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
}

const DAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const MONTHS = [
  'Leden','Únor','Březen','Duben','Květen','Červen',
  'Červenec','Srpen','Září','Říjen','Listopad','Prosinec',
];

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(s: string): string {
  const d = parseDate(s);
  if (!d) return '';
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday-based weekday index (0=Mon … 6=Sun) */
function weekday(d: Date) {
  return (d.getDay() + 6) % 7;
}

export default function DatePicker({ value, onChange, min, max, placeholder = 'Vyber datum' }: Props) {
  const today = toYMD(new Date());
  const selected = parseDate(value);

  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [viewYear, setViewYear]   = useState(() => selected?.getFullYear()  ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selected?.getMonth()     ?? new Date().getMonth());
  const ref = useRef<HTMLDivElement>(null);

  // Sync view when value changes externally
  useEffect(() => {
    if (selected) { setViewYear(selected.getFullYear()); setViewMonth(selected.getMonth()); }
  }, [value]);

  // Position dropdown
  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setAlignRight(window.innerWidth - rect.left < 300);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (ymd: string) => {
    onChange(ymd);
    setOpen(false);
  };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const leadingBlanks = weekday(firstDay);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const cells: (string | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => {
      const d = i + 1;
      return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const isDisabled = (ymd: string) =>
    (min != null && ymd < min) || (max != null && ymd > max);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input flex items-center gap-2 w-full text-left"
      >
        <CalendarDays size={16} className="text-ink-muted shrink-0" />
        {value ? (
          <span className="font-semibold text-ink">{formatDisplay(value)}</span>
        ) : (
          <span className="text-ink-faint">{placeholder}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute z-50 mt-2 w-72 bg-surface rounded-2xl shadow-modal border border-border overflow-hidden ${alignRight ? 'right-0' : 'left-0'}`}>

            {/* Month navigation */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <button
                type="button"
                onClick={prevMonth}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface-raised active:scale-95 transition-all text-ink-muted"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => { setViewYear(new Date().getFullYear()); setViewMonth(new Date().getMonth()); }}
                className="text-sm font-bold text-ink hover:text-primary transition-colors"
              >
                {MONTHS[viewMonth]} {viewYear}
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface-raised active:scale-95 transition-all text-ink-muted"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 px-2 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-ink-faint py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 px-2 pb-3 gap-y-0.5">
              {cells.map((ymd, i) => {
                if (!ymd) return <div key={i} />;
                const isSelected = ymd === value;
                const isToday    = ymd === today;
                const disabled   = isDisabled(ymd);
                return (
                  <button
                    key={ymd}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectDay(ymd)}
                    className={`
                      h-9 w-full rounded-xl text-sm font-semibold transition-all active:scale-95
                      ${disabled ? 'opacity-25 cursor-not-allowed' : 'hover:bg-primary/15'}
                      ${isSelected ? 'bg-primary text-white shadow-sm' : ''}
                      ${isToday && !isSelected ? 'text-primary ring-1 ring-primary/40' : ''}
                      ${!isSelected && !isToday ? 'text-ink' : ''}
                    `}
                  >
                    {parseInt(ymd.slice(8), 10)}
                  </button>
                );
              })}
            </div>

            {/* Quick: Today / Clear */}
            <div className="flex gap-2 px-3 pb-3">
              <button
                type="button"
                onClick={() => selectDay(today)}
                className="flex-1 py-1.5 rounded-xl bg-surface-raised text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                Dnes
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => { onChange(''); setOpen(false); }}
                  className="flex-1 py-1.5 rounded-xl bg-surface-raised text-xs font-semibold text-ink-muted hover:bg-danger/10 hover:text-danger transition-colors"
                >
                  Smazat
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
