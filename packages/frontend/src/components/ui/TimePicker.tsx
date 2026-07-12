/**
 * TimePicker — mobile-first drum-style time selector.
 *
 * Shows a 2-column (hour / minute) selector with:
 *   – tap-to-change buttons (▲ / ▼)
 *   – quick-time grid for common slots
 *   – 5-minute minute steps
 */
import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, Clock } from 'lucide-react';

interface Props {
  value: string;          // "HH:MM"
  onChange: (val: string) => void;
  label?: string;
}

const QUICK_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const QUICK_MINUTES = [0, 15, 30, 45];

function pad(n: number) { return String(n).padStart(2, '0'); }

function parseTime(val: string): [number, number] {
  const [h, m] = val.split(':').map(Number);
  return [isNaN(h) ? 9 : h, isNaN(m) ? 0 : m];
}

export default function TimePicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'drum' | 'quick'>('drum');
  const [alignRight, setAlignRight] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  // Decide dropdown alignment based on available space when opening
  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dropdownWidth = 288; // w-72
    // If enough space to the right, align left; otherwise align right
    const spaceRight = window.innerWidth - rect.left;
    setAlignRight(spaceRight < dropdownWidth + 16);
  }, [open]);

  const [h, m] = parseTime(value);

  const setH = (newH: number) => onChange(`${pad((newH + 24) % 24)}:${pad(m)}`);
  const setM = (newM: number) => {
    // Round to nearest 5
    const snapped = Math.round((((newM % 60) + 60) % 60) / 5) * 5 % 60;
    onChange(`${pad(h)}:${pad(snapped)}`);
  };

  const stepH = (delta: number) => setH(h + delta);
  const stepM = (delta: number) => setM(m + delta * 5);

  // Touch swipe on drum columns
  const touchStartY = useRef<number | null>(null);
  const swipeTarget = useRef<'h' | 'm' | null>(null);

  function onTouchStart(col: 'h' | 'm', e: React.TouchEvent) {
    touchStartY.current = e.touches[0]!.clientY;
    swipeTarget.current = col;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null || !swipeTarget.current) return;
    const dy = touchStartY.current - e.changedTouches[0]!.clientY;
    if (Math.abs(dy) < 10) return;
    const steps = Math.round(dy / 18);
    if (swipeTarget.current === 'h') stepH(steps);
    else stepM(steps);
    touchStartY.current = null;
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center gap-2 w-full text-left font-mono text-lg"
      >
        <Clock size={16} className="text-ink-muted shrink-0" />
        <span className="font-bold tracking-wider text-ink">{pad(h)}:{pad(m)}</span>
      </button>

      {/* Picker dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className={`absolute z-50 mt-2 w-72 bg-surface rounded-2xl shadow-modal border border-border overflow-hidden ${alignRight ? 'right-0' : 'left-0'}`}>
            {/* Tabs */}
            <div className="flex border-b border-border">
              {(['drum', 'quick'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                    tab === t ? 'text-primary border-b-2 border-primary' : 'text-ink-muted'
                  }`}
                >
                  {t === 'drum' ? '🕐 Přesný čas' : '⚡ Rychlé'}
                </button>
              ))}
            </div>

            {tab === 'drum' && (
              <div className="flex items-center justify-center gap-6 py-5 select-none">
                {/* Hours column */}
                <div
                  className="flex flex-col items-center"
                  onTouchStart={(e) => onTouchStart('h', e)}
                  onTouchEnd={onTouchEnd}
                >
                  <button type="button" onClick={() => stepH(1)}
                    className="w-12 h-10 flex items-center justify-center rounded-xl hover:bg-surface-raised active:scale-95 transition-all text-ink-muted">
                    <ChevronUp size={22} />
                  </button>
                  <div className="w-16 h-14 flex items-center justify-center">
                    <span className="text-4xl font-extrabold text-ink tabular-nums">{pad(h)}</span>
                  </div>
                  <button type="button" onClick={() => stepH(-1)}
                    className="w-12 h-10 flex items-center justify-center rounded-xl hover:bg-surface-raised active:scale-95 transition-all text-ink-muted">
                    <ChevronDown size={22} />
                  </button>
                  <span className="text-xs text-ink-faint mt-1">hod</span>
                </div>

                <span className="text-3xl font-black text-ink-muted pb-3">:</span>

                {/* Minutes column */}
                <div
                  className="flex flex-col items-center"
                  onTouchStart={(e) => onTouchStart('m', e)}
                  onTouchEnd={onTouchEnd}
                >
                  <button type="button" onClick={() => stepM(1)}
                    className="w-12 h-10 flex items-center justify-center rounded-xl hover:bg-surface-raised active:scale-95 transition-all text-ink-muted">
                    <ChevronUp size={22} />
                  </button>
                  <div className="w-16 h-14 flex items-center justify-center">
                    <span className="text-4xl font-extrabold text-ink tabular-nums">{pad(m)}</span>
                  </div>
                  <button type="button" onClick={() => stepM(-1)}
                    className="w-12 h-10 flex items-center justify-center rounded-xl hover:bg-surface-raised active:scale-95 transition-all text-ink-muted">
                    <ChevronDown size={22} />
                  </button>
                  <span className="text-xs text-ink-faint mt-1">min</span>
                </div>
              </div>
            )}

            {tab === 'quick' && (
              <div className="p-3">
                <div className="grid grid-cols-4 gap-1.5">
                  {QUICK_HOURS.map((qh) =>
                    QUICK_MINUTES.map((qm) => {
                      const active = qh === h && qm === m;
                      return (
                        <button
                          key={`${qh}-${qm}`}
                          type="button"
                          onClick={() => { onChange(`${pad(qh)}:${pad(qm)}`); setOpen(false); }}
                          className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            active
                              ? 'bg-primary text-white'
                              : 'bg-surface-raised text-ink hover:bg-primary/20'
                          }`}
                        >
                          {pad(qh)}:{pad(qm)}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Confirm */}
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-primary w-full text-sm py-2"
              >
                ✓ {pad(h)}:{pad(m)}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
