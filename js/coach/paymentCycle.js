import { isoToDate } from '../util.js';

// storage.js'in getPaymentCycleStatus()'ıyla AYNI mantığın izole kopyası (bkz.
// assignProgram.js'in başındaki not — bu izole modül ağacı storage.js'i bilerek
// import etmiyor). studentPayments.js VE studentRoster.js (roster rozeti) ikisi
// de kullandığı için burada tek yerde tutuluyor — sadece 2 satırlık bir yardımcı
// olsaydı (extractLeadingInt gibi) her dosyada ayrı ayrı tutulurdu, ama bu döngü
// matematiği tekrar edilmeye değecek kadar kendine has.
export function sortedPayments(payments) {
  return [...payments].sort((a, b) => b.date.localeCompare(a.date));
}

export function cycleStatus(payments) {
  const last = sortedPayments(payments)[0];
  if (!last) return { hasPayment: false };
  // storage.js'in getPaymentCycleStatus()'ıyla AYNI 0'a sabitleme — iki kopya
  // olduğu için bu mantığa dokunulursa İKİSİ de güncellenmeli (bkz. yorumu orada).
  const daysSince = Math.max(0, Math.floor((Date.now() - isoToDate(last.date).getTime()) / 86400000));
  const weekInCycle = Math.min(4, Math.floor(daysSince / 7) + 1);
  return { hasPayment: true, lastDate: last.date, daysSince, weekInCycle, overdue: daysSince >= 28 };
}
