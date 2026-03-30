/**
 * Custom Hook: useSearchDebounce
 * Provides debounced search with React's useTransition
 * Prevents excessive re-renders while typing
 */

import { useState, useTransition, useCallback, useEffect } from 'react';

/**
 * @param {number} delayMs - Debounce delay in milliseconds (default: 300)
 * @returns {object} { searchTerm, debouncedTerm, setSearchTerm, isPending }
 */
export function useSearchDebounce(delayMs = 300) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedTerm(searchTerm);
      });
    }, delayMs);

    return () => clearTimeout(timer);
  }, [searchTerm, delayMs]);

  const clear = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    debouncedTerm,
    isPending,
    clear
  };
}

export default useSearchDebounce;
