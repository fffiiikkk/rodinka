import type { Role } from '../types/index.js';

export const GUARDIAN_ROLES: Role[] = ['PARENT', 'GRANDPARENT', 'RELATIVE'];
export const ADMIN_ROLES: Role[] = ['PARENT'];
export const ALL_ROLES: Role[] = ['PARENT', 'GRANDPARENT', 'RELATIVE', 'KID', 'GUEST'];

export const ROLE_LABELS_CS: Record<Role, string> = {
  PARENT: 'Rodič',
  GRANDPARENT: 'Prarodič',
  RELATIVE: 'Příbuzný',
  KID: 'Dítě',
  GUEST: 'Host',
};

export const ROLE_LABELS_EN: Record<Role, string> = {
  PARENT: 'Parent',
  GRANDPARENT: 'Grandparent',
  RELATIVE: 'Relative',
  KID: 'Kid',
  GUEST: 'Guest',
};

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

export function isGuardian(role: Role): boolean {
  return GUARDIAN_ROLES.includes(role);
}

export function canEditEvents(role: Role): boolean {
  return role === 'PARENT' || role === 'GRANDPARENT' || role === 'RELATIVE';
}

export function canProposeEvents(role: Role): boolean {
  return role === 'KID';
}
