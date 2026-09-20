// A piece of page state kept in the URL query string instead of useState, so
// it survives leaving the page (edit, another tab, back) and coming back.
// Same [value, set] shape as useState<string> for a drop-in swap.

import { useSearchParams } from 'react-router-dom';

export function useUrlParam(key: string, initial: string): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.has(key) ? (params.get(key) ?? '') : initial;
  const set = (v: string) => {
    const next = new URLSearchParams(params);
    next.set(key, v);
    setParams(next, { replace: true }); // don't flood history while filtering
  };
  return [value, set];
}
