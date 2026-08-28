// Take Attendance, the simple marking flow the legacy
// ClassesSessionsAttendanceList.aspx wrapped in thirty controls:
// tap a student to flip Present/Absent, add a remark where needed, Save.
// Status defaults to Normal; the dropdown appears per row for the exceptions
// (Late / MakeUp / No Suit / Miss Land Training). Make-up visitors from other
// sessions show highlighted and read-only, exactly like legacy.

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2, AlertCircle, Save, Check, X, Users, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { SmartBack } from '../components/SmartBack';

type Row = Record<string, unknown>;

const STATUSES = ['Normal', 'Late', 'MakeUp', 'No Suit', 'Miss Land Training'];

const num = (r: Row, k: string) => Number(r[k] ?? 0);
const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));

interface Mark { attended: boolean; status: string; remarks: string; locationId: number }

export function TakeAttendancePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const user = getStoredUser();
  const canSave = user?.canSave !== false && (user?.userType || '').toLowerCase() !== 'guest';

  const [rows, setRows] = useState<Row[]>([]);
  const [marks, setMarks] = useState<Record<number, Mark>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function hydrate(data: Row[]) {
    setRows(data);
    const m: Record<number, Mark> = {};
    for (const r of data) {
      m[num(r, 'AttendanceId')] = {
        attended: r.AttendanceStudentAttended === true,
        status: str(r, 'AttendanceStatus') || 'Normal',
        remarks: str(r, 'AttendanceRemarks'),
        locationId: num(r, 'AttendanceLocationId'),
      };
    }
    setMarks(m);
  }

  function load() {
    setLoading(true);
    setError('');
    apiRequest<Row[]>(`/api/portal/attendance/session/${sessionId}`)
      .then(hydrate)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the roster.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshStudents() {
    setRefreshing(true);
    setError('');
    try {
      hydrate(await apiRequest<Row[]>(`/api/portal/attendance/session/${sessionId}/refresh`, { method: 'POST' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh the roster.');
    } finally {
      setRefreshing(false);
    }
  }

  const sid = Number(sessionId);
  // Make-up visitors belong to another session, shown, never edited or saved (legacy rule).
  const isVisitor = (r: Row) => num(r, 'AttendanceSessionID') !== 0 && num(r, 'AttendanceSessionID') !== sid;

  const header = rows[0];
  const className = header ? str(header, 'ClassName') : '';
  const sessionDate = header?.SessionDate ? new Date(String(header.SessionDate)).toLocaleDateString() : '';
  const remarksRequired = rows.some((r) => r.ClassObligatoryRemarksWhenAbsent === true);

  const counts = useMemo(() => {
    let present = 0, absent = 0, total = 0;
    for (const r of rows) {
      if (isVisitor(r)) continue;
      total++;
      if (marks[num(r, 'AttendanceId')]?.attended) present++; else absent++;
    }
    return { present, absent, total };
  }, [rows, marks]); // eslint-disable-line react-hooks/exhaustive-deps

  function setMark(id: number, patch: Partial<Mark>) {
    setMarks((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setSavedAt(null);
  }

  function markAll(attended: boolean) {
    setMarks((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (isVisitor(r)) continue;
        const id = num(r, 'AttendanceId');
        next[id] = { ...next[id], attended };
      }
      return next;
    });
    setSavedAt(null);
  }

  async function save() {
    // Legacy gate: classes flagged ClassObligatoryRemarksWhenAbsent refuse to
    // save while a Normal-status absentee has no remark.
    if (remarksRequired) {
      const missing = rows.filter((r) => {
        if (isVisitor(r)) return false;
        const m = marks[num(r, 'AttendanceId')];
        return m && !m.attended && m.status.toLowerCase() === 'normal' && m.remarks.trim() === '';
      });
      if (missing.length > 0) {
        setError(`Remarks are required for absent students in this class, missing for: ${missing.map((r) => str(r, 'StudentFullName')).join(', ')}`);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const payload = rows
        .filter((r) => !isVisitor(r))
        .map((r) => ({ attendanceId: num(r, 'AttendanceId'), ...marks[num(r, 'AttendanceId')] }));
      await apiRequest('/api/portal/attendance/save', {
        method: 'POST',
        body: JSON.stringify({ sessionId: sid, marks: payload }),
      });
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save attendance.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <SmartBack label="Sessions" fallback="/sessions" />
      <PageHero
        title={className ? `${className}` : 'Take Attendance'}
        subtitle={sessionDate ? `Session of ${sessionDate}` : 'Mark who attended'}
        slide={2}
      />

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="size-8 text-[#1e5c97] animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-8 text-center">
          <Users className="size-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 mb-4">No attendance rows for this session yet.</p>
          {canSave && (
            <button onClick={refreshStudents} disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-semibold px-5 py-2 disabled:opacity-50">
              {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Load registered students
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-sm font-bold text-[#1e5c97]">
              {counts.present} present · {counts.absent} absent · {counts.total} students
            </span>
            <div className="flex-1" />
            {canSave && (
              <>
                <button onClick={() => markAll(true)}
                  className="rounded-lg border border-emerald-300 text-emerald-700 text-xs font-bold px-3 py-1.5 hover:bg-emerald-50">
                  All present
                </button>
                <button onClick={() => markAll(false)}
                  className="rounded-lg border border-red-200 text-red-600 text-xs font-bold px-3 py-1.5 hover:bg-red-50">
                  All absent
                </button>
                <button onClick={refreshStudents} disabled={refreshing} title="Sync newly registered students into this session"
                  className="rounded-lg border border-slate-200 text-slate-600 text-xs font-bold px-3 py-1.5 hover:border-[#1e5c97]/40 disabled:opacity-50">
                  {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                </button>
              </>
            )}
          </div>

          {/* Roster, tap the row to flip Present/Absent */}
          <div className="space-y-2 mb-24">
            {rows.map((r) => {
              const id = num(r, 'AttendanceId');
              const m = marks[id];
              if (!m) return null;
              const visitor = isVisitor(r);
              return (
                <div key={id}
                  className={`rounded-xl border p-3 transition-colors ${
                    visitor ? 'bg-[#FAFAB4]/60 border-amber-200'
                    : m.attended ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50/70 border-red-200'
                  }`}>
                  <div className="flex items-center gap-3">
                    <button
                      disabled={visitor || !canSave}
                      onClick={() => setMark(id, { attended: !m.attended })}
                      className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm transition-transform active:scale-90 disabled:opacity-50 ${
                        m.attended ? 'bg-emerald-500' : 'bg-red-400'
                      }`}
                      title={m.attended ? 'Mark absent' : 'Mark present'}
                    >
                      {m.attended ? <Check className="size-5" /> : <X className="size-5" />}
                    </button>
                    <button
                      disabled={visitor || !canSave}
                      onClick={() => setMark(id, { attended: !m.attended })}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-sm font-bold text-slate-800 truncate">{str(r, 'StudentFullName')}</p>
                      <p className="text-xs text-slate-500">
                        {visitor ? 'Make-up visitor from another session'
                          : m.attended ? 'Present' : 'Absent'}
                        {num(r, 'DuePercent') > 0 && <span className="text-amber-600"> · payment due</span>}
                        {str(r, 'MakeupInfo').length > 1 && <span className="text-lime-700"> · {str(r, 'MakeupInfo')}</span>}
                      </p>
                    </button>
                    {!visitor && (
                      <select
                        value={m.status}
                        disabled={!canSave}
                        onChange={(e) => setMark(id, { status: e.target.value })}
                        className={`shrink-0 rounded-lg border px-1.5 py-1 text-xs ${
                          m.status !== 'Normal' ? 'border-amber-300 bg-amber-50 font-semibold' : 'border-slate-200 bg-white/70'
                        }`}
                      >
                        {STATUSES.map((s2) => <option key={s2} value={s2}>{s2}</option>)}
                      </select>
                    )}
                  </div>
                  {!visitor && (!m.attended || m.remarks) && (
                    <input
                      value={m.remarks}
                      disabled={!canSave}
                      onChange={(e) => setMark(id, { remarks: e.target.value })}
                      placeholder={remarksRequired && !m.attended ? 'Remark required for absence…' : 'Remark (optional)…'}
                      className={`mt-2 w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40 ${
                        remarksRequired && !m.attended && m.remarks.trim() === '' ? 'border-red-300' : 'border-slate-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Sticky save bar */}
          {canSave && (
            <div className="fixed bottom-0 left-0 right-0 md:left-60 bg-white/95 backdrop-blur border-t border-slate-200 px-6 py-3 flex items-center gap-3 z-20">
              <span className="text-sm text-slate-500">
                {counts.present}/{counts.total} present
              </span>
              {savedAt && (
                <span className="flex items-center gap-1 text-sm text-emerald-700">
                  <CheckCircle2 className="size-4" /> Saved {savedAt.toLocaleTimeString()}
                </span>
              )}
              <div className="flex-1" />
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-bold px-8 py-2.5 disabled:opacity-50">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Attendance
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
