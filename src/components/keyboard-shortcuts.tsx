'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const platform = typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent;
      const isMac = platform.toUpperCase().includes('MAC');
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey) {
        switch (e.key.toLowerCase()) {
          case 'j':
            e.preventDefault();
            router.push('/jobs' as '/jobs');
            break;
          case 'f':
            e.preventDefault();
            router.push('/favorites' as '/favorites');
            break;
          case 'a':
            e.preventDefault();
            router.push('/applications' as '/applications');
            break;
          case 'h':
            e.preventDefault();
            router.push('/' as '/');
            break;
        }
      }

      if (e.key === '/') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[placeholder*="搜索"]');
        input?.focus();
      }

      if (e.key === 'Escape') {
        const modal = document.querySelector<HTMLElement>('[role="dialog"]');
        if (modal) {
          modal.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [router]);

  return null;
}
