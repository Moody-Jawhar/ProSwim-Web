// Self-service password reset (public). Step 1: enter email → a 6-digit code is
// emailed. Step 2: enter the code + a new password. Mirrors the legacy
// LoginForgetPassword.aspx flow, but the code lives server-side, not in Session.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, KeyRound, ArrowLeft } from 'lucide-react';
import { Bubbles } from '../components/Bubbles';
import { forgotPassword, resetPassword } from '../api/portalApi';

const inputCls =
  'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40 focus:border-[#1e5c97]';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setNotice(''); setLoading(true);
    try {
      const r = await forgotPassword(email.trim());
      setChallengeId(r.challengeId);
      setCooldown(r.resendInSeconds ?? 60);
      setNotice(`If an account exists for that email, we sent a 6-digit code${r.sentTo ? ` to ${r.sentTo}` : ''}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the reset.');
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (pw1 !== pw2) { setError('The two passwords do not match.'); return; }
    setLoading(true);
    try {
      await resetPassword(challengeId!, code.trim(), pw1);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    setError(''); setNotice('');
    try {
      const r = await forgotPassword(email.trim());
      setChallengeId(r.challengeId);
      setCooldown(r.resendInSeconds ?? 60);
      setNotice('A new code has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        backgroundImage:
          `linear-gradient(120deg, rgba(36,44,67,0.88) 0%, rgba(30,92,151,0.72) 60%, rgba(30,92,151,0.5) 100%), url(${import.meta.env.BASE_URL}heroes/slide1.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <Bubbles tint="green" overlay />
      <div className="hero-in w-full max-w-sm bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 relative">
        <div className="flex flex-col items-center mb-6">
          <span className="w-12 h-12 rounded-2xl bg-[#e8f0f8] flex items-center justify-center mb-3">
            <KeyRound className="size-6 text-[#1e5c97]" />
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Reset password</h1>
          <p className="text-sm text-slate-400 mt-1 text-center">
            {done ? 'All set' : challengeId ? 'Enter the code and your new password' : 'We’ll email you a reset code'}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
            <AlertCircle className="size-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {notice && !done && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4">
            <p className="text-sm text-emerald-700">{notice}</p>
          </div>
        )}

        {done ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-sm text-emerald-700">Your password has been changed. You can sign in now.</p>
            </div>
            <button onClick={() => navigate('/login')}
              className="btn-grad w-full rounded-xl text-sm font-semibold py-2.5">Back to sign in</button>
          </div>
        ) : !challengeId ? (
          <form onSubmit={requestCode} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="username" required className={inputCls} />
            </div>
            <button type="submit" disabled={loading}
              className="btn-grad w-full rounded-xl text-sm font-semibold py-2.5 flex items-center justify-center gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />} Send reset code
            </button>
          </form>
        ) : (
          <form onSubmit={submitReset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">6-digit code</label>
              <input inputMode="numeric" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required className={`${inputCls} tracking-[0.4em] text-center text-lg`} />
              <button type="button" onClick={resend} disabled={cooldown > 0}
                className="mt-2 text-xs font-semibold text-[#1e5c97] hover:underline disabled:text-slate-400 disabled:no-underline">
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
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
            <button type="submit" disabled={loading}
              className="btn-grad w-full rounded-xl text-sm font-semibold py-2.5 flex items-center justify-center gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />} Set new password
            </button>
          </form>
        )}

        {!done && (
          <div className="text-center mt-5">
            <button onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#1e5c97]">
              <ArrowLeft className="size-3.5" /> Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
