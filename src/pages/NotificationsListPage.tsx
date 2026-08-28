// Notifications list, the push broadcasts sent to the mobile app (last 90
// days, grouped), mirroring the legacy NotificationsList.aspx. Read-only;
// composing and removing live on the Mobile App → Notifications page.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, Bell, Megaphone, Send } from 'lucide-react';
import { apiRequest, getStoredUser } from '../api/portalApi';
import { PageHero } from '../components/PageHero';

type Row = Record<string, unknown>;

export function NotificationsListPage() {
  const user = getStoredUser();
  const canSend = (user?.userType || '').toLowerCase() !== 'guest';

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<Row[]>('/api/portal/notify/sent')
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load notifications.'));
  }, []);

  const totalRecipients = (rows ?? []).reduce((s, r) => s + Number(r.Recipients ?? 0), 0);

  return (
    <div className="p-6 md:p-8">
      <PageHero
        title="Notifications"
        subtitle="Push notifications sent to the mobile app, last 90 days"
        slide={2}
        right={canSend ? (
          <Link
            to="/announcements"
            className="flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3.5 py-2 transition-colors"
          >
            <Send className="size-3.5" /> Send new
          </Link>
        ) : undefined}
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <AlertCircle className="size-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!error && !rows && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="size-8 text-[#1e5c97] animate-spin" />
        </div>
      )}

      {rows && (
        <>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
            {rows.length.toLocaleString()} notification{rows.length === 1 ? '' : 's'} ·{' '}
            {totalRecipients.toLocaleString()} recipient inboxes reached
          </p>

          {rows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-8 text-center">
              <Bell className="size-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No notifications sent in the last 90 days.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4">
              <div className="divide-y divide-slate-100">
                {rows.map((r, i) => {
                  const type = String(r.Type ?? '');
                  const when = r.SentDate
                    ? new Date(String(r.SentDate)).toLocaleString(undefined, {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })
                    : '-';
                  return (
                    <div key={i} className="py-3 flex items-start gap-3">
                      <span className={`shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5 mt-0.5 ${
                        type === 'Urgent' ? 'bg-red-50 text-red-600' : 'bg-[#e8f0f8] text-[#1e5c97]'
                      }`}>
                        {type || 'Announcement'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800" style={{ overflowWrap: 'anywhere' }}>
                          {String(r.Desc ?? '')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {when} · {Number(r.Recipients ?? 0).toLocaleString()} recipient(s)
                        </p>
                      </div>
                      <Megaphone className="size-4 text-slate-300 shrink-0 mt-1" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
