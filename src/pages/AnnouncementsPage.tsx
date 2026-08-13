import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, Megaphone, Users, Search, X, Send } from 'lucide-react';
import { PageHero } from '../components/PageHero';
import { apiRequest, getStoredUser } from '../api/portalApi';

interface Picker { id: number; label: string }
interface Lookups {
  locations: { locationId: number; locationNickName: string | null }[];
}
interface PreviewResult { count: number; sample: string[] }

const PROGRAMS = ['Group', 'Private', 'Competitive', 'School', 'AquaBaby', 'AquaGym'];

const inputCls =
  'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

// Targeted parent announcements: location / program / individual swimmer.
// Sending to literally everyone requires ticking an explicit confirmation —
// the requirement is "not sent to everyone unnecessarily".
export function AnnouncementsPage() {
  const user = getStoredUser();
  const canSend = user?.canSave !== false && (user?.userType || '').toLowerCase() !== 'guest';

  const [locations, setLocations] = useState<Lookups['locations']>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [locationId, setLocationId] = useState(0);
  const [program, setProgram] = useState('');
  const [studentId, setStudentId] = useState(0);
  const [studentLabel, setStudentLabel] = useState('');
  const [allowAll, setAllowAll] = useState(false);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<Picker[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    apiRequest<Lookups>('/api/portal/students/lookups')
      .then((lk) => setLocations(lk.locations ?? []))
      .catch(() => {});
  }, []);

  // Debounced student search (same behavior as the registration form)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    searchTimer.current = setTimeout(() => {
      apiRequest<Picker[]>(`/api/portal/edit/student-search?q=${encodeURIComponent(q.trim())}`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 300);
  }, [q]);

  // Live recipient preview whenever targeting changes
  useEffect(() => {
    setPreview(null);
    const untargeted = !locationId && !program && !studentId;
    if (untargeted && !allowAll) return;
    setPreviewing(true);
    const params = new URLSearchParams();
    if (locationId) params.set('locationId', String(locationId));
    if (program) params.set('program', program);
    if (studentId) params.set('studentId', String(studentId));
    apiRequest<PreviewResult>(`/api/portal/notify/preview?${params.toString()}`)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setPreviewing(false));
  }, [locationId, program, studentId, allowAll]);

  const untargeted = !locationId && !program && !studentId;
  const readyToSend = body.trim().length > 0 && (!untargeted || allowAll) && (preview?.count ?? 0) > 0;

  async function send() {
    if (!readyToSend) return;
    if (!window.confirm(`Send this ${urgent ? 'URGENT ' : ''}announcement to ${preview!.count} parent(s)?`)) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const res = await apiRequest<{ recipients: number; message: string }>(
        '/api/portal/notify/announce',
        {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim() || null,
            body: body.trim(),
            urgent,
            locationId: locationId || null,
            program: program || null,
            studentId: studentId || null,
            allowAll,
          }),
        },
      );
      setNotice(res.message);
      setTitle('');
      setBody('');
      setUrgent(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <PageHero
        title="Announcements"
        subtitle="Push a message to parents' phones — targeted by location, program or swimmer"
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
      {!canSend && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
          <p className="text-sm text-amber-700">Your account cannot send announcements.</p>
        </div>
      )}

      {/* Message */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5 mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Message</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Title (optional)</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={urgent ? 'Urgent announcement 📢' : 'ProSwim announcement'} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Message *</label>
            <textarea className={inputCls} rows={4} value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. The Achrafieh pool is closed this Saturday for maintenance — all sessions move to Sunday." />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="accent-red-600" />
            <span className={urgent ? 'font-bold text-red-600' : ''}>Urgent</span>
          </label>
        </div>
      </div>

      {/* Targeting */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5 mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Who receives it</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Location</label>
            <select className={inputCls} value={locationId} onChange={(e) => setLocationId(Number(e.target.value))}>
              <option value={0}>Any location</option>
              {locations.map((l) => (
                <option key={l.locationId} value={l.locationId}>{l.locationNickName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Program</label>
            <select className={inputCls} value={program} onChange={(e) => setProgram(e.target.value)}>
              <option value="">Any program</option>
              {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Specific swimmer (optional)</label>
            {studentId ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800 bg-[#e8f0f8] rounded-lg px-3 py-1.5">{studentLabel}</span>
                <button onClick={() => { setStudentId(0); setStudentLabel(''); }}
                  className="text-slate-400 hover:text-red-600" title="Clear">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="size-4 text-slate-400 absolute left-2.5 top-2" />
                <input className={inputCls + ' pl-8'} value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Type at least 2 letters…" />
                {results.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    {results.map((r) => (
                      <button key={r.id}
                        onClick={() => { setStudentId(r.id); setStudentLabel(r.label); setQ(''); setResults([]); }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {untargeted && (
          <label className="flex items-center gap-2 text-sm text-amber-700 select-none mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <input type="checkbox" checked={allowAll} onChange={(e) => setAllowAll(e.target.checked)} className="accent-amber-600" />
            No targeting selected — I really do want to notify <b>every active swimmer's parent</b>.
          </label>
        )}

        {/* Live recipient preview */}
        <div className="flex items-start gap-2 mt-4 text-sm">
          <Users className="size-4 text-[#1e5c97] shrink-0 mt-0.5" />
          {previewing ? (
            <span className="text-slate-400"><Loader2 className="size-3.5 animate-spin inline mr-1" />Counting recipients…</span>
          ) : preview ? (
            <span className="text-slate-600">
              Will reach <b className="text-[#1e5c97]">{preview.count}</b> parent(s)
              {preview.sample.length > 0 && (
                <span className="text-slate-400"> — {preview.sample.slice(0, 5).join(', ')}{preview.count > 5 ? '…' : ''}</span>
              )}
            </span>
          ) : (
            <span className="text-slate-400">Pick a location, program or swimmer to see who this reaches.</span>
          )}
        </div>
      </div>

      {canSend && (
        <button
          onClick={send}
          disabled={!readyToSend || sending}
          className={`flex items-center gap-2 rounded-xl text-sm font-semibold px-6 py-2.5 text-white disabled:opacity-50 ${
            urgent ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1e5c97] hover:bg-[#17497a]'
          }`}
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : urgent ? <Megaphone className="size-4" /> : <Send className="size-4" />}
          {sending ? 'Sending…' : urgent ? 'Send urgent announcement' : 'Send announcement'}
        </button>
      )}
    </div>
  );
}
