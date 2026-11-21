// Amount in words using the Indian numbering system. Kept as a pure helper
// so invoices, quotations and tests share one spelling.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n) {
  if (n < 20) return ONES[n]
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')
}

function threeDigits(n) {
  const h = Math.floor(n / 100)
  const r = n % 100
  return (h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? twoDigits(r) : '')
}

export function amountInWords(value) {
  const n = Math.round(Number(value) || 0)
  if (n === 0) return 'Zero Rupees Only'
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thou = Math.floor((n % 100000) / 1000)
  const rest = n % 1000
  let words = ''
  if (crore) words += threeDigits(crore) + ' Crore '
  if (lakh) words += twoDigits(lakh) + ' Lakh '
  if (thou) words += twoDigits(thou) + ' Thousand '
  if (rest) words += threeDigits(rest) + ' '
  return words.trim() + ' Rupees Only'
}
