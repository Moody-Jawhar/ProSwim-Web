import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Plus, Pencil, Trash2, Eye, EyeOff, X, Save, Newspaper } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';

// Raw rows from /api/portal/news (P_News_SelectAll passthrough).
interface NewsRow {
  NewsId: number;
  NewsTitle: string;
  NewsBody: string;
  NewsImageURL: string | null;
  NewsLocationId: number | null;
  NewsDate: string | null;
  NewsActive: boolean;
  NewsCreatedBy: string | null;
  NewsWhatsappURL: string | null;
  NewsYoutubeURL: string | null;
  NewsFacebookURL: string | null;
}

// Social buttons an article can carry — prefilled with ProSwim's profiles,
// editable per article (e.g. a specific video or post).
const SOCIALS = [
  {
    key: 'whatsappURL' as const, label: 'WhatsApp', color: '#25D366',
    defaultUrl: 'https://wa.me/96178949498',
    path: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
  },
  {
    key: 'youtubeURL' as const, label: 'YouTube', color: '#FF0000',
    defaultUrl: 'https://www.youtube.com/user/ProSwimlb',
    path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
  {
    key: 'facebookURL' as const, label: 'Facebook', color: '#1877F2',
    defaultUrl: 'https://www.facebook.com/pages/ProSwim/226193561428',
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  },
];

interface LocationOpt { locationId: number; locationNickName: string }

interface FormState {
  title: string;
  body: string;
  imageURL: string;
  locationId: number;
  date: string;
  active: boolean;
  whatsappURL: string;
  youtubeURL: string;
  facebookURL: string;
}

const EMPTY: FormState = {
  title: '', body: '', imageURL: '', locationId: 0, date: '', active: true,
  whatsappURL: '', youtubeURL: '', facebookURL: '',
};

function toDateInput(v: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function NewsAdminPage() {
  const user = getStoredUser();
  const canSave = user?.canSave !== false && (user?.userType || '').toLowerCase() !== 'guest';

  const [rows, setRows] = useState<NewsRow[]>([]);
  const [locations, setLocations] = useState<LocationOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // null = form closed; 0 = creating; >0 = editing that article
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    const list = await apiRequest<NewsRow[]>('/api/portal/news');
    setRows(list);
  }

  useEffect(() => {
    Promise.all([
      load(),
      apiRequest<{ locations: LocationOpt[] }>('/api/portal/students/lookups')
        .then((lk) => setLocations(lk.locations)),
    ])
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load news.'))
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setForm(EMPTY);
    setEditingId(0);
    setNotice('');
  }

  function openEdit(r: NewsRow) {
    setForm({
      title: r.NewsTitle,
      body: r.NewsBody,
      imageURL: r.NewsImageURL ?? '',
      locationId: r.NewsLocationId ?? 0,
      date: toDateInput(r.NewsDate),
      active: r.NewsActive,
      whatsappURL: r.NewsWhatsappURL ?? '',
      youtubeURL: r.NewsYoutubeURL ?? '',
      facebookURL: r.NewsFacebookURL ?? '',
    });
    setEditingId(r.NewsId);
    setNotice('');
  }

  function closeForm() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function save() {
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title,
        body: form.body,
        imageURL: form.imageURL.trim() || null,
        locationId: form.locationId || null,
        date: form.date || null,
        active: form.active,
        whatsappURL: form.whatsappURL.trim() || null,
        youtubeURL: form.youtubeURL.trim() || null,
        facebookURL: form.facebookURL.trim() || null,
      };
      if (editingId === 0) {
        await apiRequest('/api/portal/news', { method: 'POST', body: JSON.stringify(payload) });
        setNotice('Article published.');
      } else {
        await apiRequest(`/api/portal/news/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        setNotice('Article updated.');
      }
      await load();
      closeForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: NewsRow) {
    setError('');
    try {
      await apiRequest(`/api/portal/news/${r.NewsId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: r.NewsTitle,
          body: r.NewsBody,
          imageURL: r.NewsImageURL,
          locationId: r.NewsLocationId,
          date: r.NewsDate,
          active: !r.NewsActive,
          whatsappURL: r.NewsWhatsappURL,
          youtubeURL: r.NewsYoutubeURL,
          facebookURL: r.NewsFacebookURL,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the article.');
    }
  }

  async function remove(r: NewsRow) {
    if (!window.confirm(`Delete "${r.NewsTitle}"? Students will no longer see it.`)) return;
    setError('');
    try {
      await apiRequest(`/api/portal/news/${r.NewsId}`, { method: 'DELETE' });
      await load();
      setNotice('Article deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the article.');
    }
  }

  const locName = (id: number | null) =>
    !id ? 'All branches' : (locations.find((l) => l.locationId === id)?.locationNickName ?? `#${id}`);

  const inputCls =
    'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">News</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            What students and parents see in the app's News section.
          </p>
        </div>
        {canSave && editingId === null && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-[#1e5c97] text-white text-sm font-semibold px-5 py-2 hover:bg-[#17497a]"
          >
            <Plus className="size-4" /> New article
          </button>
        )}
      </div>

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

      {editingId !== null && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-5 mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            {editingId === 0 ? 'New article' : 'Edit article'}
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} maxLength={200} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Body</label>
              <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={5} className={inputCls} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Image URL (optional)</label>
                <input value={form.imageURL} onChange={(e) => setForm((f) => ({ ...f, imageURL: e.target.value }))} className={inputCls} placeholder="https://…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Audience</label>
                <select value={form.locationId} onChange={(e) => setForm((f) => ({ ...f, locationId: Number(e.target.value) }))} className={inputCls}>
                  <option value={0}>All branches</option>
                  {locations.map((l) => (
                    <option key={l.locationId} value={l.locationId}>{l.locationNickName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Date (default today)</label>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">
                Link buttons on the article — tap to add, prefilled with the ProSwim profile
              </label>
              <div className="flex flex-wrap gap-2">
                {SOCIALS.map(({ key, label, color, defaultUrl, path }) => {
                  const on = form[key] !== '';
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, [key]: on ? '' : defaultUrl }))}
                      className="flex items-center gap-2 rounded-xl border text-sm font-semibold px-3.5 py-2 transition-colors"
                      style={on
                        ? { background: `${color}1A`, borderColor: `${color}66`, color }
                        : { background: '#fff', borderColor: '#e2e8f0', color: '#64748b' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={on ? color : '#94a3b8'}>
                        <path d={path} />
                      </svg>
                      {on ? `${label} added` : `Add ${label}`}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 space-y-2">
                {SOCIALS.filter(({ key }) => form[key] !== '').map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{label} link</label>
                    <input
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className={inputCls}
                      placeholder="https://…"
                    />
                  </div>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="accent-[#1e5c97]" />
              Visible in the app
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={closeForm}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 px-4 py-2 hover:bg-slate-50 disabled:opacity-60"
            >
              <X className="size-4" /> Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-[#1e5c97] text-white text-sm font-semibold px-5 py-2 hover:bg-[#17497a] disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {editingId === 0 ? 'Publish' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-10 text-center">
          <Newspaper className="size-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No articles yet. Publish the first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.NewsId} className={`bg-white rounded-2xl border border-slate-100 shadow-soft p-5 ${!r.NewsActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900">{r.NewsTitle}</p>
                    {!r.NewsActive && (
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">Hidden</span>
                    )}
                    <span className="text-[11px] font-bold text-[#1e5c97] bg-[#e8f0f8] rounded-full px-2 py-0.5">{locName(r.NewsLocationId)}</span>
                    {SOCIALS.map(({ key, label, color, path }) => {
                      const url = key === 'whatsappURL' ? r.NewsWhatsappURL : key === 'youtubeURL' ? r.NewsYoutubeURL : r.NewsFacebookURL;
                      return url ? (
                        <svg key={key} width="14" height="14" viewBox="0 0 24 24" fill={color} aria-label={`${label} link`}>
                          <path d={path} />
                        </svg>
                      ) : null;
                    })}
                  </div>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2 whitespace-pre-line">{r.NewsBody}</p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {r.NewsDate ? new Date(r.NewsDate).toLocaleDateString() : '—'}
                    {r.NewsCreatedBy && <> · {r.NewsCreatedBy}</>}
                  </p>
                </div>
                {canSave && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleActive(r)} title={r.NewsActive ? 'Hide from the app' : 'Show in the app'}
                      className="p-2 rounded-lg hover:bg-slate-50 text-slate-500">
                      {r.NewsActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </button>
                    <button onClick={() => openEdit(r)} title="Edit" className="p-2 rounded-lg hover:bg-slate-50 text-slate-500">
                      <Pencil className="size-4" />
                    </button>
                    <button onClick={() => remove(r)} title="Delete" className="p-2 rounded-lg hover:bg-red-50 text-red-500">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}