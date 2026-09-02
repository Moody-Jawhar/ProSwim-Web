import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Loader2, AlertCircle, CalendarDays, BookOpen,
  CreditCard, GraduationCap, UserPlus, Users, ClipboardCheck,
  MessageCircle, Truck, Receipt, Inbox, Megaphone, Star,
} from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';
import { AiRiskRadar } from '../components/AiRiskRadar';
import { FinanceOverview } from '../components/FinanceOverview';
import { Bubbles } from '../components/Bubbles';

interface Stats {
  date: string;
  sessionsToday: { count: number; registered: number; attended: number };
  currentSemester: {
    activeRegistrations: number;
    registrationsWithDue: number;
    dueByCurrency: Record<string, number>;
  };
  paymentsThisMonth: { count: number; paidByCurrency: Record<string, number> };
  privatePackagesAttention: Record<string, number>;
}

// Order matters, the card lists them in this sequence. Two proc criteria map
// to payment attention, so they get distinct labels rather than duplicating.
const ATTENTION_LABELS: Record<string, string> = {
  NeedPayment: 'Need payment',
  AttendanceMoreThanPayment2: 'Attended beyond payment',
  NeedFollowup: 'Need follow-up',
  NeedtoBeClosed: 'Need closing',
  Freeze: 'Frozen',
};
const ATTENTION_ORDER = ['NeedPayment', 'AttendanceMoreThanPayment2', 'NeedFollowup', 'NeedtoBeClosed', 'Freeze'];

function money(map: Record<string, number>): string {
  const parts = Object.entries(map).map(([cur, amt]) => `${amt.toLocaleString()} ${cur}`);
  return parts.length ? parts.join(' · ') : '-';
}

