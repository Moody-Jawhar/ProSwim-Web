// Bulk WhatsApp, port of StudentsListCommunicate.aspx. Filter the audience,
// review the recipient list, compose with #placeholders#, and queue. Delivery
// drains in the background through the same UltraMsg gateway and tbl_Bulks
// queue the legacy tool uses (25 messages per batch, throttled).

import { useEffect, useState } from 'react';
import {
  Loader2, AlertCircle, MessageCircle, Search, Send, RefreshCw, Users, CheckCircle2,
} from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';

type Row = Record<string, unknown>;
type Option = { value: number | string; label: string };

const num = (r: Row, k: string) => Number(r[k] ?? 0);
const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));

const PKG_CRITERIA: Option[] = [
  { value: 'ActPck', label: 'Active package' },
  { value: 'NoActPck_Closed30', label: 'No active, closed ≤30 days' },
  { value: 'NoActPck_Closed90', label: 'No active, closed ≤90 days' },
  { value: 'NoActPck_Closed180', label: 'No active, closed ≤180 days' },
  { value: 'NoActPck_Closed365', label: 'No active, closed ≤1 year' },
  { value: 'NoActPck_Closed1825', label: 'No active, closed ≤5 years' },
];

const BIRTHDAYS: Option[] = [
  { value: '', label: 'Any birthday' },
  { value: 'BDay_2Day', label: 'Birthday today' },
  { value: 'BDay_2Moro', label: 'Birthday tomorrow' },
  { value: 'BDay_Yesterday', label: 'Birthday yesterday' },
  { value: 'BDay_Next7Days', label: 'Birthday next 7 days' },
  { value: 'BDay_ThisMonth', label: 'Birthday this month' },
  { value: 'BDay_NextMonth', label: 'Birthday next month' },
];

