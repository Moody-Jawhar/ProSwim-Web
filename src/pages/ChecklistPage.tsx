// Per-student skills checklist (StudentIndivCheckList.aspx). Items grouped by
// level; tick the mastered skills and save. Opened from a student's profile.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Save, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';

interface Item {
  ChecklistItemId: number;
  ChecklistItemText: string;
  ChecklistItemLevelName: string;
  ChecklistItemOrder: number;
  IsChecked: boolean;
  DateChecked?: string | null;
}

export function ChecklistPage() {
  const { id } = useParams();
  const studentId = Number(id);
  const navigate = useNavigate();
  const user = getStoredUser();
  const canSave = user?.userType?.toLowerCase() !== 'guest' && user?.canSave !== false;

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    apiRequest<Record<string, unknown>[]>(`/api/portal/modules/checklist?studentId=${studentId}`)
      .then((data) =>
        setItems(
          data
            .map((r) => ({
              ChecklistItemId: Number(r.ChecklistItemId),
              ChecklistItemText: String(r.ChecklistItemText ?? ''),
              ChecklistItemLevelName: String(r.ChecklistItemLevelName ?? '—'),
              ChecklistItemOrder: Number(r.ChecklistItemOrder ?? 0),
              IsChecked: r.IsChecked === true,
              DateChecked: r.DateChecked ? String(r.DateChecked) : null,
            }))
            .sort((a, b) => a.ChecklistItemOrder - b.ChecklistItemOrder)
        )
      )
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the checklist.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(itemId: number) {
    setItems((old) => old.map((i) => (i.ChecklistItemId === itemId ? { ...i, IsChecked: !i.IsChecked } : i)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/api/portal/edit/checklist/${studentId}`, {
        method: 'PUT',
        body: JSON.stringify({ items: items.map((i) => ({ ChecklistItemId: i.ChecklistItemId, IsChecked: i.IsChecked })) }),
      });
      setSaved(true);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  // Group by level, preserving first-seen order.
  const groups: { level: string; items: Item[] }[] = [];
  for (const it of items) {
    let g = groups.find((x) => x.level === it.ChecklistItemLevelName);
    if (!g) { g = { level: it.ChecklistItemLevelName, items: [] }; groups.push(g); }
    g.items.push(it);
  }
  const doneCount = items.filter((i) => i.IsChecked).length;

  return (
    <div className="p-6 max-w-3xl">
      <PageHero
        title="Skills Checklist"
        subtitle={loading ? 'Loading…' : `${doneCount} / ${items.length} mastered`}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/students/${studentId}`)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#1e5c97] hover:bg-slate-50"
            >
              <ArrowLeft className="size-3.5" /> Profile
            </button>
            {canSave && (
              <button
                onClick={save}
                disabled={saving || items.length === 0}
                className="btn-grad flex items-center gap-1.5 rounded-lg text-xs font-semibold px-3 py-1.5 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
              </button>
            )}
          </div>
        }
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-3">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-3">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700">Checklist saved.</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 px-1">No checklist items configured.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.level} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">{g.level}</p>
              <div className="space-y-1">
                {g.items.map((it) => (
                  <label key={it.ChecklistItemId} className="flex items-start gap-2 text-sm text-slate-700 py-1.5 px-2 rounded hover:bg-slate-50 select-none">
                    <input
                      type="checkbox"
                      checked={it.IsChecked}
                      disabled={!canSave}
                      onChange={() => toggle(it.ChecklistItemId)}
                      className="accent-[#1e5c97] mt-0.5"
                    />
                    <span className={it.IsChecked ? 'line-through text-slate-400' : ''}>{it.ChecklistItemText}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
