// Change-own-password for the signed-in admin. Verifies the current password
// server-side (P_User_Login), stores the new one as SHA-256 (login parity).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, KeyRound, Check } from 'lucide-react';
import { changePassword } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { toast } from '../components/Toast';

const inputCls =
  'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40 focus:border-[#1e5c97]';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (pw1 !== pw2) { setError('The two new passwords do not match.'); return; }
    if (pw1 === current) { setError('The new password must be different from the current one.'); return; }
    setSaving(true);
    try {
      await changePassword(current, pw1);
      toast.success('Your password has been changed.');
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <PageHero title="Change Password" subtitle="Update your own sign-in password" />

      <div className="max-w-md">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
            <AlertCircle className="size-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-[#1e5c97] font-semibold">
            <KeyRound className="size-4" /> Your password
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Current password</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password" required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">New password</label>
            <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)}
              autoComplete="new-password" required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Confirm new password</label>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password" required className={inputCls} />
          </div>
          <p className="text-[11px] text-slate-400">
            8–60 characters, with an upper- and lower-case letter, a number and a symbol.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => navigate(-1)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="btn-grad flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
