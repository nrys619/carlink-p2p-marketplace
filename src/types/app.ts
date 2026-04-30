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
  tags: string[]
  inspection: string
  verified: boolean
  sellerId?: string
  description?: string
  sellerName?: string
  createdAt?: string
  status?: 'published' | 'draft' | 'paused'
}

export type ChatMessage = {
  from: 'buyer' | 'seller'
  body: string
  time: string
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
