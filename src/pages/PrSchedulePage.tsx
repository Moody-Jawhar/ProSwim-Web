import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, Search, ChevronLeft, ChevronRight, Pause, StickyNote, Phone, CreditCard, Package, MessageSquarePlus } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';

type Row = Record<string, unknown>;

interface PrivateData {
  rows: Row[];
  countsHeader: Row[];
  timeRemarks: Row[];
}

const s = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => (v == null ? 0 : Number(v));

// Legacy color constants (PrivatePackagesListView.aspx.cs)
const COLOR_EMPTY = '#fdfdc3';
const COLOR_CANCELLED = '#f4f401';
const COLOR_STARTING = '#84fb65';
const COLOR_MIDDLE = '#adf99a';
const COLOR_ENDING = '#fafa76';

// GetColorBasedonAttendance, ported 1:1.
function boxStyle(r: Row): React.CSSProperties {
  const status = s(r.packageStatus).toLowerCase();
  const state = s(r.PrivateSessionState).toLowerCase();
  const followup = s(r.PackageFollowUp);
  const attended = n(r.CountAttended);
  const total = n(r.PackageNumberOfSessions);

  if (state.includes('freeze') || status.includes('freeze'))
    return { backgroundImage: 'linear-gradient(to right, #FFFFFF, #eeebd2, #FFFFFF)' };

  const pct = total > 0 ? (attended * 100) / total : 0;
  let color = pct < 30 ? COLOR_STARTING : pct < 70 ? COLOR_MIDDLE : COLOR_ENDING;
  if (state.includes('canc')) color = COLOR_CANCELLED;
  if (attended >= total - 2) color = COLOR_ENDING;

  if (followup === 'Renewing' || followup === 'Renewed' || followup === 'MovedtoGroup')
    return { backgroundImage: `linear-gradient(to right, ${color}, ${color}, ${COLOR_STARTING})` };
  if (followup === 'Leaving')
    return { backgroundImage: `linear-gradient(to right, ${color}, ${color}, #ebeb08)` };
  return { backgroundColor: color };
}

function boxBorder(r: Row): React.CSSProperties {
  if (s(r.PrivateSessionState).toLowerCase() === 'frommakeup') return { border: '3px dotted green' };
  if (s(r.PrivateSessionMkupDate)) return { border: '3px dotted #ebeb08' };
  return { border: '3px dotted transparent' };
}

// Cell border when several sessions share one slot.
function mergedBorder(sessions: Row[]): React.CSSProperties {
  if (sessions.length <= 1) return {};
  const activeCnt = sessions.filter((x) => !s(x.PrivateSessionState).toLowerCase().includes('canc')).length;
  const color = activeCnt >= 2 ? '#e60650' : activeCnt === 1 ? '#7cdd25' : '#aabd04';
  return { border: `4px solid ${color}` };
}

function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOfWeek(base: Date): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 === 0 ? 0 : 1 - d.getDay()));
  return d;
}

const COUNT_LABELS: Record<string, string> = {
  AttendanceMoreThanPayment2: 'Packs Need Payment',
  NeedtoBeClosed: 'Packs Need to Be Closed',
  NeedFollowup: 'Packs Need Followup',
  Freeze: 'Freeze Packs',
};

