import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../lib/api';
import { validateName } from './categoryName';
import { formatMoney, parseMoney } from '../../lib/format';
import { suggestCategoryNames } from './suggestions';

/**
 * A new category drawn as a real row of the budget grid. Name and Assigned sit
 * in their own columns, so adding a category and giving it money is one pass:
 * Enter on the name moves to the amount, Enter on the amount saves and opens a
 * fresh row, Esc closes. The amount is reported upward so Ready to assign can
 * preview the effect while the person types.
 */
export function CategoryDraftRow({
  groupName,
  existing,
  budgetNames,
  currency,
  onAdd,
  onPreview,
  onClose,
}: {
  groupName: string;
  existing: string[];
  budgetNames: string[];
  currency: string;
  onAdd: (name: string, assignMinor: number) => Promise<void>;
  onPreview: (minor: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  useEffect(() => onPreview(parseMoney(amount) ?? 0), [amount]);
  useEffect(() => () => onPreview(0), []);

  const checkName = () => {
    const issue = validateName(name, existing, 'category');
    setProblem(issue);
    if (issue) nameRef.current?.focus();
    return issue === null;
  };

  const submit = async () => {
    if (pending || !checkName()) return;
    const minor = parseMoney(amount);
    if (minor === null) {
      setProblem('Enter an amount such as 250 or 250.50.');
      amountRef.current?.focus();
      return;
    }
    const clean = name.trim();
    setPending(true);
    try {
      await onAdd(clean, minor);
      setName('');
      setAmount('');
      setProblem(null);
      setAdded(clean);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setPending(false);
      nameRef.current?.focus();
    }
  };

  const onNameKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (checkName()) amountRef.current?.focus();
  };

  const onAmountKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    submit();
  };

  const suggestions = suggestCategoryNames(name, budgetNames);

  return (
    <tr
      className="draft-row"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <td>
        <input
          ref={nameRef}
          className={`input${problem ? ' invalid' : ''}`}
          placeholder="New category name"
          aria-label={`New category in ${groupName}`}
          aria-invalid={problem ? true : undefined}
          value={name}
          maxLength={80}
          autoComplete="off"
          readOnly={pending}
          onChange={(e) => {
            setName(e.target.value);
            setAdded(null);
            if (problem) setProblem(null);
          }}
          onKeyDown={onNameKey}
        />
        <div className="draft-meta" aria-live="polite">
          {problem ? (
            <span className="composer-problem" role="alert">{problem}</span>
          ) : added && !name ? (
            <span className="composer-added">Added “{added}”. Add another, or press Esc to finish.</span>
          ) : suggestions.length > 0 ? (
            <span className="draft-suggest">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip chip-sm"
                  onClick={() => {
                    setName(s);
                    setProblem(null);
                    amountRef.current?.focus();
                  }}
                >
                  {s}
                </button>
              ))}
            </span>
          ) : (
            <span className="muted">Enter for the amount, Esc to close.</span>
          )}
        </div>
      </td>
      <td className="right">
        <input
          ref={amountRef}
          className="input amount"
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Assigned this month"
          value={amount}
          readOnly={pending}
          autoComplete="off"
          onChange={(e) => {
            setAmount(e.target.value);
            if (problem) setProblem(null);
          }}
          onKeyDown={onAmountKey}
        />
      </td>
      <td className="right num muted">{formatMoney(0, currency)}</td>
      <td className="right">
        <div className="draft-actions">
          <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={submit}>
            {pending ? 'Adding…' : 'Add'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {added ? 'Done' : 'Cancel'}
          </button>
        </div>
      </td>
    </tr>
  );
}
