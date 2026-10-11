import { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigate } from './router';

/**
 * A real anchor that routes on the client. Because it is an <a href>, open in
 * new tab, copy link, middle-click and screen-reader link lists all work.
 */
export function Link({
  to,
  replace,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; replace?: boolean }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
    if (e.defaultPrevented || e.button !== 0 || modified) return;
    if (rest.target && rest.target !== '_self') return;
    e.preventDefault();
    navigate(to, { replace });
  };
  return <a {...rest} href={to} onClick={handle} />;
}
