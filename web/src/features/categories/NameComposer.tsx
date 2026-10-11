import { FormEvent, useEffect, useRef, useState } from 'react';
import { MAX_NAME_LENGTH, NameKind, validateName } from './categoryName';
import { errorMessage } from '../../lib/api';

export function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

/**
 * Inline "add a name" control shared by categories and groups. It rests as a
 * quiet trigger and expands in place into a composer: Enter adds and keeps the
 * field open for quick entry, Escape or Cancel collapses it.
 */
export function NameComposer({
  kind,
  triggerLabel,
  placeholder,
  ariaLabel,
  existing,
  onAdd,
  defaultOpen = false,
  variant = 'row',
  closeOnAdd = false,
}: {
  kind: NameKind;
  triggerLabel: string;
  placeholder: string;
  ariaLabel: string;
  existing: string[];
  onAdd: (name: string) => Promise<void>;
  defaultOpen?: boolean;
  variant?: 'row' | 'block';
  /** Collapse after a successful add, for callers that continue elsewhere. */
  closeOnAdd?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(null), 2500);
    return () => window.clearTimeout(timer);
  }, [added]);

  const close = (restore = true) => {
    restoreFocus.current = restore;
    setOpen(false);
    setValue('');
    setProblem(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const issue = validateName(value, existing, kind);
    if (issue) {
      setProblem(issue);
      inputRef.current?.focus();
      return;
    }
    const name = value.trim();
    setPending(true);
    try {
      await onAdd(name);
      if (closeOnAdd) {
        close(false);
        return;
      }
      setValue('');
      setProblem(null);
      setAdded(name);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={`composer-trigger ${variant}`}
        onClick={() => setOpen(true)}
        aria-expanded={false}
      >
        <PlusIcon />
        {triggerLabel}
      </button>
    );
  }

  const problemId = `${ariaLabel.replace(/\W+/g, '-').toLowerCase()}-problem`;
  return (
    <form
      className={`composer ${variant}`}
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
      noValidate
    >
      <div className="composer-fields">
        <input
          ref={inputRef}
          className={`input${problem ? ' invalid' : ''}`}
          placeholder={placeholder}
          value={value}
          maxLength={MAX_NAME_LENGTH + 20}
          onChange={(e) => {
            setValue(e.target.value);
            if (problem) setProblem(null);
          }}
          aria-label={ariaLabel}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          readOnly={pending}
          aria-busy={pending || undefined}
          autoComplete="off"
        />
        <button className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? 'Adding…' : 'Add'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => close()}>
          {added ? 'Done' : 'Cancel'}
        </button>
      </div>
      <div className="composer-meta" aria-live="polite">
        {problem ? (
          <span id={problemId} className="composer-problem" role="alert">{problem}</span>
        ) : added ? (
          <span className="composer-added">Added “{added}”. Type another, or press Esc.</span>
        ) : (
          <span className="muted">Press Enter to add, Esc to close.</span>
        )}
      </div>
    </form>
  );
}
