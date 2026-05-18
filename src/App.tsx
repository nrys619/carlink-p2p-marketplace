import {
  BadgeCheck,
  Bell,
  CalendarDays,
  Camera,
  CarFront,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  FileScan,
  Gauge,
  Heart,
  Home,
  ImagePlus,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Nfc,
  PenLine,
  ReceiptText,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Upload,
  UserCheck,
  WalletCards,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { catalogMakers, catalogSource, catalogStats, findCatalogModel, getCatalogModels } from './data/catalog'
import { aiOptions, baseVehicles, initialChat, photoSlots, scannedFields } from './data/demo'
import {
  clearPersistedState,
  clearRemoteState,
  createConversationMessage,
  createDeal,
  loadConversationMessages,
  loadDeals,
  loadListings,
  loadMyListings,
  loadNotifications,
  loadPersistedState,
  loadSession,
  loginUser,
  logoutUser,
  markNotificationRead,
  saveListing,
  savePersistedState,
  updateDealDocumentChecks,
  updateDealHandoverPlan,
  updateListingStatus,
  updateDealStatus,
  uploadImage,
} from './lib/storage'
import { currentTimeLabel, mileageLabel, yen } from './lib/format'
import type {
  AuthUser,
  ConversationMessage,
  DealRecord,
  NotificationRecord,
  PersistedAppState,
  SavedSearch,
  Vehicle,
  WizardStep,
} from './types/app'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type ReadinessStatus = {
  ok: boolean
  checks: { key: string; label: string; ok: boolean }[]
  state: {
    vehicles: number
    chatMessages: number
    savedSearches: number
    users?: number
    listings?: number
    deals?: number
    messages?: number
    notifications?: number
  }
}

type AnalysisResult = {
  fields?: Record<string, string>
  options?: string[]
  price?: number
  confidence?: number
  source?: 'openai' | 'fallback'
  note?: string
}

type NdefRecord = {
  data?: DataView
  encoding?: string
  recordType?: string
}

type NdefReadingEvent = {
  message: {
    records: NdefRecord[]
  }
}

interface NdefReader {
  scan: () => Promise<void>
  addEventListener: (type: 'reading', listener: (event: NdefReadingEvent) => void) => void
}

declare global {
  interface Window {
    NDEFReader?: new () => NdefReader
  }
}

type AppView = 'home' | 'sell' | 'deal' | 'message' | 'admin'

type Toast = { id: string; message: string; type: 'success' | 'error' | 'info' }

const dealSteps = [
  { label: '本人確認', icon: UserCheck },
  { label: '購入申請', icon: ClipboardCheck },
  { label: '入金確認', icon: WalletCards },
  { label: '車両引渡し', icon: Truck },
  { label: '名義変更', icon: ReceiptText },
  { label: '売上入金', icon: BadgeCheck },
]

const dealStatusLabels: Record<DealRecord['status'], string> = {
  inquiry: '相談中',
  applied: '購入申請済み',
  payment_pending: '入金待ち',
  paid: '入金確認済み',
  handover: '車両引き渡し',
  transfer: '名義変更中',
  completed: '完了',
  cancelled: 'キャンセル',
}

const dealEventLabels = {
  created: '申請',
  status: '進行',
  documents: '書類',
  handover: '予定',
  message: '相談',
  system: '記録',
} as const

const authRoleLabels: Record<AuthUser['role'], string> = {
  seller: '売主',
  buyer: '買主',
  admin: '運営',
}

const inspectionCheckItems = [
  '車検証と車台番号',
  '修復歴・冠水歴',
  'メーター表示',
  '警告灯',
  'タイヤ溝',
  'オイル漏れ',
  'エアコン',
  '鍵・スペアキー',
]

const listingSteps: WizardStep[] = [
  {
    label: '読み取り',
    title: '読み取り方法を選ぶ',
    body: '車検証から正確に読み取るか、車の写真からAIで掲載情報を作るか選べます。',
    icon: FileScan,
  },
  {
    label: '写真',
    title: '掲載写真をそろえる',
    body: '外装・内装・メーター・装備まわりを撮影。足りない写真はその場で案内します。',
    icon: Camera,
  },
  {
    label: '装備確認',
    title: 'AI候補を確認する',
    body: '写真から検出した装備候補をユーザーが最終確認。誤判定は公開前に修正できます。',
    icon: Sparkles,
  },
  {
    label: '価格設定',
    title: '相場を見ながら価格を決める',
    body: '掲載相場と想定成約レンジを見ながら、売り急ぎ・標準・強気の価格を選べます。',
    icon: CircleDollarSign,
  },
  {
    label: '掲載',
    title: '公開前の最終確認',
    body: '重要項目、契約条件、名義変更方法を確認して、買い手に見える掲載内容を公開します。',
    icon: BadgeCheck,
  },
]

const viewFromHash = (): AppView => {
  if (typeof window === 'undefined') return 'home'
  if (window.location.hash === '#list') return 'sell'
  if (window.location.hash === '#deal') return 'deal'
  if (window.location.hash === '#message') return 'message'
  if (window.location.hash === '#admin') return 'admin'
  return 'home'
}

const getVehicleBodyTypes = (vehicle: Vehicle) => {
  const maker = catalogMakers.find((catalogMaker) => catalogMaker.name === vehicle.maker)
  const matchedModel = maker?.models.find((model) => vehicle.title.includes(model.name))
  if (matchedModel) return matchedModel.bodyTypes

  const text = `${vehicle.title} ${vehicle.grade} ${vehicle.tags.join(' ')}`
  if (/N-BOX|タント|軽|ジムニー|スペーシア/.test(text)) return ['軽自動車']
  if (/CX-|SUV|ハリアー|フォレスター|ランド|エクストレイル/.test(text)) return ['SUV・クロカン']
  if (/ヴォクシー|セレナ|アルファード|ステップワゴン/.test(text)) return ['ミニバン']
  if (/レヴォーグ|ワゴン|ツーリング/.test(text)) return ['ステーションワゴン']
  if (/ロードスター|911|クーペ|BRZ|フェアレディ/.test(text)) return ['クーペ']
  return ['セダン']
}

const normalizeSavedSearches = (value: unknown): SavedSearch[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Partial<SavedSearch> => Boolean(item) && typeof item === 'object' && 'label' in item)
    .map((item, index) => ({
      id: item.id ?? `saved-${index}`,
      label: item.label ?? '保存条件',
      bodyType: item.bodyType ?? 'すべて',
      location: item.location ?? 'すべて',
      maker: item.maker ?? 'すべて',
      mileage: item.mileage ?? 80000,
      model: item.model ?? 'すべて',
      price: item.price ?? 350,
      query: item.query ?? '',
    }))
}

const emptyPhotoImages = () => photoSlots.map(() => '')

const inferMaker = (title: string) => {
  const normalizedTitle = title.trim()
  return catalogMakers.find((maker) => normalizedTitle.includes(maker.name))?.name ?? 'その他'
}

const inferYear = (value: string) => {
  const westernYear = value.match(/20\d{2}/)?.[0]
  if (westernYear) return `${westernYear}年`
  const reiwaYear = value.match(/令和\s*(\d+)/)?.[1]
  if (reiwaYear) return `${2018 + Number(reiwaYear)}年`
  const heiseiYear = value.match(/平成\s*(\d+)/)?.[1]
  if (heiseiYear) return `${1988 + Number(heiseiYear)}年`
  return '年式未入力'
}

const toAnalysisImageUrl = (image: string) => {
  if (!image) return image
  if (image.startsWith('data:') || image.startsWith('http')) return image
  if (typeof window === 'undefined') return image
  return new URL(image, window.location.origin).toString()
}

const compressImageFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('error', () => reject(new Error('画像を読み込めませんでした')))
    reader.addEventListener('load', () => {
      const image = new Image()
      image.addEventListener('error', () => reject(new Error('画像を処理できませんでした')))
      image.addEventListener('load', () => {
        const maxSize = 1400
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('画像処理を開始できませんでした'))
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      })
      image.src = String(reader.result)
    })
    reader.readAsDataURL(file)
  })

