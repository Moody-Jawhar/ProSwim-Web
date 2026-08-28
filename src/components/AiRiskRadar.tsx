// Dashboard "AI overview": the on-device neural network scans every active
// registration and ranks the students who most need attention. Replaces the
// old server-generated text summary with instant, explainable scoring.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { buildRiskRadar, type RiskRadar, type RadarEntry } from '../insights/engine';

const RISK_LABEL: Record<RadarEntry['topRisk'], string> = {
  attendance: 'Attendance',
  churn: 'Churn',
  payment: 'Payment',
};

function riskColor(v: number): string {
  if (v >= 0.75) return 'text-red-600 bg-red-50 border-red-200';
  if (v >= 0.55) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-emerald-700 bg-emerald-50 border-emerald-200';
}

export function AiRiskRadar() {
  const [radar, setRadar] = useState<RiskRadar | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    buildRiskRadar()
      .then(setRadar)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not scan registrations.'));
  }, []);

  return (
    <div className="rise-in rise-3 lg:col-span-2 relative overflow-hidden rounded-2xl border border-[#1e5c97]/15 shadow-soft p-6 bg-gradient-to-br from-white via-[#eaf2fb] to-[#dcebfb]">
      <div className="pointer-events-none absolute -bottom-16 -right-10 w-48 h-48 rounded-full bg-gradient-to-br from-[#2d7dc4] to-[#1e5c97] opacity-10 blur-3xl" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md bg-gradient-to-br from-[#2d7dc4] to-[#1e5c97] floaty">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">AI overview</p>
            <p className="text-sm font-semibold text-slate-700">Students who need attention</p>
          </div>
        </div>
        {radar && (
          <p className="text-xs text-slate-400 text-right">
            {radar.scanned.toLocaleString()} active students scanned<br />
            <span className="font-semibold text-slate-500">{radar.flagged.toLocaleString()} flagged</span> · on-device model
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
          <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}

      {!error && !radar && (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="size-4 text-[#1e5c97] animate-spin" />
          <p className="text-sm text-slate-400">Scoring every active registration…</p>
        </div>
      )}

      {radar && radar.entries.length === 0 && (
        <div className="flex items-center gap-2.5 py-2">
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-slate-600">
            No students flagged, attendance and payments look healthy across all active registrations.
          </p>
        </div>
      )}

      {radar && radar.entries.length > 0 && (
        <ul className="space-y-2">
          {radar.entries.map((e) => (
            <li key={`${e.studentId ?? e.name}`}>
              <Link
                to={e.studentId != null
                  ? `/students/${e.studentId}`
                  : `/students?searchFor=${encodeURIComponent(e.name)}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/85 px-3.5 py-2.5 shadow-sm hover:shadow-md hover:border-[#1e5c97]/40 hover:bg-white active:scale-[0.99] transition-all"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 truncate">{e.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {e.reasons.join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-bold rounded-full border px-2 py-0.5 ${riskColor(e.topScore)}`}>
                    {RISK_LABEL[e.topRisk]} {Math.round(e.topScore * 100)}%
                  </span>
                  <ChevronRight className="size-4 text-slate-400" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
