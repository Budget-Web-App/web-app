import { ReactNode, useState } from 'react';
import { errorMessage } from '../../lib/api';

/** Pending and error state for one async form action. `run` resolves true on success. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>): Promise<boolean> => {
    if (pending) return false;
    setPending(true);
    setProblem(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setProblem(errorMessage(err));
      return false;
    } finally {
      setPending(false);
    }
  };
  return { pending, problem, setProblem, run };
}

export function Callout({ children }: { children: ReactNode }) {
  return <p className="guide-callout">{children}</p>;
}

/** Quick-fill suggestions. Choosing one fills the field; it never submits. */
export function Ideas({
  label,
  ideas,
  onPick,
}: {
  label: string;
  ideas: string[];
  onPick: (idea: string) => void;
}) {
  if (ideas.length === 0) return null;
  return (
    <div className="guide-ideas" role="group" aria-label={label}>
      <span className="muted small">{label}</span>
      {ideas.map((idea) => (
        <button key={idea} type="button" className="chip chip-sm" onClick={() => onPick(idea)}>
          {idea}
        </button>
      ))}
    </div>
  );
}

export function Problem({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="composer-problem guide-problem" role="alert">
      {children}
    </p>
  );
}
