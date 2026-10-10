import type { Budget, Membership, Role, User } from './types';

export const publicUser = (user: User) => ({
  id: user.id,
  email: user.email,
  name: user.name,
});

export const budgetView = (budget: Budget, role: Role) => ({
  id: budget.id,
  name: budget.name,
  currency: budget.currency,
  ownerId: budget.ownerId,
  role,
  createdAt: budget.createdAt,
});

export const memberView = (membership: Membership, user: User) => ({
  userId: user.id,
  email: user.email,
  name: user.name,
  role: membership.role,
  createdAt: membership.createdAt,
});
