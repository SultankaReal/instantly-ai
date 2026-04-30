const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

async function apiFetch<T>(path: string, options?: RequestInit & { token?: string }): Promise<T> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (options?.token) headers['Authorization'] = `Bearer ${options.token}`

  const { token: _token, ...restOptions } = options ?? {}
  void _token

  const res = await fetch(`${API_URL}${path}`, { ...restOptions, headers })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'network_error' }))
    throw new Error((error as { error?: string }).error ?? 'request_failed')
  }
  return res.json() as Promise<T>
}

export const api = {
  auth: {
    login: (body: { email: string; password: string }) =>
      apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body: { email: string; password: string; fullName?: string }) =>
      apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    logout: (token: string, refreshToken: string) =>
      apiFetch('/auth/logout', { method: 'POST', token, body: JSON.stringify({ refreshToken }) }),
    forgotPassword: (email: string) =>
      apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token: string, password: string) =>
      apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
    refresh: (refreshToken: string) =>
      apiFetch('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  },
  accounts: {
    list: (token: string) => apiFetch('/accounts', { token }),
    create: (token: string, body: unknown) =>
      apiFetch('/accounts', { method: 'POST', token, body: JSON.stringify(body) }),
    update: (token: string, id: string, body: unknown) =>
      apiFetch(`/accounts/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    delete: (token: string, id: string) =>
      apiFetch(`/accounts/${id}`, { method: 'DELETE', token }),
    startWarmup: (token: string, id: string) =>
      apiFetch(`/accounts/${id}/warmup/start`, { method: 'POST', token }),
    stopWarmup: (token: string, id: string) =>
      apiFetch(`/accounts/${id}/warmup/stop`, { method: 'POST', token }),
    getScore: (token: string, id: string) =>
      apiFetch(`/accounts/${id}/score`, { token }),
    verifyDns: (token: string, id: string) =>
      apiFetch(`/accounts/${id}/dns/verify`, { method: 'POST', token }),
  },
  campaigns: {
    list: (token: string) => apiFetch('/campaigns', { token }),
    get: (token: string, id: string) => apiFetch(`/campaigns/${id}`, { token }),
    create: (token: string, body: unknown) =>
      apiFetch('/campaigns', { method: 'POST', token, body: JSON.stringify(body) }),
    update: (token: string, id: string, body: unknown) =>
      apiFetch(`/campaigns/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    start: (token: string, id: string) =>
      apiFetch(`/campaigns/${id}/start`, { method: 'POST', token }),
    pause: (token: string, id: string) =>
      apiFetch(`/campaigns/${id}/pause`, { method: 'POST', token }),
    archive: (token: string, id: string) =>
      apiFetch(`/campaigns/${id}/archive`, { method: 'POST', token }),
  },
  inbox: {
    list: (token: string, page = 1) =>
      apiFetch(`/inbox?page=${page}`, { token }),
    markRead: (token: string, id: string) =>
      apiFetch(`/inbox/${id}/read`, { method: 'POST', token }),
    reply: (token: string, id: string, body: string) =>
      apiFetch(`/inbox/${id}/reply`, { method: 'POST', token, body: JSON.stringify({ body }) }),
    updateLeadStatus: (token: string, id: string, status: string) =>
      apiFetch(`/inbox/${id}/lead-status`, { method: 'PATCH', token, body: JSON.stringify({ status }) }),
  },
  billing: {
    checkout: (token: string, plan: string, period: string) =>
      apiFetch('/billing/checkout', {
        method: 'POST',
        token,
        body: JSON.stringify({ plan, period }),
      }),
    subscription: (token: string) => apiFetch('/billing/subscription', { token }),
    cancel: (token: string) => apiFetch('/billing/cancel', { method: 'POST', token }),
    portal: (token: string) => apiFetch('/billing/portal', { method: 'POST', token }),
  },
  unsubscribe: {
    confirm: (token: string) =>
      apiFetch('/unsubscribe', { method: 'POST', body: JSON.stringify({ token }) }),
  },
}
