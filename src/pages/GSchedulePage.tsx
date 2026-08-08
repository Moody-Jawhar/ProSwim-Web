import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, Search, AlertTriangle, OctagonX, Phone, Cake, StickyNote } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';

type Row = Record<string, unknown>;

interface GroupData {
  timeslots: Row[];
  coaches: Row[];
  rows: Row[];
  studentsPerClass: number;
  semester: Row | null;
  counts: { active: number; stopped: number; sumTimes: number };
}

// Legacy cell colors keyed by student count (RegistrationsListView.aspx.cs,
// compared against the hardcoded 5-per-class).
const COLOR_CAP = 5;
function cellColor(count: number): string {
  if (count > COLOR_CAP) return '#80a9ff';
  if (count === 5) return '#99bbff';
  if (count === 4) return '#b3ccff';
  if (count === 3) return '#ccddff';
  if (count === 2) return '#e5eeff';
  if (count === 1) return '#e9e9f5';
  return '#ffffff';
}

const s = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => (v == null ? 0 : Number(v));

function isBirthdayNear(dob: unknown): boolean {
  const t = s(dob);
  if (!t) return false;
  const d = new Date(t);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.abs((thisYear.getTime() - now.getTime()) / 86400000);
  return diff <= 6 || Math.abs(diff - 365) <= 6;
}

