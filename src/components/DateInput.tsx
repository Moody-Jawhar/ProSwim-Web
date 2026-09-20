// Date field that always reads and writes dd/mm/yyyy. The native
// <input type="date"> renders in the browser/OS region order (mm/dd on an
// en-US machine) and that cannot be styled away, so we own the text box and
// keep a hidden native picker only for the calendar popup.
//
// Drop-in for <input type="date">: `value` is ISO yyyy-mm-dd and `onChange`
// receives an event-shaped object, so existing `(e) => set(e.target.value)`
// handlers work unchanged.

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { CalendarDays } from 'lucide-react';

type Native = InputHTMLAttributes<HTMLInputElement>;

interface Props extends Omit<Native, 'value' | 'onChange' | 'type'> {
  value: string; // ISO yyyy-mm-dd or ''
  onChange: (e: { target: { value: string } }) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO yyyy-mm-dd → dd/mm/yyyy ('' when empty/unparseable). */
function toDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** dd/mm/yyyy → ISO yyyy-mm-dd, or null when incomplete or not a real date. */
function toIso(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  // Reject roll-overs like 31/02 → 03/03.
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

export function DateInput({ value, onChange, className, disabled, min, max, ...rest }: Props) {
  const [text, setText] = useState(() => toDisplay(value));
  const picker = useRef<HTMLInputElement>(null);

  // Follow external value changes (defaults, resets, loads).
  useEffect(() => { setText(toDisplay(value)); }, [value]);

  const emit = (iso: string) => onChange({ target: { value: iso } });

  // Auto-insert the slashes while the user types digits; commit as soon as a
  // full valid date is present so filters can auto-apply.
  function handleTyping(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const t =
      digits.length > 4 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
      : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}`
      : digits;
    setText(t);
    if (digits.length === 0) emit('');
    else if (digits.length === 8) { const iso = toIso(t); if (iso) emit(iso); }
  }

  // On blur, snap back to the last good value if what's typed isn't a date.
  function handleBlur() {
    if (text.trim() === '') { emit(''); return; }
    const iso = toIso(text);
    if (iso) emit(iso); else setText(toDisplay(value));
  }

  function openPicker() {
    const el = picker.current;
    if (!el || disabled) return;
    if ('showPicker' in el) el.showPicker(); else el.click();
  }

  return (
    <span className="relative inline-flex items-center">
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={text}
        disabled={disabled}
        onChange={(e) => handleTyping(e.target.value)}
        onBlur={handleBlur}
        className={`${className ?? ''} pr-7`}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={openPicker}
        aria-label="Open calendar"
        className="absolute right-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-40"
      >
        <CalendarDays className="size-3.5" />
      </button>
      {/* Hidden native picker: supplies the calendar popup only. Anchored over the
          icon so the popup opens next to it. */}
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={value}
        min={min}
        max={max}
        onChange={(e) => emit(e.target.value)}
        className="absolute right-0 top-0 h-full w-7 opacity-0 pointer-events-none"
      />
    </span>
  );
}
