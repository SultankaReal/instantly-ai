/**
 * Client-side auth utilities.
 * These functions are safe to call only in browser contexts (Client Components).
 * For server-side token access, read from cookies via next/headers.
 */

const TOKEN_KEY = 'inkflow_access_token';
const REFRESH_TOKEN_KEY = 'inkflow_refresh_token';
const USER_KEY = 'inkflow_user';

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  role: 'author' | 'admin';
};

/**
 * Retrieve the stored access token from localStorage.
 * Returns null if not in browser or token is absent.
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Persist the access token in localStorage.
 */
export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove the access token from localStorage.
 */
export function clearStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Retrieve the stored refresh token from localStorage.
 */
export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Persist the refresh token in localStorage.
 */
export function setStoredRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/**
 * Remove the refresh token from localStorage.
 */
export function clearStoredRefreshToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Retrieve the stored user info from localStorage.
 */
export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

/**
 * Persist user info in localStorage.
 */
export function setStoredUser(user: StoredUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Clear all auth state from localStorage.
 */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Returns true if a token is present in localStorage.
 * Does NOT validate the token signature or expiry.
 */
export function isAuthenticated(): boolean {
  return getStoredToken() !== null;
}

/** Alias for getStoredToken — used by auth layout redirect check. */
export const getAccessToken = getStoredToken;

/** Alias for getStoredRefreshToken — used by useAuth hook. */
export const getRefreshToken = getStoredRefreshToken;

/** Alias for clearAuth — clears all tokens. */
export const clearTokens = clearAuth;

/** Persist both access and refresh tokens in one call. */
export function setTokens(accessToken: string, refreshToken: string): void {
  setStoredToken(accessToken);
  setStoredRefreshToken(refreshToken);
}
