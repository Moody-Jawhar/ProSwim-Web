// API client for the ProSwim admin portal.
// In dev, /api is proxied by Vite to the local PSWM_API (see vite.config.ts).
// In production set VITE_API_BASE_URL (e.g. https://admin.proswim-lb.com/Proswim_API).

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const API_KEY = import.meta.env.VITE_API_KEY || "dev-api-key-12345";

// --- Auth storage ---

export function getStoredToken(): string | null {
  return localStorage.getItem("portalToken");
}

export interface PortalUser {
  userId: number;
  fullName: string | null;
  email: string | null;
  userType: string | null;
  primaryLocationId: number | null;
  canExport: boolean;
  canSave: boolean;
}

export function getStoredUser(): PortalUser | null {
  const raw = localStorage.getItem("portalUser");
  if (!raw) return null;
  try { return JSON.parse(raw) as PortalUser; } catch { return null; }
}

export function storeAuth(token: string, user: PortalUser): void {
  localStorage.setItem("portalToken", token);
  localStorage.setItem("portalUser", JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem("portalToken");
  localStorage.removeItem("portalUser");
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// --- Core fetch helper ---

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-KEY": API_KEY,
  };

  if (requiresAuth) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...((options.headers as Record<string, string>) || {}) },
  });

  if (res.status === 401 && requiresAuth) {
    clearAuth();
    // Hard redirect: any 401 on an authenticated call means the session is gone.
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError("Session expired.", 401);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    try {
      const parsed = JSON.parse(txt);
      throw new ApiError(parsed.message || `Request failed (${res.status})`, res.status);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(txt || `Request failed (${res.status})`, res.status);
    }
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- Auth ---

export interface LoginResponse extends PortalUser {
  /** Present when sign-in completed. Absent when a second factor is required. */
  token: string | null;
  mfaRequired: boolean;
  challengeId: string | null;
  sentTo: string | null;
  expiresInSeconds: number | null;
  resendInSeconds: number | null;
  /** Present only when "remember this device" was ticked. */
  deviceToken: string | null;
}

// Trusted-device token — lets this browser skip the code for ~20 days.
export function getDeviceToken(): string | null {
  return localStorage.getItem("portalDeviceToken");
}

export function storeDeviceToken(token: string): void {
  localStorage.setItem("portalDeviceToken", token);
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>(
    "/api/portal/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password, deviceToken: getDeviceToken() }),
    },
    false
  );
}

export async function verifyMfa(
  challengeId: string,
  code: string,
  rememberDevice: boolean
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>(
    "/api/portal/auth/verify-mfa",
    { method: "POST", body: JSON.stringify({ challengeId, code, rememberDevice }) },
    false
  );
}

export async function resendMfa(challengeId: string): Promise<{
  sentTo: string;
  expiresInSeconds: number;
  resendInSeconds: number;
}> {
  return apiRequest(
    "/api/portal/auth/resend-mfa",
    { method: "POST", body: JSON.stringify({ challengeId }) },
    false
  );
}

export async function me(): Promise<{ userId: number; userType: string }> {
  return apiRequest<{ userId: number; userType: string }>("/api/portal/auth/me");
}

export { apiRequest };
