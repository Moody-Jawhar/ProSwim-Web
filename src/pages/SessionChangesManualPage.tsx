import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CalendarX, Check, User, Repeat } from 'lucide-react';
import { PageHero } from '../components/PageHero';
import { apiRequest, getStoredUser } from '../api/portalApi';

type Row = Record<string, unknown>;
const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));
const num = (r: Row, k: string) => Number(r[k] ?? 0);

function fmtDay(v: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// Staff-side manual change of a private session: search the swimmer, pick the
// session, cancel or reschedule it — choosing whether it counts as one of the
// swimmer's 2 allowed changes (student cancellation) or not (coach
// cancellation).
export function SessionChangesManualPage() {
  const user = getStoredUser();
  const canSave = user?.canSave !== false && (user?.userType || '').toLowerCase() !== 'guest';

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Row[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<Row | null>(null);
  const [sessions, setSessions] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [editFor, setEditFor] = useState<number | null>(null);
  const [state, setState] = useState('Cancelled Prev. By Student');
  const [countAsStudent, setCountAsStudent] = useState(true);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // The legacy dropdown's full status list.
  const SESSION_STATES = [
    'Regular', 'Cancelled By ProSwim', 'Cancelled Prev. By Student',
    'Cancelled on same Day', 'Merged w/o Pack', 'Freeze Package',
    'Cancelled Package', 'Reduced Package', 'Transfer Package', 'Makeup',
  ];
  // Student-caused statuses default to using one of the 2 allowed changes.
  const STUDENT_STATES = new Set(['Cancelled Prev. By Student', 'Cancelled on same Day']);

  function chooseState(v: string) {
    setState(v);
    setCountAsStudent(STUDENT_STATES.has(v));
  }

  // Live student search.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await apiRequest<Row[]>(`/api/portal/students?searchFor=${encodeURIComponent(q)}`);
        const ql = q.toLowerCase();
        setResults(rows
          .sort((a, b) => {
            const rank = (r: Row) => {
              const n = str(r, 'studentFullName').toLowerCase();
              return n.startsWith(ql) ? 0 : n.includes(ql) ? 1 : 2;
            };
            return rank(a) - rank(b);
          })
          .slice(0, 15));
      } catch { /* ignore */ } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  function pickStudent(r: Row) {
    setStudent(r);
    setResults(null);
    setSearch('');
    setSessions(null);
    setError('');
    apiRequest<Row[]>(`/api/portal/change-requests/private-sessions?studentId=${num(r, 'studentId')}`)
      .then(setSessions)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load sessions.'));
  }

  async function apply(sessionId: number) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await apiRequest<{ counted: boolean; state: string }>(
        '/api/portal/change-requests/manual-change', {
          method: 'POST',
          body: JSON.stringify({
            privateSessionId: sessionId,
            state,
            countAsStudent,
            newDate: newDate || null,
            newTime: newTime || null,
            note: note.trim() || null,
          }),
        });
      setNotice(
        `Session set to “${res.state}”` +
        (res.counted ? ' — counted as 1 of the 2 allowed changes.' : ' — not counted toward the quota.'));
      setEditFor(null); setNewDate(''); setNewTime(''); setNote('');
      if (student) pickStudent(student);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Change failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <PageHero
        title="Manual Session Change"
        subtitle="Search a swimmer, pick a private session, cancel or reschedule it — choosing whether it uses one of their 2 changes"
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4">
          <p className="text-sm text-emerald-700">{notice}</p>
        </div>
      )}

      {/* Student picker */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search swimmer by name…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40"
            />
            {searching && <Loader2 className="size-4 animate-spin text-slate-400 absolute right-3 top-2.5" />}
          </div>
          {student && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f0f8] text-[#1e5c97] text-sm font-semibold px-3 py-1.5">
              <User className="size-4" /> {str(student, 'studentFullName')} #{num(student, 'studentId')}
            </span>
          )}
        </div>
        {results !== null && (
          <div className="mt-2 divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {results.length === 0 && <p className="text-sm text-slate-400 py-2">No matches.</p>}
            {results.map((r) => (
              <button key={num(r, 'studentId')} onClick={() => pickStudent(r)}
                className="w-full flex items-center justify-between py-2 text-left hover:bg-slate-50 px-1 rounded">
                <span className="text-sm text-slate-800">{str(r, 'studentFullName')}</span>
                <span className="text-xs text-slate-400">
                  #{num(r, 'studentId')}
                  {str(r, 'studentDateOfBirth') ? ` · b. ${new Date(str(r, 'studentDateOfBirth')).getFullYear()}` : ''}
                  {' · '}{str(r, 'locationNickName') || '—'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sessions */}
      {student && sessions === null && !error && (
        <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-[#1e5c97]" /></div>
      )}
      {sessions !== null && sessions.length === 0 && (
        <p className="text-sm text-slate-400">This swimmer has no private sessions.</p>
      )}
      {sessions !== null && sessions.length > 0 && (
        <div className="space-y-2">
          {sessions.map((s) => {
            const id = num(s, 'PrivateSessionId');
            const state = str(s, 'PrivateSessionState');
            const attended = s.PrivateSessionAttended === true || s.PrivateSessionAttended === 1;
            const editable = !attended && canSave;
            return (
              <div key={id} className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-slate-900">
                    {fmtDay(str(s, 'PrivateSessionDate'))} · {str(s, 'PrivateSessionTime')}
                  </span>
                  <span className="text-xs text-slate-500">
                    {str(s, 'PackageName')}{str(s, 'CoachFullName') ? ` · ${str(s, 'CoachFullName')}` : ''}
                  </span>
                  {attended && <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700">Attended</span>}
                  {state && state !== 'Regular' && !attended && (
                    <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-violet-50 text-violet-700">{state}</span>
                  )}
                  <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 ml-auto">
                    {num(s, 'UsedCount')}/2 changes used
                  </span>
                </div>
                {state === 'Makeup' && str(s, 'PrivateSessionMkupDate') && (
                  <p className="text-xs text-violet-700 mt-1 flex items-center gap-1">
                    <Repeat className="size-3.5" /> Makeup: {fmtDay(str(s, 'PrivateSessionMkupDate'))} {str(s, 'PrivateSessionMkupTime')}
                  </p>
                )}

                {editable && editFor !== id && (
                  <button onClick={() => { setEditFor(id); chooseState('Cancelled Prev. By Student'); setNewDate(''); setNewTime(''); setNote(''); }}
                    className="mt-2 flex items-center gap-1.5 rounded-xl bg-[#1e5c97] text-white text-xs font-semibold px-3 py-1.5 hover:bg-[#174a7c]">
                    <CalendarX className="size-3.5" /> Change this session
                  </button>
                )}

                {editable && editFor === id && (
                  <div className="mt-3 border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 mb-1">Session status</p>
                        <select value={state} onChange={(e) => chooseState(e.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white">
                          {SESSION_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </div>
                      {state === 'Makeup' && (
                        <>
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 mb-1">Makeup date</p>
                            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-slate-500 mb-1">Makeup time</p>
                            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
                              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white" />
                          </div>
                        </>
                      )}
                    </div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={countAsStudent} onChange={(e) => setCountAsStudent(e.target.checked)} />
                      Count as 1 of the swimmer's 2 allowed changes
                    </label>
                    <input value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Note (optional)"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white" />
                    <div className="flex gap-2">
                      <button onClick={() => apply(id)} disabled={busy || (state === 'Makeup' && !newDate)}
                        className="flex items-center gap-1.5 rounded-xl bg-[#1e5c97] text-white text-sm font-semibold px-4 py-1.5 hover:bg-[#174a7c] disabled:opacity-60">
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Apply change
                      </button>
                      <button onClick={() => setEditFor(null)} disabled={busy}
                        className="rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold px-4 py-1.5 hover:bg-slate-50 disabled:opacity-60">
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
