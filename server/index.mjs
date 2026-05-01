import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dataDir = join(rootDir, 'server-data')
const stateFile = join(dataDir, 'state.json')
const usersFile = join(dataDir, 'users.json')
const sessionsFile = join(dataDir, 'sessions.json')
const listingsFile = join(dataDir, 'listings.json')
const dealsFile = join(dataDir, 'deals.json')
const messagesFile = join(dataDir, 'messages.json')
const notificationsFile = join(dataDir, 'notifications.json')
const uploadsDir = join(dataDir, 'uploads')
const distDir = join(rootDir, 'dist')
const port = Number(process.env.PORT ?? 8787)
const isHttps = Boolean(process.env.HTTPS_KEY_PATH && process.env.HTTPS_CERT_PATH)
const hasManagedTls = Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL)

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const securityHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

async function readJsonBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 30_000_000) {
      throw new Error('Request body is too large')
    }
  }
  return body ? JSON.parse(body) : null
}

async function readState() {
  try {
    const raw = await readFile(stateFile, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function writeState(state) {
  await mkdir(dataDir, { recursive: true })
  await writeFile(stateFile, JSON.stringify(state, null, 2))
}

async function readCollection(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function writeCollection(filePath, value) {
  await mkdir(dataDir, { recursive: true })
  await writeFile(filePath, JSON.stringify(value, null, 2))
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie ?? '')
      .split(';')
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const [key, ...value] = cookie.split('=')
        return [key, decodeURIComponent(value.join('='))]
      }),
  )
}

function userPublicView(user) {
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    verified: Boolean(user.verified),
    createdAt: user.createdAt,
  }
}

async function getCurrentUser(request) {
  const cookies = parseCookies(request)
  if (!cookies.carlink_session) return null
  const sessions = await readCollection(sessionsFile, {})
  const userId = sessions[cookies.carlink_session]
  if (!userId) return null
  const users = await readCollection(usersFile, [])
  return users.find((user) => user.id === userId) ?? null
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateState(state) {
  if (state === null) return { ok: true }
  if (!isRecord(state)) return { ok: false, error: 'State must be an object' }
  if (!Array.isArray(state.vehicles)) return { ok: false, error: 'vehicles must be an array' }
  if (!Array.isArray(state.chatMessages)) return { ok: false, error: 'chatMessages must be an array' }
  if (state.compareIds !== undefined && !Array.isArray(state.compareIds)) {
    return { ok: false, error: 'compareIds must be an array' }
  }
  if (!Array.isArray(state.favorites)) return { ok: false, error: 'favorites must be an array' }
  if (state.inspectionChecks !== undefined && !Array.isArray(state.inspectionChecks)) {
    return { ok: false, error: 'inspectionChecks must be an array' }
  }
  if (!Array.isArray(state.selectedOptions)) return { ok: false, error: 'selectedOptions must be an array' }
  if (!Array.isArray(state.photoImages)) return { ok: false, error: 'photoImages must be an array' }
  if (state.savedSearches !== undefined && !Array.isArray(state.savedSearches)) {
    return { ok: false, error: 'savedSearches must be an array' }
  }
  return { ok: true }
}

function sanitizeString(value, maxLength = 120) {
  return String(value ?? '').trim().slice(0, maxLength)
}

function sanitizeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function parseDataUrl(value) {
  const match = String(value ?? '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) return null
  const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1]
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length === 0 || buffer.length > 8_000_000) return null
  return { buffer, extension, mimeType }
}