export function BulkWhatsAppPage() {
  const user = getStoredUser();
  const canSend = user?.canSave !== false && (user?.userType || '').toLowerCase() !== 'guest';

  // Audience filters
  const [locations, setLocations] = useState<Option[]>([]);
  const [semesters, setSemesters] = useState<Option[]>([]);
  const [schools, setSchools] = useState<string[]>([]);
  const [templates, setTemplates] = useState<{ subject: string; body: string }[]>([]);
  const [locationId, setLocationId] = useState(user?.primaryLocationId ?? 0);
  const [semesterId, setSemesterId] = useState(0);
  const [search, setSearch] = useState('');
  const [grp, setGrp] = useState(false);
  const [grpDue, setGrpDue] = useState(false);
  const [prv, setPrv] = useState(false);
  const [prvCriteria, setPrvCriteria] = useState('ActPck');
  const [prvDue, setPrvDue] = useState(false);
  const [birthdays, setBirthdays] = useState('');
  const [yobFrom, setYobFrom] = useState('');
  const [yobTo, setYobTo] = useState('');
  const [school, setSchool] = useState('');

  // Results & compose
  const [rows, setRows] = useState<Row[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [filterDupPhones, setFilterDupPhones] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ queued: number } | null>(null);
  const [queue, setQueue] = useState<{ queued: number; sending: number; draining: boolean } | null>(null);

  useEffect(() => {
    apiRequest<{ locations: Option[]; semesters: Option[] }>('/api/portal/modules/lookups')
      .then((lk) => { setLocations(lk.locations ?? []); setSemesters(lk.semesters ?? []); })
      .catch(() => {});
    apiRequest<{ schools: string[]; templates: { subject: string; body: string }[] }>('/api/portal/communicate/lookups')
      .then((lk) => { setSchools(lk.schools ?? []); setTemplates(lk.templates ?? []); })
      .catch(() => {});
    refreshQueue();
  }, []);

  function refreshQueue() {
    apiRequest<{ queued: number; sending: number; draining: boolean }>('/api/portal/communicate/queue')
      .then(setQueue)
      .catch(() => {});
  }

  function loadRecipients() {
    setLoading(true);
    setError('');
    setSent(null);
    const q = new URLSearchParams();
    if (search.trim()) q.set('searchFor', search.trim());
    if (locationId) q.set('locationIds', String(locationId));
    if (grp) { q.set('grp', 'true'); if (semesterId) q.set('semesterIds', String(semesterId)); if (grpDue) q.set('grpDue', 'true'); }
    if (prv) { q.set('prv', 'true'); q.set('prvCriteria', prvCriteria); if (prvDue) q.set('prvDue', 'true'); }
    if (birthdays) q.set('birthdays', birthdays);
    if (yobFrom) q.set('yobFrom', yobFrom);
    if (yobTo) q.set('yobTo', yobTo);
    if (school) q.set('school', school);
    apiRequest<Row[]>(`/api/portal/communicate/recipients?${q}`)
      .then((data) => {
        setRows(data);
        setChecked(new Set(data.map((r) => num(r, 'rn') || num(r, 'StudentID'))));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load recipients.'))
      .finally(() => setLoading(false));
  }

  const rowKey = (r: Row) => num(r, 'rn') || num(r, 'StudentID');

  async function send() {
    if (!rows) return;
    if (subject.trim().length < 2) { setError('Subject is too short.'); return; }
    if (message.trim().length < 15) { setError('Message must be at least 15 characters.'); return; }
    const selected = rows.filter((r) => checked.has(rowKey(r)));
    if (selected.length === 0) { setError('Select at least one recipient.'); return; }
    if (!window.confirm(`Queue a WhatsApp message to ${selected.length} recipient(s)?`)) return;
    setSending(true);
    setError('');
    try {
      const recipients = selected.map((r) => ({
        studentId: num(r, 'StudentID'),
        refId: num(r, 'RefID'),
        refType: str(r, 'RefType'),
        fullName: str(r, 'StudentFullName'),
        firstName: str(r, 'StudentFirstName'),
        lastName: str(r, 'StudentLastName'),
        location: str(r, 'locationNickName'),
        coach: str(r, 'Coach'),
        phone1: str(r, 'PhoneNumber1'),
        email: str(r, 'StudentEmail'),
        locationId: num(r, 'LocID'),
        coachId: num(r, 'CoachID'),
        sessionDate: str(r, 'SessionDate'),
        sessionTime: str(r, 'SessionTime'),
        dupPhone: num(r, 'IsDuplicatePhone') === 1,
        dupEmail: num(r, 'IsDuplicateEmail') === 1,
      }));
      const res = await apiRequest<{ queued: number }>('/api/portal/communicate/whatsapp', {
        method: 'POST',
        body: JSON.stringify({ subject, body: message, filterDupPhones, filterDupEmails: false, recipients }),
      });
      setSent(res);
      refreshQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not queue the messages.');
    } finally {
      setSending(false);
    }
  }

  const inputCls = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';
  const dupPhones = (rows ?? []).filter((r) => num(r, 'IsDuplicatePhone') === 1).length;

  return (
    <div className="p-6 md:p-8">
      <PageHero title="Bulk WhatsApp" subtitle="Filter the audience, compose once, reach every family" slide={1} />

      {/* ── Audience filters ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Audience</p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student…" className={`${inputCls} w-44`} />
          <select value={locationId} onChange={(e) => setLocationId(Number(e.target.value))} className={inputCls}>
            <option value={0}>All locations</option>
            {locations.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <select value={birthdays} onChange={(e) => setBirthdays(e.target.value)} className={inputCls}>
            {BIRTHDAYS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <select value={school} onChange={(e) => setSchool(e.target.value)} className={`${inputCls} max-w-40`}>
            <option value="">Any school</option>
            {schools.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={yobFrom} onChange={(e) => setYobFrom(e.target.value)} placeholder="YOB from" className={`${inputCls} w-24`} />
          <input value={yobTo} onChange={(e) => setYobTo(e.target.value)} placeholder="YOB to" className={`${inputCls} w-24`} />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
          <label className="flex items-center gap-1.5 text-sm text-slate-700 select-none">
            <input type="checkbox" checked={grp} onChange={(e) => setGrp(e.target.checked)} className="accent-[#1e5c97]" />
            <b>Group</b> registered in
          </label>
          <select value={semesterId} onChange={(e) => setSemesterId(Number(e.target.value))} disabled={!grp} className={`${inputCls} max-w-48 disabled:opacity-40`}>
            <option value={0}>Any semester</option>
            {semesters.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 select-none">
            <input type="checkbox" checked={grpDue} onChange={(e) => setGrpDue(e.target.checked)} disabled={!grp} className="accent-[#1e5c97]" />
            with dues only
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
          <label className="flex items-center gap-1.5 text-sm text-slate-700 select-none">
            <input type="checkbox" checked={prv} onChange={(e) => setPrv(e.target.checked)} className="accent-[#1e5c97]" />
            <b>Private</b> swimmers
          </label>
          <select value={prvCriteria} onChange={(e) => setPrvCriteria(e.target.value)} disabled={!prv} className={`${inputCls} max-w-64 disabled:opacity-40`}>
            {PKG_CRITERIA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            <option value="AllPrivateStds">All private students</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 select-none">
            <input type="checkbox" checked={prvDue} onChange={(e) => setPrvDue(e.target.checked)} disabled={!prv} className="accent-[#1e5c97]" />
            with dues only
          </label>
        </div>
        <button onClick={loadRecipients} disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-[#1e5c97] hover:bg-[#17497a] text-white text-sm font-semibold px-5 py-2 disabled:opacity-50">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Load Recipients
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* ── Recipients ── */}
      {rows && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <Users className="size-4" /> {rows.length.toLocaleString()} recipients · {checked.size.toLocaleString()} selected
            {dupPhones > 0 && <span className="text-amber-600 normal-case tracking-normal">({dupPhones} duplicate phones)</span>}
          </p>
          <div className="border border-slate-100 rounded-xl overflow-y-auto max-h-80 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-slate-400">
                  <th className="p-1.5">
                    <input type="checkbox" checked={checked.size === rows.length && rows.length > 0}
                      onChange={(e) => setChecked(e.target.checked ? new Set(rows.map(rowKey)) : new Set())}
                      className="accent-[#1e5c97]" />
                  </th>
                  <th className="text-left">Student</th><th className="text-left">Location</th>
                  <th className="text-left">Coach</th><th className="text-left">Phone</th>
                  <th className="text-left">Type</th><th className="text-center">Dup</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const key = rowKey(r);
                  return (
                    <tr key={key} className={num(r, 'IsDuplicatePhone') === 1 ? 'text-amber-700' : ''}>
                      <td className="p-1.5 text-center">
                        <input type="checkbox" checked={checked.has(key)}
                          onChange={(e) => setChecked((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(key); else next.delete(key);
                            return next;
                          })}
                          className="accent-[#1e5c97]" />
                      </td>
                      <td>{str(r, 'StudentFullName')}</td>
                      <td>{str(r, 'locationNickName')}</td>
                      <td>{str(r, 'Coach')}</td>
                      <td>{str(r, 'PhoneNumber1')}</td>
                      <td>{str(r, 'RefType')}</td>
                      <td className="text-center">{num(r, 'IsDuplicatePhone') === 1 ? '📱' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Compose ── */}
      {rows && canSend && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <MessageCircle className="size-4" /> Compose WhatsApp
          </p>
          {templates.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {templates.map((t) => (
                <button key={t.subject}
                  onClick={() => { setSubject(t.subject); setMessage(t.body); }}
                  className="text-xs font-semibold rounded-full border border-[#1e5c97]/30 text-[#1e5c97] px-3 py-1 hover:bg-[#e8f0f8]">
                  {t.subject}
                </button>
              ))}
            </div>
          )}
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (internal)" className={`${inputCls} w-full mb-2`} />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
            placeholder="Message… placeholders: #FirstName# #FullName# #LastName# #Location# #Coach# #SessionDate# #SessionTime#"
            className={`${inputCls} w-full mb-2`} />
          <p className="text-xs text-slate-400 mb-3">
            Placeholders: <code>#FirstName#</code> <code>#FullName#</code> <code>#LastName#</code>{' '}
            <code>#Location#</code> <code>#Coach#</code> <code>#SessionDate#</code> <code>#SessionTime#</code>
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm text-slate-600 select-none">
              <input type="checkbox" checked={filterDupPhones} onChange={(e) => setFilterDupPhones(e.target.checked)} className="accent-[#1e5c97]" />
              Skip duplicate phone numbers
            </label>
            <div className="flex-1" />
            <button onClick={send} disabled={sending}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-50">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Queue &amp; Send
            </button>
          </div>
          {sent && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 mt-3">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700">
                {sent.queued} message(s) queued, sending starts automatically in batches of 25.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Queue status ── */}
      <div className="flex items-center gap-3 text-sm text-slate-500">
        {queue && (
          <span>
            {queue.queued > 0 ? <b>{queue.queued}</b> : 'No'} bulk message(s) queued
            {queue.sending > 0 && ' · messages currently sending'}
          </span>
        )}
        <button onClick={refreshQueue} title="Refresh" className="text-[#1e5c97] hover:underline inline-flex items-center gap-1">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
        {queue && queue.queued > 0 && canSend && (
          <button
            onClick={() => apiRequest('/api/portal/communicate/send-batch', { method: 'POST' }).then(refreshQueue)}
            className="text-emerald-700 font-semibold hover:underline">
            Send another batch
          </button>
        )}
      </div>
    </div>
  );
}
