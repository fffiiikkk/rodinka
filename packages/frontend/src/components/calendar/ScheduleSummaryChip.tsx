import React, { useState } from 'react';
import { ChevronDown, ChevronUp, School } from 'lucide-react';
import type { ScheduleGroup } from '../../lib/scheduleGroups.js';

interface Props {
  group: ScheduleGroup;
  /** If provided, each block will use this color. Defaults to a blue-ish schedule color. */
  color?: string;
}

export default function ScheduleSummaryChip({ group, color }: Props) {
  const [expanded, setExpanded] = useState(false);
  const bg = color ?? '#3b82f6';

  return (
    <div
      className="rounded-lg overflow-hidden border border-border/60 shadow-sm"
      style={{ borderLeft: `3px solid ${bg}` }}
    >
      {/* Summary header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-surface-overlay transition-colors"
        style={{ background: `${bg}12` }}
      >
        <School size={13} style={{ color: bg }} className="shrink-0" />
        <span className="flex-1 text-xs font-semibold truncate" style={{ color: bg }}>
          🏫 {group.count} {group.count === 1 ? 'hodina' : group.count < 5 ? 'hodiny' : 'hodin'}
          {' '}({group.startTime}–{group.endTime})
        </span>
        {expanded
          ? <ChevronUp size={12} style={{ color: bg }} className="shrink-0" />
          : <ChevronDown size={12} style={{ color: bg }} className="shrink-0" />
        }
      </button>

      {/* Expanded block list */}
      {expanded && (
        <div className="divide-y divide-border/30">
          {group.events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="text-[10px] font-mono text-ink-muted w-11 shrink-0">
                {ev.start.slice(11, 16)}
              </span>
              <span className="text-xs text-ink font-medium truncate flex-1">{ev.title}</span>
              {typeof ev.location === 'string' && ev.location && (
                <span className="text-[10px] text-ink-muted truncate max-w-[80px]">
                  {ev.location}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
