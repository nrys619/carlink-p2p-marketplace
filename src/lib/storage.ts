import type { AuthUser, PersistedAppState } from '../types/app'

export const storageKey = 'carlink-p2p-marketplace-state'
const apiBase = import.meta.env.VITE_API_URL ?? ''

export function loadPersistedState(): PersistedAppState | null {
  if (typeof window === 'undefined') return null

  try {
    const saved = window.localStorage.getItem(storageKey)
    return saved ? (JSON.parse(saved) as PersistedAppState) : null
  } catch {
    return null
  }
}

export function savePersistedState(state: PersistedAppState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state))
}

export function clearPersistedState() {
  window.localStorage.removeItem(storageKey)
}

export async function loadRemoteState(): Promise<PersistedAppState | null> {
  try {
    const response = await fetch(`${apiBase}/api/state`)
    if (!response.ok) return null
    const payload = (await response.json()) as { state?: PersistedAppState | null }
    return payload.state ?? null
  } catch {
    return null
  }
}

export async function saveRemoteState(state: PersistedAppState) {
  try {
    await fetch(`${apiBase}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    })
  } catch {
    // Local storage remains the offline fallback.
  }
}

export async function clearRemoteState() {
  try {
    await fetch(`${apiBase}/api/state`, { method: 'DELETE' })
  } catch {
    // Local storage remains the offline fallback.
  }
}

export async function loadSession(): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${apiBase}/api/auth/session`, { credentials: 'include' })
    if (!response.ok) return null
    const payload = (await response.json()) as { user?: AuthUser | null }
    return payload.user ?? null
  } catch {
    return null
  }
}

export async function loginUser(payload: { name: string; phone: string; role: AuthUser['role'] }): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return null
    const result = (await response.json()) as { user?: AuthUser }
    return result.user ?? null
  } catch {
    return null
  }
}

export async function logoutUser() {
  try {
    await fetch(`${apiBase}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Session will be treated as logged out locally.
  }
}