export function GSchedulePage() {
  const user = getStoredUser();
  const userType = (user?.userType || '').toLowerCase();
  const locationLocked = (userType === 'user' || userType === 'guest') && !!user?.primaryLocationId;

  const [locations, setLocations] = useState<{ locationId: number; locationNickName: string | null }[]>([]);
  // Everyone opens scoped to their own location; only locked types can't change it.
  const [locationId, setLocationId] = useState(user?.primaryLocationId ?? 0);
  const [semesters, setSemesters] = useState<Row[]>([]);
  const [semesterId, setSemesterId] = useState(0);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ locations: { locationId: number; locationNickName: string | null }[] }>(
      '/api/portal/students/lookups'
    ).then((lk) => setLocations(lk.locations)).catch(() => {});
  }, []);

  // Location → semester list (+ current semester as default)
  useEffect(() => {
    apiRequest<{ semesters: Row[]; currentSemesterId: number }>(
      `/api/portal/schedule/semesters?locationId=${locationId}`
    )
      .then((r) => {
        setSemesters(r.semesters);
        if (r.currentSemesterId) setSemesterId(r.currentSemesterId);
        else if (r.semesters.length) setSemesterId(n(r.semesters[0].SemesterId ?? r.semesters[0].SemesterID));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load semesters.'));
  }, [locationId]);

  const load = useCallback((semId: number, q: string) => {
    if (!semId) return;
    setLoading(true);
    setError('');
    apiRequest<GroupData>(`/api/portal/schedule/group?semesterId=${semId}&searchFor=${encodeURIComponent(q)}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load schedule.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(semesterId, search); }, [semesterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── derived matrix helpers ────────────────────────────────────────────────
  const coachNames = (data?.coaches ?? []).map((c) => s(c.CoachName)).filter(Boolean);

  function cellRows(dayid: unknown, classTime: unknown, coach: string): Row[] {
    return (data?.rows ?? []).filter(
      (r) => s(r.dayid) === s(dayid) && s(r.ClassTime) === s(classTime) && s(r.CoachName) === coach
    );
  }

  function coachSummary(coach: string) {
    const rows = (data?.rows ?? []).filter((r) => s(r.CoachName) === coach);
    const classIds = new Set(rows.filter((r) => n(r.ClassId) > 0).map((r) => n(r.ClassId)));
    const students = rows.filter((r) => s(r.StudentName).length > 2).length;
    const spc = data?.studentsPerClass || COLOR_CAP;
    const places = spc * classIds.size;
    let avail = places - students;
    // Legacy adds back over-capacity slots so avail never goes negative per slot.
    const slots = new Map<string, number>();
    for (const r of rows) {
      if (s(r.StudentName).length <= 2) continue;
      const k = `${s(r.dayid)}|${s(r.ClassTime)}`;
      slots.set(k, (slots.get(k) || 0) + 1);
    }
    for (const cnt of slots.values()) if (cnt >= spc + 1) avail += cnt - spc;
    const pct = places > 0 ? Math.round((100 * (places - avail)) / places) : 0;
    return { classes: classIds.size, students, places, avail, pct };
  }

  // Semester weeks remark
  function weeksRemark(): string {
    const sem = data?.semester;
    if (!sem) return '';
    const start = new Date(s(sem.SemesterStart));
    const end = new Date(s(sem.SemesterEnd));
    const weeks = n(sem.SemesterNumberOfWeeks);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
    const now = new Date();
    let head = `${weeks} Weeks`;
    if (now >= start && now <= end) {
      const cur = Math.floor(((now.getTime() - start.getTime()) / 86400000 + 6) / 7);
      head = `Week ${cur} of ${weeks}`;
    }
    return `${head} · ${start.toLocaleDateString()} → ${end.toLocaleDateString()}`;
  }

  const distinctClasses = new Set(
    (data?.rows ?? []).filter((r) => n(r.ClassId) > 0).map((r) => n(r.ClassId))
  ).size;

  const selectCls =
    'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

  return (
    <div className="p-6">
      <PageHero
        compact
        title="Group Schedule"
        subtitle={weeksRemark() || 'Group schedule by coach and time slot'}
        slide={3}
        right={
          data ? (
            <div className="text-xs font-semibold bg-slate-100 border border-slate-200 text-[#1e5c97] rounded-lg px-3 py-1.5">
              [{distinctClasses} Classes] [
              <span className="text-emerald-600">{data.counts.active} Active</span>
              {' + '}
              <span className="text-red-500">{data.counts.stopped} Stopped</span>
              {' = '}{data.counts.active + data.counts.stopped} Regs]
            </div>
          ) : undefined
        }
      />

      {/* Filters */}
      <form
        onSubmit={(e) => { e.preventDefault(); load(semesterId, search); }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4 flex flex-wrap items-center gap-2"
      >
        <div className="relative">
          <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student…"
            className="w-52 rounded-lg border border-slate-200 pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40"
          />
        </div>
        <select
          value={locationId}
          onChange={(e) => setLocationId(Number(e.target.value))}
          disabled={locationLocked}
          className={`${selectCls} disabled:bg-slate-50 disabled:text-slate-400`}
        >
          <option value={0}>All locations</option>
          {locations.map((l) => (
            <option key={l.locationId} value={l.locationId}>{l.locationNickName}</option>
          ))}
        </select>
        <select value={semesterId} onChange={(e) => setSemesterId(Number(e.target.value))} className={`${selectCls} min-w-44`}>
          {semesters.length === 0 && <option value={0}>No semesters found</option>}
          {semesters.map((sm) => {
            const id = n(sm.SemesterId ?? sm.SemesterID);
            return <option key={id} value={id}>{s(sm.SemesterName)}</option>;
          })}
        </select>
        <button type="submit" className="rounded-lg bg-[#1e5c97] text-white text-xs font-semibold px-4 py-1.5 hover:bg-[#17497a]">
          Search
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-3">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
        </div>
      ) : !data || (data.timeslots ?? []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <p className="text-sm font-medium text-slate-500">No schedule to show</p>
          <p className="text-xs text-slate-400 mt-1">
            {semesters.length === 0
              ? 'No semesters found for this location — pick a different location.'
              : 'Pick a semester with classes, or clear the search filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-xs border-collapse" style={{ minWidth: `${110 + coachNames.length * 200}px` }}>
            <thead>
              {/* Coach band — same chrome as the Private Schedule coach rows */}
              <tr>
                <th className="sticky left-0 z-10 bg-[#aabacf] p-1.5 text-center font-semibold w-[90px] min-w-[90px] text-slate-800">
                  Time
                </th>
                {coachNames.map((coach) => {
                  const sum = coachSummary(coach);
                  return (
                    <th key={coach} className="bg-[#dce7f4] p-2 w-[200px] min-w-[200px] align-top text-left">
                      <span className="text-sm font-bold text-slate-800">{coach}</span>{' '}
                      <span className="text-[#1e5c97] font-bold">{sum.pct}%</span>
                      <div className="mt-0.5 text-[10px] font-normal text-slate-500">
                        [{sum.classes} Classes] [{sum.students} Students]
                        <br />
                        [{sum.avail} of {sum.places} Places Free]
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(data.timeslots ?? []).map((ts, i) => (
                <tr key={i}>
                  <td className="sticky left-0 z-10 bg-[#88abd6] p-1.5 text-center font-semibold text-[13px] text-slate-900 align-middle">
                    {s(ts.ClassDay)}<br />{s(ts.ClassTime)}
                  </td>
                  {coachNames.map((coach) => {
                    const rows = cellRows(ts.dayid, ts.ClassTime, coach);
                    const students = rows.filter((r) => s(r.StudentName).length > 2);
                    const hasClass = rows.some((r) => n(r.ClassId) > 0);
                    const closed = rows.length > 0 && !hasClass;
                    const level = rows.length ? s(rows[0].LevelName) : '';
                    const classRemark = rows.length ? s(rows[0].ClassRemark) : '';
                    return (
                      <td key={coach} className="border border-slate-300 p-0.5 align-top">
                        {rows.length > 0 && (
                          <div
                            className="rounded p-1.5 h-full"
                            style={{ backgroundColor: closed ? '#f1f5f9' : cellColor(students.length) }}
                          >
                            <div className={`flex items-center gap-1 flex-wrap ${closed ? 'line-through text-slate-400' : ''}`}>
                              {level && <span className="text-[#1e5c97] font-bold text-[12px]">{level}</span>}
                              <span className="font-bold">[{students.length}]</span>
                              {classRemark && (
                                <span title={classRemark}><StickyNote className="size-3.5 text-amber-600" /></span>
                              )}
                              {students.length === 6 && <AlertTriangle className="size-3.5 text-amber-500" />}
                              {students.length > 6 && <OctagonX className="size-3.5 text-red-600" />}
                              {closed && <span className="text-[10px] font-semibold text-slate-400 no-underline">CLOSED</span>}
                            </div>
                            <div className="mt-1 space-y-0.5">
                              {students.map((r, k) => (
                                <div key={k} className="flex items-center gap-1 whitespace-nowrap">
                                  <span
                                    title={n(r.DuePercent) > 0 ? `Due ${n(r.DuePercent)}%` : 'Paid'}
                                    className={`inline-block w-2 h-2 rounded-full border shrink-0 ${
                                      n(r.DuePercent) > 0
                                        ? 'bg-red-500 border-red-700'
                                        : 'bg-emerald-500 border-emerald-700'
                                    }`}
                                  />
                                  <span className="truncate max-w-[120px]">{s(r.StudentName)}</span>
                                  {n(r.DuePercent) > 0 && (
                                    <span className="text-red-600 font-semibold">Due {n(r.DuePercent)}%</span>
                                  )}
                                  {s(r.Contact) && (
                                    <span title={s(r.Contact).replace(/,/g, ' ')}>
                                      <Phone className="size-3 text-slate-500" />
                                    </span>
                                  )}
                                  {isBirthdayNear(r.DOB) && (
                                    <span title={new Date(s(r.DOB)).toLocaleDateString()}>
                                      <Cake className="size-3 text-pink-500" />
                                    </span>
                                  )}
                                  {s(r.StudentRemark) && (
                                    <span title={s(r.StudentRemark)}>
                                      <StickyNote className="size-3 text-amber-600" />
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend — same pattern as the Private Schedule */}
      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <LegendSwatch color="#ffffff" label="Empty" />
        <LegendSwatch color="#e5eeff" label="2 students" />
        <LegendSwatch color="#ccddff" label="3" />
        <LegendSwatch color="#b3ccff" label="4" />
        <LegendSwatch color="#99bbff" label="5 (full)" />
        <LegendSwatch color="#80a9ff" label="Over capacity" />
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 border border-emerald-700" /> paid
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 border border-red-700" /> payment due
        </span>
        <span className="flex items-center gap-1"><AlertTriangle className="size-3 text-amber-500" /> 6 students</span>
        <span className="flex items-center gap-1"><OctagonX className="size-3 text-red-600" /> over 6</span>
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block w-4 h-3 rounded-sm border border-slate-300" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
