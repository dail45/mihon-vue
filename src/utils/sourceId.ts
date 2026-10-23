/**
 * Suwayomi source identity helpers.
 *
 * Mihon `HttpSource.generateId` (mihon/source-api/.../online/HttpSource.kt):
 *
 *   val key = "${name.lowercase()}/$lang/$versionId"
 *   val bytes = MessageDigest.getInstance("MD5").digest(key.toByteArray())
 *   return (0..7).map { bytes[it].toLong() and 0xff shl 8 * (7 - it) }.reduce(Long::or) and Long.MAX_VALUE
 *
 * Suwayomi-Server derives the source id the same way, with the extension's
 * `versionId` pinned to 1, so the id is reversible: for a known (name, lang)
 * pair the MD5 key produces exactly the numeric source id.
 *
 * This lets the web client reconstruct the identity of a source that is not
 * installed any more, which is what Mihon keeps in its local `source` table and
 * renders through `StubSource.toString()`:
 *
 *   override fun toString(): String =
 *     if (!isInvalid) "$name (${lang.uppercase()})" else id.toString()
 */

/* ----------------------------- MD5 ----------------------------- */

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const K = new Uint32Array(64)
for (let i = 0; i < 64; i++) {
  K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0
}

function rotl(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0
}

/** MD5 digest of an UTF-8 string, as 16 lowercase hex characters. */
export function md5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const bitLength = bytes.length * 8
  const paddedLength = ((bytes.length + 8 + 63) >> 6) << 6
  const buffer = new Uint8Array(paddedLength)
  buffer.set(bytes)
  buffer[bytes.length] = 0x80
  const view = new DataView(buffer.buffer)
  view.setUint32(paddedLength - 8, bitLength >>> 0, true)
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 4294967296), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const chunk = new Uint32Array(16)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) chunk[i] = view.getUint32(offset + i * 4, true)
    let a = a0, b = b0, c = c0, d = d0
    for (let i = 0; i < 64; i++) {
      let f: number, g: number
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }
      f = (f + a + K[i] + chunk[g]) >>> 0
      a = d
      d = c
      c = b
      b = (b + rotl(f, S[i])) >>> 0
    }
    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  const out = new DataView(new ArrayBuffer(16))
  out.setUint32(0, a0, true)
  out.setUint32(4, b0, true)
  out.setUint32(8, c0, true)
  out.setUint32(12, d0, true)
  let hex = ''
  for (let i = 0; i < 16; i++) hex += out.getUint8(i).toString(16).padStart(2, '0')
  return hex
}

/* ------------------------- Source identity ------------------------- */

/** Mihon `HttpSource.generateId` with Suwayomi's `versionId = 1`. */
export function generateSourceId(name: string, lang: string, versionId = 1): string {
  const key = `${name.toLowerCase()}/${lang}/${versionId}`
  const bytes = md5Hex(key)
  let value = 0n
  for (let i = 0; i < 8; i++) {
    value |= BigInt(parseInt(bytes.slice(i * 2, i * 2 + 2), 16)) << BigInt(8 * (7 - i))
  }
  // `and Long.MAX_VALUE` clears the sign bit of the 64-bit value.
  return (value & 0x7fffffffffffffffn).toString()
}

export interface SourceIdentity {
  /** The source name, e.g. `MangaDex`. */
  name: string
  /** The source language, e.g. `af`. */
  lang: string
}

/**
 * The source languages the Mihon extension ecosystem uses. The language of a
 * source is part of its id, so the reverse lookup needs the language set.
 * `localsourcelang` is excluded: the local source is not an extension.
 */
export const SOURCE_LANGUAGES = [
  'af', 'sq', 'ar', 'az', 'eu', 'be', 'bn', 'bg', 'my', 'ca', 'zh-Hans', 'zh-Hant',
  'cv', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'fil', 'fi', 'fr', 'ka', 'de',
  'el', 'he', 'hi', 'hu', 'ga', 'id', 'it', 'ja', 'jv', 'kk', 'ko', 'la', 'lt',
  'ms', 'mn', 'ne', 'no', 'fa', 'pl', 'pt-BR', 'pt', 'ro', 'sr', 'sk', 'es-419',
  'es', 'es-la', 'sv', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'uz', 'vi', 'all',
  'other', 'zh',
]

/**
 * Mihon `StubSource.toString()`:
 *   if (!isInvalid) "$name (${lang.uppercase()})" else id.toString()
 *
 * `isInvalid` is `name.isBlank() || lang.isBlank()`, so a stub without a name
 * falls back to the bare source id.
 */
export function sourceIdentityToString(identity: SourceIdentity | null, sourceId: string): string {
  if (!identity || !identity.name.trim() || !identity.lang.trim()) return String(sourceId)
  return `${identity.name} (${identity.lang.toUpperCase()})`
}

/**
 * Reverses `generateSourceId` for a single source id.
 *
 * The candidate space is the cross product of the known source names and the
 * known language codes, so the reverse lookup is exact rather than a guess.
 */
export function resolveSourceIdentity(
  sourceId: string,
  names: Iterable<string>,
  langs: Iterable<string>,
): SourceIdentity | null {
  const wanted = String(sourceId)
  for (const name of names) {
    if (!name.trim()) continue
    for (const lang of langs) {
      if (!lang.trim()) continue
      if (generateSourceId(name, lang) === wanted) return { name, lang }
    }
  }
  return null
}
