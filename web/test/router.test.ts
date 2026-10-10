import { describe, expect, it } from 'vitest';
import { findBudget, matchPath, Route } from '../src/router';

describe('matchPath', () => {
  it('matches the list route', () => {
    expect(matchPath('/')).toEqual({ name: 'list' });
  });

  it('matches a budget and defaults to the Budget tab', () => {
    expect(matchPath('/budgets/bud_1')).toEqual({
      name: 'budget',
      budgetId: 'bud_1',
      tab: 'month',
      accountId: null,
    });
  });

  it('treats /budget as an alias of the Budget tab', () => {
    expect(matchPath('/budgets/bud_1/budget')).toEqual({
      name: 'budget',
      budgetId: 'bud_1',
      tab: 'month',
      accountId: null,
    });
  });

  it('selects the matching tab segment', () => {
    expect(matchPath('/budgets/bud_1/accounts')).toEqual({
      name: 'budget',
      budgetId: 'bud_1',
      tab: 'accounts',
      accountId: null,
    });
    expect(matchPath('/budgets/bud_1/transactions')).toEqual({
      name: 'budget',
      budgetId: 'bud_1',
      tab: 'transactions',
      accountId: null,
    });
    expect(matchPath('/budgets/bud_1/members')).toEqual({
      name: 'budget',
      budgetId: 'bud_1',
      tab: 'members',
      accountId: null,
    });
  });

  it('reads the account query parameter when present', () => {
    expect(matchPath('/budgets/bud_1/transactions?account=acct_1')).toEqual({
      name: 'budget',
      budgetId: 'bud_1',
      tab: 'transactions',
      accountId: 'acct_1',
    });
  });

  it('is null when the account query parameter is absent', () => {
    expect(matchPath('/budgets/bud_1/transactions?month=2026-01')).toEqual({
      name: 'budget',
      budgetId: 'bud_1',
      tab: 'transactions',
      accountId: null,
    });
  });

  it('treats an empty account query parameter as all accounts', () => {
    expect(matchPath('/budgets/bud_1/transactions?account=')).toEqual({
      name: 'budget',
      budgetId: 'bud_1',
      tab: 'transactions',
      accountId: null,
    });
  });

  it('decodes an encoded account id and ignores other parameters', () => {
    expect(
      matchPath('/budgets/bud_1/transactions?account=a%2Fb&month=2026-01'),
    ).toEqual({
      name: 'budget',
      budgetId: 'bud_1',
      tab: 'transactions',
      accountId: 'a/b',
    });
  });

  it('parses the account parameter on a non-transactions budget route', () => {
    expect(matchPath('/budgets/bud_1/accounts?account=acct_1')).toEqual({
      name: 'budget',
      budgetId: 'bud_1',
      tab: 'accounts',
      accountId: 'acct_1',
    });
  });

  it('falls back to unknown for paths outside the table', () => {
    expect(matchPath('/nope')).toEqual({ name: 'unknown' });
    expect(matchPath('/budgets')).toEqual({ name: 'unknown' });
    expect(matchPath('/budgets/bud_1/unknown')).toEqual({ name: 'unknown' });
    expect(matchPath('/budgets/bud_1/accounts/extra')).toEqual({
      name: 'unknown',
    });
  });

  it('ignores trailing slashes', () => {
    expect(matchPath('/budgets/bud_1/')).toEqual({
      name: 'budget',
      budgetId: 'bud_1',
      tab: 'month',
      accountId: null,
    });
    expect(matchPath('/budgets/bud_1/accounts/')).toEqual({
      name: 'budget',
      budgetId: 'bud_1',
      tab: 'accounts',
      accountId: null,
    });
  });

  it('decodes encoded ids', () => {
    expect(matchPath('/budgets/a%2Fb')).toEqual({
      name: 'budget',
      budgetId: 'a/b',
      tab: 'month',
      accountId: null,
    });
    expect(matchPath('/budgets/a%20b/accounts')).toEqual({
      name: 'budget',
      budgetId: 'a b',
      tab: 'accounts',
      accountId: null,
    });
  });

  it('rejects a malformed id encoding', () => {
    expect(matchPath('/budgets/%')).toEqual({ name: 'unknown' });
  });
});

describe('findBudget', () => {
  const route: Route = {
    name: 'budget',
    budgetId: 'bud_1',
    tab: 'month',
    accountId: null,
  };

  it('finds the budget by id, and reports a missing one as null', () => {
    expect(findBudget(route, [{ id: 'bud_1' }, { id: 'bud_2' }])).toEqual({
      id: 'bud_1',
    });
    expect(findBudget(route, [{ id: 'bud_2' }])).toBeNull();
  });

  it('is null while the list is not loaded or the route is not a budget', () => {
    expect(findBudget(route, null)).toBeNull();
    expect(findBudget({ name: 'list' }, [{ id: 'bud_1' }])).toBeNull();
  });
});
