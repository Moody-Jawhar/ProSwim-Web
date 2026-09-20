// Returning to a list "as the user left it". List filters live in the URL
// (ModuleListPage mirrors them; custom pages use useUrlParam), so going BACK
// in history restores them, whereas navigating to the bare list route would
// reload it with the defaults.

import { useNavigate } from 'react-router-dom';

// react-router stamps an `idx` into history.state; 0 = the first in-app entry,
// so anything higher means there is an in-app page to go back to.
export function canGoBack(): boolean {
  return typeof window !== 'undefined' && ((window.history.state?.idx ?? 0) > 0);
}

/** After save/cancel: go back to the list the user came from (criteria intact),
 *  or to `fallback` when the page was opened directly (no in-app history). */
export function useBackTo(fallback: string): () => void {
  const navigate = useNavigate();
  return () => { if (canGoBack()) navigate(-1); else navigate(fallback); };
}
