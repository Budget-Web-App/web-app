import type { Role } from './api';

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

/** True when `role` has at least the access level of `minimum`. */
export const hasRole = (role: Role, minimum: Role): boolean =>
  RANK[role] >= RANK[minimum];
