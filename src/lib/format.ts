export function yen(value: number) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value)
}

export function mileageLabel(value: number) {
  return `${value.toLocaleString('ja-JP')}km`
}

export function currentTimeLabel() {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}