const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function PrSchedulePage() {
  const user = getStoredUser();
  const userType = (user?.userType || '').toLowerCase();
  const locationLocked = userType === 'user' && !!user?.primaryLocationId;

  const monday = mondayOfWeek(new Date());
  const [locations, setLocations] = useState<{ locationId: number; locationNickName: string | null }[]>([]);
  const [coaches, setCoaches] = useState<{ coachId: number; coachFullName: string | null }[]>([]);
  const [locationId, setLocationId] = useState(user?.primaryLocationId ?? 0);
  const [coachId, setCoachId] = useState(0);
  const [day, setDay] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(fmtISO(monday));
  const [dateTo, setDateTo] = useState(fmtISO(new Date(monday.getTime() + 5 * 86400000)));
  const [onlyActive, setOnlyActive] = useState(true);
  const [freeTimes, setFreeTimes] = useState(false);
  const [data, setData] = useState<PrivateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ locations: typeof locations; coaches: typeof coaches }>('/api/portal/students/lookups')
      .then((lk) => { setLocations(lk.locations); setCoaches(lk.coaches); })
      .catch(() => {});
  }, []);

  const load = useCallback((from: string, to: string) => {
    setLoading(true);
    setError('');
    const q = new URLSearchParams({
      dateFrom: from, dateTo: to,
      locationId: String(locationId), coachId: String(coachId),
      searchFor: search, day,
      showFreeTimes: String(freeTimes), showOnlyActive: String(onlyActive),
    });
    apiRequest<PrivateData>(`/api/portal/schedule/private?${q}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load schedule.'))
      .finally(() => setLoading(false));
  }, [locationId, coachId, search, day, freeTimes, onlyActive]);

  useEffect(() => { load(dateFrom, dateTo); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function shiftWeek(offset: number) {
    const from = offset === 0 ? mondayOfWeek(new Date()) : new Date(new Date(dateFrom).getTime() + offset * 7 * 86400000);
    const f = fmtISO(from);
    const t = fmtISO(new Date(from.getTime() + 5 * 86400000));
    setDateFrom(f); setDateTo(t);
    load(f, t);
  }

  // ── derived structures ────────────────────────────────────────────────────
  const rows = data?.rows ?? [];
  const coachList: { name: string; id: number; remark: string }[] = [];
  for (const r of rows) {
    const id = n(r.CoachId);
    if (!id || coachList.some((c) => c.id === id)) continue;
    coachList.push({ name: s(r.CoachFullname), id, remark: s(r.CoachRemark) });
  }
  coachList.sort((a, b) => a.name.localeCompare(b.name));

  const days = [...new Set(rows.map((r) => s(r.PrivateSessionDate)))].filter(Boolean).sort();

  function timeRemark(coachIdVal: number, dateStr: string, time: string): string {
    const d = new Date(dateStr);
    const key = coachIdVal * 100000 + d.getDay() * 10000 + Number(time.replace(':', '') || 0);
    const hit = (data?.timeRemarks ?? []).find((r) => n(r.RemarkTypeID) === key);
    return hit ? s(hit.Remark) : '';
  }

  const LEGACY = 'https://admin.proswim-lb.com/ASPXPages';
  const [phones, setPhones] = useState<Record<number, string>>({});

  // Phone numbers aren't in the schedule proc — fetched per student on tap.
  async function showPhone(studentId: number) {
    if (phones[studentId]) {
      setPhones((prev) => { const next = { ...prev }; delete next[studentId]; return next; });
      return;
    }
    try {
      const st = await apiRequest<Record<string, unknown>>(`/api/portal/students/${studentId}`);
      const nums = [
        [st.StudentPhoneNumberCode1, st.StudentPhoneNumber1].filter(Boolean).join(' '),
        [st.StudentPhoneNumberCode2, st.StudentPhoneNumber2].filter(Boolean).join(' '),
      ].filter((x) => x.trim().length > 0).join(' / ');
      setPhones((prev) => ({ ...prev, [studentId]: nums || '—' }));
    } catch {
      setPhones((prev) => ({ ...prev, [studentId]: '—' }));
    }
  }

  async function editRemark(studentId: number) {
    const remark = window.prompt('Remark for this student (empty clears it):', '');
    if (remark === null) return;
    try {
      await apiRequest('/api/portal/schedule/remark', {
        method: 'POST',
        body: JSON.stringify({ remarkType: 'Student', remarkTypeId: studentId, remark }),
      });
      load(dateFrom, dateTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the remark.');
    }
  }

  const todayISO = fmtISO(new Date());
  const selectCls =
    'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

  return (
    <div className="p-6">
      <PageHero
        compact
        title="Private Schedule"
        subtitle={`${new Date(dateFrom).toLocaleDateString()} → ${new Date(dateTo).toLocaleDateString()}`}
        slide={0}
        right={
          <div className="flex gap-2 flex-wrap justify-end">
            {(data?.countsHeader ?? []).filter((c) => n(c.Cnt) > 0).map((c) => (
              <span key={s(c.Criteria)} className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1">
                {n(c.Cnt)} {COUNT_LABELS[s(c.Criteria)] ?? s(c.Criteria)}
              </span>
            ))}
          </div>
        }
      />

      {/* Filters */}
      <form
        onSubmit={(e) => { e.preventDefault(); load(dateFrom, dateTo); }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4 flex flex-wrap items-center gap-2"
      >
        <div className="relative">
          <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student…"
            className="w-44 rounded-lg border border-slate-200 pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40"
          />
        </div>
        <select
          value={locationId}
          onChange={(e) => setLocationId(Number(e.target.value))}
          disabled={locationLocked}
          className={`${selectCls} disabled:bg-slate-50 disabled:text-slate-400`}
        >
          <option value={0}>All locations</option>
          {locations.map((l) => <option key={l.locationId} value={l.locationId}>{l.locationNickName}</option>)}
        </select>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shiftWeek(-1)} title="Previous week"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">
            <ChevronLeft className="size-4 text-slate-500" />
          </button>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={selectCls} />
          <span className="text-xs text-slate-400">→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={selectCls} />
          <button type="button" onClick={() => shiftWeek(0)} title="This week"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">
            <Pause className="size-4 text-slate-500" />
          </button>
          <button type="button" onClick={() => shiftWeek(1)} title="Next week"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">
            <ChevronRight className="size-4 text-slate-500" />
          </button>
        </div>

        <select value={coachId} onChange={(e) => setCoachId(Number(e.target.value))} className={selectCls}>
          <option value={0}>All coaches</option>
          {coaches.map((c) => <option key={c.coachId} value={c.coachId}>{c.coachFullName}</option>)}
        </select>
        <select value={day} onChange={(e) => setDay(e.target.value)} className={selectCls}>
          {DAYS.map((d) => <option key={d} value={d}>{d || 'All days'}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-500 select-none px-1">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="accent-[#1e5c97]" />
          Only Active
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-500 select-none px-1">
          <input type="checkbox" checked={freeTimes} onChange={(e) => setFreeTimes(e.target.checked)} className="accent-[#1e5c97]" />
          Free Times
        </label>
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
      ) : data && coachList.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">No data for this week.</div>
      ) : data && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-xs border-collapse" style={{ minWidth: `${120 + days.length * 190}px` }}>
            <tbody>
              {coachList.map((coach) => {
                const coachRows = rows.filter((r) => n(r.CoachId) === coach.id);
                const times = [...new Set(coachRows.map((r) => s(r.PrivateSessionTime)))].filter(Boolean).sort();
                const total = coachRows.filter((r) => n(r.PrivateSessionId) > 0).length;
                const remarksOnly = coachRows.filter((r) => n(r.PrivateSessionId) === 0).length;
                return (
                  <FragmentRows
                    key={coach.id}
                    coach={coach}
                    total={total}
                    remarksOnly={remarksOnly}
                    days={days}
                    times={times}
                    coachRows={coachRows}
                    todayISO={todayISO}
                    timeRemark={timeRemark}
                    legacy={LEGACY}
                    phones={phones}
                    onPhone={showPhone}
                    onRemark={editRemark}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <LegendSwatch color={COLOR_STARTING} label="0–30% attended" />
        <LegendSwatch color={COLOR_MIDDLE} label="30–70%" />
        <LegendSwatch color={COLOR_ENDING} label="≥70% / ending" />
        <LegendSwatch color={COLOR_CANCELLED} label="Cancelled" />
        <LegendSwatch color="#eeebd2" label="Freeze" />
        <LegendSwatch color={COLOR_EMPTY} label="Free time" />
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-3 border-2 border-dotted border-[#ebeb08]" /> made up later</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-3 border-2 border-dotted border-green-600" /> is a makeup</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-3 border-2 border-[#e60650]" /> merged slot</span>
      </div>
    </div>
  );
}

function FragmentRows({ coach, total, remarksOnly, days, times, coachRows, todayISO, timeRemark, legacy, phones, onPhone, onRemark }: {
  coach: { name: string; id: number; remark: string };
  total: number;
  remarksOnly: number;
  days: string[];
  times: string[];
  coachRows: Row[];
  todayISO: string;
  timeRemark: (coachId: number, dateStr: string, time: string) => string;
  legacy: string;
  phones: Record<number, string>;
  onPhone: (studentId: number) => void;
  onRemark: (studentId: number) => void;
}) {
  return (
    <>
      {/* Coach band */}
      <tr>
        <td className="bg-[#dce7f4] p-2" />
        <td colSpan={days.length} className="bg-[#dce7f4] p-2 text-sm font-bold text-slate-800">
          {coach.name}
          {coach.remark && (
            <span title={coach.remark} className="inline-flex align-middle ml-1">
              <StickyNote className="size-3.5 text-amber-600" />
            </span>
          )}
          <span className="ml-3 font-normal text-slate-500">
            [Total Sessions = {total}] [Remarks Only = {remarksOnly}]
          </span>
        </td>
      </tr>
      {/* Day header */}
      <tr>
        <td className="bg-[#aabacf] p-1.5 text-center font-semibold w-[90px] min-w-[90px]">Time</td>
        {days.map((d) => {
          const dd = new Date(d);
          const isToday = d.slice(0, 10) === todayISO;
          return (
            <td
              key={d}
              className={`p-1.5 text-center font-semibold ${isToday ? 'bg-[#555555] text-white border-2 border-black' : 'bg-[#aabacf]'}`}
            >
              {dd.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit' })}
            </td>
          );
        })}
      </tr>
      {/* Time rows */}
      {times.map((t) => (
        <tr key={`${coach.id}-${t}`}>
          <td className="bg-[#88abd6] p-1.5 text-center font-semibold text-[13px]">{t}</td>
          {days.map((d) => {
            const sessions = coachRows.filter(
              (r) => s(r.PrivateSessionTime) === t && s(r.PrivateSessionDate) === d
            );
            const real = sessions.filter((r) => n(r.PrivateSessionId) > 0);
            const free = sessions.length > 0 && real.length === 0;
            const remark = timeRemark(coach.id, d, t);
            return (
              <td
                key={d}
                className="border border-slate-300 p-0.5 align-top w-[190px] min-w-[190px]"
                style={{
                  backgroundColor: free ? COLOR_EMPTY : undefined,
                  ...mergedBorder(real),
                }}
              >
                {free && remark && <div className="p-1 text-[10px] text-slate-600">{remark}</div>}
                {real.map((r, i) => (
                  <div key={i} className="rounded p-1 mb-0.5" style={{ ...boxStyle(r), ...boxBorder(r) }}>
                    <Link
                      to={`/students/${n(r.Std1ID)}`}
                      title="Open student page"
                      className="font-bold text-[12px] uppercase hover:underline"
                      style={{ color: n(r.DuePercent) > 0 ? '#dc2626' : '#000' }}
                    >
                      {s(r.STD1)}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        title={r.PrivateSessionAttended === true ? 'Attended' : 'Not attended'}
                        className={`inline-block w-2.5 h-2.5 rounded-full border ${
                          r.PrivateSessionAttended === true
                            ? 'bg-emerald-500 border-emerald-700'
                            : 'bg-red-500 border-red-700'
                        }`}
                      />
                      <span>Att {n(r.CountAttended)}/{n(r.PackageNumberOfSessions)}</span>
                      <span className={n(r.DuePercent) > 0 ? 'text-red-600 font-semibold' : ''}>
                        Due {n(r.DuePercent)}%
                      </span>
                    </div>
                    {(s(r.PrivateSessionRemarks) || remark) && (
                      <div className="text-[10px] text-slate-700 mt-0.5">
                        {[remark, s(r.PrivateSessionRemarks)].filter(Boolean).join(' ')}
                      </div>
                    )}
                    <div className="flex gap-1 mt-0.5">
                      {s(r.PAckagelevel) && (
                        <span className="text-[9px] font-semibold bg-white/60 rounded px-1">{s(r.PAckagelevel)}</span>
                      )}
                      {s(r.PackageFollowUp) && (
                        <span className="text-[9px] font-semibold bg-white/60 rounded px-1">{s(r.PackageFollowUp)}</span>
                      )}
                    </div>
                    {/* Actions: package, add payment (legacy popups), remark, phone */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <a href={`${legacy}/PrivatePackagesIndividual.aspx?PackageID=${n(r.PackageId)}`}
                        target="_blank" rel="noreferrer" title="Open package">
                        <Package className="size-3 text-slate-600 hover:text-[#1e5c97]" />
                      </a>
                      <a href={`${legacy}/PrivatePaymentsIndividual.aspx?PackageID=${n(r.PackageId)}`}
                        target="_blank" rel="noreferrer" title="Add payment">
                        <CreditCard className={`size-3 ${n(r.DuePercent) > 0 ? 'text-red-600' : 'text-slate-600'} hover:text-[#1e5c97]`} />
                      </a>
                      <button type="button" onClick={() => onRemark(n(r.Std1ID))} title="Add remark">
                        <MessageSquarePlus className="size-3 text-slate-600 hover:text-amber-600" />
                      </button>
                      <button type="button" onClick={() => onPhone(n(r.Std1ID))} title="Show phone">
                        <Phone className="size-3 text-slate-600 hover:text-[#1e5c97]" />
                      </button>
                      {phones[n(r.Std1ID)] && (
                        <span className="text-[9px] font-semibold text-[#1e5c97] bg-white/70 rounded px-1">
                          {phones[n(r.Std1ID)]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </td>
            );
          })}
        </tr>
      ))}
    </>
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
