import { useEffect, useRef, useState } from 'react';
import { Account, MonthView, api } from '../../lib/api';
import { Loading } from '../../lib/Loading';
import { Modal } from '../../lib/Modal';
import { LESSONS } from './content';
import { STEPS, StepId, factsFrom, hasMoney, isStepDone, openingStep } from './guide';
import { AccountsStep, CategoriesStep, GroupsStep, WelcomeStep } from './StructureSteps';
import { AssignStep, DoneStep, MoneyStep } from './MoneySteps';

export interface SetupGuideProps {
  budgetId: string;
  month: string;
  currency: string;
  view: MonthView;
  busy: boolean;
  open: boolean;
  onStarter: () => void;
  /** Reload the month so every step sees what the last one created. */
  onChanged: () => Promise<void>;
  onClose: () => void;
}

/**
 * Guided first-time setup. Each step teaches one idea, then has the person do
 * it for real: the data lands in their budget, not in a practice mode. Steps
 * can be skipped or revisited, and the guide reopens at the first unfinished one.
 */
export function SetupGuide(props: SetupGuideProps) {
  if (!props.open) return null;
  return <GuideDialog {...props} />;
}

function GuideDialog({
  budgetId,
  month,
  currency,
  view,
  busy,
  onStarter,
  onChanged,
  onClose,
}: SetupGuideProps) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [step, setStep] = useState<StepId | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const loadAccounts = async () => {
    const { accounts } = await api.listAccounts(budgetId);
    setAccounts(accounts);
  };

  useEffect(() => {
    loadAccounts().catch(() => setAccounts([]));
  }, [budgetId]);

  const facts = factsFrom(view, accounts?.length ?? 0);

  // Open where the person left off, once the account count is known.
  useEffect(() => {
    if (accounts && step === null) setStep(openingStep(facts));
  }, [accounts, step]);

  // Announce each new step by moving focus to its heading.
  useEffect(() => {
    if (step) heading.current?.focus();
  }, [step]);

  const index = step ? STEPS.findIndex((s) => s.id === step) : 0;
  const last = STEPS.length - 1;
  const go = (delta: number) => setStep(STEPS[Math.min(last, Math.max(0, index + delta))].id);

  if (!accounts || !step) {
    return (
      <Modal title="Set up your budget" size="lg" onClose={onClose}>
        <Loading />
      </Modal>
    );
  }

  const lesson = LESSONS[step];
  const done = isStepDone(step, facts);
  const title =
    step === 'done' && facts.readyMinor !== 0 ? 'Good start' : lesson.title;

  const body = {
    welcome: <WelcomeStep />,
    groups: (
      <GroupsStep budgetId={budgetId} view={view} busy={busy} onStarter={onStarter} onChanged={onChanged} />
    ),
    categories: <CategoriesStep budgetId={budgetId} view={view} onChanged={onChanged} />,
    accounts: <AccountsStep budgetId={budgetId} accounts={accounts} onAccountsChanged={loadAccounts} />,
    money: (
      <MoneyStep
        budgetId={budgetId}
        month={month}
        currency={currency}
        view={view}
        accounts={accounts}
        onChanged={onChanged}
      />
    ),
    assign: (
      <AssignStep
        budgetId={budgetId}
        month={month}
        currency={currency}
        view={view}
        facts={facts}
        onChanged={onChanged}
      />
    ),
    done: <DoneStep budgetId={budgetId} facts={facts} currency={currency} onClose={onClose} />,
  }[step];

  return (
    <Modal title="Set up your budget" size="lg" onClose={onClose}>
      <nav aria-label="Setup steps">
        <ol className="guide-steps">
          {STEPS.map((s, i) => {
            const complete = isStepDone(s.id, facts);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`guide-step${complete ? ' complete' : ''}`}
                  aria-current={s.id === step ? 'step' : undefined}
                  onClick={() => setStep(s.id)}
                >
                  <span className="guide-step-dot" aria-hidden="true">
                    {complete ? '✓' : i + 1}
                  </span>
                  <span className="guide-step-label">{s.label}</span>
                  {complete && <span className="visually-hidden"> (done)</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="guide-body" aria-labelledby="guide-heading">
        <p className="guide-count muted small">
          Step {index + 1} of {STEPS.length}
        </p>
        <h3 id="guide-heading" ref={heading} tabIndex={-1} className="guide-heading">
          {title}
        </h3>
        <p className="guide-why">{lesson.why}</p>

        {lesson.think && (
          <div className="guide-think">
            <h4>Think about</h4>
            <ul>
              {lesson.think.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="guide-panel">{body}</div>
      </section>

      <div className="guide-actions">
        {step === 'done' ? (
          <span />
        ) : (
          <button type="button" className="btn-link" data-autofocus={step === 'welcome' ? true : undefined} onClick={onClose}>
            {step === 'welcome' ? 'I know how this works' : 'Skip setup'}
          </button>
        )}
        <div className="guide-nav">
          {index > 0 && step !== 'done' && (
            <button type="button" className="btn" onClick={() => go(-1)}>
              Back
            </button>
          )}
          {step !== 'done' && (
            <button
              type="button"
              className={done || step === 'welcome' ? 'btn btn-primary' : 'btn'}
              onClick={() => go(1)}
            >
              {step === 'welcome' ? 'Start setup' : done ? 'Next' : step === 'assign' && hasMoney(facts) ? 'Finish later' : 'Skip for now'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
