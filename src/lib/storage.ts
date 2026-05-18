import type { AuthUser, ConversationMessage, DealRecord, NotificationRecord, PersistedAppState, Vehicle } from '../types/app'

export const storageKey = 'carlink-p2p-marketplace-state'
const sessionKey = 'carlink-p2p-marketplace-session'
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

export async function loadListings(): Promise<Vehicle[]> {
  try {
    const response = await fetch(`${apiBase}/api/listings`)
    if (!response.ok) return []
    const payload = (await response.json()) as { listings?: Vehicle[] }
    return payload.listings ?? []
  } catch {
    return []
  }
}

export async function loadMyListings(): Promise<Vehicle[]> {
  try {
    const response = await fetch(`${apiBase}/api/listings?scope=mine`, { credentials: 'include' })
    if (!response.ok) return []
    const payload = (await response.json()) as { listings?: Vehicle[] }
    return payload.listings ?? []
  } catch {
    return []
  }
}

export async function saveListing(vehicle: Vehicle): Promise<Vehicle | null> {
  try {
    const response = await fetch(`${apiBase}/api/listings`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing: vehicle }),
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { listing?: Vehicle }
    return payload.listing ?? null
  } catch {
    return null
  }
}

export async function updateListingStatus(id: number, status: Vehicle['status']): Promise<Vehicle | null> {
  try {
    const response = await fetch(`${apiBase}/api/listings/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { listing?: Vehicle }
    return payload.listing ?? null
  } catch {
    return null
  }
}

export async function uploadImage(image: string): Promise<string | null> {
  try {
    const response = await fetch(`${apiBase}/api/uploads`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { upload?: { url?: string } }
    return payload.upload?.url ?? null
  } catch {
    return null
  }
}

export async function loadDeals(): Promise<DealRecord[]> {
  try {
    const response = await fetch(`${apiBase}/api/deals`, { credentials: 'include' })
    if (!response.ok) return []
    const payload = (await response.json()) as { deals?: DealRecord[] }
    return payload.deals ?? []
  } catch {
    return []
  }
}

export async function createDeal(payload: Omit<DealRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<DealRecord | null> {
  try {
    const response = await fetch(`${apiBase}/api/deals`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return null
    const result = (await response.json()) as { deal?: DealRecord }
    return result.deal ?? null
  } catch {
    return null
  }
}

export async function updateDealStatus(id: string, status: DealRecord['status']): Promise<DealRecord | null> {
  try {
    const response = await fetch(`${apiBase}/api/deals/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) return null
    const result = (await response.json()) as { deal?: DealRecord }
    return result.deal ?? null
  } catch {
    return null
  }
}

export async function updateDealDocumentChecks(id: string, documentChecks: string[]): Promise<DealRecord | null> {
  try {
    const response = await fetch(`${apiBase}/api/deals/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentChecks }),
    })
    if (!response.ok) return null
    const result = (await response.json()) as { deal?: DealRecord }
    return result.deal ?? null
  } catch {
    return null
  }
}

export async function updateDealHandoverPlan(
  id: string,
  payload: Pick<DealRecord, 'handoverDate' | 'handoverPlace' | 'handoverMemo'>,
): Promise<DealRecord | null> {
  try {
    const response = await fetch(`${apiBase}/api/deals/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return null
    const result = (await response.json()) as { deal?: DealRecord }
    return result.deal ?? null
  } catch {
    return null
  }
}

export async function loadConversationMessages(params: { dealId?: string; vehicleId: number }): Promise<ConversationMessage[]> {
  try {
    const searchParams = new URLSearchParams({ vehicleId: String(params.vehicleId) })
    if (params.dealId) searchParams.set('dealId', params.dealId)
    const response = await fetch(`${apiBase}/api/messages?${searchParams.toString()}`, { credentials: 'include' })
    if (!response.ok) return []
    const payload = (await response.json()) as { messages?: ConversationMessage[] }
    return payload.messages ?? []
  } catch {
    return []
  }
}

export async function loadNotifications(): Promise<NotificationRecord[]> {
  try {
    const response = await fetch(`${apiBase}/api/notifications`, { credentials: 'include' })
    if (!response.ok) return []
    const payload = (await response.json()) as { notifications?: NotificationRecord[] }
    return payload.notifications ?? []
  } catch {
    return []
  }
}

export async function markNotificationRead(id: string): Promise<NotificationRecord | null> {
  try {
    const response = await fetch(`${apiBase}/api/notifications/${id}`, {
      method: 'PATCH',
      credentials: 'include',
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { notification?: NotificationRecord }
    return payload.notification ?? null
  } catch {
    return null
  }
}

export async function createConversationMessage(
  payload: Omit<ConversationMessage, 'id' | 'createdAt' | 'senderName'> & { senderName?: string },
): Promise<ConversationMessage | null> {
  try {
    const response = await fetch(`${apiBase}/api/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return null
    const result = (await response.json()) as { message?: ConversationMessage }
    return result.message ?? null
  } catch {
    return null
  }
}

export async function loadSession(): Promise<AuthUser | null> {
  const localUser = loadLocalSession()
  try {
    const response = await fetch(`${apiBase}/api/auth/session`, { credentials: 'include' })
    if (!response.ok) return localUser
    const payload = (await response.json()) as { user?: AuthUser | null }
    return payload.user ?? localUser
  } catch {
    return localUser
  }
}

export async function loginUser(payload: { name: string; phone: string; role: AuthUser['role']; password?: string }): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return createLocalSession(payload)
    const result = (await response.json()) as { user?: AuthUser }
    if (result.user) {
      saveLocalSession(result.user)
    }
    return result.user ?? createLocalSession(payload)
  } catch {
    return createLocalSession(payload)
  }
}

export async function logoutUser() {
  clearLocalSession()
  try {
    await fetch(`${apiBase}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Session will be treated as logged out locally.
  }
}

function loadLocalSession(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(sessionKey)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function saveLocalSession(user: AuthUser) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(sessionKey, JSON.stringify(user))
}

function clearLocalSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(sessionKey)
}

function createLocalSession(payload: { name: string; phone: string; role: AuthUser['role'] }) {
  const user: AuthUser = {
    id: `local-${Date.now()}`,
    name: payload.name.trim() || '出品者',
    phone: payload.phone.trim(),
    role: payload.role,
    verified: false,
    createdAt: new Date().toISOString(),
  }
  saveLocalSession(user)
  return user
}
