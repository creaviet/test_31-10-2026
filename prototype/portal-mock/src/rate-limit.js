/**
 * Rate-Limiting (T-20/BE-10): je Quelle (IP) und je Identität.
 * Fenster-basiert, in-memory. Antwort ist bewusst generisch (429).
 */
const buckets = new Map(); // key → { start, count }

function hit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= limit;
}

export function isLimited({ ip, verifiId }) {
  const WINDOW = 60_000;
  const perIp = 40; // Login/Registrierungs-Versuche je Quelle pro Minute
  const perIdentity = 10; // je Identität (verifi_id) pro Minute

  if (!hit(`ip:${ip}`, perIp, WINDOW)) return true;
  if (verifiId && !hit(`id:${verifiId}`, perIdentity, WINDOW)) return true;
  return false;
}

// Periodisches Aufräumen, damit die Map nicht wächst.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now - b.start > 120_000) buckets.delete(k);
  }
}, 60_000).unref();