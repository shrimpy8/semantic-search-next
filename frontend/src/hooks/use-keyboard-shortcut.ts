'use client';

import { useEffect, useCallback } from 'react';

type KeyboardShortcutHandler = (event: KeyboardEvent) => void;

interface UseKeyboardShortcutOptions {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  preventDefault?: boolean;
}

export function useKeyboardShortcut(
  handler: KeyboardShortcutHandler,
  options: UseKeyboardShortcutOptions
) {
  const {
    key,
    metaKey = false,
    ctrlKey = false,
    shiftKey = false,
    altKey = false,
    preventDefault = true,
  } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const matchesKey = event.key.toLowerCase() === key.toLowerCase();
      const matchesShift = shiftKey ? event.shiftKey : !event.shiftKey;
      const matchesAlt = altKey ? event.altKey : !event.altKey;

      // Allow Cmd+K or Ctrl+K for cross-platform support
      const isCmdOrCtrl = metaKey || ctrlKey;
      const matchesCmdOrCtrl = isCmdOrCtrl
        ? event.metaKey || event.ctrlKey
        : !event.metaKey && !event.ctrlKey;

      if (matchesKey && matchesCmdOrCtrl && matchesShift && matchesAlt) {
        if (preventDefault) {
          event.preventDefault();
        }
        handler(event);
      }
    },
    [handler, key, metaKey, ctrlKey, shiftKey, altKey, preventDefault]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
