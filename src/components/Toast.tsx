// Lightweight global toasts. Call toast.success()/error()/info() from anywhere;
// <ToastHost/> (mounted once in the Shell) renders them fixed to the viewport,
// so save feedback is always visible regardless of scroll position.

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string }

let seq = 0;
function emit(kind: ToastKind, message: string) {
  if (!message) return;
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { id: ++seq, kind, message } }));
}

export const toast = {
  success: (m: string) => emit('success', m),
  error: (m: string) => emit('error', m),
  info: (m: string) => emit('info', m),
};

const STYLES: Record<ToastKind, { icon: typeof Info; ring: string; text: string; iconCls: string }> = {
  success: { icon: CheckCircle2, ring: 'border-emerald-200', text: 'text-emerald-800', iconCls: 'text-emerald-600' },
  error: { icon: AlertCircle, ring: 'border-red-200', text: 'text-red-700', iconCls: 'text-red-500' },
  info: { icon: Info, ring: 'border-slate-200', text: 'text-slate-700', iconCls: 'text-[#1e5c97]' },
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const h = (e: Event) => {
      const t = (e as CustomEvent<ToastItem>).detail;
      setItems((x) => [...x, t]);
      const ttl = t.kind === 'error' ? 6000 : 3500;
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), ttl);
    };
    window.addEventListener('app:toast', h);
    return () => window.removeEventListener('app:toast', h);
  }, []);

  function dismiss(id: number) { setItems((x) => x.filter((i) => i.id !== id)); }

  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[120] flex flex-col gap-2 w-[min(92vw,22rem)]">
      {items.map((t) => {
        const s = STYLES[t.kind];
        const Ic = s.icon;
        return (
          <div key={t.id}
            role="status"
            className={`flex items-start gap-2.5 rounded-xl border ${s.ring} bg-white shadow-lg px-3.5 py-3 animate-[slideIn_.18s_ease-out]`}
            style={{ animationName: 'none' }}>
            <Ic className={`size-4 shrink-0 mt-0.5 ${s.iconCls}`} />
            <p className={`flex-1 text-sm ${s.text}`}>{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-slate-300 hover:text-slate-500 shrink-0" title="Dismiss">
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
