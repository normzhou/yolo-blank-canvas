/**
 * Polling that respects the panel's visibility and the page's visibility.
 *
 * Refreshes never reload the page and never touch typed input: they only bump a
 * token that views observe to re-read records.
 */
import { useEffect, useRef, useState } from 'react';

export const REFRESH_INTERVAL_MS = 30_000;

export function useVisible(enabled: boolean, intervalMs = REFRESH_INTERVAL_MS): number {
  const [token, setToken] = useState(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => {
      if (!enabledRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      setToken((value) => value + 1);
    };
    const timer = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs]);

  return token;
}

export function formatRelativeTime(value: number | string | null | undefined): string {
  if (!value) return 'unknown';
  const time = typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(time)) return 'unknown';
  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatClockTime(value: number | null): string {
  if (!value) return 'never';
  return new Date(value).toLocaleTimeString();
}