function App() {
  const savedState = useMemo(() => loadPersistedState(), [])
  const [activeView, setActiveView] = useState<AppView>(() => viewFromHash())
  const [vehicles, setVehicles] = useState(savedState?.vehicles ?? [])
  const [selectedId, setSelectedId] = useState(1)
  const [listingStep, setListingStep] = useState(0)
  const [analysisDone, setAnalysisDone] = useState(savedState?.analysisDone ?? false)
  const [published, setPublished] = useState(savedState?.published ?? false)
  const [query, setQuery] = useState('')
  const [makerFilter, setMakerFilter] = useState('すべて')
  const [modelFilter, setModelFilter] = useState('すべて')
  const [bodyTypeFilter, setBodyTypeFilter] = useState('すべて')
  const [locationFilter, setLocationFilter] = useState('すべて')
  const [mileageLimit, setMileageLimit] = useState(80000)
  const [priceLimit, setPriceLimit] = useState(350)
  const [dealProgress, setDealProgress] = useState(savedState?.dealProgress ?? 2)
  const [message, setMessage] = useState('')
  const [scanMode, setScanMode] = useState<'certificate' | 'photo' | null>(
    savedState?.scanMode ?? null,
  )
  const [certificateReadMethod, setCertificateReadMethod] = useState<'upload' | 'electronic' | null>(
    savedState?.certificateReadMethod ?? null,
  )
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState('')
  const [draftSavedAt, setDraftSavedAt] = useState(savedState?.lastDraftSavedAt ?? '')
  const [sortMode, setSortMode] = useState<'newest' | 'priceAsc' | 'mileageAsc'>('newest')
  const [yearMin, setYearMin] = useState(2010)
  const [yearMax, setYearMax] = useState(2025)
  const [fuelTypeFilter, setFuelTypeFilter] = useState('すべて')
  const [driveTypeFilter, setDriveTypeFilter] = useState('すべて')
  const [accidentFilter, setAccidentFilter] = useState<'すべて' | '修復歴なし'>('すべて')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installDismissed, setInstallDismissed] = useState(false)
  const [legalPanel, setLegalPanel] = useState<'terms' | 'privacy' | 'commerce' | null>(null)
  const [serverSynced, setServerSynced] = useState(false)
  const [readiness, setReadiness] = useState<ReadinessStatus | null>(null)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [loginName, setLoginName] = useState('')
  const [loginPhone, setLoginPhone] = useState('')
  const [loginRole, setLoginRole] = useState<AuthUser['role']>('buyer')
  const [loginPassword, setLoginPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [nfcReading, setNfcReading] = useState(false)
  const [photoMessage, setPhotoMessage] = useState('')
  const [deals, setDeals] = useState<DealRecord[]>([])
  const [dealMessage, setDealMessage] = useState('')
  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [buyerNote, setBuyerNote] = useState('')
  const [handoverDate, setHandoverDate] = useState('')
  const [handoverPlace, setHandoverPlace] = useState('')
  const [handoverMemo, setHandoverMemo] = useState('')
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([])
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [editingListingId, setEditingListingId] = useState<number | null>(null)
  const [chatMessages, setChatMessages] = useState(savedState?.chatMessages ?? initialChat)
  const [compareIds, setCompareIds] = useState<number[]>(savedState?.compareIds ?? [])
  const [favorites, setFavorites] = useState(savedState?.favorites ?? [])
  const [inspectionChecks, setInspectionChecks] = useState<string[]>(savedState?.inspectionChecks ?? [])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() =>
    normalizeSavedSearches(savedState?.savedSearches),
  )
  const [downPayment, setDownPayment] = useState(300000)
  const [loanMonths, setLoanMonths] = useState(60)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([
    ...(savedState?.selectedOptions ?? ['サンルーフ', 'ETC', 'アダプティブクルーズ']),
  ])
  const [draftPrice, setDraftPrice] = useState(savedState?.draftPrice ?? 3180000)
  const [draftLocation, setDraftLocation] = useState(savedState?.draftLocation ?? '')
  const [draftDescription, setDraftDescription] = useState(savedState?.draftDescription ?? '')
  const [draftFuelType, setDraftFuelType] = useState<Vehicle['fuelType']>(undefined)
  const [draftDriveType, setDraftDriveType] = useState<Vehicle['driveType']>(undefined)
  const [draftColor, setDraftColor] = useState('')
  const [draftAccidentHistory, setDraftAccidentHistory] = useState<boolean | undefined>(undefined)
  const [sellerConsent, setSellerConsent] = useState(savedState?.sellerConsent ?? false)
  const [draftFields, setDraftFields] = useState<Record<string, string>>(
    savedState?.draftFields ?? Object.fromEntries(scannedFields),
  )
  const [photoImages, setPhotoImages] = useState<string[]>(
    savedState?.photoImages ?? emptyPhotoImages(),
  )

  const chatListRef = useRef<HTMLDivElement>(null)

  const [toasts, setToasts] = useState<Toast[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const [loadingVehicles, setLoadingVehicles] = useState(true)

  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const id = `${Date.now()}`
    setToasts((current) => [...current, { id, message, type }])
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4500)
  }

  useEffect(() => {
    // Mark as synced immediately - per-user data comes from dedicated endpoints
    setServerSynced(true)
  }, [])

  useEffect(() => {
    const state: PersistedAppState = {
      analysisDone,
      certificateReadMethod,
      chatMessages,
      compareIds,
      dealProgress,
      draftFields,
      draftLocation,
      draftPrice,
      draftDescription,
      sellerConsent,
      favorites,
      inspectionChecks,
      lastDraftSavedAt: draftSavedAt,
      photoImages,
      published,
      scanMode,
      savedSearches,
      selectedOptions,
      vehicles,
    }
    savePersistedState(state)
  }, [
    analysisDone,
    certificateReadMethod,
    chatMessages,
    compareIds,
    dealProgress,
    draftFields,
    draftLocation,
    draftPrice,
    draftDescription,
    sellerConsent,
    favorites,
    inspectionChecks,
    draftSavedAt,
    photoImages,
    published,
    scanMode,
    savedSearches,
    selectedOptions,
    vehicles,
  ])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  useEffect(() => {
    const handleHashChange = () => setActiveView(viewFromHash())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (detailOpen) setDetailOpen(false)
        else if (legalPanel) setLegalPanel(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [detailOpen, legalPanel])

  useEffect(() => {
    fetch('/api/readiness')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: ReadinessStatus | null) => setReadiness(payload))
      .catch(() => setReadiness(null))
  }, [serverSynced])

  useEffect(() => {
    loadSession().then((user) => {
      setCurrentUser(user)
      if (user) {
        setBuyerName(user.name)
        setBuyerPhone(user.phone)
      }
    })
  }, [])

  useEffect(() => {
    loadListings().then((listings) => {
      if (listings.length > 0) {
        setVehicles(listings)
        setSelectedId((current) => (listings.some((vehicle) => vehicle.id === current) ? current : listings[0].id))
      }
      setLoadingVehicles(false)
    })
    loadDeals().then((records) => setDeals(records))
  }, [])

  useEffect(() => {
    if (!currentUser) return
    loadMyListings().then((listings) => {
      if (listings.length === 0) return
      setVehicles((current) => {
        const merged = [...current]
        for (const listing of listings) {
          const index = merged.findIndex((vehicle) => vehicle.id === listing.id)
          if (index >= 0) {
            merged[index] = listing
          } else {
            merged.unshift(listing)
          }
        }
        return merged
      })
    })
    loadDeals().then((records) => setDeals(records))
    loadNotifications().then((records) => setNotifications(records))
  }, [currentUser])

  const refreshNotifications = () => {
    loadNotifications().then((records) => setNotifications(records))
  }

  const filteredVehicles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = vehicles.filter((vehicle) => {
      if (vehicle.status === 'draft' || vehicle.status === 'paused') return false
      const searchText =
        `${vehicle.title} ${vehicle.maker} ${vehicle.grade} ${vehicle.location} ${vehicle.tags.join(' ')}`.toLowerCase()
      const bodyTypes = getVehicleBodyTypes(vehicle)
      const matchesQuery = normalizedQuery.length === 0 || searchText.includes(normalizedQuery)
      const matchesMaker = makerFilter === 'すべて' || vehicle.maker === makerFilter
      const matchesModel = modelFilter === 'すべて' || vehicle.title.includes(modelFilter)
      const matchesBodyType = bodyTypeFilter === 'すべて' || bodyTypes.includes(bodyTypeFilter)
      const matchesLocation = locationFilter === 'すべて' || vehicle.location.startsWith(locationFilter)
      const matchesFavorite = !showFavoritesOnly || favorites.includes(vehicle.id)
      const vehicleYear = parseInt(vehicle.year?.replace(/[^0-9]/g, '').slice(0, 4) ?? '2020') || 2020
      const matchesYear = vehicleYear >= yearMin && vehicleYear <= yearMax
      const matchesFuelType = fuelTypeFilter === 'すべて' || vehicle.fuelType === fuelTypeFilter ||
        (fuelTypeFilter === 'ハイブリッド' && vehicle.tags.some(t => t.includes('HV') || t.includes('e-POWER') || t.includes('ハイブリッド'))) ||
        (fuelTypeFilter === 'EV' && vehicle.tags.some(t => t.includes('EV') || t === 'リーフ')) ||
        (fuelTypeFilter === 'PHEV' && vehicle.tags.some(t => t.includes('PHEV') || t.includes('PHV')))
      const matchesDriveType = driveTypeFilter === 'すべて' || vehicle.driveType === driveTypeFilter ||
        (driveTypeFilter === '4WD' && vehicle.tags.some(t => t === '4WD' || t === 'AWD' || t === 'e-4WD' || t === '4×4'))
      const matchesAccident = accidentFilter === 'すべて' || vehicle.accidentHistory === false
      return (
        matchesQuery &&
        matchesMaker &&
        matchesModel &&
        matchesBodyType &&
        matchesLocation &&
        matchesFavorite &&
        matchesYear &&
        matchesFuelType &&
        matchesDriveType &&
        matchesAccident &&
        vehicle.price <= priceLimit * 10000 &&
        vehicle.mileage <= mileageLimit
      )
    })

    return [...filtered].sort((a, b) => {
      if (sortMode === 'priceAsc') return a.price - b.price
      if (sortMode === 'mileageAsc') return a.mileage - b.mileage
      return b.id - a.id
    })
  }, [
    accidentFilter,
    bodyTypeFilter,
    driveTypeFilter,
    favorites,
    fuelTypeFilter,
    locationFilter,
    makerFilter,
    mileageLimit,
    modelFilter,
    priceLimit,
    query,
    showFavoritesOnly,
    sortMode,
    vehicles,
    yearMax,
    yearMin,
  ])

  const makers = useMemo(() => ['すべて', ...catalogMakers.map((maker) => maker.name)], [])
  const models = useMemo(
    () => ['すべて', ...Array.from(new Set(getCatalogModels(makerFilter)))],
    [makerFilter],
  )
  const bodyTypes = useMemo(
    () => [
      'すべて',
      ...Array.from(new Set(catalogMakers.flatMap((maker) => maker.models.flatMap((model) => model.bodyTypes)))).sort(
        (a, b) => a.localeCompare(b, 'ja'),
      ),
    ],
    [],
  )
  const locations = useMemo(
    () => ['すべて', ...Array.from(new Set(vehicles.map((vehicle) => vehicle.location.split(' ')[0])))],
    [vehicles],
  )
  const selectedCatalogModel = useMemo(
    () => (modelFilter === 'すべて' ? undefined : findCatalogModel(makerFilter, modelFilter)),
    [makerFilter, modelFilter],
  )

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedId) ?? vehicles[0] ?? baseVehicles[0],
    [selectedId, vehicles],
  )
  const comparedVehicles = useMemo(
    () => compareIds.map((id) => vehicles.find((vehicle) => vehicle.id === id)).filter((vehicle): vehicle is Vehicle => Boolean(vehicle)),
    [compareIds, vehicles],
  )
  const selectedDeal = useMemo(
    () => deals.find((deal) => deal.vehicleId === selectedVehicle.id && deal.status !== 'cancelled') ?? null,
    [deals, selectedVehicle],
  )
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  )
  const activeInspectionChecks = useMemo(
    () => selectedDeal?.documentChecks ?? inspectionChecks,
    [inspectionChecks, selectedDeal],
  )
  const selectedDealEvents = useMemo(
    () => [...(selectedDeal?.events ?? [])].reverse().slice(0, 8),
    [selectedDeal],
  )
  const displayedMessages = useMemo(
    () =>
      conversationMessages.length > 0
        ? conversationMessages.map((chat) => ({
            body: chat.body,
            from: chat.senderId && chat.senderId === selectedVehicle.sellerId ? 'seller' as const : 'buyer' as const,
            time: new Date(chat.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
          }))
        : chatMessages,
    [chatMessages, conversationMessages, selectedVehicle],
  )

  useEffect(() => {
    loadConversationMessages({ dealId: selectedDeal?.id, vehicleId: selectedVehicle.id }).then((messages) =>
      setConversationMessages(messages),
    )
  }, [selectedDeal?.id, selectedVehicle])

  useEffect(() => {
    const list = chatListRef.current
    if (!list) return
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [displayedMessages])

  const reviewQueue = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        vehicle,
        risks: [
          !vehicle.verified ? '本人確認未完了' : '',
          vehicle.tags.length < 3 ? '装備情報が少ない' : '',
          vehicle.mileage > 70000 ? '走行距離多め' : '',
          vehicle.price < 500000 ? '価格異常の確認' : '',
        ].filter(Boolean),
      })),
    [vehicles],
  )
  const myListings = useMemo(
    () => (currentUser ? vehicles.filter((vehicle) => vehicle.sellerId === currentUser.id) : []),
    [currentUser, vehicles],
  )
  const searchLabel = `${makerFilter === 'すべて' ? '全メーカー' : makerFilter} / ${
    modelFilter === 'すべて' ? '全車種' : modelFilter
  } / ${bodyTypeFilter === 'すべて' ? '全タイプ' : bodyTypeFilter} / ${priceLimit}万円まで`
  const marketRange = useMemo(() => {
    const related = vehicles.filter((vehicle) => vehicle.maker === selectedVehicle.maker)
    const prices = (related.length ? related : vehicles).map((vehicle) => vehicle.price).sort((a, b) => a - b)
    const low = prices[0] ?? selectedVehicle.price
    const high = prices[prices.length - 1] ?? selectedVehicle.price
    const fair = Math.round((low + high + selectedVehicle.price) / 3)
    return { low, fair, high }
  }, [selectedVehicle, vehicles])

  const currentWizard = listingSteps[listingStep]
  const buyerFee = Math.round(selectedVehicle.price * 0.015)
  const totalPayment = selectedVehicle.price + buyerFee + 28000
  const loanPrincipal = Math.max(totalPayment - downPayment, 0)
  const loanMonthlyRate = 0.035 / 12
  const monthlyPayment =
    loanPrincipal === 0
      ? 0
      : Math.round((loanPrincipal * loanMonthlyRate) / (1 - Math.pow(1 + loanMonthlyRate, -loanMonths)))
  const transferScenario = selectedVehicle.location.startsWith('東京都')
    ? {
        label: '同一管轄想定',
        cost: 28000,
        steps: ['書類回収', '行政書士申請', '車検証更新', '売上入金'],
      }
    : {
        label: '管轄変更想定',
        cost: 58000,
        steps: ['書類回収', '陸送/持込調整', 'ナンバー交換', '車検証更新'],
      }
  const listingQuality = Math.min(100, 58 + selectedOptions.length * 6 + (analysisDone ? 12 : 0))
  const listingIssues = useMemo(() => {
    const issues: string[] = []
    if (!draftFields.車名?.trim()) issues.push('車名')
    if (!draftFields.型式?.trim()) issues.push('型式')
    if (!draftFields.車検満了?.trim()) issues.push('車検満了')
    if (!draftLocation.trim()) issues.push('地域')
    if (photoImages.filter(Boolean).length < 2) issues.push('掲載写真2枚以上')
    if (!Number.isFinite(draftPrice) || draftPrice < 50_000) issues.push('掲載価格')
    if (selectedOptions.length === 0) issues.push('装備候補')
    if (!sellerConsent) issues.push('確認同意')
    return issues
  }, [draftFields, draftLocation, draftPrice, photoImages, selectedOptions, sellerConsent])
  const runtimeCapabilities = {
    camera: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices),
    nfc: typeof window !== 'undefined' && Boolean(window.NDEFReader),
    secure: typeof window !== 'undefined' && window.isSecureContext,
  }
  const legalPanels = {
    terms: {
      eyebrow: 'Terms',
      title: '利用規約の要点',
      items: [
        '出品者は掲載情報の正確性に責任を持ち、修復歴・不具合等は必ず事前に開示してください。',
        'AI読み取り結果は参考情報です。車検証・現車の内容と必ず照合してから公開してください。',
        '決済はCarLinkエスクローを通じて行われ、名義変更完了の確認後に売主へ入金されます。',
      ],
    },
    privacy: {
      eyebrow: 'Privacy',
      title: 'プライバシー方針の要点',
      items: [
        '氏名・電話番号・車検証情報は取引目的のみに使用し、第三者への提供は行いません。',
        '車両写真はAI解析後も安全に保管され、ユーザーの削除リクエストに応じて消去します。',
        '本人確認完了ユーザーには「本人確認済み」バッジが表示され、取引の信頼性を高めます。',
      ],
    },
    commerce: {
      eyebrow: 'Trust',
      title: '取引安全の要点',
      items: [
        '現車確認・修復歴確認・書類確認を購入前の必須ステップとしてチェックリストで管理します。',
        '入金はエスクローで一時預かり。名義変更完了が確認されてから売主へ送金されます。',
        'トラブル・キャンセル時はCarLinkサポートが仲裁し、証跡をもとに返金対応を行います。',
      ],
    },
  } as const
  const wizardPrimaryLabel =
    listingStep === 0
      ? scanMode === 'certificate'
        ? certificateReadMethod === 'upload'
          ? 'アップロード画像を読み取る'
          : certificateReadMethod === 'electronic'
            ? '電子車検証を読み取る'
            : '読み取り方法を選択'
        : scanMode === 'photo'
          ? '写真を追加へ進む'
          : '方法を選択'
      : listingStep === 1
        ? '写真AIで読み取る'
        : listingStep === 4
          ? editingListingId
            ? '掲載を更新'
            : published
            ? '掲載を更新'
            : '掲載する'
          : '次へ進む'

  const toggleOption = (option: string) => {
    setSelectedOptions((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option],
    )
  }

  const saveSearchCondition = () => {
    const savedSearch: SavedSearch = {
      id: `${Date.now()}`,
      label: searchLabel,
      bodyType: bodyTypeFilter,
      location: locationFilter,
      maker: makerFilter,
      mileage: mileageLimit,
      model: modelFilter,
      price: priceLimit,
      query,
    }
    setSavedSearches((current) => {
      const next = [savedSearch, ...current.filter((item) => item.label !== savedSearch.label)]
      return next.slice(0, 5)
    })
  }

  const applySavedSearch = (savedSearch: SavedSearch) => {
    setQuery(savedSearch.query)
    setMakerFilter(savedSearch.maker)
    setModelFilter(savedSearch.model)
    setBodyTypeFilter(savedSearch.bodyType)
    setLocationFilter(savedSearch.location)
    setMileageLimit(savedSearch.mileage)
    setPriceLimit(savedSearch.price)
    setShowFavoritesOnly(false)
    setSortMode('newest')
  }

  const applyAnalysisResult = (result: AnalysisResult, fallbackMessage: string) => {
    setDraftFields((current) => ({
      ...current,
      ...(result.fields ?? Object.fromEntries(scannedFields)),
    }))
    setDraftPrice(result.price ?? 3180000)
    setAnalysisDone(true)
    setSelectedOptions(result.options ?? ['サンルーフ', 'ETC', 'アダプティブクルーズ', 'シートヒーター'])
    setAnalysisMessage(result.note ?? fallbackMessage)
  }

  const runAnalysis = async () => {
    if (photoImages.filter(Boolean).length === 0) {
      setAnalysisMessage('先に外装・内装・メーターなどの写真を追加してください。')
      setListingStep(1)
      return
    }
    setScanMode((current) => current ?? 'photo')
    setIsAnalyzing(true)
    setAnalysisMessage('写真から車種・装備・価格候補を読み取っています')

    try {
      const response = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: toAnalysisImageUrl(photoImages[0]),
          images: photoImages.filter(Boolean).slice(0, 4).map(toAnalysisImageUrl),
          mode: scanMode ?? 'photo',
        }),
      })
      const result = (await response.json()) as AnalysisResult
      applyAnalysisResult(result, 'AI読み取りが完了しました。内容を確認してください。')
      setListingStep(2)
    } catch {
      applyAnalysisResult({}, 'ローカル解析で読み取りました。内容を確認してください。')
      setListingStep(2)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const startNfcScan = async () => {
    if (!window.isSecureContext) {
      setAnalysisMessage('電子車検証のNFC読み取りはHTTPS環境でのみ利用できます。HTTPSで開いてから実行してください。')
      return
    }
    if (!window.NDEFReader) {
      setAnalysisMessage('この端末/ブラウザはWeb NFCに未対応です。Android Chromeなど対応環境で確認してください。')
      return
    }

    setNfcReading(true)
    setAnalysisMessage('電子車検証の読み取り待機中です。スマホをカードに近づけてください。')

    try {
      const reader = new window.NDEFReader()
      reader.addEventListener('reading', (event) => {
        const decodedRecords = event.message.records
          .map((record) => {
            if (!record.data) return ''
            const decoder = new TextDecoder(record.encoding || 'utf-8')
            return decoder.decode(record.data)
          })
          .join('\n')
        setDraftFields((current) => ({
          ...current,
          車名: current.車名 || '電子車検証読み取り車両',
          型式: current.型式 || 'NFC-READ',
          車検満了: current.車検満了 || '読み取り結果を確認',
          車台番号: decodedRecords.slice(0, 24) || current.車台番号 || '読み取り済み',
        }))
        setAnalysisDone(true)
        setNfcReading(false)
        setAnalysisMessage('電子車検証のNFC読み取りが完了しました。内容を確認してください。')
        setListingStep(1)
      })
      await reader.scan()
    } catch {
      setNfcReading(false)
      setAnalysisMessage('NFC読み取りを開始できませんでした。端末のNFC設定とブラウザ権限を確認してください。')
    }
  }

  const runCertificateScan = async () => {
    setScanMode('certificate')
    if (certificateReadMethod === 'electronic') {
      await startNfcScan()
      return
    }

    if (!photoImages[3]) {
      setAnalysisMessage('車検証画像を撮影または選択してください。')
      return
    }

    setIsAnalyzing(true)
    setAnalysisMessage('アップロードされた車検証画像から基本情報を読み取っています')

    try {
      const response = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: toAnalysisImageUrl(photoImages[3]), mode: 'certificate' }),
      })
      const result = (await response.json()) as AnalysisResult
      applyAnalysisResult(result, '車検証の読み取りが完了しました。次に掲載写真を追加してください。')
      setListingStep(1)
    } catch {
      setDraftFields(Object.fromEntries(scannedFields))
      setAnalysisDone(true)
      setAnalysisMessage('車検証の読み取りが完了しました。次に掲載写真を追加してください。')
      setListingStep(1)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const saveDraftNow = () => {
    const savedAt = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    setDraftSavedAt(savedAt)
    showToast(`下書きを保存しました (${savedAt})`, 'success')
  }

  const publishListing = async () => {
    if (!currentUser) {
      setAuthMessage('掲載するにはログインしてください。')
      setAnalysisMessage('掲載するにはログインが必要です。')
      return
    }
    if (listingIssues.length > 0) {
      setAnalysisMessage(`公開前チェック: ${listingIssues.join('、')} を確認してください。`)
      if (listingIssues.some((issue) => ['車名', '型式', '車検満了'].includes(issue))) {
        setListingStep(0)
      } else if (listingIssues.includes('掲載写真2枚以上')) {
        setListingStep(1)
      } else if (listingIssues.includes('掲載価格')) {
        setListingStep(3)
      } else if (listingIssues.includes('確認同意')) {
        setListingStep(4)
      } else {
        setListingStep(2)
      }
      return
    }

    const title = draftFields.車名?.trim() || '車名未入力'
    const existingVehicle = editingListingId ? vehicles.find((vehicle) => vehicle.id === editingListingId) : undefined
    const newVehicle: Vehicle = {
      id: editingListingId ?? Date.now(),
      sellerId: currentUser.id,
      title: draftFields.車名 || 'トヨタ ハリアー',
      maker: inferMaker(title),
      grade: draftFields.グレード?.trim() || `${draftFields.型式 ?? ''} 個人出品`.trim(),
      year: inferYear(draftFields.初度登録 ?? ''),
      mileage: Number((draftFields.走行距離 ?? '28000').replace(/[^\d]/g, '')) || 28000,
      price: draftPrice,
      location: draftLocation.trim(),
      image: photoImages.find(Boolean) ?? photoSlots[0].image,
      tags: selectedOptions,
      inspection: draftFields.車検満了 || '確認中',
      verified: currentUser.verified,
      sellerName: currentUser.name,
      description: draftDescription.trim() || '写真と車検証読み取り結果をもとに作成した個人出品です。現車確認後に購入申請へ進めます。',
      fuelType: draftFuelType || undefined,
      driveType: draftDriveType || undefined,
      color: draftColor.trim() || undefined,
      accidentHistory: draftAccidentHistory,
      createdAt: existingVehicle?.createdAt ?? new Date().toISOString(),
      status: 'published',
    }

    setVehicles((current) => {
      const exists = current.some((vehicle) => vehicle.id === newVehicle.id)
      return exists
        ? current.map((vehicle) => (vehicle.id === newVehicle.id ? newVehicle : vehicle))
        : [newVehicle, ...current]
    })
    saveListing(newVehicle).then((savedListing) => {
      if (!savedListing) return
      setVehicles((current) => current.map((vehicle) => (vehicle.id === newVehicle.id ? savedListing : vehicle)))
      refreshNotifications()
    })
    setSelectedId(newVehicle.id)
    setPublished(true)
    setEditingListingId(null)
    setListingStep(4)
    setAnalysisMessage('')
    showToast(editingListingId ? '掲載内容を更新しました。' : '掲載しました！検索画面に反映されています。', 'success')
  }

  const startNewListing = () => {
    setEditingListingId(null)
    setPublished(false)
    setListingStep(0)
    setAnalysisDone(false)
    setScanMode(null)
    setCertificateReadMethod(null)
    setDraftSavedAt('')
    setAnalysisMessage('新しい出品を作成できます。車検証または写真から始めてください。')
    setPhotoMessage('')
    setDraftFields(Object.fromEntries(scannedFields))
    setDraftPrice(3180000)
    setDraftLocation('')
    setDraftDescription('')
    setSelectedOptions([])
    setSellerConsent(false)
    setDraftFuelType(undefined)
    setDraftDriveType(undefined)
    setDraftColor('')
    setDraftAccidentHistory(undefined)
    setPhotoImages(emptyPhotoImages())
  }

  const editListing = (vehicle: Vehicle) => {
    setEditingListingId(vehicle.id)
    setSelectedId(vehicle.id)
    setPublished(false)
    setListingStep(3)
    setAnalysisDone(true)
    setScanMode('photo')
    setDraftFields({
      車名: vehicle.title,
      型式: vehicle.grade,
      初度登録: vehicle.year,
      車検満了: vehicle.inspection,
      走行距離: `${vehicle.mileage.toLocaleString('ja-JP')}km`,
      排気量: draftFields.排気量 ?? '',
    })
    setDraftPrice(vehicle.price)
    setDraftLocation(vehicle.location)
    setDraftDescription(vehicle.description ?? '')
    setDraftFuelType(vehicle.fuelType)
    setDraftDriveType(vehicle.driveType)
    setDraftColor(vehicle.color ?? '')
    setDraftAccidentHistory(vehicle.accidentHistory)
    setSelectedOptions(vehicle.tags)
    setSellerConsent(true)
    setPhotoImages([vehicle.image, '', '', ''])
    setAnalysisMessage('掲載内容を編集しています。価格・説明・写真を確認して更新できます。')
    navigate('sell')
  }

  const setListingStatus = async (vehicleId: number, status: Vehicle['status']) => {
    if (!status) return
    const updated = await updateListingStatus(vehicleId, status)
    if (!updated) {
      setAnalysisMessage('掲載ステータスを更新できませんでした。')
      return
    }
    setVehicles((current) => current.map((vehicle) => (vehicle.id === vehicleId ? updated : vehicle)))
    const statusMsg = status === 'published' ? '掲載を再公開しました。' : '掲載を一時停止しました。'
    setAnalysisMessage(statusMsg)
    showToast(statusMsg, 'success')
    refreshNotifications()
  }

  const persistMessage = async (body: string) => {
    const saved = await createConversationMessage({
      body,
      dealId: selectedDeal?.id,
      senderId: currentUser?.id,
      senderName: currentUser?.name,
      senderRole: currentUser?.role ?? 'buyer',
      vehicleId: selectedVehicle.id,
    })
    if (saved) {
      setConversationMessages((current) => [...current, saved])
      refreshNotifications()
    }
  }

  const sendMessage = () => {
    const body = message.trim()
    if (!body) return
    setChatMessages((current) => [
      ...current,
      {
        from: 'buyer',
        body,
        time: currentTimeLabel(),
      },
    ])
    persistMessage(body)
    setMessage('')
  }

  const submitPurchaseApplication = async () => {
    const name = buyerName.trim() || currentUser?.name || ''
    const phone = buyerPhone.trim() || currentUser?.phone || ''
    if (!name || phone.replace(/[^\d+]/g, '').length < 8) {
      setDealMessage('購入申請には名前と連絡先電話番号が必要です。')
      return
    }

    setDealMessage('購入申請を送信しています。')
    const deal = await createDeal({
      vehicleId: selectedVehicle.id,
      vehicleTitle: selectedVehicle.title,
      buyerId: currentUser?.id,
      buyerName: name,
      buyerPhone: phone,
      sellerId: selectedVehicle.sellerId,
      sellerName: selectedVehicle.sellerName,
      amount: totalPayment,
      status: 'applied',
      note: buyerNote,
    })
    if (!deal) {
      setDealMessage('購入申請を保存できませんでした。入力内容と通信状態を確認してください。')
      return
    }
    setDeals((current) => [deal, ...current.filter((item) => item.id !== deal.id)])
    setDealProgress(Math.max(dealProgress, 1))
    setDealMessage('購入申請を保存しました。次は売主との現車確認・書類確認へ進めます。')
    showToast('購入申請を送信しました！', 'success')
    refreshNotifications()
  }

  const advanceSelectedDeal = async () => {
    if (!selectedDeal) {
      await submitPurchaseApplication()
      return
    }
    const order: DealRecord['status'][] = ['applied', 'payment_pending', 'paid', 'handover', 'transfer', 'completed']
    const nextStatus = order[Math.min(order.indexOf(selectedDeal.status) + 1, order.length - 1)] ?? 'payment_pending'
    const updated = await updateDealStatus(selectedDeal.id, nextStatus)
    if (!updated) {
      setDealMessage('取引ステータスを更新できませんでした。')
      return
    }
    setDeals((current) => current.map((deal) => (deal.id === updated.id ? updated : deal)))
    setDealProgress(Math.min(dealProgress + 1, dealSteps.length))
    setDealMessage('取引ステータスを更新しました。')
    showToast('取引ステータスを更新しました。', 'success')
    refreshNotifications()
  }

  const saveHandoverPlan = async () => {
    if (!selectedDeal) {
      setDealMessage('先に購入申請を作成してください。')
      return
    }
    const updated = await updateDealHandoverPlan(selectedDeal.id, {
      handoverDate: handoverDate || selectedDeal.handoverDate || '',
      handoverPlace: handoverPlace || selectedDeal.handoverPlace || '',
      handoverMemo: handoverMemo || selectedDeal.handoverMemo || '',
    })
    if (!updated) {
      setDealMessage('現車確認・引き渡し予定を保存できませんでした。')
      return
    }
    setDeals((current) => current.map((deal) => (deal.id === updated.id ? updated : deal)))
    setDealMessage('現車確認・引き渡し予定を保存しました。')
    refreshNotifications()
  }

  const handleLogin = async () => {
    if (!loginName.trim() || !loginPhone.trim()) {
      setAuthMessage('お名前と電話番号を入力してください。')
      return
    }
    setAuthMessage('確認中です')
    const user = await loginUser({ name: loginName, phone: loginPhone, role: loginRole, password: loginPassword })
    if (!user) {
      setAuthMessage('ログインできませんでした。入力内容を確認してください。')
      return
    }
    setCurrentUser(user)
    setBuyerName(user.name)
    setBuyerPhone(user.phone)
    setAuthMessage(`${authRoleLabels[user.role]}としてログインしました。`)
    showToast(`${authRoleLabels[user.role]}としてログインしました。`, 'success')
    refreshNotifications()
  }

  const handleLogout = async () => {
    await logoutUser()
    setCurrentUser(null)
    setAuthMessage('ログアウトしました。')
    showToast('ログアウトしました。', 'info')
  }

  const sendQuickMessage = (body: string) => {
    setChatMessages((current) => [
      ...current,
      {
        from: 'buyer',
        body,
        time: currentTimeLabel(),
      },
    ])
    persistMessage(body)
  }

  const toggleFavorite = (vehicleId: number) => {
    setFavorites((current) =>
      current.includes(vehicleId)
        ? current.filter((favoriteId) => favoriteId !== vehicleId)
        : [...current, vehicleId],
    )
  }

  const toggleCompare = (vehicleId: number) => {
    setCompareIds((current) => {
      if (current.includes(vehicleId)) return current.filter((id) => id !== vehicleId)
      return [vehicleId, ...current].slice(0, 3)
    })
  }

  const toggleInspectionCheck = (item: string) => {
    const next = activeInspectionChecks.includes(item)
      ? activeInspectionChecks.filter((check) => check !== item)
      : [...activeInspectionChecks, item]
    setInspectionChecks(next)
    if (selectedDeal) {
      updateDealDocumentChecks(selectedDeal.id, next).then((updated) => {
        if (!updated) return
        setDeals((records) => records.map((deal) => (deal.id === updated.id ? updated : deal)))
      })
    }
  }

  const resetDemoData = () => {
    clearPersistedState()
    clearRemoteState()
    setVehicles([])
    setSelectedId(1)
    setListingStep(0)
    setAnalysisDone(false)
    setPublished(false)
    setDealProgress(2)
    setChatMessages(initialChat)
    setCompareIds([])
    setFavorites([])
    setInspectionChecks([])
    setSavedSearches([])
    setScanMode(null)
    setCertificateReadMethod(null)
    setDraftSavedAt('')
    setIsAnalyzing(false)
    setAnalysisMessage('')
    setSelectedOptions(['サンルーフ', 'ETC', 'アダプティブクルーズ'])
    setDraftPrice(3180000)
    setDraftLocation('')
    setDraftDescription('')
    setSellerConsent(false)
    setDraftFields(Object.fromEntries(scannedFields))
    setPhotoImages(emptyPhotoImages())
  }

  const exportDemoData = () => {
    const state: PersistedAppState = {
      analysisDone,
      certificateReadMethod,
      chatMessages,
      compareIds,
      dealProgress,
      draftFields,
      draftLocation,
      draftPrice,
      draftDescription,
      sellerConsent,
      favorites,
      inspectionChecks,
      lastDraftSavedAt: draftSavedAt,
      photoImages,
      published,
      scanMode,
      savedSearches,
      selectedOptions,
      vehicles,
    }
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'carlink-demo-data.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const installApp = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const navigate = (view: AppView) => {
    setActiveView(view)
    setPhotoMessage('')
    const hash =
      view === 'home'
        ? 'search'
        : view === 'sell'
          ? 'list'
          : view === 'deal'
            ? 'deal'
            : view === 'admin'
              ? 'admin'
              : 'message'
    window.history.pushState(null, '', `#${hash}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetSearch = () => {
    setQuery('')
    setMakerFilter('すべて')
    setModelFilter('すべて')
    setBodyTypeFilter('すべて')
    setLocationFilter('すべて')
    setMileageLimit(80000)
    setPriceLimit(350)
    setShowFavoritesOnly(false)
    setSortMode('newest')
    setYearMin(2010)
    setYearMax(2025)
    setFuelTypeFilter('すべて')
    setDriveTypeFilter('すべて')
    setAccidentFilter('すべて')
  }

  const handleWizardPrimary = () => {
    if (listingStep === 0) {
      if (scanMode === 'certificate') {
        if (!certificateReadMethod) {
          setAnalysisMessage('車検証の読み取り方法を選んでください。')
          return
        }
        runCertificateScan()
        return
      }
      if (scanMode === 'photo') {
        setAnalysisMessage('掲載写真を追加してから、写真AIで装備候補を読み取ります。')
        setListingStep(1)
        return
      }
      setAnalysisMessage('先に読み取り方法を選んでください。')
      return
    }

    if (listingStep === 1) {
      runAnalysis()
      return
    }

    if (listingStep === 4) {
      publishListing()
      return
    }

    setListingStep(Math.min(listingStep + 1, 4))
  }

  const updatePhoto = async (index: number, file: File | undefined) => {
    if (!file) return

    setPhotoMessage(`${photoSlots[index]?.label ?? '画像'}を処理しています`)
    try {
      const imageData = await compressImageFile(file)
      const uploadedUrl = await uploadImage(imageData)
      const imageSource = uploadedUrl ?? imageData
      setPhotoImages((current) =>
        current.map((image, imageIndex) => (imageIndex === index ? imageSource : image)),
      )
      setPhotoMessage(
        uploadedUrl
          ? `${photoSlots[index]?.label ?? '画像'}を保存しました`
          : `${photoSlots[index]?.label ?? '画像'}を一時保存しました`,
      )
      if (scanMode === 'photo') {
        setAnalysisMessage('写真を受け取りました。AI解析を実行できます。')
      }
      saveDraftNow()
    } catch {
      setPhotoMessage('画像の処理に失敗しました。別の写真で試してください。')
    }
  }

  return (
    <main className="app-shell">
      <aside className="side-nav" aria-label="メインナビゲーション">
        <div className="brand-mark">
          <CarFront aria-hidden="true" />
          <span>CarLink</span>
        </div>
        <nav>
          <button className={activeView === 'home' ? 'active' : ''} onClick={() => navigate('home')} type="button">
            <Search size={18} />
            探す
          </button>
          <button className={activeView === 'sell' ? 'active' : ''} onClick={() => navigate('sell')} type="button">
            <Camera size={18} />
            出品
          </button>
          <button className={activeView === 'deal' ? 'active' : ''} onClick={() => navigate('deal')} type="button">
            <ShieldCheck size={18} />
            取引
          </button>
          <button
            className={activeView === 'message' ? 'active' : ''}
            onClick={() => navigate('message')}
            type="button"
          >
            <MessageSquareText size={18} />
            チャット
          </button>
          <button className={activeView === 'admin' ? 'active' : ''} onClick={() => navigate('admin')} type="button">
            <ClipboardCheck size={18} />
            管理
          </button>
        </nav>
      </aside>

      <section className="workspace">
        {installPrompt && !installDismissed && (
          <section className="install-banner" aria-label="アプリインストール">
            <div>
              <Home size={19} />
            <p>ホーム画面に追加して、スマホアプリのように使えます。</p>
            </div>
            <button onClick={installApp} type="button">
              追加
            </button>
            <button aria-label="閉じる" onClick={() => setInstallDismissed(true)} type="button">
              <X size={17} />
            </button>
          </section>
        )}

        <header className={`topbar ${activeView === 'admin' ? 'admin-tools' : ''}`}>
          <div className="search-box">
            <Search size={19} />
            <input
              aria-label="車を検索"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="メーカー・車種・地域で検索"
              value={query}
            />
          </div>
          <button
            className={`icon-button${showFilters ? ' active-filter' : ''}`}
            onClick={() => setShowFilters((f) => !f)}
            type="button"
            aria-label="絞り込み"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal size={19} />
          </button>
          {activeView === 'admin' && currentUser?.role === 'admin' && (
            <button className="icon-button" onClick={exportDemoData} type="button" aria-label="データを書き出す">
              <Download size={18} />
            </button>
          )}
          {activeView === 'admin' && currentUser?.role === 'admin' && (
            <button className="icon-button" onClick={resetDemoData} type="button" aria-label="データ初期化">
              <RotateCcw size={18} />
            </button>
          )}
          <button className="icon-button notification-button" onClick={() => navigate('admin')} type="button" aria-label="通知">
            <Bell size={18} />
            {unreadNotifications > 0 && <span>{unreadNotifications}</span>}
          </button>
          <button className="primary-action" onClick={() => navigate('sell')} type="button">
            <Camera size={18} />
            出品する
          </button>
        </header>

        <div className={`sync-status ${serverSynced ? 'online' : ''}`}>
          {serverSynced ? '接続中' : '接続確認中'}
        </div>

        {notifications.length > 0 && (
          <section className="notification-strip">
            <Bell size={15} />
            <strong>{unreadNotifications > 0 ? `未読通知 ${unreadNotifications}件` : '通知は確認済み'}</strong>
            <span>{notifications[0].title}</span>
            <button
              onClick={() => {
                markNotificationRead(notifications[0].id).then((updated) => {
                  if (updated) {
                    setNotifications((records) =>
                      records.map((notification) => (notification.id === updated.id ? updated : notification)),
                    )
                  }
                })
              }}
              type="button"
            >
              確認
            </button>
          </section>
        )}

        <section className={`hero-band ${activeView !== 'home' ? 'hidden-section' : ''}`} id="search">
          <div>
            <p className="eyebrow">個人間中古車検索</p>
            <h1>中古車を探す</h1>
            <p>メーカー、車種、地域、価格から条件に合う車をすぐに絞り込めます。</p>
          </div>
          <button className="market-chip" onClick={() => navigate('sell')} type="button">
            <Camera size={18} />
            写真で出品する
          </button>
        </section>

        <section
          className={`listing-wizard ${activeView !== 'sell' ? 'hidden-section' : ''}`}
          aria-label="出品ウィザード"
          id="list"
        >
          <div className="wizard-rail">
            {listingSteps.map((step, index) => {
              const Icon = step.icon
              const stepClass = index < listingStep ? 'done' : index === listingStep ? 'active' : ''
              return (
                <button
                  className={stepClass}
                  key={step.label}
                  onClick={() => setListingStep(index)}
                  type="button"
                >
                  <span>
                    {index < listingStep ? <Check size={15} /> : <Icon size={17} />}
                  </span>
                  {step.label}
                </button>
              )
            })}
          </div>

          <div className="wizard-main">
            <div className="wizard-copy">
              <p className="eyebrow">出品ウィザード</p>
              <h2>{currentWizard.title}</h2>
              <p>{currentWizard.body}</p>
              <div className="auth-card compact">
	                {currentUser ? (
	                  <>
	                    <UserCheck size={18} />
                    <span>
                      {currentUser.name} / {authRoleLabels[currentUser.role]}
                    </span>
	                    <button onClick={handleLogout} type="button">ログアウト</button>
	                  </>
	                ) : (
                  <>
                    <LockKeyhole size={18} />
                    <input
                      aria-label="表示名"
                      onChange={(event) => setLoginName(event.target.value)}
                      placeholder="お名前・ニックネーム"
                      value={loginName}
                    />
                    <input
                      aria-label="電話番号"
                      inputMode="tel"
                      onChange={(event) => setLoginPhone(event.target.value)}
                      placeholder="電話番号"
                      value={loginPhone}
                    />
                    <input
                      aria-label="パスワード"
                      type="password"
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="パスワード（任意）"
                      value={loginPassword}
                    />
                    <div className="role-selector">
                      {(['seller', 'buyer'] as AuthUser['role'][]).map((role) => (
                        <button
                          className={loginRole === role ? 'active' : ''}
                          key={role}
                          onClick={() => setLoginRole(role)}
                          type="button"
                        >
                          {authRoleLabels[role]}
                        </button>
                      ))}
                    </div>
	                    <button onClick={handleLogin} type="button">会員登録 / ログイン</button>
	                  </>
	                )}
              </div>
              {authMessage && <p className="draft-status">{authMessage}</p>}
              {currentUser && (
                <div className="seller-mini-status">
                  <span>{editingListingId ? '掲載を編集中' : `自分の掲載 ${myListings.length}台`}</span>
                  <button onClick={startNewListing} type="button">
                    新しい出品
                  </button>
                </div>
              )}
              {analysisMessage && <p className="analysis-message">{analysisMessage}</p>}
              <div className="wizard-actions">
                <button
                  className="primary-action"
                  disabled={isAnalyzing}
                  onClick={handleWizardPrimary}
                  type="button"
                >
                  <Sparkles size={18} />
                  {isAnalyzing ? '解析中' : wizardPrimaryLabel}
                </button>
                <button
                  className="ghost-button"
                  onClick={() =>
                    listingStep === 4
                      ? setListingStep(Math.max(listingStep - 1, 0))
                      : setListingStep(Math.min(listingStep + 1, 4))
                  }
                  type="button"
                >
                  {listingStep === 4 ? '戻る' : '次へ'}
                </button>
                <button className="ghost-button" onClick={saveDraftNow} type="button">
                  <ClipboardCheck size={16} />
                  下書き保存
                </button>
              </div>
              <p className="draft-status">
                {draftSavedAt ? `下書き保存済み ${draftSavedAt}` : '入力内容は自動保存されます'}
              </p>
            </div>

            {listingStep === 0 && (
              <div className="scan-start">
                <button
                  className={scanMode === 'certificate' ? 'selected' : ''}
                  onClick={() => {
                    setScanMode('certificate')
                    setCertificateReadMethod(null)
                    setAnalysisMessage('車検証の読み取り方法を選んでください。')
                  }}
                  type="button"
                >
                  <FileScan size={24} />
                  <span>車検証で正確に入力</span>
                  <small>型式・年式・車検満了日などを自動入力</small>
                </button>
                <button
                  className={scanMode === 'photo' ? 'selected' : ''}
                  onClick={() => {
                    setScanMode('photo')
                    setAnalysisMessage('車の写真から車種・装備候補をAIで読み取ります。')
                    setListingStep(1)
                  }}
                  type="button"
                >
                  <Camera size={24} />
                  <span>
                    写真AIでかんたん出品
                    <strong>おすすめ</strong>
                  </span>
                  <small>外装・内装写真から装備と掲載情報を推定</small>
                </button>

                {scanMode === 'certificate' && (
                  <div className="certificate-reader">
                    <div className="reader-methods">
                      <label className={certificateReadMethod === 'upload' ? 'selected' : ''}>
                        <input
                          type="radio"
                          name="certificate-method"
                          checked={certificateReadMethod === 'upload'}
                          onChange={() => {
                            setCertificateReadMethod('upload')
                            setAnalysisMessage('車検証画像をアップロードしてください。')
                          }}
                        />
                        <Upload size={20} />
                        <span>写真をアップロード</span>
                        <small>車検証を撮影、またはアルバムから選択</small>
                      </label>
                      <label className={certificateReadMethod === 'electronic' ? 'selected' : ''}>
                        <input
                          type="radio"
                          name="certificate-method"
                          checked={certificateReadMethod === 'electronic'}
                          onChange={() => {
                            setCertificateReadMethod('electronic')
                            setAnalysisMessage('スマホのNFC読み取りを想定した操作です。')
                          }}
                        />
                        <FileScan size={20} />
                        <span>電子車検証を読み取る</span>
                        <small>{runtimeCapabilities.nfc ? 'この端末はWeb NFC候補あり' : 'Android Chrome + HTTPSで利用'}</small>
                      </label>
                    </div>

                    {certificateReadMethod === 'upload' && (
                      <label className="certificate-upload">
                        <img src={photoImages[3] || photoSlots[3].image} alt="" />
                        <span>{photoImages[3] ? '車検証画像を変更' : '車検証を撮影/選択'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(event) => updatePhoto(3, event.target.files?.[0])}
                        />
                      </label>
                    )}

                    {certificateReadMethod === 'electronic' && (
                      <div className="electronic-reader">
                        <Nfc size={28} />
                        <h3>{nfcReading ? '読み取り待機中' : 'スマホを電子車検証に近づける'}</h3>
                        <p>
                          {runtimeCapabilities.secure
                            ? '対応端末ではWeb NFCで読み取りを開始します。未対応端末では画像アップロードを使えます。'
                            : 'NFC読み取りにはHTTPSが必要です。本番配信またはHTTPSローカル配信で利用できます。'}
                        </p>
                      </div>
                    )}

                    <div className="scan-result">
                      {scannedFields.map(([label]) => (
                        <label key={label}>
                          {label}
                          <input
                            onChange={(event) =>
                              setDraftFields((current) => ({
                                ...current,
                                [label]: event.target.value,
                              }))
                            }
                            value={draftFields[label] ?? ''}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {listingStep === 1 && (
              <div className="photo-step">
                <div className="photo-step-header">
                  <div>
                    <p className="eyebrow">撮影ガイド</p>
                    <h3>まずは4枚で出品情報を作成</h3>
                  </div>
                  <span>{photoImages.filter(Boolean).length}/4</span>
                </div>
                {photoMessage && <p className="photo-message">{photoMessage}</p>}
                <div className="photo-capture-grid">
                  {photoSlots.map((slot, index) => (
                    <label className={`photo-slot ${photoImages[index] ? 'has-image' : ''}`} key={slot.label}>
                      <img src={photoImages[index] || slot.image} alt="" />
                      <span>{slot.label}</span>
                      {photoImages[index] ? <BadgeCheck size={17} /> : <ImagePlus size={17} />}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => updatePhoto(index, event.target.files?.[0])}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {listingStep === 2 && (
              <div className="option-list large">
                {aiOptions.map((option) => (
                  <button
                    className={selectedOptions.includes(option.label) ? 'picked' : ''}
                    key={option.label}
                    onClick={() => toggleOption(option.label)}
                    type="button"
                  >
                    <span>{option.label}</span>
                    <small>{analysisDone ? `${option.score}%` : '候補'}</small>
                  </button>
                ))}
              </div>
            )}

            {listingStep === 3 && (
              <div className="price-editor">
                <label>
                  <span className="price-label-row">掲載価格 <strong className="price-label-yen">{yen(draftPrice)}</strong></span>
                  <input
                    inputMode="numeric"
                    onChange={(event) => setDraftPrice(Number(event.target.value.replace(/[^\d]/g, '')))}
                    value={draftPrice}
                  />
                </label>
                <label>
                  地域
                  <input
                    onChange={(event) => setDraftLocation(event.target.value)}
                    placeholder="例: 東京都 世田谷区"
                    value={draftLocation}
                  />
                </label>
                <label className="wide">
                  説明文
                  <textarea
                    onChange={(event) => setDraftDescription(event.target.value)}
                    placeholder="整備記録、保管環境、現車確認可能な曜日など"
                    value={draftDescription}
                  />
                </label>
                <label>
                  燃料タイプ
                  <select
                    onChange={(event) => setDraftFuelType(event.target.value as Vehicle['fuelType'])}
                    value={draftFuelType ?? ''}
                  >
                    <option value="">選択してください</option>
                    {(['ガソリン', 'ハイブリッド', 'PHEV', 'EV', 'ディーゼル', 'マイルドハイブリッド'] as const).map((ft) => (
                      <option key={ft} value={ft}>{ft}</option>
                    ))}
                  </select>
                </label>
                <label>
                  駆動方式
                  <select
                    onChange={(event) => setDraftDriveType(event.target.value as Vehicle['driveType'])}
                    value={draftDriveType ?? ''}
                  >
                    <option value="">選択してください</option>
                    {(['2WD', '4WD', 'AWD', 'e-4WD'] as const).map((dt) => (
                      <option key={dt} value={dt}>{dt}</option>
                    ))}
                  </select>
                </label>
                <label>
                  ボディカラー
                  <input
                    onChange={(event) => setDraftColor(event.target.value)}
                    placeholder="例: パールホワイト、ブラック"
                    value={draftColor}
                  />
                </label>
                <label>
                  修復歴
                  <select
                    onChange={(event) => setDraftAccidentHistory(event.target.value === 'true' ? true : event.target.value === 'false' ? false : undefined)}
                    value={draftAccidentHistory === true ? 'true' : draftAccidentHistory === false ? 'false' : ''}
                  >
                    <option value="">未回答</option>
                    <option value="false">修復歴なし</option>
                    <option value="true">修復歴あり</option>
                  </select>
                </label>
                <div className="price-presets">
                  <button onClick={() => setDraftPrice(3040000)} type="button">
                    早く売る
                  </button>
                  <button onClick={() => setDraftPrice(3180000)} type="button">
                    標準
                  </button>
                  <button onClick={() => setDraftPrice(3260000)} type="button">
                    高め
                  </button>
                </div>
              </div>
            )}

            {listingStep === 4 && (
              <div className="ready-panel">
                <Check size={34} />
                <h3>{published ? '掲載済み' : '公開準備完了'}</h3>
                <p>読み取り結果、掲載写真、装備候補、価格、名義変更条件を確認してから公開できます。</p>
                <div className="publish-checks">
                  {['車名', '型式', '車検満了', '地域', '掲載写真2枚以上', '掲載価格', '装備候補', '確認同意'].map((item) => (
                    <span className={listingIssues.includes(item) ? 'missing' : ''} key={item}>
                      {listingIssues.includes(item) ? <X size={13} /> : <Check size={13} />}
                      {item}
                    </span>
                  ))}
                </div>
                <label className="consent-check">
                  <input
                    checked={sellerConsent}
                    onChange={(event) => setSellerConsent(event.target.checked)}
                    type="checkbox"
                  />
                  AI読み取り内容、車両状態、修復歴/不具合、引き渡し条件を確認しました。
                </label>
                <button
                  className="primary-action"
                  onClick={publishListing}
                  type="button"
                >
                  <Upload size={18} />
                  {editingListingId || published ? '掲載を更新' : '掲載する'}
                </button>
              </div>
            )}
          </div>

          <aside className="price-advisor">
            <p className="eyebrow">価格提案</p>
            <h3>{yen(draftPrice)}</h3>
            <div className="price-bar" aria-hidden="true">
              <span style={{ width: '64%' }}></span>
              <strong style={{ left: '58%' }}></strong>
            </div>
            <div className="price-scale">
              <span>{yen(2860000)}</span>
              <span>{yen(3420000)}</span>
            </div>
            <div className="advisor-note">
              <CircleDollarSign size={18} />
              <p>同型式・走行3万km前後の掲載相場から、強気すぎない価格帯を提案中。</p>
            </div>
          </aside>
        </section>

        <section className={`content-grid ${activeView === 'home' ? 'single' : ''}`}>
          <div className={`main-column ${activeView === 'sell' ? 'hidden-section' : ''}`}>
            <section className={`listing-panel ${activeView !== 'home' ? 'hidden-section' : ''}`}>
              <div className="section-header">
                <div>
                  <p className="eyebrow">中古車を探す</p>
                  <h2>メーカー・車種から検索</h2>
                </div>
                <div className="catalog-badge">
                  <CarFront size={17} />
                  {catalogStats.makers}メーカー / {catalogStats.models}車種
                </div>
                <button className="ghost-button" onClick={resetSearch} type="button">
                  <RotateCcw size={16} />
                  条件クリア
                </button>
              </div>

              {showFilters && (
                <div className="carsensor-search" aria-label="検索条件">
                  <label>
                    メーカー
                    <select
                      onChange={(event) => {
                        setMakerFilter(event.target.value)
                        setModelFilter('すべて')
                      }}
                      value={makerFilter}
                    >
                      {makers.map((maker) => (
                        <option key={maker} value={maker}>
                          {maker}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    車種
                    <select onChange={(event) => setModelFilter(event.target.value)} value={modelFilter}>
                      {models.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    価格上限
                    <div className="range-control">
                      <span>{priceLimit}万円まで</span>
                      <input
                        max="400"
                        min="80"
                        onChange={(event) => setPriceLimit(Number(event.target.value))}
                        type="range"
                        value={priceLimit}
                      />
                    </div>
                  </label>
                  <label>
                    走行距離
                    <div className="range-control">
                      <span>{mileageLabel(mileageLimit)}まで</span>
                      <input
                        max="120000"
                        min="10000"
                        step="5000"
                        onChange={(event) => setMileageLimit(Number(event.target.value))}
                        type="range"
                        value={mileageLimit}
                      />
                    </div>
                  </label>
                  <label>
                    ボディタイプ
                    <select onChange={(event) => setBodyTypeFilter(event.target.value)} value={bodyTypeFilter}>
                      {bodyTypes.map((bodyType) => (
                        <option key={bodyType} value={bodyType}>
                          {bodyType}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    地域
                    <select onChange={(event) => setLocationFilter(event.target.value)} value={locationFilter}>
                      {locations.map((location) => (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    燃料タイプ
                    <select onChange={(event) => setFuelTypeFilter(event.target.value)} value={fuelTypeFilter}>
                      {['すべて', 'ガソリン', 'ハイブリッド', 'EV', 'PHEV', 'ディーゼル', 'マイルドハイブリッド'].map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    駆動方式
                    <select onChange={(event) => setDriveTypeFilter(event.target.value)} value={driveTypeFilter}>
                      {['すべて', '2WD', '4WD', 'AWD', 'e-4WD'].map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    修復歴
                    <select onChange={(event) => setAccidentFilter(event.target.value as 'すべて' | '修復歴なし')} value={accidentFilter}>
                      <option value="すべて">すべて</option>
                      <option value="修復歴なし">修復歴なし</option>
                    </select>
                  </label>
                  <label>
                    年式（下限）
                    <select onChange={(event) => setYearMin(Number(event.target.value))} value={yearMin}>
                      {Array.from({ length: 16 }, (_, i) => 2010 + i).map((y) => (
                        <option key={y} value={y}>{y}年〜</option>
                      ))}
                    </select>
                  </label>
                  <button className="primary-action" type="button" onClick={() => setShowFilters(false)}>
                    <Search size={18} />
                    {filteredVehicles.length}台を表示
                  </button>
                </div>
              )}

              <div className="intent-chips" aria-label="よく使う検索">
                {[
                  { label: 'SUV', bodyType: 'SUV・クロカン', price: 350, fuel: 'すべて' },
                  { label: '軽自動車', bodyType: '軽自動車', price: 220, fuel: 'すべて' },
                  { label: 'ミニバン', bodyType: 'ミニバン', price: 400, fuel: 'すべて' },
                  { label: '200万円以下', bodyType: 'すべて', price: 200, fuel: 'すべて' },
                  { label: 'EV', bodyType: 'すべて', price: 600, fuel: 'EV' },
                  { label: 'ハイブリッド', bodyType: 'すべて', price: 350, fuel: 'ハイブリッド' },
                  { label: 'PHEV', bodyType: 'すべて', price: 500, fuel: 'PHEV' },
                  { label: 'スポーツ', bodyType: 'クーペ', price: 700, fuel: 'すべて' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => {
                      setBodyTypeFilter(chip.bodyType)
                      setPriceLimit(chip.price)
                      setFuelTypeFilter(chip.fuel)
                      setShowFavoritesOnly(false)
                    }}
                    type="button"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="buyer-tools">
                <div>
                  <p className="eyebrow">希望条件</p>
                  <h3>{searchLabel}</h3>
                </div>
                <button className="ghost-button" onClick={saveSearchCondition} type="button">
                  <BadgeCheck size={16} />
                  条件を保存
                </button>
              </div>

              {savedSearches.length > 0 && (
                <div className="saved-searches" aria-label="保存した条件">
                  {savedSearches.map((savedSearch) => (
                    <button
                      key={savedSearch.id}
                      onClick={() => applySavedSearch(savedSearch)}
                      type="button"
                    >
                      {savedSearch.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="quick-filters" aria-label="クイックフィルター">
                <button
                  className={!showFavoritesOnly ? 'active' : ''}
                  onClick={() => setShowFavoritesOnly(false)}
                  type="button"
                >
                  すべて
                </button>
                <button
                  className={showFavoritesOnly ? 'active' : ''}
                  onClick={() => setShowFavoritesOnly(true)}
                  type="button"
                >
                  お気に入り {favorites.length}
                </button>
                <button
                  className={sortMode === 'newest' ? 'active' : ''}
                  onClick={() => setSortMode('newest')}
                  type="button"
                >
                  新着順
                </button>
                <button
                  className={sortMode === 'priceAsc' ? 'active' : ''}
                  onClick={() => setSortMode('priceAsc')}
                  type="button"
                >
                  安い順
                </button>
                <button
                  className={sortMode === 'mileageAsc' ? 'active' : ''}
                  onClick={() => setSortMode('mileageAsc')}
                  type="button"
                >
                  距離少
                </button>
              </div>

              <div className="result-summary">
                <span>
                  {makerFilter === 'すべて' ? '全メーカー' : makerFilter} /{' '}
                  {modelFilter === 'すべて' ? '全車種' : modelFilter}
                </span>
                <strong>{filteredVehicles.length}台</strong>
              </div>

              {selectedCatalogModel && (
                <div className="catalog-hint">
                  <div>
                    <p className="eyebrow">カタログ候補</p>
                    <h3>
                      {selectedCatalogModel.maker.name} {selectedCatalogModel.model.name}
                    </h3>
                  </div>
                  <div className="catalog-tags">
                    {[
                      ...selectedCatalogModel.model.bodyTypes,
                      ...selectedCatalogModel.model.generationHints.slice(0, 2),
                      ...selectedCatalogModel.model.optionHints.slice(0, 3),
                    ].map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              )}

              <p className="catalog-source">
                参照構造: <a href={catalogSource.url}>{catalogSource.name}</a> / {catalogSource.note}
              </p>

              {loadingVehicles ? (
                <div className="vehicle-grid">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="vehicle-card skeleton" aria-hidden="true" />
                  ))}
                </div>
              ) : filteredVehicles.length === 0 ? (
                <div className="empty-result">
                  <Search size={32} />
                  <h3>条件に合う出品がありません</h3>
                  <p>フィルターを変えるか、条件をクリアして再検索してください。</p>
                  <button className="primary-action" onClick={resetSearch} type="button">
                    <RotateCcw size={16} />
                    条件をリセット
                  </button>
                </div>
              ) : (
                <div className="vehicle-grid">
                  {filteredVehicles.map((vehicle) => (
                    <article
                      className={`vehicle-card ${selectedId === vehicle.id ? 'selected' : ''}`}
                      key={vehicle.id}
                      onClick={() => {
                        setSelectedId(vehicle.id)
                        setDetailOpen(true)
                      }}
                    >
                      <div className="vehicle-photo">
                        <img src={vehicle.image} alt={vehicle.title} />
                        <button
                          className={`favorite ${favorites.includes(vehicle.id) ? 'active' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleFavorite(vehicle.id)
                          }}
                          type="button"
                          aria-label="お気に入り"
                        >
                          <Heart size={17} fill={favorites.includes(vehicle.id) ? 'currentColor' : 'none'} />
                        </button>
                        {vehicle.verified && <span className="verified-pill">本人確認済み</span>}
                      </div>
                      <div className="vehicle-body">
                        <div className="vehicle-title-row">
                          <h3>{vehicle.title}</h3>
                          <span>{yen(vehicle.price)}</span>
                        </div>
                        <p>{vehicle.grade}</p>
                        <div className="spec-row">
                          <span>{vehicle.year}</span>
                          <span>{mileageLabel(vehicle.mileage)}</span>
                          <span>車検 {vehicle.inspection}</span>
                          {vehicle.fuelType && vehicle.fuelType !== 'ガソリン' && (
                            <span className={`fuel-badge ${vehicle.fuelType === 'EV' ? 'fuel-ev' : vehicle.fuelType === 'PHEV' ? 'fuel-phev' : 'fuel-hv'}`}>{vehicle.fuelType}</span>
                          )}
                        </div>
                        <div className="tag-row">
                          {vehicle.tags.slice(0, 4).map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                        <div className="card-seller-row">
                          <MapPin size={11} />
                          <span>{vehicle.location.split(' ')[0]}</span>
                          <span className="card-dot">·</span>
                          <UserCheck size={11} />
                          <span>{vehicle.sellerName ?? '個人出品者'}</span>
                        </div>
                        <div className="card-actions">
                          <button
                            className={compareIds.includes(vehicle.id) ? 'picked' : ''}
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleCompare(vehicle.id)
                            }}
                            type="button"
                          >
                            <Scale size={15} />
                            比較
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {comparedVehicles.length > 0 && (
              <section className={`compare-panel ${activeView !== 'home' ? 'hidden-section' : ''}`}>
                <div className="section-header compact">
                  <div>
                    <p className="eyebrow">比較リスト</p>
                    <h2>{comparedVehicles.length}台を比較</h2>
                  </div>
                  <button className="ghost-button" onClick={() => setCompareIds([])} type="button">
                    クリア
                  </button>
                </div>
                <div className="compare-grid">
                  {comparedVehicles.map((vehicle) => (
                    <article key={vehicle.id}>
                      <img src={vehicle.image} alt="" />
                      <h3>{vehicle.title}</h3>
                      <dl>
                        <div>
                          <dt>価格</dt>
                          <dd>{yen(vehicle.price)}</dd>
                        </div>
                        <div>
                          <dt>走行</dt>
                          <dd>{mileageLabel(vehicle.mileage)}</dd>
                        </div>
                        <div>
                          <dt>車検</dt>
                          <dd>{vehicle.inspection}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className={`detail-strip ${activeView !== 'home' ? 'hidden-section' : ''}`}>
              <img src={selectedVehicle.image} alt="" />
              <div>
                <p className="eyebrow">選択中</p>
                <h2>{selectedVehicle.title}</h2>
                <p>
                  {selectedVehicle.grade} / {selectedVehicle.location}
                </p>
                <div className="mini-specs">
                  <span>
                    <Gauge size={15} />
                    {mileageLabel(selectedVehicle.mileage)}
                  </span>
                  <span>
                    <CalendarDays size={15} />
                    車検 {selectedVehicle.inspection}
                  </span>
                  <span>
                    <MapPin size={15} />
                    {selectedVehicle.location}
                  </span>
                </div>
              </div>
              <button className="primary-action" onClick={() => navigate('message')} type="button">
                <MessageSquareText size={18} />
                相談する
              </button>
              <button className="ghost-button" onClick={() => setDetailOpen(true)} type="button">
                詳細
              </button>
            </section>

            <section className={`market-insight ${activeView !== 'home' ? 'hidden-section' : ''}`}>
              <div>
                <p className="eyebrow">相場と購入総額</p>
                <h2>{selectedVehicle.maker}の近い出品から見る目安</h2>
              </div>
              <div className="insight-grid">
                <div>
                  <span>安め</span>
                  <strong>{yen(marketRange.low)}</strong>
                </div>
                <div>
                  <span>目安</span>
                  <strong>{yen(marketRange.fair)}</strong>
                </div>
                <div>
                  <span>高め</span>
                  <strong>{yen(marketRange.high)}</strong>
                </div>
                <div>
                  <span>諸費用込み</span>
                  <strong>{yen(totalPayment)}</strong>
                </div>
              </div>
              <div className="payment-planner">
                <div>
                  <p className="eyebrow">支払い目安</p>
                  <h3>月々 {yen(monthlyPayment)}</h3>
                  <p>
                    頭金 {yen(downPayment)} / {loanMonths}回払い / 概算年率3.5%相当
                  </p>
                </div>
                <label>
                  頭金
                  <input
                    max="1500000"
                    min="0"
                    step="50000"
                    type="range"
                    value={downPayment}
                    onChange={(event) => setDownPayment(Number(event.target.value))}
                  />
                </label>
                <label>
                  回数
                  <select value={loanMonths} onChange={(event) => setLoanMonths(Number(event.target.value))}>
                    <option value={36}>36回</option>
                    <option value={48}>48回</option>
                    <option value={60}>60回</option>
                    <option value={72}>72回</option>
                  </select>
                </label>
              </div>
              <div className="transfer-scenario">
                <div>
                  <p className="eyebrow">名義変更</p>
                  <h3>{transferScenario.label}</h3>
                  <p>概算サポート費用 {yen(transferScenario.cost)}</p>
                </div>
                <ol>
                  {transferScenario.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </section>

            <section className={`trust-panel ${activeView !== 'home' ? 'hidden-section' : ''}`}>
              <div>
                <p className="eyebrow">信頼と安全</p>
                <h2>安全な個人間売買のために</h2>
                <p>
                  CarLinkでは、車両状態の確認・本人確認・エスクロー決済・名義変更サポートを通じて、安全な取引環境を提供します。
                </p>
              </div>
              <div className="trust-actions">
                <button onClick={() => setLegalPanel('terms')} type="button">
                  利用規約
                </button>
                <button onClick={() => setLegalPanel('privacy')} type="button">
                  プライバシー
                </button>
                <button onClick={() => setLegalPanel('commerce')} type="button">
                  取引安全
                </button>
              </div>
              {readiness && (
                <div className="readiness-strip">
                  <strong>{readiness.ok ? '公開前チェック OK' : '確認が必要'}</strong>
                  {readiness.checks.map((check) => (
                    <span className={check.ok ? 'ok' : 'warn'} key={check.key}>
                      {check.ok ? <Check size={13} /> : <X size={13} />}
                      {check.label}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section
              className={`deal-workspace ${
                activeView !== 'message' && activeView !== 'deal' ? 'hidden-section' : ''
              }`}
              id="message"
            >
              <div className={`chat-panel ${activeView !== 'message' ? 'hidden-section' : ''}`}>
                <div className="section-header compact">
                  <div>
                    <p className="eyebrow">購入相談</p>
                    <h2>アプリ内チャット</h2>
                  </div>
                  <MessageSquareText className="status-icon" size={22} />
                </div>
                <div className="chat-list" ref={chatListRef}>
                  {displayedMessages.map((chat, index) => (
                    <div className={chat.from} key={`${chat.body}-${index}`}>
                      <p>{chat.body}</p>
                      <span>{chat.time}</span>
                    </div>
                  ))}
                </div>
                <div className="quick-message-row" aria-label="定型質問">
                  {[
                    '現車確認の日程を相談したいです。',
                    '整備記録簿と修復歴の有無を確認したいです。',
                    '名義変更の管轄と必要書類を確認したいです。',
                  ].map((template) => (
                    <button key={template} onClick={() => sendQuickMessage(template)} type="button">
                      {template}
                    </button>
                  ))}
                </div>
                <div className="message-composer">
                  <input
                    aria-label="メッセージ"
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') sendMessage()
                    }}
                    placeholder="質問や日程候補を入力"
                    value={message}
                  />
                  <button onClick={sendMessage} type="button">
                    送信
                  </button>
                </div>
              </div>

              <div className={`purchase-panel ${activeView !== 'deal' ? 'hidden-section' : ''}`} id="deal">
                <div className="section-header compact">
                  <div>
                    <p className="eyebrow">購入申請</p>
                    <h2>{selectedDeal ? '取引管理' : '安全決済の内訳'}</h2>
                  </div>
                  <LockKeyhole className="status-icon" size={22} />
                </div>
                {selectedDeal ? (
	                  <div className="deal-record">
	                    <span>申請ID {selectedDeal.id.slice(0, 8)}</span>
	                    <strong>{dealStatusLabels[selectedDeal.status]}</strong>
                    <p>
                      {selectedDeal.buyerName} / {yen(selectedDeal.amount)}
                    </p>
                    <div className="deal-timeline">
                      {(['applied', 'payment_pending', 'paid', 'handover', 'transfer', 'completed'] as DealRecord['status'][]).map(
                        (status, index, steps) => {
                          const currentIndex = steps.indexOf(selectedDeal.status)
                          return (
                            <span className={index <= currentIndex ? 'done' : ''} key={status}>
                              {dealStatusLabels[status]}
                            </span>
                          )
                        },
	                      )}
	                    </div>
                    {selectedDealEvents.length > 0 && (
                      <div className="deal-event-log">
                        <p className="eyebrow">取引ログ</p>
                        {selectedDealEvents.map((event) => (
                          <article key={event.id}>
                            <span>{dealEventLabels[event.kind]}</span>
                            <div>
                              <strong>{event.title}</strong>
                              <p>{event.body}</p>
                              <small>{new Date(event.createdAt).toLocaleString('ja-JP')}</small>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
	                  </div>
	                ) : (
                  <div className="application-form">
                    <label>
                      名前
                      <input
                        onChange={(event) => setBuyerName(event.target.value)}
                        placeholder="購入者名"
                        value={buyerName}
                      />
                    </label>
                    <label>
                      連絡先
                      <input
                        inputMode="tel"
                        onChange={(event) => setBuyerPhone(event.target.value)}
                        placeholder="電話番号"
                        value={buyerPhone}
                      />
                    </label>
                    <label className="wide">
                      希望・メモ
                      <textarea
                        onChange={(event) => setBuyerNote(event.target.value)}
                        placeholder="現車確認希望日、支払い方法、名義変更の希望など"
                        value={buyerNote}
                      />
                    </label>
                  </div>
                )}
                {dealMessage && <p className="deal-message">{dealMessage}</p>}
                <dl className="cost-list">
                  <div>
                    <dt>車両本体</dt>
                    <dd>{yen(selectedVehicle.price)}</dd>
                  </div>
                  <div>
                    <dt>プラットフォーム手数料 1.5%</dt>
                    <dd>{yen(buyerFee)}</dd>
                  </div>
                  <div>
                    <dt>名義変更サポート</dt>
                    <dd>{yen(28000)}</dd>
                  </div>
                  <div className="total">
                    <dt>入金予定額</dt>
                    <dd>{yen(totalPayment)}</dd>
                  </div>
                </dl>
                <button
                  className="primary-action full"
	                  onClick={advanceSelectedDeal}
	                  type="button"
	                >
                  <WalletCards size={18} />
                  {selectedDeal ? '取引を進める' : '購入申請を作成'}
                </button>
                <div className="handover-plan">
                  <div>
                    <p className="eyebrow">現車確認・引き渡し予定</p>
                    <strong>{selectedDeal?.handoverDate || '未設定'}</strong>
                  </div>
                  <label>
                    日時
                    <input
                      onChange={(event) => setHandoverDate(event.target.value)}
                      placeholder="5月10日 14:00"
                      value={handoverDate || selectedDeal?.handoverDate || ''}
                    />
                  </label>
                  <label>
                    場所
                    <input
                      onChange={(event) => setHandoverPlace(event.target.value)}
                      placeholder="東京都品川区 周辺"
                      value={handoverPlace || selectedDeal?.handoverPlace || ''}
                    />
                  </label>
                  <label className="wide">
                    メモ
                    <textarea
                      onChange={(event) => setHandoverMemo(event.target.value)}
                      placeholder="駅前で現車確認、必要書類を持参など"
                      value={handoverMemo || selectedDeal?.handoverMemo || ''}
                    />
                  </label>
                  <button onClick={saveHandoverPlan} type="button">
                    予定を保存
                  </button>
                </div>
                <div className="safety-checklist">
                  <p>購入前チェック</p>
                  <span>
                    <Check size={14} />
                    本人確認済み
                  </span>
                  <span>
                    <Check size={14} />
                    入金後に売主へ通知
                  </span>
                  <span>
                    <Check size={14} />
                    名義変更完了までステータス管理
                  </span>
                  <span>
                    <Check size={14} />
                    現車確認と書類確認をチャットに記録
                  </span>
                </div>
                <div className="inspection-checklist">
                  <div>
                    <p className="eyebrow">現車確認チェック</p>
                    <strong>
                      {activeInspectionChecks.length}/{inspectionCheckItems.length}
                    </strong>
                  </div>
                  <div className="inspection-grid">
                    {inspectionCheckItems.map((item) => (
                      <button
                        className={activeInspectionChecks.includes(item) ? 'done' : ''}
                        key={item}
                        onClick={() => toggleInspectionCheck(item)}
                        type="button"
                      >
                        {activeInspectionChecks.includes(item) ? <Check size={14} /> : <ClipboardCheck size={14} />}
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="escrow-flow">
                  <p className="eyebrow">資金解放条件</p>
                  <ol>
                    <li>買主の入金確認</li>
                    <li>車両引き渡し確認</li>
                    <li>名義変更完了確認</li>
                    <li>売主へ売上入金</li>
                  </ol>
                </div>
              </div>
            </section>
          </div>

          <aside className={`assist-column ${activeView !== 'sell' ? 'hidden-section' : ''}`}>
            <section className="assistant-card">
              <div className="section-header compact">
                <div>
                  <p className="eyebrow">出品作成</p>
                  <h2>読み取り結果</h2>
                </div>
                <BadgeCheck className="status-icon" size={22} />
              </div>

              <div className="scan-actions">
                <button onClick={() => setListingStep(0)} type="button">
                  <FileScan size={18} />
                  車検証
                </button>
                <button onClick={() => setListingStep(1)} type="button">
                  <Upload size={18} />
                  写真
                </button>
              </div>

              <div className="form-grid">
                {scannedFields.slice(0, 4).map(([label]) => (
                  <label key={label}>
                    {label}
                    <input
                      onChange={(event) =>
                        setDraftFields((current) => ({
                          ...current,
                          [label]: event.target.value,
                        }))
                      }
                      value={draftFields[label] ?? ''}
                    />
                  </label>
                ))}
              </div>

              <div className="option-block">
                <div className="mini-heading">
                  <Sparkles size={16} />
                  装備候補
                </div>
                <div className="option-list">
                  {aiOptions.slice(0, 5).map((option) => (
                    <button
                      className={selectedOptions.includes(option.label) ? 'picked' : ''}
                      key={option.label}
                      onClick={() => toggleOption(option.label)}
                      type="button"
                    >
                      <span>{option.label}</span>
                      <small>{option.score}%</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="publish-preview">
                <div>
                  <p className="eyebrow">掲載プレビュー</p>
                  <h3>{draftFields.車名 || '車名未入力'} {draftFields.型式 ? `(${draftFields.型式})` : ''}</h3>
                  <p>
                    掲載品質 {listingQuality}% / 不足 {listingIssues.length}件 / 公開前に編集できます。
                  </p>
                </div>
                <button className="ghost-button" onClick={() => setListingStep(4)} type="button">
                  <PenLine size={16} />
                  編集
                </button>
              </div>

              {currentUser && (
                <div className="seller-listings">
                  <div className="mini-heading">
                    <CarFront size={16} />
                    自分の掲載
                  </div>
                  {myListings.length === 0 ? (
                    <p>公開済みの掲載はまだありません。</p>
                  ) : (
                    myListings.slice(0, 3).map((vehicle) => (
                      <article className="seller-listing-row" key={vehicle.id}>
                        <img src={vehicle.image} alt="" />
                        <span>
                          <strong>{vehicle.title}</strong>
                          <small>
                            {yen(vehicle.price)} / {vehicle.location} / {vehicle.status === 'paused' ? '停止中' : '公開中'}
                          </small>
                        </span>
                        <div>
                          <button
                            onClick={() => editListing(vehicle)}
                            type="button"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => {
                              setSelectedId(vehicle.id)
                              setDetailOpen(true)
                              navigate('home')
                            }}
                            type="button"
                          >
                            詳細
                          </button>
                          <button
                            onClick={() => setListingStatus(vehicle.id, vehicle.status === 'paused' ? 'published' : 'paused')}
                            type="button"
                          >
                            {vehicle.status === 'paused' ? '再公開' : '停止'}
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              )}
            </section>

            <section className="deal-card">
              <div className="section-header compact">
                <div>
                  <p className="eyebrow">安全決済</p>
                  <h2>取引ステータス</h2>
                </div>
                <WalletCards className="status-icon" size={22} />
              </div>
              <div className="progress-list">
                {dealSteps.map((step, index) => {
                  const Icon = step.icon
                  return (
                    <div className={index < dealProgress ? 'done' : ''} key={step.label}>
                      <span>
                        <Icon size={14} />
                      </span>
                      <p>{step.label}</p>
                    </div>
                  )
                })}
              </div>
              <div className="metric-row">
                <div>
                  <Gauge size={18} />
                  名義変更判定
                </div>
                <strong>同一管轄</strong>
              </div>
              <div className="document-list">
                <p className="eyebrow">必要書類</p>
                {['車検証', '譲渡証明書', '印鑑証明', '委任状', '自賠責保険証'].map((documentName, index) => (
                  <span className={index < 2 ? 'done' : ''} key={documentName}>
                    {index < 2 ? <Check size={14} /> : <FileScan size={14} />}
                    {documentName}
                  </span>
                ))}
              </div>
            </section>
          </aside>
        </section>

        <section className={`admin-workspace ${activeView !== 'admin' ? 'hidden-section' : ''}`} id="admin">
          <div className="admin-hero">
            <div>
              <p className="eyebrow">管理パネル</p>
              <h1>出品審査と運用チェック</h1>
              <p>出品審査・取引管理・ユーザー管理・システム状態をまとめて確認できます。</p>
            </div>
            <strong>{readiness?.ok ? '運用チェック OK' : '確認中'}</strong>
          </div>

          <div className="admin-grid">
            <section className="admin-card">
              <div className="section-header compact">
                <div>
                  <p className="eyebrow">Readiness</p>
                  <h2>システム状態</h2>
                </div>
                <ShieldCheck className="status-icon" size={22} />
              </div>
              <div className="admin-check-list">
                {(readiness?.checks ?? []).map((check) => (
                  <span className={check.ok ? 'ok' : 'warn'} key={check.key}>
                    {check.ok ? <Check size={14} /> : <X size={14} />}
                    {check.label}
                  </span>
                ))}
              </div>
            </section>

            <section className="admin-card">
              <div className="section-header compact">
                <div>
                  <p className="eyebrow">Metrics</p>
                  <h2>現在のデータ</h2>
                </div>
                <Gauge className="status-icon" size={22} />
              </div>
              <div className="admin-metrics">
                <div>
                  <span>出品</span>
                  <strong>{vehicles.length}</strong>
                </div>
                <div>
                  <span>チャット</span>
                  <strong>{chatMessages.length}</strong>
                </div>
                <div>
                  <span>保存条件</span>
                  <strong>{savedSearches.length}</strong>
                </div>
                <div>
                  <span>購入申請</span>
                  <strong>{readiness?.state.deals ?? deals.length}</strong>
                </div>
                <div>
                  <span>相談履歴</span>
                  <strong>{readiness?.state.messages ?? conversationMessages.length}</strong>
                </div>
                <div>
                  <span>通知</span>
                  <strong>{readiness?.state.notifications ?? notifications.length}</strong>
                </div>
              </div>
            </section>
          </div>

          <section className="admin-card">
            <div className="section-header compact">
              <div>
                <p className="eyebrow">Notifications</p>
                <h2>ユーザー通知</h2>
              </div>
              <Bell className="status-icon" size={22} />
            </div>
            <div className="notification-list">
              {notifications.length === 0 ? (
                <p>通知はまだありません。出品・購入申請・チャットが発生するとここに残ります。</p>
              ) : (
                notifications.map((notification) => (
                  <article className={notification.read ? 'read' : ''} key={notification.id}>
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.body}</p>
                      <span>{new Date(notification.createdAt).toLocaleString('ja-JP')}</span>
                    </div>
                    <button
                      onClick={() => {
                        markNotificationRead(notification.id).then((updated) => {
                          if (updated) {
                            setNotifications((records) =>
                              records.map((item) => (item.id === updated.id ? updated : item)),
                            )
                          }
                        })
                      }}
                      type="button"
                    >
                      {notification.read ? '確認済み' : '既読'}
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="admin-card">
            <div className="section-header compact">
              <div>
                <p className="eyebrow">Review Queue</p>
                <h2>出品審査キュー</h2>
              </div>
              <BadgeCheck className="status-icon" size={22} />
            </div>
            <div className="review-table">
              {reviewQueue.map(({ vehicle, risks }) => (
                <article key={vehicle.id}>
                  <img src={vehicle.image} alt="" />
                  <div>
                    <h3>{vehicle.title}</h3>
                    <p>
                      {yen(vehicle.price)} / {mileageLabel(vehicle.mileage)} / {vehicle.location}
                    </p>
                  </div>
	                  <div className="risk-tags">
	                    {risks.length ? risks.map((risk) => <span key={risk}>{risk}</span>) : <span className="ok">確認済み</span>}
	                  </div>
                  <div className="review-actions">
                    <button onClick={() => setListingStatus(vehicle.id, 'published')} type="button">
                      公開
                    </button>
                    <button onClick={() => setListingStatus(vehicle.id, 'paused')} type="button">
                      停止
                    </button>
                  </div>
	                </article>
              ))}
            </div>
          </section>

          <section className="admin-card">
            <div className="section-header compact">
              <div>
                <p className="eyebrow">Deal Queue</p>
                <h2>購入申請キュー</h2>
              </div>
              <WalletCards className="status-icon" size={22} />
            </div>
            <div className="deal-table">
              {deals.length === 0 ? (
                <p>購入申請はまだありません。</p>
              ) : (
                deals.map((deal) => (
                  <article key={deal.id}>
                    <div>
                      <h3>{deal.vehicleTitle}</h3>
                      <p>
                        {deal.buyerName} / {yen(deal.amount)} / {dealStatusLabels[deal.status]}
                      </p>
                      {deal.events?.length ? (
                        <small>{deal.events[deal.events.length - 1].title}</small>
                      ) : (
                        <small>取引ログ未作成</small>
                      )}
                    </div>
                    <span>{deal.id.slice(0, 8)}</span>
                    <button onClick={() => updateDealStatus(deal.id, 'payment_pending').then((updated) => {
                      if (updated) {
                        setDeals((current) => current.map((item) => (item.id === updated.id ? updated : item)))
                        refreshNotifications()
                      }
                    })} type="button">
                      入金待ちへ
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>
      </section>

      {detailOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setDetailOpen(false)}>
          <section
            aria-label="車両詳細"
            className="vehicle-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setDetailOpen(false)} type="button">
              <X size={20} />
            </button>
            {(selectedVehicle.images ?? []).length > 1 ? (
              <div className="modal-gallery">
                {(selectedVehicle.images ?? [selectedVehicle.image]).map((img, idx) => (
                  <img key={idx} src={img} alt={`${selectedVehicle.title} 写真${idx + 1}`} />
                ))}
              </div>
            ) : (
              <img src={selectedVehicle.image} alt={selectedVehicle.title} />
            )}
            <div className="modal-body">
              <p className="eyebrow">{selectedVehicle.sellerName ?? '個人出品者'}</p>
              <h2>{selectedVehicle.title}</h2>
              <strong>{yen(selectedVehicle.price)}</strong>
              <p>{selectedVehicle.description ?? '出品者が内容を確認済みです。現車確認・書類確認の上、購入申請へお進みください。'}</p>
              <div className="prepurchase-checks">
                {[
                  ['本人確認', selectedVehicle.verified],
                  ['車検残あり', selectedVehicle.inspection !== 'なし'],
                  ['写真確認', selectedVehicle.image.length > 0],
                  ['装備タグ', selectedVehicle.tags.length > 0],
                ].map(([label, ok]) => (
                  <span className={ok ? 'ok' : 'warn'} key={String(label)}>
                    {ok ? <Check size={13} /> : <X size={13} />}
                    {label}
                  </span>
                ))}
              </div>
              <div className="mini-specs">
                <span>
                  <Gauge size={15} />
                  {mileageLabel(selectedVehicle.mileage)}
                </span>
                <span>
                  <CalendarDays size={15} />
                  車検 {selectedVehicle.inspection}
                </span>
                <span>
                  <MapPin size={15} />
                  {selectedVehicle.location}
                </span>
                {selectedVehicle.fuelType && (
                  <span className={`fuel-badge ${selectedVehicle.fuelType === 'EV' ? 'fuel-ev' : selectedVehicle.fuelType === 'PHEV' ? 'fuel-phev' : 'fuel-hv'}`}>
                    {selectedVehicle.fuelType}
                  </span>
                )}
                {selectedVehicle.driveType && (
                  <span>{selectedVehicle.driveType}</span>
                )}
                {selectedVehicle.accidentHistory === false && (
                  <span className="no-accident">修復歴なし</span>
                )}
              </div>
              <div className="tag-row">
                {selectedVehicle.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="modal-actions">
                <button
                  className={`ghost-button ${favorites.includes(selectedVehicle.id) ? 'picked' : ''}`}
                  onClick={() => toggleFavorite(selectedVehicle.id)}
                  type="button"
                >
                  <Heart size={17} fill={favorites.includes(selectedVehicle.id) ? 'currentColor' : 'none'} />
                  お気に入り
                </button>
                <button
                  className={`ghost-button ${compareIds.includes(selectedVehicle.id) ? 'picked' : ''}`}
                  onClick={() => toggleCompare(selectedVehicle.id)}
                  type="button"
                >
                  <Scale size={17} />
                  比較
                </button>
                <button
                  className="primary-action"
                  onClick={() => {
                    setDetailOpen(false)
                    navigate('deal')
                  }}
                  type="button"
                >
                  <ShieldCheck size={18} />
                  取引・申請
                </button>
                <button
                  className="ghost-button"
                  onClick={() => {
                    setDetailOpen(false)
                    navigate('message')
                  }}
                  type="button"
                >
                  <MessageSquareText size={17} />
                  相談する
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              {toast.type === 'success' && <Check size={16} />}
              {toast.type === 'error' && <X size={16} />}
              {toast.type === 'info' && <Bell size={16} />}
              <span>{toast.message}</span>
              <button
                onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
                aria-label="閉じる"
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <nav className="bottom-nav" aria-label="ボトムナビゲーション">
        <button className={activeView === 'home' ? 'active' : ''} onClick={() => navigate('home')} type="button">
          <Search size={20} />
          <span>探す</span>
        </button>
        <button className={activeView === 'sell' ? 'active' : ''} onClick={() => navigate('sell')} type="button">
          <Camera size={20} />
          <span>出品</span>
        </button>
        <button className={activeView === 'deal' ? 'active' : ''} onClick={() => navigate('deal')} type="button">
          <ShieldCheck size={20} />
          <span>取引</span>
        </button>
        <button className={activeView === 'message' ? 'active' : ''} onClick={() => navigate('message')} type="button">
          <MessageSquareText size={20} />
          <span>チャット</span>
        </button>
        <button className={`${activeView === 'admin' ? 'active' : ''} notification-button`} onClick={() => navigate('admin')} type="button">
          <Bell size={20} />
          {unreadNotifications > 0 && <span className="badge">{unreadNotifications}</span>}
          <span>管理</span>
        </button>
      </nav>

      {legalPanel && (
        <div className="modal-backdrop" role="presentation" onClick={() => setLegalPanel(null)}>
          <section
            aria-label={legalPanels[legalPanel].title}
            className="legal-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setLegalPanel(null)} type="button">
              <X size={20} />
            </button>
            <p className="eyebrow">{legalPanels[legalPanel].eyebrow}</p>
            <h2>{legalPanels[legalPanel].title}</h2>
            <ul>
              {legalPanels[legalPanel].items.map((item) => (
                <li key={item}>
                  <Check size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p>
              詳細な規約・プライバシーポリシー・特定商取引法に基づく表記については、サービス内の各ページよりご確認いただけます。ご不明な点はサポートまでお問い合わせください。
            </p>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
