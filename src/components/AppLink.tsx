import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigateTo } from '../lib/router';

interface AppLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

export function AppLink({ href, onClick, ...props }: AppLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || props.target === '_blank'
    ) {
      return;
    }

    event.preventDefault();
    navigateTo(href);
  };

  return <a {...props} href={href} onClick={handleClick} />;
}
