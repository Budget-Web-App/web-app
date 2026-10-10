import { useEffect, useRef, useState } from 'react';
import { currentMonth, monthLabel, shiftMonth } from './format';

const NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Previous/next arrows around the month picker, shared by the views that navigate months. */
export function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="month-switcher">
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Previous month"
      >
        ‹
      </button>
      <MonthPicker month={month} onChange={onChange} />
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label="Next month"
      >
        ›
      </button>
    </div>
  );
}

/** Month and year title that opens a year-and-month calendar grid, like YNAB's. */
export function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setYear(Number(month.slice(0, 4)));
  }, [open, month]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const pick = (value: string) => {
    onChange(value);
    setOpen(false);
  };
  const now = currentMonth();

  return (
    <div className="month-picker-wrap" ref={ref}>
      <h2 className="month-title">
        <button
          className="month-title-btn"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {monthLabel(month)}
          <svg className="chev" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>
      </h2>
      {open && (
        <div className="month-pop" role="dialog" aria-label="Choose month">
          <div className="month-pop-head">
            <button className="btn btn-ghost btn-icon" onClick={() => setYear(year - 1)} aria-label="Previous year">‹</button>
            <strong>{year}</strong>
            <button className="btn btn-ghost btn-icon" onClick={() => setYear(year + 1)} aria-label="Next year">›</button>
          </div>
          <div className="month-grid-pick">
            {NAMES.map((name, i) => {
              const value = `${year}-${String(i + 1).padStart(2, '0')}`;
              const cls = `month-cell${value === month ? ' selected' : ''}${value === now ? ' today' : ''}`;
              return (
                <button key={value} className={cls} aria-pressed={value === month} onClick={() => pick(value)}>
                  {name}
                </button>
              );
            })}
          </div>
          <button className="btn-link month-pop-today" onClick={() => pick(now)}>Jump to this month</button>
        </div>
      )}
    </div>
  );
}
