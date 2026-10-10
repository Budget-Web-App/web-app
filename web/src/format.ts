export function formatMoney(minor: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(minor / 100);
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const shifted = new Date(year, monthIndex - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

export function monthOptions(currentMonthValue: string): { value: string; label: string }[] {
  const [currentYear, currentMonthIndex] = currentMonthValue.split('-').map(Number);
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const options: { value: string; label: string }[] = [];
  
  // Generate ±12 months from current month
  for (let delta = -12; delta <= 12; delta++) {
    const date = new Date(currentYear, currentMonthIndex - 1 + delta, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  
  // Add "Today" option if not already in the list
  if (!options.some((opt) => opt.value === todayValue)) {
    const todayLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.unshift({ value: todayValue, label: `${todayLabel} (Today)` });
  }
  
  return options;
}
