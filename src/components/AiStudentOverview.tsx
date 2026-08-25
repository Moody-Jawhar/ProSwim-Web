// Per-student "AI overview" panel on the student detail page. Runs the
// on-device neural network (src/insights) over the student's history and
// shows risk gauges + worded findings. Self-fetching; hides itself if the
// data cannot be loaded, same contract as ProgramsEnrolled.

import { useEffect, useState } from 'react';
import {
  Sparkles, Loader2, TrendingUp, TrendingDown, Info, AlertTriangle,
} from 'lucide-react';
import {
  buildStudentOverview, type StudentOverview, type InsightTone, type OutputName,
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

export function AiStudentOverview({ studentId, studentFullName, startingDate }: {
  studentId: string;
  studentFullName: string;
  startingDate: string | null;
}) {
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [failed, setFailed] = useState(false);

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
          <div className="space-y-2">
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
        </>
      )}
    </div>
  );
}
