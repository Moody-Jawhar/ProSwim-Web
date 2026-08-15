import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, MapPin, Upload, Trash2, ImageOff } from 'lucide-react';
import { PageHero } from '../components/PageHero';
import { apiRequest, apiUpload, getStoredUser } from '../api/portalApi';

type Row = Record<string, unknown>;
const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));
const num = (r: Row, k: string) => Number(r[k] ?? 0);

// Location pictures: each location can carry one photo, shown on the mobile
// app's location list and detail pages. Upload/replace/remove happens here.
export function LocationsAdminPage() {
  const user = getStoredUser();
  const canSave = user?.canSave !== false && (user?.userType || '').toLowerCase() !== 'guest';

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetId = useRef<number>(0);

  useEffect(() => {
    apiRequest<Row[]>('/api/portal/locations').then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load locations.'));
  }, []);

  function pickPhoto(id: number) {
    targetId.current = id;
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const id = targetId.current;
    if (!file || !id) return;
    setError('');
    setBusyId(id);
    try {
      const { url } = await apiUpload<{ url: string }>(`/api/portal/locations/${id}/photo`, file);
      setRows((rs) => (rs ?? []).map((r) => (num(r, 'LocationId') === id ? { ...r, LocationPhotoUrl: url } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the photo.');
    } finally {
      setBusyId(null);
    }
  }

  async function removePhoto(id: number) {
    setError('');
    setBusyId(id);
    try {
      await apiRequest(`/api/portal/locations/${id}/photo`, { method: 'DELETE' });
      setRows((rs) => (rs ?? []).map((r) => (num(r, 'LocationId') === id ? { ...r, LocationPhotoUrl: null } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the photo.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHero
        title="Locations"
        subtitle="Pool locations — their photos show in the mobile app"
      />

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {rows === null && !error && (
        <div className="flex justify-center py-20">
          <Loader2 className="size-8 animate-spin text-[#1e5c97]" />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(rows ?? []).map((r) => {
          const id = num(r, 'LocationId');
          const photo = str(r, 'LocationPhotoUrl');
          const active = r['LocationActive'] === true || r['LocationActive'] === 1;
          const busy = busyId === id;
          return (
            <div key={id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="h-36 bg-slate-50 flex items-center justify-center relative">
                {photo ? (
                  <img src={photo} alt={str(r, 'LocationNickName')} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-300">
                    <ImageOff className="size-7" />
                    <span className="text-xs">No photo yet</span>
                  </div>
                )}
                {busy && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-[#1e5c97]" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 truncate">{str(r, 'LocationNickName') || str(r, 'LocationFullName')}</p>
                  {!active && (
                    <span className="text-[10px] font-bold uppercase rounded-full px-2 py-0.5 bg-slate-100 text-slate-500 shrink-0">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                  <MapPin className="size-3.5 shrink-0" />
                  {[str(r, 'LocationCity'), str(r, 'LocationFullAddress')].filter(Boolean).join(' — ') || '—'}
                </p>
                {canSave && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => pickPhoto(id)}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-lg bg-[#1e5c97] text-white text-xs font-semibold px-3 py-1.5 hover:bg-[#174a7c] disabled:opacity-50 transition-colors"
                    >
                      <Upload className="size-3.5" />
                      {photo ? 'Replace photo' : 'Upload photo'}
                    </button>
                    {photo && (
                      <button
                        onClick={() => removePhoto(id)}
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
