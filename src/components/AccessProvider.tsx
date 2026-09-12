// Role-based access: loads the current user's access items from the API once,
// and exposes canView / canEdit + the item list (for the landing launcher).
// Levels: 'None' | 'View' | 'Full'. Unknown routes fail OPEN (deep/unregistered
// routes aren't blocked); the server keeps its own hard role-gates as the lock.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from '../api/portalApi';

export interface AccessItem { code: string; label: string; group: string; level: string }
interface AccessCtx {
  items: AccessItem[];
  map: Record<string, string>;
  loading: boolean;
  canView: (route?: string) => boolean;
  canEdit: (route?: string) => boolean;
}

const Ctx = createContext<AccessCtx>({ items: [], map: {}, loading: true, canView: () => true, canEdit: () => true });
export const useAccess = () => useContext(Ctx);

export function AccessProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AccessItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiRequest<{ items: AccessItem[] }>('/api/portal/access/me')
      .then((r) => { if (alive) setItems(r?.items ?? []); })
      .catch(() => { /* fail open: leave empty */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const map = useMemo(() => Object.fromEntries(items.map((i) => [i.code, i.level])), [items]);
  const lvl = (route?: string) => (route && map[route]) || undefined;
  const canView = (route?: string) => { const l = lvl(route); return l === undefined ? true : l !== 'None'; };
  const canEdit = (route?: string) => { const l = lvl(route); return l === undefined ? true : l === 'Full'; };

  return <Ctx.Provider value={{ items, map, loading, canView, canEdit }}>{children}</Ctx.Provider>;
}
