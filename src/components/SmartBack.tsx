// History-aware back link: returns to wherever the user actually came from
// (dashboard quick action, a list page, a schedule cell…), falling back to the
// page's natural parent when the app was opened directly on this page.

import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { canGoBack } from '../lib/history';

export function SmartBack({ label = 'Back', fallback = '/' }: { label?: string; fallback?: string }) {
  const navigate = useNavigate();
  const back = canGoBack();
  return (
    <button
      type="button"
      onClick={() => (back ? navigate(-1) : navigate(fallback))}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1e5c97] mb-2"
    >
      <ArrowLeft className="size-4" /> {label}
    </button>
  );
}