function sanitizeListing(input, owner) {
  if (!isRecord(input)) return null
  const title = sanitizeString(input.title, 80)
  const price = sanitizeNumber(input.price)
  if (!title || price < 50_000) return null
  return {
    id: sanitizeNumber(input.id, Date.now()),
    title,
    maker: sanitizeString(input.maker || '未設定', 40),
    grade: sanitizeString(input.grade || '個人出品', 80),
    year: sanitizeString(input.year || '年式未入力', 30),
    mileage: Math.max(0, sanitizeNumber(input.mileage, 0)),
    price,
    location: sanitizeString(input.location || '地域未入力', 60),
    image: sanitizeString(input.image, 1_000_000),
    tags: Array.isArray(input.tags) ? input.tags.map((tag) => sanitizeString(tag, 28)).filter(Boolean).slice(0, 30) : [],
    inspection: sanitizeString(input.inspection || '確認中', 40),
    verified: Boolean(input.verified),
    sellerId: sanitizeString(input.sellerId || owner?.id || '', 80),
    sellerName: sanitizeString(input.sellerName || owner?.name || '個人出品者', 40),
    description: sanitizeString(input.description || '', 600),
    createdAt: sanitizeString(input.createdAt || new Date().toISOString(), 40),
    updatedAt: new Date().toISOString(),
    status: ['published', 'draft', 'paused'].includes(input.status) ? input.status : 'published',
  }
}

function publicListingView(listing) {
  return {
    ...listing,
    sellerId: listing.sellerId,
  }
}

async function saveUpload(dataUrl) {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return null
  await mkdir(uploadsDir, { recursive: true })
  const id = randomUUID()
  const filename = `${id}.${parsed.extension}`
  await writeFile(join(uploadsDir, filename), parsed.buffer)
  return {
    id,
    url: `/uploads/${filename}`,
    mimeType: parsed.mimeType,
    size: parsed.buffer.length,
  }
}

function sanitizeDeal(input, user) {
  if (!isRecord(input)) return null
  const vehicleId = sanitizeNumber(input.vehicleId)
  const vehicleTitle = sanitizeString(input.vehicleTitle, 80)
  const buyerName = sanitizeString(input.buyerName || user?.name, 40)
  const buyerPhone = sanitizeString(input.buyerPhone || user?.phone, 20).replace(/[^\d+]/g, '')
  const amount = sanitizeNumber(input.amount)
  if (!vehicleId || !vehicleTitle || !buyerName || buyerPhone.length < 8 || amount < 50_000) return null
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    vehicleId,
    vehicleTitle,
    buyerId: sanitizeString(input.buyerId || user?.id || '', 80),
    buyerName,
    buyerPhone,
    sellerId: sanitizeString(input.sellerId || '', 80),
    sellerName: sanitizeString(input.sellerName || '', 40),
    amount,
    status: ['inquiry', 'applied', 'payment_pending', 'paid', 'handover', 'transfer', 'completed', 'cancelled'].includes(input.status)
      ? input.status
      : 'applied',
    note: sanitizeString(input.note || '', 500),
    documentChecks: Array.isArray(input.documentChecks)
      ? input.documentChecks.map((check) => sanitizeString(check, 40)).filter(Boolean).slice(0, 20)
      : [],
    createdAt: now,
    updatedAt: now,
  }
}

function sanitizeMessage(input, user) {
  if (!isRecord(input)) return null
  const vehicleId = sanitizeNumber(input.vehicleId)
  const body = sanitizeString(input.body, 1000)
  if (!vehicleId || !body) return null
  return {
    id: randomUUID(),
    dealId: sanitizeString(input.dealId || '', 80),
    vehicleId,
    senderId: sanitizeString(user?.id || input.senderId || '', 80),
    senderName: sanitizeString(user?.name || input.senderName || 'ゲスト', 40),
    senderRole: ['buyer', 'seller', 'admin', 'system'].includes(input.senderRole) ? input.senderRole : user?.role || 'buyer',
    body,
    createdAt: new Date().toISOString(),
  }
}

async function createNotification(input) {
  const userId = sanitizeString(input?.userId || '', 80)
  if (!userId) return null

  const notification = {
    id: randomUUID(),
    userId,
    kind: ['listing', 'deal', 'message', 'system'].includes(input?.kind) ? input.kind : 'system',
    title: sanitizeString(input?.title, 80),
    body: sanitizeString(input?.body, 240),
    href: sanitizeString(input?.href || '', 120),
    read: false,
    createdAt: new Date().toISOString(),
  }
  const notifications = await readCollection(notificationsFile, [])
  await writeCollection(notificationsFile, [notification, ...notifications].slice(0, 1000))
  return notification
}

