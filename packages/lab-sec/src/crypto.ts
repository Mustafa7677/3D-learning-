/**
 * Teaching cryptography: classical ciphers over the Kazakh alphabet, a real
 * SHA-256, XOR pads and a toy RSA. Small, dependency-free and deterministic.
 */
export const ALPHABET = "аәбвгғдеёжзийкқлмнңоөпрстуұүфхһцчшщъыіьэюя";
export const A = [...ALPHABET];
export const N = A.length; // 42

/** Shift every letter of the alphabet by k; everything else stays. Case is preserved. */
export function caesar(text: string, k: number): string {
  const shift = ((k % N) + N) % N;
  return [...text]
    .map((ch) => {
      const lower = ch.toLowerCase();
      const i = A.indexOf(lower);
      if (i < 0) return ch;
      const out = A[(i + shift) % N]!;
      return ch === lower ? out : out.toUpperCase();
    })
    .join("");
}

/** Letter counts (alphabet order) — the fingerprint frequency analysis reads. */
export function frequencies(text: string): number[] {
  const f = Array<number>(N).fill(0);
  for (const ch of text.toLowerCase()) {
    const i = A.indexOf(ch);
    if (i >= 0) f[i]!++;
  }
  return f;
}

/** Guess a Caesar key by assuming the most common letter of the ciphertext stands for "а". */
export function guessShift(cipher: string, common = "а"): number {
  const f = frequencies(cipher);
  const top = f.indexOf(Math.max(...f));
  return (top - A.indexOf(common) + N) % N;
}

// ---------------- XOR ----------------

export const utf8 = (s: string) => new TextEncoder().encode(s);
export const fromUtf8 = (b: Uint8Array) => new TextDecoder("utf-8", { fatal: false }).decode(b);
export function xorBytes(a: Uint8Array, key: Uint8Array): Uint8Array {
  return a.map((x, i) => x ^ key[i % key.length]!);
}
export const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

// ---------------- SHA-256 (FIPS 180-4) ----------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(message: string | Uint8Array): string {
  const msg = typeof message === "string" ? utf8(message) : message;
  const bitLen = msg.length * 8;
  const padded = new Uint8Array(Math.ceil((msg.length + 9) / 64) * 64);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 2 ** 32));
  view.setUint32(padded.length - 4, bitLen >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as unknown as number[];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e!, 6) ^ rotr(e!, 11) ^ rotr(e!, 25);
      const ch = (e! & f!) ^ (~e! & g!);
      const t1 = (hh! + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a!, 2) ^ rotr(a!, 13) ^ rotr(a!, 22);
      const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d! + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a!) >>> 0;
    h[1] = (h[1]! + b!) >>> 0;
    h[2] = (h[2]! + c!) >>> 0;
    h[3] = (h[3]! + d!) >>> 0;
    h[4] = (h[4]! + e!) >>> 0;
    h[5] = (h[5]! + f!) >>> 0;
    h[6] = (h[6]! + g!) >>> 0;
    h[7] = (h[7]! + hh!) >>> 0;
  }
  return [...h].map((x) => x.toString(16).padStart(8, "0")).join("");
}

/** Number of differing bits between two equal-length hex strings. */
export function bitDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Key stretching: hash `rounds` times. Each round multiplies an attacker's work. */
export function slowHash(password: string, salt: string, rounds: number): string {
  let h = sha256(salt + password);
  for (let i = 1; i < rounds; i++) h = sha256(h);
  return h;
}

// ---------------- toy RSA ----------------

export function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return Math.abs(a);
}

/** Modular inverse via the extended Euclidean algorithm; undefined if none exists. */
export function modInverse(a: number, m: number): number | undefined {
  let [oldR, r] = [a, m];
  let [oldS, s] = [1, 0];
  while (r) {
    const q = Math.floor(oldR / r);
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== 1) return undefined;
  return ((oldS % m) + m) % m;
}

/** b^e mod m with BigInt so intermediate products never lose precision. */
export function modPow(b: number, e: number, m: number): number {
  let result = 1n;
  let base = BigInt(b) % BigInt(m);
  let exp = BigInt(e);
  const mod = BigInt(m);
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return Number(result);
}

export function isPrime(n: number): boolean {
  if (n < 2 || !Number.isInteger(n)) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

export interface RsaKeys {
  p: number;
  q: number;
  n: number;
  phi: number;
  e: number;
  d: number;
}

/** Build a key pair, or explain what is wrong with the choice. */
export function rsaKeys(p: number, q: number, e: number): RsaKeys | { error: string } {
  if (!isPrime(p) || !isPrime(q)) return { error: "p мен q жай сан болуы керек" };
  if (p === q) return { error: "p мен q әр түрлі болуы керек" };
  const n = p * q;
  if (n > 1_000_000) return { error: "Оқу үшін n ≤ 1 000 000 болсын" };
  const phi = (p - 1) * (q - 1);
  if (e <= 1 || e >= phi || gcd(e, phi) !== 1) return { error: "e мен φ(n) өзара жай болуы керек (ЕҮОБ = 1)" };
  return { p, q, n, phi, e, d: modInverse(e, phi)! };
}
