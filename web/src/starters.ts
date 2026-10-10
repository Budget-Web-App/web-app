import type { AccountType } from './api';

export interface StarterGroup {
  name: string;
  categories: string[];
}

export interface StarterAccount {
  name: string;
  type: AccountType;
}

/** Zero-based starter categories, so a new budget has every dollar a place to go. */
export const starterGroups: StarterGroup[] = [
  {
    name: 'Immediate obligations',
    categories: ['Rent/mortgage', 'Utilities', 'Phone'],
  },
  {
    name: 'Everyday spending',
    categories: ['Groceries', 'Transportation', 'Dining out'],
  },
  {
    name: 'Savings',
    categories: ['Emergency fund', 'Vacation'],
  },
];

export const starterAccounts: StarterAccount[] = [
  { name: 'Checking', type: 'checking' },
  { name: 'Savings', type: 'savings' },
  { name: 'Credit card', type: 'credit' },
];
