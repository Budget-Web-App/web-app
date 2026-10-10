import { useEffect, useState } from 'react';

/** Tab ids match `BudgetDetail`'s component state; the `budget` URL segment maps to `month`. */
export type TabId = 'month' | 'accounts' | 'transactions' | 'members';

/**
 * Route table:
 *   /                                     budget list
 *   /budgets/:budgetId                    budget detail, Budget tab
 *   /budgets/:budgetId/budget             alias of the row above
 *   /budgets/:budgetId/accounts           Accounts tab
 *   /budgets/:budgetId/transactions       Transactions tab, optional ?account= filter
 *   /budgets/:budgetId/members            Members tab
 *   anything else                         budget list (replaceState to /)
 */
export type Route =
  | { name: 'list' }
  | {
      name: 'budget';
      budgetId: string;
      tab: TabId;
      /** Value of the `account` query parameter; null means "all accounts". */
      accountId: string | null;
    };

/** `matchPath` result: a `Route`, or `unknown` for anything outside the table. */
export type Match = Route | { name: 'unknown' };

const TAB_BY_SEGMENT: Record<string, TabId> = {
  budget: 'month',
  accounts: 'accounts',
  transactions: 'transactions',
  members: 'members',
};

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Pure matcher over a path with an optional `?query`. Never touches the DOM, so
 * it is safe to unit-test. The only query parameter it reads is `account`.
 */
export function matchPath(url: string): Match {
  const queryAt = url.indexOf('?');
  const pathname = queryAt === -1 ? url : url.slice(0, queryAt);
  const search = queryAt === -1 ? '' : url.slice(queryAt + 1);

  // Ignore trailing slashes, but keep the root path.
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { name: 'list' };

  const parts = path.split('/');
  if (parts[0] === '' && parts[1] === 'budgets' && parts[2]) {
    const budgetId = decode(parts[2]);
    if (budgetId) {
      const tab =
        parts.length === 3
          ? 'month'
          : parts.length === 4
            ? TAB_BY_SEGMENT[parts[3]]
            : undefined;
      if (tab) {
        // An absent or empty `account` means "all accounts".
        const accountId = new URLSearchParams(search).get('account') || null;
        return { name: 'budget', budgetId, tab, accountId };
      }
    }
  }
  return { name: 'unknown' };
}

/** Resolve a route's budget from the loaded list. Null means absent or not yet loaded. */
export function findBudget<T extends { id: string }>(
  route: Route,
  budgets: readonly T[] | null,
): T | null {
  if (route.name !== 'budget' || !budgets) return null;
  return budgets.find((b) => b.id === route.budgetId) ?? null;
}

const ROUTE_EVENT = 'onebudget:route';

function readRoute(): Route {
  const match = matchPath(window.location.pathname + window.location.search);
  if (match.name === 'unknown') {
    // Unknown paths resolve to the list without leaving a bad URL in history.
    history.replaceState(null, '', '/');
    return { name: 'list' };
  }
  return match;
}

export function navigate(
  path: string,
  { replace = false }: { replace?: boolean } = {},
): void {
  // Skip no-op navigation so a repeated click does not add a dead history entry.
  if (path === window.location.pathname + window.location.search) return;
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener('popstate', sync);
    window.addEventListener(ROUTE_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(ROUTE_EVENT, sync);
    };
  }, []);
  return route;
}
