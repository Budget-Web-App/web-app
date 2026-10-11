import { AccountType } from '../../lib/api';
import { parseMoney } from '../../lib/format';

export const TYPES: { id: AccountType; label: string; hint: string }[] = [
  { id: 'checking', label: 'Checking', hint: 'Day-to-day spending' },
  { id: 'savings', label: 'Savings', hint: 'Money set aside' },
  { id: 'credit', label: 'Credit card', hint: 'Spend now, pay later' },
];

export const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.id, t.label])) as Record<
  AccountType,
  string
>;

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** "1,200.50" -> 120050; a leading "-" means overdrawn. Null when it is not an amount. */
export function parseBalance(raw: string): number | null {
  const negative = raw.trim().startsWith('-');
  const minor = parseMoney(raw.replace('-', ''));
  return minor === null ? null : negative ? -minor : minor;
}

/** What a typed balance means for an account: a card balance is money owed, so it is negative. */
export const signedBalance = (type: AccountType, parsed: number) =>
  type === 'credit' ? -Math.abs(parsed) : parsed;

export const reconciledKey = (budgetId: string, accountId: string) =>
  `onebudget:reconciled:${budgetId}:${accountId}`;