export function DashboardPage() {
  const user = getStoredUser();
  const userType = (user?.userType || '').toLowerCase();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userType === 'guest') return;
    apiRequest<Stats>('/api/portal/dashboard')
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load dashboard.'))
      .finally(() => setLoading(false));
  }, [userType]);

  // Restricted personas have no dashboard in the legacy menu.
  if (userType === 'guest') return <Navigate to="/students" replace />;

  const attention = stats
    ? ATTENTION_ORDER
        .map((k) => [k, stats.privatePackagesAttention[k] ?? 0] as const)
        .filter(([, v]) => v > 0)
    : [];
  const attentionTotal = attention.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="p-6 md:p-8 relative">
      <Bubbles tint="blue" overlay />
      <PageHero
        title={`Welcome${user?.fullName ? `, ${user.fullName}` : ''}`}
        subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        slide={1}
        right={<img src={`${import.meta.env.BASE_URL}ProSwimLogo.png`} alt="" className="h-7 w-auto hidden sm:block" />}
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
        </div>
      ) : stats && (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <Tile
              to="/sessions"
              rise="rise-1"
              accent="from-sky-400 to-[#1e5c97]"
              icon={<CalendarDays className="size-5" />}
              label="Sessions today"
              value={String(stats.sessionsToday.count)}
              sub={stats.sessionsToday.count > 0
                ? `${stats.sessionsToday.attended} attended of ${stats.sessionsToday.registered} registered`
                : 'No group sessions scheduled'}
            />
            <Tile
              to="/registrations"
              rise="rise-2"
              accent="from-teal-400 to-emerald-600"
              icon={<BookOpen className="size-5" />}
              label="Active registrations"
              value={stats.currentSemester.activeRegistrations.toLocaleString()}
              sub="current semesters"
            />
            <Tile
              to="/payments-due"
              rise="rise-3"
              accent="from-amber-400 to-orange-500"
              icon={<CreditCard className="size-5" />}
              label="Registrations with dues"
              value={stats.currentSemester.registrationsWithDue.toLocaleString()}
              sub={`due ${money(stats.currentSemester.dueByCurrency)}`}
            />
            <Tile
              to="/payments"
              rise="rise-4"
              accent="from-violet-400 to-purple-600"
              icon={<CreditCard className="size-5" />}
              label="Payments this month"
              value={String(stats.paymentsThisMonth.count)}
              sub={stats.paymentsThisMonth.count > 0
                ? `collected ${money(stats.paymentsThisMonth.paidByCurrency)}`
                : 'none recorded yet this month'}
            />
          </div>

          {/* Finance analytics. SiteMaster only (the endpoint enforces it too) */}
          {userType === 'sitemaster' && <FinanceOverview />}

          {/* Quick actions, the daily operations, one tap away */}
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Quick actions</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <QuickAction to="/students/new" label="Add Student" accent="from-sky-400 to-[#1e5c97]" icon={<UserPlus className="size-5" />} d="rise-1" />
              <QuickAction to="/registrations/new" label="New Registration" accent="from-teal-400 to-emerald-600" icon={<BookOpen className="size-5" />} d="rise-1" />
              <QuickAction to="/payments/new" label="Add Payment" accent="from-emerald-400 to-green-600" icon={<CreditCard className="size-5" />} d="rise-1" />
              <QuickAction to="/sessions" label="Take Attendance" accent="from-cyan-400 to-sky-600" icon={<ClipboardCheck className="size-5" />} d="rise-1" />
              <QuickAction to="/students" label="Students" accent="from-blue-400 to-indigo-600" icon={<Users className="size-5" />} d="rise-1" />
              <QuickAction to="/schedule" label="Group Schedule" accent="from-indigo-400 to-indigo-700" icon={<CalendarDays className="size-5" />} d="rise-2" />
              <QuickAction to="/pr-schedule" label="Private Schedule" accent="from-fuchsia-400 to-purple-700" icon={<GraduationCap className="size-5" />} d="rise-2" />
              <QuickAction to="/payments-due" label="Due Payments" accent="from-amber-400 to-orange-500" icon={<CreditCard className="size-5" />} d="rise-2" />
              <QuickAction to="/attendance-summary" label="Attendance Report" accent="from-sky-400 to-cyan-600" icon={<ClipboardCheck className="size-5" />} d="rise-2" />
              <QuickAction to="/bulk-whatsapp" label="Bulk WhatsApp" accent="from-green-400 to-emerald-700" icon={<MessageCircle className="size-5" />} d="rise-2" />
              <QuickAction to="/payment-delivery" label="Payment Delivery" accent="from-rose-400 to-pink-600" icon={<Truck className="size-5" />} d="rise-3" />
              <QuickAction to="/expenses/new" label="New Expense" accent="from-orange-400 to-red-500" icon={<Receipt className="size-5" />} d="rise-3" />
              <QuickAction to="/change-requests" label="App Requests" accent="from-violet-400 to-purple-600" icon={<Inbox className="size-5" />} d="rise-3" />
              <QuickAction to="/announcements" label="Send Notification" accent="from-pink-400 to-rose-600" icon={<Megaphone className="size-5" />} d="rise-3" />
              <QuickAction to="/feedback" label="Feedback" accent="from-yellow-400 to-amber-600" icon={<Star className="size-5" />} d="rise-3" />
            </div>
          </div>

          {/* Private packages attention */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Link
              to="/privates"
              className="card-lift rise-in rise-2 group relative overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-soft p-5"
            >
              <div className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 opacity-15 blur-2xl group-hover:opacity-30 transition-opacity" />
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md bg-gradient-to-br from-rose-400 to-pink-600">
                  <GraduationCap className="size-5" />
                </span>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Private packages<br />attention
                </p>
              </div>
              {attentionTotal === 0 ? (
                <p className="text-sm text-slate-500">Nothing needs attention right now.</p>
              ) : (
                <ul className="space-y-2">
                  {attention.map(([k, v]) => (
                    <li key={k} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-slate-600">{ATTENTION_LABELS[k] ?? k}</span>
                      <span className="font-bold text-rose-600 tabular-nums">{v.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Link>

            {/* AI overview: on-device risk radar over all active registrations */}
            <AiRiskRadar />
          </div>

        </>
      )}
    </div>
  );
}

function QuickAction({ to, label, accent, icon, d }: {
  to: string; label: string; accent: string; icon: React.ReactNode; d: string;
}) {
  return (
    <Link
      to={to}
      className={`card-lift rise-in ${d} group flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-100 shadow-soft py-5 px-3 text-center`}
    >
      <span className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md bg-gradient-to-br ${accent} group-hover:scale-110 transition-transform`}>
        {icon}
      </span>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
    </Link>
  );
}

function Tile({ to, icon, label, value, sub, accent, rise }: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: string;
  rise: string;
}) {
  return (
    <Link
      to={to}
      className={`card-lift rise-in ${rise} group relative overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-soft p-5`}
    >
      {/* corner glow in the tile's accent */}
      <div className={`pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${accent} opacity-15 blur-2xl group-hover:opacity-30 transition-opacity`} />
      <div className="flex items-start justify-between mb-3">
        <span className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md bg-gradient-to-br ${accent}`}>
          {icon}
        </span>
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className="text-4xl font-extrabold text-slate-900 tabular-nums leading-none">{value}</p>
      <p className="text-xs text-slate-500 mt-2">{sub}</p>
    </Link>
  );
}
