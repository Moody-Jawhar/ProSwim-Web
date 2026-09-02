import { useEffect, useRef, useState } from 'react';
import { Bubbles } from '../components/Bubbles';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import {
  login, verifyMfa, resendMfa, storeAuth, storeDeviceToken,
  type LoginResponse,
} from '../api/portalApi';

const inputCls =
  'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40 focus:border-[#1e5c97]';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Second-factor step
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  // Resend cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (challengeId) codeRef.current?.focus();
  }, [challengeId]);

  function finish(res: LoginResponse) {
    const { token, mfaRequired, challengeId: _c, sentTo: _s, expiresInSeconds: _e,
            resendInSeconds: _r, deviceToken, ...user } = res;
    void mfaRequired; void _c; void _s; void _e; void _r;
    if (deviceToken) storeDeviceToken(deviceToken);
    storeAuth(token!, user);
    sessionStorage.setItem('showIntro', '1'); // cinematic splash on arrival
    navigate('/');
  }

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.mfaRequired && res.challengeId) {
        setChallengeId(res.challengeId);
        setSentTo(res.sentTo || '');
        setCooldown(res.resendInSeconds ?? 60);
      } else {
        finish(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId) return;
    setError('');
    setNotice('');
    setLoading(true);
    try {
      finish(await verifyMfa(challengeId, code, remember));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
      setCode('');
      codeRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!challengeId || cooldown > 0) return;
    setError('');
    setNotice('');
    try {
      const res = await resendMfa(challengeId);
      setSentTo(res.sentTo);
      setCooldown(res.resendInSeconds);
      setNotice('A new code is on its way.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
    }
  }

  function backToPassword() {
    setChallengeId(null);
    setCode('');
    setError('');
    setNotice('');
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
          <img src={`${import.meta.env.BASE_URL}ProSwimLogo.png`} alt="ProSwim" className="h-12 w-auto mb-3" />
          <h1 className="text-2xl font-bold text-slate-900">
            {challengeId ? 'Verify it’s you' : 'Management Portal'}
          </h1>
          <p className="text-sm text-slate-400 mt-1 text-center">
            {challengeId
              ? sentTo
                ? `We sent a 6-digit code by WhatsApp to ${sentTo}`
                : 'Enter the 6-digit code we sent you'
              : 'Sign in to continue'}
          </p>
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

        {!challengeId ? (
          <form onSubmit={onSubmitPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-grad w-full rounded-xl text-sm font-semibold py-2.5 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmitCode} className="space-y-4">
            <div className="flex justify-center mb-1">
              <span className="w-12 h-12 rounded-2xl bg-[#e8f0f8] flex items-center justify-center">
                <ShieldCheck className="size-6 text-[#1e5c97]" />
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Verification code</label>
              <input
                ref={codeRef}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                required
                className={`${inputCls} text-center text-2xl tracking-[0.4em] font-bold`}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-[#1e5c97]"
              />
              Trust this device for 30 days
            </label>
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="btn-grad w-full rounded-xl text-sm font-semibold py-2.5 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Verify and sign in
            </button>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={backToPassword}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
              >
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={onResend}
                disabled={cooldown > 0}
                className="text-xs font-semibold text-[#1e5c97] hover:text-[#17497a] disabled:text-slate-300"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
