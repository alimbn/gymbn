import { normalizeForMatch } from '../util.js';

// assignProgram.js'ten (hoca tarafı) çıkarıldı — artık bulkAdd.js da (coach-yönetimli
// öğrenci hesapları için) aynı eşleştirmeyi kullanıyor, tek yerden bakım.

// Kataloga TAM eşleşmeyen bir isim için "bunu mu demek istedin" önerisi —
// düzenleme mesafesi küçükse (yazım hatası ihtimali yüksekse) tek bir öneri
// gösteriyoruz, dropdown'ı baştan sona taramak zorunda kalmasın. Damerau-
// Levenshtein kullanıyoruz (düz Levenshtein değil) ki bitişik iki harfin yer
// değiştirmesi ("dubmlee" ~ "dumbbell") TEK hata sayılsın, iki değil.
function damerauLevenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

// Kelimeleri sırayla değil KÜME olarak karşılaştırmak için: "bacak ön" ile
// "ön bacak" kelime bazında aynı, ama karakter karakter kıyaslanırsa neredeyse
// alakasız iki dizi gibi görünüp mesafeyi eşiğin çok üstüne çıkarıyordu. İki
// ismin de kelimelerini sıralayıp ayrıca kıyaslıyoruz, ikisinin en küçüğünü
// alıyoruz — sıra farkını cezalandırmaz, gerçek yazım hatalarını hâlâ yakalar.
function sortedWords(str) {
  return str.split(' ').sort().join(' ');
}

export function closestCatalogMatch(parsedName, catalog) {
  const q = normalizeForMatch(parsedName);
  if (!q) return null;
  const qSorted = sortedWords(q);
  let best = null;
  let bestDist = Infinity;
  for (const c of catalog) {
    const name = normalizeForMatch(c.name);
    const dist = Math.min(damerauLevenshtein(q, name), damerauLevenshtein(qSorted, sortedWords(name)));
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  if (!best) return null;
  const threshold = Math.max(2, Math.ceil(q.length * 0.3));
  return bestDist <= threshold ? best : null;
}
