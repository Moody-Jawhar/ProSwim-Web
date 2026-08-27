// Per-student "AI overview" panel on the student detail page. Runs the
// on-device neural network (src/insights) over the student's history and
// shows risk gauges + worded findings. Self-fetching; hides itself if the
// data cannot be loaded, same contract as ProgramsEnrolled.

import { useEffect, useState } from 'react';
import {
  Sparkles, Loader2, TrendingUp, TrendingDown, Info, AlertTriangle,
  MessageCircle, Bell, Send, X, CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../api/portalApi';
import {
  buildStudentOverview, draftOutreach, type StudentOverview, type InsightTone, type OutputName,
} from '../insights/engine';

const TONE_STYLE: Record<InsightTone, { text: string; chip: string; Icon: typeof Info }> = {
  positive: { text: 'text-emerald-700', chip: 'bg-emerald-50 border-emerald-200', Icon: TrendingUp },
  info: { text: 'text-[#1e5c97]', chip: 'bg-[#e8f0f8] border-[#1e5c97]/20', Icon: Info },
  warn: { text: 'text-amber-700', chip: 'bg-amber-50 border-amber-200', Icon: TrendingDown },
  alert: { text: 'text-red-700', chip: 'bg-red-50 border-red-200', Icon: AlertTriangle },
};

const GAUGES: { key: OutputName; label: string }[] = [
  { key: 'attendanceRisk', label: 'Attendance risk' },
  { key: 'churnRisk', label: 'Churn risk' },
  { key: 'paymentRisk', label: 'Payment risk' },
  { key: 'renewalDue', label: 'Renewal due' },
];

function gaugeColor(v: number): string {
  if (v >= 0.6) return 'text-red-600';
  if (v >= 0.35) return 'text-amber-600';
  return 'text-emerald-600';
}

function barColor(v: number): string {
  if (v >= 0.6) return 'bg-red-500';
  if (v >= 0.35) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function AiStudentOverview({ studentId, studentFullName, startingDate, phone }: {
  studentId: string;
  studentFullName: string;
  startingDate: string | null;
  phone?: string;
}) {
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);

  useEffect(() => {
    buildStudentOverview(studentId, studentFullName, startingDate)
      .then(setOverview)
      .catch(() => setFailed(true));
  }, [studentId, studentFullName, startingDate]);

  if (failed) return null; // the rest of the page still works

  return (
    <div className="mb-4 relative overflow-hidden rounded-2xl border border-[#1e5c97]/15 shadow-soft p-5 bg-gradient-to-br from-white via-[#eaf2fb] to-[#dcebfb]">
      <div className="pointer-events-none absolute -bottom-16 -right-10 w-48 h-48 rounded-full bg-gradient-to-br from-[#2d7dc4] to-[#1e5c97] opacity-10 blur-3xl" />

      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md bg-gradient-to-br from-[#2d7dc4] to-[#1e5c97]">
          <Sparkles className="size-5" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">AI overview</p>
          <p className="text-sm font-semibold text-slate-700">
            On-device model — the student's data never leaves the portal
          </p>
        </div>
      </div>

      {!overview ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="size-4 text-[#1e5c97] animate-spin" />
          <p className="text-sm text-slate-400">Reading this student's history…</p>
        </div>
      ) : (
        <>
          {/* Risk gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {GAUGES.map(({ key, label }) => {
              const v = overview.scores[key];
              return (
                <div key={key} className="bg-white/70 rounded-xl border border-slate-100 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                    <p className={`text-sm font-extrabold tabular-nums ${gaugeColor(v)}`}>{Math.round(v * 100)}%</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                    <div className={`h-full rounded-full ${barColor(v)}`} style={{ width: `${Math.round(v * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Findings */}
          <div className="space-y-2 mb-4">
            {overview.insights.map((item) => {
              const tone = TONE_STYLE[item.tone];
              return (
                <div key={item.id} className={`flex items-start gap-2.5 rounded-xl border p-3 ${tone.chip}`}>
                  <tone.Icon className={`size-4 shrink-0 mt-0.5 ${tone.text}`} />
                  <div>
                    <p className={`text-sm font-bold ${tone.text}`}>{item.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI outreach — message drafted from the strongest signal */}
          <div className="flex flex-wrap items-center gap-2">
            {phone && phone.replace(/\D/g, '').length >= 6 && (
              <a
                href={`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(draftOutreach(overview, studentFullName).message)}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2"
              >
                <MessageCircle className="size-4" /> Contact on WhatsApp
              </a>
            )}
            <button
              onClick={() => setNotifyOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-semibold px-4 py-2"
            >
              <Bell className="size-4" /> Send app notification
            </button>
            <p className="text-[11px] text-slate-400">Message pre-written by the model from this student's signals — edit before sending.</p>
          </div>

          {notifyOpen && (
            <NotifyDialog
              studentId={Number(studentId)}
              studentName={studentFullName}
              draft={draftOutreach(overview, studentFullName)}
              onClose={() => setNotifyOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Push-notification dialog with the AI draft prefilled ────────────────────

function NotifyDialog({ studentId, studentName, draft, onClose }: {
  studentId: number;
  studentName: string;
  draft: { title: string; message: string };
  onClose: () => void;
}) {
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.message);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ recipients: number; pushed: number; pushWarning?: string | null } | null>(null);
  const [error, setError] = useState('');

  async function send() {
    if (body.trim().length < 5) { setError('Message is too short.'); return; }
    setSending(true);
    setError('');
    try {
      const res = await apiRequest<{ recipients: number; pushed: number; pushWarning?: string | null }>(
        '/api/portal/notify/announce', {
          method: 'POST',
          body: JSON.stringify({ studentId, title: title.trim(), body: body.trim(), urgent: false, allowAll: false }),
        });
      setResult(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not send the notification.';
      // The targets proc only returns swimmers reachable in the app — explain
      // the common case instead of parroting the raw server text.
      setError(msg.toLowerCase().includes('no recipients')
        ? 'This student has no ProSwim app account to notify — they may never have signed in on a phone. Use WhatsApp instead.'
        : msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Bell className="size-4 text-[#1e5c97]" /> App notification
          </p>
          <button onClick={onClose}><X className="size-5 text-slate-400 hover:text-slate-600" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-3">To {studentName} — drafted by the AI from their signals, edit freely.</p>

        {result ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700">
                Delivered to {studentName}'s in-app inbox
                {result.pushed > 0 ? ' and pushed to their phone.' : '.'}
              </p>
            </div>
            {result.pushWarning && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">{result.pushWarning}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold mb-2 focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40" />
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-slate-200 text-sm font-semibold px-4 py-2">Cancel</button>
              <button onClick={send} disabled={sending}
                className="flex items-center gap-1.5 rounded-lg bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-semibold px-5 py-2 disabled:opacity-50">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
