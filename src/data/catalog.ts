import { bulkCatalogMakers, bulkCatalogSource } from './catalogBulk'

export type CatalogModel = {
  name: string
  bodyTypes: string[]
  generationHints: string[]
  optionHints: string[]
}

export type CatalogMaker = {
  name: string
  country: string
  sourcePath?: string
  models: CatalogModel[]
}

export const catalogSource = {
  name: 'Goo-net 自動車カタログ + 公開車種マスター',
  url: 'https://www.goo-net.com/catalog/',
  note:
    `公開カタログの構造を参考にし、1000車種以上の候補は ${bulkCatalogSource.name} 由来の公開モデル名で補完しています。商用で全量利用する場合は正規ライセンス済みデータに差し替えてください。`,
}

const detailedCatalogMakers: CatalogMaker[] = [
  {
    name: 'トヨタ',
    country: '日本',
    sourcePath: '/catalog/TOYOTA/',
    models: [
      {
        name: 'ハリアー',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['60系', '80系'],
        optionHints: ['JBL', 'パノラマルーフ', 'デジタルインナーミラー', '電動リアゲート'],
      },
      {
        name: 'アルファード',
        bodyTypes: ['ミニバン'],
        generationHints: ['30系', '40系'],
        optionHints: ['ツインムーンルーフ', '後席モニター', 'デジタルインナーミラー'],
      },
      {
        name: 'ヴェルファイア',
        bodyTypes: ['ミニバン'],
        generationHints: ['30系', '40系'],
        optionHints: ['両側電動スライド', '後席モニター', 'JBL'],
      },
      {
        name: 'プリウス',
        bodyTypes: ['ハイブリッド', 'セダン'],
        generationHints: ['50系', '60系'],
        optionHints: ['Toyota Safety Sense', 'AC100V', 'パノラマビュー'],
      },
      {
        name: 'アクア',
        bodyTypes: ['コンパクト', 'ハイブリッド'],
        generationHints: ['NHP10', 'MXPK系'],
        optionHints: ['Toyota Safety Sense', 'スマートキー', 'ナビ'],
      },
      {
        name: 'ランドクルーザー',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['200系', '300系'],
        optionHints: ['サンルーフ', '本革シート', 'クールボックス'],
      },
      {
        name: 'クラウン',
        bodyTypes: ['セダン', 'クロスオーバー'],
        generationHints: ['220系', 'SH35系'],
        optionHints: ['本革シート', 'パノラミックビュー', 'デジタルキー'],
      },
      {
        name: 'ヴォクシー',
        bodyTypes: ['ミニバン'],
        generationHints: ['80系', '90系'],
        optionHints: ['両側電動スライド', '快適利便パッケージ', '後席モニター'],
      },
    ],
  },
  {
    name: 'レクサス',
    country: '日本',
    sourcePath: '/catalog/LEXUS/',
    models: [
      {
        name: 'RX',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['20系', 'ALA10系'],
        optionHints: ['パノラマルーフ', 'Mark Levinson', '三眼LED'],
      },
      {
        name: 'NX',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['10系', 'AAZA20系'],
        optionHints: ['パノラマルーフ', '三眼LED', 'デジタルインナーミラー'],
      },
      {
        name: 'IS',
        bodyTypes: ['セダン'],
        generationHints: ['30系'],
        optionHints: ['F SPORT', 'マークレビンソン', '本革シート'],
      },
      {
        name: 'LS',
        bodyTypes: ['セダン'],
        generationHints: ['50系'],
        optionHints: ['後席リラクゼーション', 'サンルーフ', 'Mark Levinson'],
      },
    ],
  },
  {
    name: '日産',
    country: '日本',
    sourcePath: '/catalog/NISSAN/',
    models: [
      {
        name: 'セレナ',
        bodyTypes: ['ミニバン'],
        generationHints: ['C27', 'C28'],
        optionHints: ['プロパイロット', '両側電動スライド', '後席モニター'],
      },
      {
        name: 'エクストレイル',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['T32', 'T33'],
        optionHints: ['プロパイロット', 'アラウンドビューモニター', '防水シート'],
      },
      {
        name: 'ノート',
        bodyTypes: ['コンパクト'],
        generationHints: ['E12', 'E13'],
        optionHints: ['e-POWER', 'プロパイロット', 'アラウンドビューモニター'],
      },
      {
        name: 'リーフ',
        bodyTypes: ['EV'],
        generationHints: ['ZE1'],
        optionHints: ['プロパイロット', 'プロパイロットパーキング', 'BOSE'],
      },
      {
        name: 'フェアレディZ',
        bodyTypes: ['クーペ'],
        generationHints: ['Z34', 'RZ34'],
        optionHints: ['BOSE', '6MT', 'バージョンST'],
      },
    ],
  },
  {
    name: 'ホンダ',
    country: '日本',
    sourcePath: '/catalog/HONDA/',
    models: [
      {
        name: 'N-BOX',
        bodyTypes: ['軽自動車'],
        generationHints: ['JF3/JF4', 'JF5/JF6'],
        optionHints: ['両側電動スライド', 'Honda SENSING', 'ナビ'],
      },
      {
        name: 'フィット',
        bodyTypes: ['コンパクト'],
        generationHints: ['GK系', 'GR系'],
        optionHints: ['Honda SENSING', 'e:HEV', 'ナビ'],
      },
      {
        name: 'ヴェゼル',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['RU系', 'RV系'],
        optionHints: ['Honda SENSING', 'パワーテールゲート', 'マルチビューカメラ'],
      },
      {
        name: 'ステップワゴン',
        bodyTypes: ['ミニバン'],
        generationHints: ['RP系'],
        optionHints: ['両側電動スライド', '後席モニター', 'Honda SENSING'],
      },
      {
        name: 'シビック',
        bodyTypes: ['ハッチバック', 'セダン'],
        generationHints: ['FK系', 'FL系'],
        optionHints: ['Honda SENSING', 'BOSE', '6MT'],
      },
    ],
  },
  {
    name: 'マツダ',
    country: '日本',
    sourcePath: '/catalog/MAZDA/',
    models: [
      {
        name: 'CX-5',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['KF系'],
        optionHints: ['BOSE', '360度ビューモニター', 'パワーリフトゲート'],
      },
      {
        name: 'CX-8',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['KG系'],
        optionHints: ['BOSE', '本革シート', '360度ビューモニター'],
      },
      {
        name: 'MAZDA3',
        bodyTypes: ['ハッチバック', 'セダン'],
        generationHints: ['BP系'],
        optionHints: ['BOSE', '360度ビューモニター', 'レーダークルーズ'],
      },
      {
        name: 'ロードスター',
        bodyTypes: ['オープンカー'],
        generationHints: ['ND系'],
        optionHints: ['BOSE', '6MT', 'Brembo'],
      },
    ],
  },
  {
    name: 'スバル',
    country: '日本',
    sourcePath: '/catalog/SUBARU/',
    models: [
      {
        name: 'レヴォーグ',
        bodyTypes: ['ステーションワゴン'],
        generationHints: ['VM系', 'VN系'],
        optionHints: ['アイサイトX', 'STIエアロ', '11.6インチナビ'],
      },
      {
        name: 'フォレスター',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['SJ系', 'SK系'],
        optionHints: ['アイサイト', 'X-MODE', 'パワーリアゲート'],
      },
      {
        name: 'インプレッサ',
        bodyTypes: ['ハッチバック', 'セダン'],
        generationHints: ['GP/GJ系', 'GT/GK系', 'GU系'],
        optionHints: ['アイサイト', 'AWD', 'ナビ'],
      },
      {
        name: 'BRZ',
        bodyTypes: ['クーペ'],
        generationHints: ['ZC6', 'ZD8'],
        optionHints: ['6MT', 'STIエアロ', 'Brembo'],
      },
    ],
  },
  {
    name: 'スズキ',
    country: '日本',
    sourcePath: '/catalog/SUZUKI/',
    models: [
      {
        name: 'ジムニー',
        bodyTypes: ['軽自動車', 'SUV・クロカン'],
        generationHints: ['JB23', 'JB64'],
        optionHints: ['4WD', 'セーフティサポート', 'リフトアップ'],
      },
      {
        name: 'スペーシア',
        bodyTypes: ['軽自動車'],
        generationHints: ['MK53S', 'MK54S'],
        optionHints: ['両側電動スライド', 'セーフティサポート', '全方位モニター'],
      },
      {
        name: 'スイフト',
        bodyTypes: ['コンパクト'],
        generationHints: ['ZC/ZD系'],
        optionHints: ['セーフティサポート', '全方位モニター', '6MT'],
      },
    ],
  },
  {
    name: 'ダイハツ',
    country: '日本',
    sourcePath: '/catalog/DAIHATSU/',
    models: [
      {
        name: 'タント',
        bodyTypes: ['軽自動車'],
        generationHints: ['LA600S', 'LA650S'],
        optionHints: ['スマートアシスト', 'ミラクルオープンドア', '両側電動スライド'],
      },
      {
        name: 'ムーヴ',
        bodyTypes: ['軽自動車'],
        generationHints: ['LA150S'],
        optionHints: ['スマートアシスト', 'ナビ', 'LEDヘッドライト'],
      },
      {
        name: 'ロッキー',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['A200S/A210S'],
        optionHints: ['スマートアシスト', '全方位カメラ', 'ACC'],
      },
    ],
  },
  {
    name: '三菱',
    country: '日本',
    sourcePath: '/catalog/MITSUBISHI/',
    models: [
      {
        name: 'デリカD:5',
        bodyTypes: ['ミニバン', 'SUV・クロカン'],
        generationHints: ['CV系'],
        optionHints: ['4WD', '電動サイドステップ', '後席モニター'],
      },
      {
        name: 'アウトランダーPHEV',
        bodyTypes: ['SUV・クロカン', 'PHEV'],
        generationHints: ['GG系', 'GN系'],
        optionHints: ['マイパイロット', 'BOSE', 'AC100V'],
      },
      {
        name: 'eKクロス',
        bodyTypes: ['軽自動車'],
        generationHints: ['B34W/B35W'],
        optionHints: ['MI-PILOT', 'デジタルルームミラー', '全方位カメラ'],
      },
    ],
  },
  {
    name: 'メルセデス・ベンツ',
    country: 'ドイツ',
    sourcePath: '/catalog/MERCEDES_BENZ/',
    models: [
      {
        name: 'Cクラス',
        bodyTypes: ['セダン', 'ステーションワゴン'],
        generationHints: ['W205', 'W206'],
        optionHints: ['AMGライン', 'パノラミックスライディングルーフ', 'Burmester'],
      },
      {
        name: 'Eクラス',
        bodyTypes: ['セダン', 'ステーションワゴン'],
        generationHints: ['W213', 'W214'],
        optionHints: ['AMGライン', 'エクスクルーシブパッケージ', 'Burmester'],
      },
      {
        name: 'Gクラス',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['W463'],
        optionHints: ['AMGライン', 'ラグジュアリーパッケージ', 'サンルーフ'],
      },
      {
        name: 'GLC',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['X253', 'X254'],
        optionHints: ['AMGライン', 'レザーエクスクルーシブ', 'パノラミックスライディングルーフ'],
      },
    ],
  },
  {
    name: 'BMW',
    country: 'ドイツ',
    sourcePath: '/catalog/BMW/',
    models: [
      {
        name: '3シリーズ',
        bodyTypes: ['セダン', 'ステーションワゴン'],
        generationHints: ['F30', 'G20'],
        optionHints: ['Mスポーツ', 'サンルーフ', 'ハーマンカードン'],
      },
      {
        name: '5シリーズ',
        bodyTypes: ['セダン', 'ステーションワゴン'],
        generationHints: ['G30', 'G60'],
        optionHints: ['Mスポーツ', 'コンフォートパッケージ', 'ハーマンカードン'],
      },
      {
        name: 'X3',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['G01'],
        optionHints: ['Mスポーツ', 'パノラマサンルーフ', 'ヘッドアップディスプレイ'],
      },
      {
        name: 'MINI',
        bodyTypes: ['コンパクト'],
        generationHints: ['F系', 'J系'],
        optionHints: ['JCW', 'ナビ', 'ハーマンカードン'],
      },
    ],
  },
  {
    name: 'アウディ',
    country: 'ドイツ',
    sourcePath: '/catalog/AUDI/',
    models: [
      {
        name: 'A4',
        bodyTypes: ['セダン', 'ステーションワゴン'],
        generationHints: ['B9'],
        optionHints: ['S line', 'Bang & Olufsen', 'マトリクスLED'],
      },
      {
        name: 'A6',
        bodyTypes: ['セダン', 'ステーションワゴン'],
        generationHints: ['C8'],
        optionHints: ['S line', 'HDマトリクスLED', 'バーチャルコックピット'],
      },
      {
        name: 'Q5',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['FY系'],
        optionHints: ['S line', 'Bang & Olufsen', 'パノラマサンルーフ'],
      },
    ],
  },
  {
    name: 'フォルクスワーゲン',
    country: 'ドイツ',
    sourcePath: '/catalog/VOLKSWAGEN/',
    models: [
      {
        name: 'ゴルフ',
        bodyTypes: ['ハッチバック'],
        generationHints: ['7代目', '8代目'],
        optionHints: ['Discover Pro', 'IQ.LIGHT', 'テクノロジーパッケージ'],
      },
      {
        name: 'ポロ',
        bodyTypes: ['コンパクト'],
        generationHints: ['AW系'],
        optionHints: ['セーフティパッケージ', 'Discover Pro', 'LEDヘッドライト'],
      },
      {
        name: 'T-Roc',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['A11系'],
        optionHints: ['Discover Pro', 'デジタルメータークラスター', 'ACC'],
      },
    ],
  },
  {
    name: 'ポルシェ',
    country: 'ドイツ',
    sourcePath: '/catalog/PORSCHE/',
    models: [
      {
        name: '911',
        bodyTypes: ['クーペ', 'オープンカー'],
        generationHints: ['991', '992'],
        optionHints: ['スポーツクロノ', 'PASM', 'スポーツエグゾースト'],
      },
      {
        name: 'カイエン',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['92A', '9YA'],
        optionHints: ['スポーツクロノ', 'パノラマルーフ', 'BOSE'],
      },
      {
        name: 'マカン',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['95B'],
        optionHints: ['スポーツクロノ', 'BOSE', 'PDLS'],
      },
    ],
  },
  {
    name: 'ボルボ',
    country: 'スウェーデン',
    sourcePath: '/catalog/VOLVO/',
    models: [
      {
        name: 'XC60',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['DB/DD系'],
        optionHints: ['Bowers & Wilkins', 'パノラマガラスサンルーフ', 'Pilot Assist'],
      },
      {
        name: 'XC90',
        bodyTypes: ['SUV・クロカン'],
        generationHints: ['LB/LD系'],
        optionHints: ['Bowers & Wilkins', 'エアサスペンション', 'Pilot Assist'],
      },
      {
        name: 'V60',
        bodyTypes: ['ステーションワゴン'],
        generationHints: ['ZB系'],
        optionHints: ['Pilot Assist', 'harman/kardon', 'パノラマガラスサンルーフ'],
      },
    ],
  },
  {
    name: 'テスラ',
    country: 'アメリカ',
    sourcePath: '/catalog/TESLA/',
    models: [
      {
        name: 'モデル3',
        bodyTypes: ['EV', 'セダン'],
        generationHints: ['初期型', 'Highland'],
        optionHints: ['オートパイロット', 'ロングレンジ', 'ガラスルーフ'],
      },
      {
        name: 'モデルY',
        bodyTypes: ['EV', 'SUV・クロカン'],
        generationHints: ['初期型'],
        optionHints: ['オートパイロット', 'ロングレンジ', 'ガラスルーフ'],
      },
    ],
  },
]

