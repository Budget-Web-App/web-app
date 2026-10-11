import { useEffect, useRef } from 'react';

/** Always-current ref to a value, so long-lived listeners never see a stale closure. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** True when the keyboard event came from somewhere the person is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
}

/** Window keydown listener that stays subscribed once while using the latest handler. */
export function useGlobalKey(handler: (e: KeyboardEvent) => void) {
  const latest = useLatest(handler);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => latest.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [latest]);
}

/** Keeps the tab title in step with the screen, so history and screen readers say where you are. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
