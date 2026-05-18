import type { ComponentType } from 'react'

export type Vehicle = {
  id: number
  title: string
  maker: string
  grade: string
  year: string
  mileage: number
  price: number
  location: string
  image: string
  images?: string[]
  tags: string[]
  inspection: string
  verified: boolean
  sellerId?: string
  description?: string
  sellerName?: string
  createdAt?: string
  updatedAt?: string
  status?: 'published' | 'draft' | 'paused'
}

export type ChatMessage = {
  from: 'buyer' | 'seller'
  body: string
  time: string
}

export type ConversationMessage = {
  id: string
  dealId?: string
  vehicleId: number
  senderId?: string
  senderName: string
  senderRole: 'buyer' | 'seller' | 'admin' | 'system'
  body: string
  createdAt: string
}

export type NotificationRecord = {
  id: string
  userId?: string
  kind: 'listing' | 'deal' | 'message' | 'system'
  title: string
  body: string
  href?: string
  read: boolean
  createdAt: string
}

export type DealEvent = {
  id: string
  kind: 'created' | 'status' | 'documents' | 'handover' | 'message' | 'system'
  title: string
  body: string
  createdAt: string
}

export type WizardStep = {
  label: string
  title: string
  body: string
  icon: ComponentType<{ size?: number }>
}

export type SavedSearch = {
  id: string
  label: string
  bodyType: string
  location: string
  maker: string
  mileage: number
  model: string
  price: number
  query: string
}

export type AuthUser = {
  id: string
  name: string
  phone: string
  role: 'seller' | 'buyer' | 'admin'
  verified: boolean
  createdAt: string
}

export type DealRecord = {
  id: string
  vehicleId: number
  vehicleTitle: string
  buyerId?: string
  buyerName: string
  buyerPhone: string
  sellerId?: string
  sellerName?: string
  amount: number
  status: 'inquiry' | 'applied' | 'payment_pending' | 'paid' | 'handover' | 'transfer' | 'completed' | 'cancelled'
  note?: string
  documentChecks?: string[]
  handoverDate?: string
  handoverPlace?: string
  handoverMemo?: string
  events?: DealEvent[]
  createdAt: string
  updatedAt: string
}

export type PersistedAppState = {
  analysisDone: boolean
  certificateReadMethod?: 'upload' | 'electronic' | null
  chatMessages: ChatMessage[]
  compareIds: number[]
  dealProgress: number
  draftFields: Record<string, string>
  draftLocation?: string
  draftPrice: number
  draftDescription?: string
  sellerConsent?: boolean
  favorites: number[]
  inspectionChecks: string[]
  lastDraftSavedAt?: string
  photoImages: string[]
  published: boolean
  scanMode: 'certificate' | 'photo' | null
  selectedOptions: string[]
  savedSearches: SavedSearch[]
  vehicles: Vehicle[]
}
