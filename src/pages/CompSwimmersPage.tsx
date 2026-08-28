import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Trophy, Medal, ChevronRight, Users } from 'lucide-react';
import { PageHero } from '../components/PageHero';
import { apiRequest } from '../api/portalApi';

type Row = Record<string, unknown>;
const str = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));
const num = (r: Row, k: string) => Number(r[k] ?? 0);

function ageOf(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function fmtDate(v: string): string {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

// Competitive Team roster: every swimmer flagged as Competitive Team, with
// portfolio counts. Clicking a swimmer opens their portfolio directly.
// that's where staff record results, awards, documents and evaluations.
export function CompSwimmersPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiRequest<Row[]>('/api/portal/comp/swimmers').then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load competitive swimmers.'));
  }, []);

  const filtered = (rows ?? []).filter((r) =>
    str(r, 'StudentFullName').toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="p-6 md:p-8">
      <PageHero
        title="Competitive Swimmers"
        subtitle="The competitive team, tap a swimmer to open their portfolio"
      />

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

      {rows !== null && (
        <>
          <div className="mb-4 max-w-sm">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search swimmers…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5c97]/40"
            />
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Users className="size-7 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">
                {rows.length === 0
                  ? 'No competitive swimmers yet, flag a student as "Competitive Team" on their profile.'
                  : 'No swimmers match your search.'}
              </p>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => {
              const id = num(r, 'StudentId');
              const name = str(r, 'StudentFullName');
              const photo = str(r, 'StudentPhotoUrl');
              const age = ageOf(str(r, 'StudentDateOfBirth'));
              const active = r['StudentActive'] === true || r['StudentActive'] === 1;
              return (
                <button
                  key={id}
                  onClick={() => navigate(`/students/${id}/portfolio`)}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 text-left hover:border-[#1e5c97]/30 hover:shadow-md active:scale-[0.99] transition-all"
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                    style={{ background: 'rgba(30,92,151,0.12)' }}>
                    {photo ? (
                      <img src={photo} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[#1e5c97] font-bold text-lg">{initialsOf(name)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{name}</p>
                      {!active && (
                        <span className="text-[10px] font-bold uppercase rounded-full px-2 py-0.5 bg-slate-100 text-slate-500 shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {[age !== null ? `Age ${age}` : null, str(r, 'StudentGender') || null,
                        str(r, 'LocationNickName') || null].filter(Boolean).join(' • ') || '-'}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Trophy className="size-3.5 text-[#1e5c97]" /> {num(r, 'ResultsCount')} results
                      </span>
                      <span className="flex items-center gap-1">
                        <Medal className="size-3.5 text-amber-500" /> {num(r, 'AwardsCount')} awards
                      </span>
                      <span className="hidden sm:inline">Last: {fmtDate(str(r, 'LastResultDate'))}</span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-slate-300 shrink-0" />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