const junkModelPattern =
  /\b(TRAILER|TRAILERS|INC|LLC|LTD|CORP|CORPORATION|COMPANY|CO\.|MFG|MANUFACTURING|WELDING|FABRICATION|REPAIR|EQUIPMENT|AUTO & TRAILER|CUSTOM TRAILERS|CARGO|BOAT)\b/i

const normalizeModelName = (name: string) => name.replace(/\s+/g, ' ').trim()

const isSearchableCatalogModel = (model: CatalogModel) => {
  const name = normalizeModelName(model.name)
  return name.length >= 2 && name.length <= 48 && !junkModelPattern.test(name)
}

const cleanModels = (models: CatalogModel[]) => {
  const modelMap = new Map<string, CatalogModel>()
  for (const model of models) {
    const name = normalizeModelName(model.name)
    if (!isSearchableCatalogModel({ ...model, name })) continue
    modelMap.set(name, { ...model, name })
  }
  return [...modelMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

const mergeCatalogMakers = (detailed: CatalogMaker[], bulk: CatalogMaker[]): CatalogMaker[] => {
  const makerMap = new Map<string, CatalogMaker>()

  for (const maker of bulk) {
    if (makerMap.has(maker.name)) continue
    makerMap.set(maker.name, {
      ...maker,
      models: cleanModels(maker.models),
    })
  }

  for (const maker of detailed) {
    const existing = makerMap.get(maker.name)
    if (!existing) {
      makerMap.set(maker.name, {
        ...maker,
        models: [...maker.models],
      })
      continue
    }

    const modelMap = new Map(existing.models.map((model) => [model.name, model]))
    for (const model of maker.models) {
      modelMap.set(model.name, model)
    }
    makerMap.set(maker.name, {
      ...existing,
      country: maker.country,
      sourcePath: maker.sourcePath ?? existing.sourcePath,
      models: cleanModels([...modelMap.values()]),
    })
  }

  return [...makerMap.values()]
    .filter((maker) => maker.models.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

export const catalogMakers: CatalogMaker[] = mergeCatalogMakers(detailedCatalogMakers, bulkCatalogMakers)

export const catalogStats = {
  makers: catalogMakers.length,
  models: catalogMakers.reduce((sum, maker) => sum + maker.models.length, 0),
}

export const getCatalogModels = (makerName: string) =>
  makerName === 'すべて'
    ? catalogMakers.flatMap((maker) => maker.models.map((model) => model.name))
    : (catalogMakers.find((maker) => maker.name === makerName)?.models.map((model) => model.name) ?? [])

export const findCatalogModel = (makerName: string, modelName: string) =>
  catalogMakers
    .filter((maker) => makerName === 'すべて' || maker.name === makerName)
    .flatMap((maker) => maker.models.map((model) => ({ maker, model })))
    .find(({ model }) => model.name === modelName)
