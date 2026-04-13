import { useEffect, useState } from 'react';

export default function useNetworkPing(intervalMs = 10000) {
  const [ping, setPing] = useState(0);
  const [status, setStatus] = useState('good');

  useEffect(() => {
    let cancelled = false;

    const checkPing = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!cancelled) setStatus('offline');
        return;
      }

      const startTime = performance.now();
      try {
        await fetch(`https://www.google.com/favicon.ico?${Math.random()}`, {
          mode: 'no-cors',
          cache: 'no-store'
        });

        const latency = Math.round(performance.now() - startTime);
        if (cancelled) return;

        setPing(latency);
        if (latency < 100) setStatus('good');
        else if (latency < 300) setStatus('fair');
        else setStatus('poor');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    };

    checkPing();
    const interval = setInterval(checkPing, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [intervalMs]);

  return { ping, status };
}