function sanitizeState(state) {
  if (state === null) return null
  return {
    ...state,
    compareIds: Array.isArray(state.compareIds) ? state.compareIds.slice(0, 3) : [],
    certificateReadMethod:
      state.certificateReadMethod === 'upload' || state.certificateReadMethod === 'electronic'
        ? state.certificateReadMethod
        : null,
    lastDraftSavedAt: typeof state.lastDraftSavedAt === 'string' ? state.lastDraftSavedAt.slice(0, 40) : '',
    savedSearches: Array.isArray(state.savedSearches) ? state.savedSearches.slice(0, 10) : [],
    vehicles: state.vehicles.slice(0, 200),
    chatMessages: state.chatMessages.slice(-200),
    favorites: state.favorites.slice(0, 200),
    inspectionChecks: Array.isArray(state.inspectionChecks) ? state.inspectionChecks.slice(0, 30) : [],
    selectedOptions: state.selectedOptions.slice(0, 80),
    photoImages: state.photoImages.slice(0, 12),
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...corsHeaders,
    ...securityHeaders,
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function sendJsonWithCookie(response, statusCode, payload, cookie) {
  response.writeHead(statusCode, {
    ...corsHeaders,
    ...securityHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Set-Cookie': cookie,
  })
  response.end(JSON.stringify(payload))
}

function sendNoContent(response) {
  response.writeHead(204, {
    ...corsHeaders,
    ...securityHeaders,
  })
  response.end()
}

async function serveStatic(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

  if (url.pathname.startsWith('/uploads/')) {
    const filename = normalize(decodeURIComponent(url.pathname.replace('/uploads/', ''))).replace(/^(\.\.[/\\])+/, '')
    const filePath = join(uploadsDir, filename)
    try {
      await stat(filePath)
      response.writeHead(200, {
        ...securityHeaders,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
      })
      createReadStream(filePath).pipe(response)
    } catch {
      sendJson(response, 404, { error: 'upload not found' })
    }
    return
  }

  const requestedPath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(distDir, requestedPath === '/' ? 'index.html' : requestedPath)

  try {
    const fileStat = await stat(filePath)
    if (fileStat.isDirectory()) filePath = join(filePath, 'index.html')
  } catch {
    filePath = join(distDir, 'index.html')
  }

  const contentType = mimeTypes[extname(filePath)] ?? 'application/octet-stream'
  const cacheControl = filePath.endsWith('index.html')
    ? 'no-cache'
    : filePath.includes(`${distDir}/assets/`)
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600'
  response.writeHead(200, {
    ...securityHeaders,
    'Cache-Control': cacheControl,
    'Content-Type': contentType,
  })
  createReadStream(filePath).pipe(response)
}

async function getReadiness() {
  const checks = []
  const state = await readState()
  const users = await readCollection(usersFile, [])
  const listings = await readCollection(listingsFile, [])
  const deals = await readCollection(dealsFile, [])
  const messages = await readCollection(messagesFile, [])
  const notifications = await readCollection(notificationsFile, [])

  try {
    await stat(join(distDir, 'index.html'))
    checks.push({ key: 'build', label: 'Production build', ok: true })
  } catch {
    checks.push({ key: 'build', label: 'Production build', ok: false })
  }

  try {
    await stat(join(distDir, 'manifest.webmanifest'))
    await stat(join(distDir, 'sw.js'))
    checks.push({ key: 'pwa', label: 'PWA manifest/service worker', ok: true })
  } catch {
    checks.push({ key: 'pwa', label: 'PWA manifest/service worker', ok: false })
  }

  checks.push({
    key: 'state',
    label: 'Local persisted state',
    ok: state === null || validateState(state).ok,
  })
  checks.push({
    key: 'storage',
    label: 'Server data directory',
    ok: true,
  })
  checks.push({
    key: 'uploads',
    label: 'Image upload storage',
    ok: true,
  })
  checks.push({
    key: 'https',
    label: 'HTTPS ready',
    ok: isHttps || hasManagedTls || process.env.NODE_ENV !== 'production',
  })
  checks.push({
    key: 'ocr',
    label: 'OpenAI OCR key',
    ok: Boolean(process.env.OPENAI_API_KEY) || process.env.NODE_ENV !== 'production',
  })

  return {
    ok: checks.every((check) => check.ok),
    checks,
    state: {
      vehicles: Array.isArray(state?.vehicles) ? state.vehicles.length : 0,
      chatMessages: Array.isArray(state?.chatMessages) ? state.chatMessages.length : 0,
      savedSearches: Array.isArray(state?.savedSearches) ? state.savedSearches.length : 0,
      users: Array.isArray(users) ? users.length : 0,
      listings: Array.isArray(listings) ? listings.length : 0,
      deals: Array.isArray(deals) ? deals.length : 0,
      messages: Array.isArray(messages) ? messages.length : 0,
      notifications: Array.isArray(notifications) ? notifications.length : 0,
    },
  }
}

function fallbackAnalysis(mode) {
  const isCertificate = mode === 'certificate'
  return {
    fields: {
      車名: isCertificate ? '車検証読み取り車両' : 'トヨタ ハリアー',
      型式: isCertificate ? 'MXUA80' : 'MXUA80',
      初度登録: '令和3年9月',
      車検満了: '令和8年9月12日',
      走行距離: '28,000km',
      排気量: '1,980cc',
    },
    options: ['サンルーフ', 'ETC', 'アダプティブクルーズ', 'シートヒーター'],
    price: 3180000,
    confidence: 0.72,
    source: 'fallback',
    note: 'OCR APIキー未設定のためローカル推定で読み取りました。OPENAI_API_KEYを設定すると本物の画像解析に切り替わります。',
  }
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text
  const texts = []
  for (const item of payload?.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === 'string') texts.push(content.text)
    }
  }
  return texts.join('\n')
}

