/**
 * UserPickerRow — rich user label for dropdowns, checkboxes and button lists.
 * Shows nickname (full name), role in Czech, age and relationship so users
 * with the same first name can be immediately distinguished.
 */
import React from 'react';

const ROLE_LABEL_CS: Record<string, string> = {
  PARENT:      'rodič',
  GRANDPARENT: 'prarodič',
  RELATIVE:    'příbuzný',
  KID:         'dítě',
  GUEST:       'host',
};

export interface UserLike {
  id: string;
  name: string;
  nickname?: string | null;
  role: string;
  dateOfBirth?: string | null;
  relationship?: string | null;
  isActive?: boolean;
}

export function userAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

/** Two-line user label: name on top, meta (role · age · relationship) below */
export function UserPickerRow({ u }: { u: UserLike }) {
  const age   = userAge(u.dateOfBirth);
  const label = ROLE_LABEL_CS[u.role] ?? u.role;
  const displayName = u.nickname ? `${u.nickname} (${u.name})` : u.name;
  const meta = [label, age !== null ? `${age} let` : null, u.relationship ?? null]
    .filter(Boolean)
    .join(' · ');

  return (
    <span className="flex flex-col min-w-0 text-left">
      <span className="text-xs font-semibold text-ink truncate leading-tight">{displayName}</span>
      {meta && <span className="text-[10px] text-ink-faint leading-tight truncate">{meta}</span>}
    </span>
  );
}

/** Compact single-line variant for narrow contexts (e.g. select option text) */
export function userDisplayName(u: UserLike): string {
  const age   = userAge(u.dateOfBirth);
  const label = ROLE_LABEL_CS[u.role] ?? u.role;
  const base  = u.nickname ? `${u.nickname} (${u.name})` : u.name;
  const parts = [label, age !== null ? `${age} let` : null, u.relationship ?? null]
    .filter(Boolean)
    .join(', ');
  return parts ? `${base} — ${parts}` : base;
}
