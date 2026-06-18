import type { ChatMessage, Vehicle } from '../types/app'

export const baseVehicles: Vehicle[] = [
  {
    id: 1,
    title: 'トヨタ ハリアー',
    maker: 'トヨタ',
    grade: 'Z レザーパッケージ',
    year: '2021年',
    mileage: 28000,
    price: 3180000,
    location: '神奈川県 横浜市',
    image:
      'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=1200&q=85',
    tags: ['サンルーフ', 'JBL', '黒革', 'ACC'],
    inspection: '2026年9月',
    verified: true,
    sellerName: '横浜の個人オーナー',
    description: '屋内保管中心。記録簿あり。現車確認は週末対応できます。',
  },
  {
    id: 2,
    title: 'ホンダ N-BOX',
    maker: 'ホンダ',
    grade: 'カスタム L ターボ',
    year: '2022年',
    mileage: 18400,
    price: 1540000,
    location: '埼玉県 川口市',
    image:
      'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=1200&q=85',
    tags: ['両側電動', 'ETC', 'ナビ', '禁煙'],
    inspection: '2027年2月',
    verified: true,
    sellerName: '川口市の出品者',
    description: '街乗り中心で使用。禁煙車、タイヤ溝も十分あります。',
  },
  {
    id: 3,
    title: 'マツダ CX-5',
    maker: 'マツダ',
    grade: 'XD プロアクティブ',
    year: '2020年',
    mileage: 42600,
    price: 2090000,
    location: '東京都 世田谷区',
    image:
      'https://images.unsplash.com/photo-1626668893632-6f3a4466d22f?auto=format&fit=crop&w=1200&q=85',
    tags: ['ディーゼル', '360度カメラ', 'BOSE', 'ACC'],
    inspection: '2026年12月',
    verified: false,
    sellerName: '世田谷区の出品者',
    description: '長距離移動が多め。燃費重視の方に合う一台です。',
  },
  {
    id: 4,
    title: 'スバル レヴォーグ',
    maker: 'スバル',
    grade: 'GT-H EX',
    year: '2021年',
    mileage: 31500,
    price: 2460000,
    location: '千葉県 船橋市',
    image:
      'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1200&q=85',
    tags: ['アイサイト', '4WD', 'ナビ', 'ドラレコ'],
    inspection: '2026年7月',
    verified: true,
    sellerName: '船橋市の個人オーナー',
    description: 'アイサイト付き。高速道路での移動が楽なワゴンです。',
  },
]

export const aiOptions = [
  { label: 'サンルーフ', score: 94 },
  { label: 'ETC', score: 91 },
  { label: 'アダプティブクルーズ', score: 88 },
  { label: 'シートヒーター', score: 82 },
  { label: '電動リアゲート', score: 76 },
  { label: '360度カメラ', score: 71 },
  { label: '衝突被害軽減ブレーキ', score: 86 },
  { label: 'レーンキープ', score: 79 },
  { label: 'ブラインドスポットモニター', score: 73 },
  { label: 'Apple CarPlay', score: 68 },
  { label: 'ドラレコ', score: 66 },
  { label: '禁煙車', score: 62 },
]

export const initialChat: ChatMessage[] = [
  {
    from: 'buyer',
    body: '週末に現車確認できますか？車検証の読み取り結果も確認しました。',
    time: '10:24',
  },
  {
    from: 'seller',
    body: '土曜の午前なら大丈夫です。屋内保管で、記録簿もあります。',
    time: '10:31',
  },
  {
    from: 'buyer',
    body: '確認後、問題なければアプリ決済で購入申請します。',
    time: '10:35',
  },
]

export const photoSlots = [
  {
    label: '外装前方',
    image:
      'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=900&q=82',
  },
  {
    label: '運転席',
    image:
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=82',
  },
  {
    label: 'メーター',
    image:
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=900&q=82',
  },
  {
    label: '車検証',
    image:
      'https://images.unsplash.com/photo-1586281380117-5a60ae2050cc?auto=format&fit=crop&w=900&q=82',
  },
]

export const scannedFields = [
  ['車名', 'トヨタ ハリアー'],
  ['型式', 'MXUA80'],
  ['グレード', 'Z レザーパッケージ'],
  ['車台番号', 'MXUA80-0000000'],
  ['初度登録', '令和3年9月'],
  ['車検満了', '令和8年9月12日'],
  ['走行距離', '28,000km'],
  ['排気量', '1,980cc'],
  ['燃料', 'ガソリン'],
  ['駆動方式', '2WD'],
  ['ミッション', 'CVT'],
  ['用途', '乗用'],
  ['自家用/事業用', '自家用'],
  ['乗車定員', '5人'],
  ['車両重量', '1,620kg'],
]
