// Role-based access: loads the current user's { route: level } map from the API
// once, and exposes canView / canEdit. Levels: 'None' | 'View' | 'Full'.
// Unknown routes fail OPEN (so deep/unregistered routes aren't blocked); the
// server keeps its own hard role-gates as the real lock.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiRequest } from '../api/portalApi';

type AccessMap = Record<string, string>;
interface AccessCtx {
  map: AccessMap;
  loading: boolean;
  canView: (route?: string) => boolean;
  canEdit: (route?: string) => boolean;
}

const Ctx = createContext<AccessCtx>({ map: {}, loading: true, canView: () => true, canEdit: () => true });
export const useAccess = () => useContext(Ctx);

export function AccessProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<AccessMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiRequest<AccessMap>('/api/portal/access/me')
      .then((m) => { if (alive) setMap(m || {}); })
      .catch(() => { /* fail open: leave map empty */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const lvl = (route?: string) => (route && map[route]) || undefined;
  const canView = (route?: string) => { const l = lvl(route); return l === undefined ? true : l !== 'None'; };
  const canEdit = (route?: string) => { const l = lvl(route); return l === undefined ? true : l === 'Full'; };

  return <Ctx.Provider value={{ map, loading, canView, canEdit }}>{children}</Ctx.Provider>;
}