async function analyzeWithOpenAI({ image, images, mode }) {
  const inputImages = Array.isArray(images) && images.length > 0 ? images : [image].filter(Boolean)
  if (!process.env.OPENAI_API_KEY || inputImages.length === 0) {
    return fallbackAnalysis(mode)
  }

  const prompt =
    mode === 'certificate'
      ? '日本の自動車検査証画像をOCRしてください。車名、型式、初度登録、車検満了、走行距離、排気量を推定し、出品者が確認しやすいJSONだけで返してください。'
      : '中古車出品用の車両写真を解析してください。車種、型式候補、年式候補、走行距離、装備候補、推奨価格を推定し、JSONだけで返してください。'

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL ?? 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `${prompt}
返却形式:
{
  "fields": {"車名": "", "型式": "", "初度登録": "", "車検満了": "", "走行距離": "", "排気量": ""},
  "options": ["ETC"],
  "price": 0,
  "confidence": 0.0,
  "note": "確認が必要な点"
}`,
            },
            ...inputImages.map((imageUrl) => ({
              type: 'input_image',
              image_url: imageUrl,
              detail: 'high',
            })),
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI OCR failed: ${response.status} ${errorBody.slice(0, 180)}`)
  }

  const payload = await response.json()
  const text = extractResponseText(payload)
  const parsed = JSON.parse(text.replace(/^```json|```$/g, '').trim())
  return {
    ...fallbackAnalysis(mode),
    ...parsed,
    source: 'openai',
    note: parsed.note ?? 'AI読み取りが完了しました。内容を確認してください。',
  }
}

const requestHandler = async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      sendNoContent(response)
      return
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

    if (url.pathname === '/api/health') {
      sendJson(response, 200, { ok: true, version: process.env.npm_package_version ?? '0.0.0' })
      return
    }

    if (url.pathname === '/api/readiness') {
      sendJson(response, 200, await getReadiness())
      return
    }

    if (url.pathname === '/api/auth/session') {
      sendJson(response, 200, { user: userPublicView(await getCurrentUser(request)) })
      return
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      const body = await readJsonBody(request)
      const name = String(body?.name ?? '').trim().slice(0, 40)
      const phone = String(body?.phone ?? '').replace(/[^\d+]/g, '').slice(0, 20)
      const role = ['seller', 'buyer', 'admin'].includes(body?.role) ? body.role : 'seller'
      if (!name || phone.length < 8) {
        sendJson(response, 400, { error: 'name and phone are required' })
        return
      }

      const users = await readCollection(usersFile, [])
      let user = users.find((item) => item.phone === phone)
      if (!user) {
        user = {
          id: randomUUID(),
          name,
          phone,
          role,
          verified: false,
          createdAt: new Date().toISOString(),
        }
        users.push(user)
      } else {
        user.name = name
        user.role = role
      }
      await writeCollection(usersFile, users)

      const sid = randomUUID()
      const sessions = await readCollection(sessionsFile, {})
      sessions[sid] = user.id
      await writeCollection(sessionsFile, sessions)
      const secureCookie = isHttps || hasManagedTls ? '; Secure' : ''
      sendJsonWithCookie(
        response,
        200,
        { user: userPublicView(user) },
        `carlink_session=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secureCookie}`,
      )
      return
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const cookies = parseCookies(request)
      const sessions = await readCollection(sessionsFile, {})
      if (cookies.carlink_session) delete sessions[cookies.carlink_session]
      await writeCollection(sessionsFile, sessions)
      sendJsonWithCookie(response, 200, { ok: true }, 'carlink_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
      return
    }

    if (url.pathname === '/api/users') {
      const user = await getCurrentUser(request)
      if (!user) {
        sendJson(response, 401, { error: 'Unauthorized' })
        return
      }
      const users = await readCollection(usersFile, [])
      sendJson(response, 200, { users: users.map(userPublicView) })
      return
    }

    if (url.pathname === '/api/state' && request.method === 'GET') {
      sendJson(response, 200, { state: await readState() })
      return
    }

    if (url.pathname === '/api/state' && request.method === 'PUT') {
      const body = await readJsonBody(request)
      const state = body?.state ?? body
      const validation = validateState(state)
      if (!validation.ok) {
        sendJson(response, 400, { error: validation.error })
        return
      }
      await writeState(sanitizeState(state))
      sendJson(response, 200, { ok: true })
      return
    }

    if (url.pathname === '/api/state' && request.method === 'DELETE') {
      await writeState(null)
      sendJson(response, 200, { ok: true })
      return
    }

    if (url.pathname === '/api/uploads' && request.method === 'POST') {
      const body = await readJsonBody(request)
      const upload = await saveUpload(body?.image)
      if (!upload) {
        sendJson(response, 400, { error: 'invalid image' })
        return
      }
      sendJson(response, 200, { upload })
      return
    }

    if (url.pathname === '/api/listings' && request.method === 'GET') {
      const user = await getCurrentUser(request)
      const listings = await readCollection(listingsFile, [])
      const scope = url.searchParams.get('scope')
      if (scope === 'mine' && user) {
        sendJson(response, 200, { listings: listings.filter((listing) => listing.sellerId === user.id).map(publicListingView) })
        return
      }
      sendJson(response, 200, {
        listings: listings
          .filter((listing) => listing.status !== 'draft' && listing.status !== 'paused')
          .map(publicListingView),
      })
      return
    }

    if (url.pathname.startsWith('/api/listings/') && request.method === 'PATCH') {
      const user = await getCurrentUser(request)
      const id = Number(url.pathname.split('/').pop())
      const body = await readJsonBody(request)
      const status = String(body?.status ?? '')
      if (!['published', 'draft', 'paused'].includes(status)) {
        sendJson(response, 400, { error: 'invalid status' })
        return
      }
      const listings = await readCollection(listingsFile, [])
      const index = listings.findIndex((listing) => listing.id === id)
      if (index < 0) {
        sendJson(response, 404, { error: 'listing not found' })
        return
      }
      const listing = listings[index]
      if (user && listing.sellerId && listing.sellerId !== user.id && user.role !== 'admin') {
        sendJson(response, 403, { error: 'forbidden' })
        return
      }
      const nextListing = { ...listing, status, updatedAt: new Date().toISOString() }
      listings[index] = nextListing
      await writeCollection(listingsFile, listings)
      sendJson(response, 200, { listing: publicListingView(nextListing) })
      return
    }

    if (url.pathname === '/api/listings' && request.method === 'POST') {
      const user = await getCurrentUser(request)
      const body = await readJsonBody(request)
      const listing = sanitizeListing(body?.listing ?? body, user)
      if (!listing) {
        sendJson(response, 400, { error: 'invalid listing' })
        return
      }

      const listings = await readCollection(listingsFile, [])
      const existingIndex = listings.findIndex((item) => item.id === listing.id)
      const nextListing =
        existingIndex >= 0
          ? { ...listings[existingIndex], ...listing, createdAt: listings[existingIndex].createdAt }
          : listing
      const nextListings =
        existingIndex >= 0
          ? listings.map((item, index) => (index === existingIndex ? nextListing : item))
          : [nextListing, ...listings]
      await writeCollection(listingsFile, nextListings.slice(0, 500))
      await createNotification({
        userId: nextListing.sellerId,
        kind: 'listing',
        title: existingIndex >= 0 ? '掲載内容を更新しました' : '出品を保存しました',
        body: nextListing.title,
        href: '#list',
      })
      sendJson(response, 200, { listing: publicListingView(nextListing) })
      return
    }

    if (url.pathname === '/api/deals' && request.method === 'GET') {
      const user = await getCurrentUser(request)
      const deals = await readCollection(dealsFile, [])
      if (!user) {
        sendJson(response, 200, { deals: [] })
        return
      }
      sendJson(response, 200, {
        deals: deals.filter((deal) => deal.buyerId === user.id || deal.sellerId === user.id || user.role === 'admin'),
      })
      return
    }

    if (url.pathname === '/api/deals' && request.method === 'POST') {
      const user = await getCurrentUser(request)
      const body = await readJsonBody(request)
      const deal = sanitizeDeal(body, user)
      if (!deal) {
        sendJson(response, 400, { error: 'invalid deal' })
        return
      }
      const deals = await readCollection(dealsFile, [])
      await writeCollection(dealsFile, [deal, ...deals].slice(0, 500))
      await createNotification({
        userId: deal.sellerId,
        kind: 'deal',
        title: '購入申請が入りました',
        body: `${deal.vehicleTitle} / ${deal.buyerName}`,
        href: '#deal',
      })
      await createNotification({
        userId: deal.buyerId,
        kind: 'deal',
        title: '購入申請を保存しました',
        body: deal.vehicleTitle,
        href: '#deal',
      })
      sendJson(response, 200, { deal })
      return
    }

    if (url.pathname.startsWith('/api/deals/') && request.method === 'PATCH') {
      const user = await getCurrentUser(request)
      const id = url.pathname.split('/').pop()
      const body = await readJsonBody(request)
      const statuses = ['inquiry', 'applied', 'payment_pending', 'paid', 'handover', 'transfer', 'completed', 'cancelled']
      const hasStatus = body?.status !== undefined
      const hasDocumentChecks = Array.isArray(body?.documentChecks)
      const status = String(body?.status ?? '')
      if (hasStatus && !statuses.includes(status)) {
        sendJson(response, 400, { error: 'invalid status' })
        return
      }
      if (!hasStatus && !hasDocumentChecks) {
        sendJson(response, 400, { error: 'missing update fields' })
        return
      }
      const deals = await readCollection(dealsFile, [])
      const index = deals.findIndex((deal) => deal.id === id)
      if (index < 0) {
        sendJson(response, 404, { error: 'deal not found' })
        return
      }
      const deal = deals[index]
      if (user && ![deal.buyerId, deal.sellerId].includes(user.id) && user.role !== 'admin') {
        sendJson(response, 403, { error: 'forbidden' })
        return
      }
      const documentChecks = hasDocumentChecks
        ? body.documentChecks.map((check) => sanitizeString(check, 40)).filter(Boolean).slice(0, 20)
        : deal.documentChecks ?? []
      const nextDeal = {
        ...deal,
        status: hasStatus ? status : deal.status,
        documentChecks,
        updatedAt: new Date().toISOString(),
      }
      deals[index] = nextDeal
      await writeCollection(dealsFile, deals)
      if (hasStatus) {
        await createNotification({
          userId: deal.buyerId,
          kind: 'deal',
          title: '取引ステータスが更新されました',
          body: `${deal.vehicleTitle} / ${status}`,
          href: '#deal',
        })
        await createNotification({
          userId: deal.sellerId,
          kind: 'deal',
          title: '取引ステータスが更新されました',
          body: `${deal.vehicleTitle} / ${status}`,
          href: '#deal',
        })
      }
      sendJson(response, 200, { deal: nextDeal })
      return
    }

    if (url.pathname === '/api/notifications' && request.method === 'GET') {
      const user = await getCurrentUser(request)
      const notifications = await readCollection(notificationsFile, [])
      sendJson(response, 200, {
        notifications: user ? notifications.filter((notification) => notification.userId === user.id).slice(0, 100) : [],
      })
      return
    }

    if (url.pathname.startsWith('/api/notifications/') && request.method === 'PATCH') {
      const user = await getCurrentUser(request)
      const id = url.pathname.split('/').pop()
      const notifications = await readCollection(notificationsFile, [])
      const index = notifications.findIndex((notification) => notification.id === id)
      if (!user) {
        sendJson(response, 401, { error: 'login required' })
        return
      }
      if (index < 0) {
        sendJson(response, 404, { error: 'notification not found' })
        return
      }
      if (notifications[index].userId !== user.id && user.role !== 'admin') {
        sendJson(response, 403, { error: 'forbidden' })
        return
      }
      notifications[index] = { ...notifications[index], read: true }
      await writeCollection(notificationsFile, notifications)
      sendJson(response, 200, { notification: notifications[index] })
      return
    }

    if (url.pathname === '/api/messages' && request.method === 'GET') {
      const vehicleId = Number(url.searchParams.get('vehicleId') ?? 0)
      const dealId = url.searchParams.get('dealId') ?? ''
      const messages = await readCollection(messagesFile, [])
      sendJson(response, 200, {
        messages: messages
          .filter((message) => (dealId ? message.dealId === dealId : true))
          .filter((message) => (vehicleId ? message.vehicleId === vehicleId : true))
          .slice(-200),
      })
      return
    }

    if (url.pathname === '/api/messages' && request.method === 'POST') {
      const user = await getCurrentUser(request)
      const body = await readJsonBody(request)
      const message = sanitizeMessage(body, user)
      if (!message) {
        sendJson(response, 400, { error: 'invalid message' })
        return
      }
      const messages = await readCollection(messagesFile, [])
      await writeCollection(messagesFile, [...messages, message].slice(-1000))
      const listings = await readCollection(listingsFile, [])
      const listing = listings.find((item) => item.id === message.vehicleId)
      const recipientId = listing?.sellerId && listing.sellerId !== message.senderId ? listing.sellerId : ''
      await createNotification({
        userId: recipientId,
        kind: 'message',
        title: '新しい購入相談があります',
        body: `${message.senderName}: ${message.body}`,
        href: '#message',
      })
      sendJson(response, 200, { message })
      return
    }

    if (url.pathname === '/api/analyze-photo' && request.method === 'POST') {
      const body = await readJsonBody(request)
      try {
        sendJson(response, 200, await analyzeWithOpenAI(body ?? {}))
      } catch (error) {
        const fallback = fallbackAnalysis(body?.mode)
        sendJson(response, 200, {
          ...fallback,
          note: `OCR API接続で問題が出たためローカル推定に切り替えました: ${
            error instanceof Error ? error.message.slice(0, 100) : 'unknown error'
          }`,
        })
      }
      return
    }

    if (url.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'Not found' })
      return
    }

    await serveStatic(request, response)
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : 'Server error' })
  }
}

const server = isHttps
  ? createHttpsServer(
      {
        key: await readFile(resolve(process.env.HTTPS_KEY_PATH), 'utf-8'),
        cert: await readFile(resolve(process.env.HTTPS_CERT_PATH), 'utf-8'),
      },
      requestHandler,
    )
  : createHttpServer(requestHandler)

server.listen(port, '0.0.0.0', () => {
  console.log(`CarLink server running on ${isHttps ? 'https' : 'http'}://0.0.0.0:${port}`)
})
