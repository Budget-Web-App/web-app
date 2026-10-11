import { ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLatest } from './hooks';

/**
 * Modal built on the native <dialog> element. The browser supplies the focus
 * trap, inert background, Escape handling, top-layer stacking and focus
 * restoration. Mark the element that should take focus first with
 * `data-autofocus`; otherwise the browser picks the first focusable one.
 */
export function Modal({
  title,
  description,
  onClose,
  size = 'sm',
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useLatest(onClose);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // React removes the node before this cleanup runs, so restore focus by hand.
    const opener = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal modal-${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onCloseRef.current();
      }}
      // A click that lands on the dialog itself, not its content, is a backdrop click.
      onClick={(e) => e.target === e.currentTarget && onCloseRef.current()}
    >
      <div className="modal-inner">
        <h2 id={titleId}>{title}</h2>
        {description && (
          <p id={descId} className="modal-description">
            {description}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

/**
 * Promise-based replacement for window.confirm:
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title, message }))) return;
 * Render `confirmDialog` once anywhere in the component.
 */
export function useConfirm() {
  const [pending, setPending] = useState<{
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  );

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const dialog = pending && (
    <Modal title={pending.options.title} onClose={() => settle(false)}>
      <p className="modal-body">{pending.options.message}</p>
      <div className="modal-actions">
        <button type="button" className="btn" data-autofocus onClick={() => settle(false)}>
          Cancel
        </button>
        <button
          type="button"
          className={pending.options.danger ? 'btn btn-primary btn-destructive' : 'btn btn-primary'}
          onClick={() => settle(true)}
        >
          {pending.options.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </Modal>
  );

  return [confirm, dialog] as const;
}
