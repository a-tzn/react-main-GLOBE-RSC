import { useEffect, useState } from 'react';

export default function useSmartProgress(isLoading) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval;
    let completeTimeout;

    if (isLoading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((oldProgress) => {
          if (oldProgress < 80) return Math.min(80, oldProgress + Math.random() * 15);
          if (oldProgress < 95) return Math.min(95, oldProgress + Math.random() * 0.5);
          return oldProgress;
        });
      }, 500);
    } else {
      setProgress(100);
      completeTimeout = setTimeout(() => setProgress(0), 350);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (completeTimeout) clearTimeout(completeTimeout);
    };
  }, [isLoading]);

  return Math.max(0, Math.min(100, progress));
}
