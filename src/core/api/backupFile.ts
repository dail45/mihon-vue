/**
 * Mihon backup file reader (headless, browser side).
 *
 * Reference: mihon/app/src/main/java/eu/kanade/tachiyomi/data/backup/
 *   - BackupDecoder.kt   (gzip magic 0x1f8b, JSON backup signatures, error messages)
 *   - BackupStream.kt     (BackupReader: varint tags, entry tag = field 1 length delimited)
 *   - models/Backup.kt    (Backup.backupSources = field 101, backupManga = field 1)
 *   - models/BackupSource.kt    (name = field 1, sourceId = field 2)
 *   - models/BackupManga.kt     (tracking = field 18)
 *   - models/BackupTracking.kt  (syncId = field 1)
 *
 * The file itself is never uploaded anywhere: it is read in the browser to reproduce
 * `BackupFileValidator.validate()`, which reports the sources that are missing locally and
 * the trackers that are not logged into.
 */

/** One entry of `Backup.backupSources`. */
export interface BackupSourceEntry {
  sourceId: number
  name: string
}

/** What `BackupFileValidator.validate()` needs from the file. */
export interface BackupFileContents {
  sources: BackupSourceEntry[]
  /** `BackupTracking.syncId` of every tracked entry, in file order, without duplicates. */
  trackerIds: number[]
}

/** Mirrors MR.strings.invalid_backup_file_json. */
export class JsonBackupError extends Error {
  constructor() {
    super('JSON backup not supported')
    this.name = 'JsonBackupError'
  }
}

/** Mirrors MR.strings.invalid_backup_file_unknown. */
export class CorruptedBackupError extends Error {
  constructor(cause?: unknown) {
    super('Backup file is corrupted')
    this.name = 'CorruptedBackupError'
    if (cause) this.cause = cause
  }
}

const GZIP_MAGIC = 0x1f8b
const JSON_SIGNATURES = [0x7b7d, 0x7b22, 0x7b0a]

const WIRE_VARINT = 0
const WIRE_FIXED64 = 1
const WIRE_LENGTH_DELIMITED = 2
const WIRE_FIXED32 = 5

/** `Backup.backupManga` is field 1, and each entry is length delimited. */
const ENTRY_FIELD = 1
/** `Backup.backupSources`. */
const SOURCES_FIELD = 101
/** `BackupManga.tracking`. */
const TRACKING_FIELD = 18
/** `BackupTracking.syncId`. */
const TRACKING_SYNC_ID_FIELD = 1

class Reader {
  private offset = 0

  constructor(private readonly bytes: Uint8Array) {}

  get exhausted() {
    return this.offset >= this.bytes.length
  }

  varint(): number {
    let result = 0
    let shift = 0
    for (;;) {
      if (this.offset >= this.bytes.length) throw new CorruptedBackupError()
      const byte = this.bytes[this.offset++]!
      result += (byte & 0x7f) * 2 ** shift
      if ((byte & 0x80) === 0) return result
      shift += 7
      if (shift > 63) throw new CorruptedBackupError()
    }
  }

  slice(length: number): Uint8Array {
    if (this.offset + length > this.bytes.length) throw new CorruptedBackupError()
    const out = this.bytes.subarray(this.offset, this.offset + length)
    this.offset += length
    return out
  }

  skip(wireType: number): void {
    switch (wireType) {
      case WIRE_VARINT:
        this.varint()
        break
      case WIRE_FIXED64:
        this.slice(8)
        break
      case WIRE_LENGTH_DELIMITED:
        this.slice(this.varint())
        break
      case WIRE_FIXED32:
        this.slice(4)
        break
      default:
        throw new CorruptedBackupError()
    }
  }
}

/** The `syncId` values of the tracking list of one `BackupManga` entry. */
function readTrackingSyncIds(entry: Uint8Array): number[] {
  const reader = new Reader(entry)
  const ids: number[] = []
  while (!reader.exhausted) {
    const tag = reader.varint()
    const field = tag >>> 3
    const wireType = tag & 0x7
    if (field === TRACKING_FIELD && wireType === WIRE_LENGTH_DELIMITED) {
      const tracking = new Reader(reader.slice(reader.varint()))
      while (!tracking.exhausted) {
        const trackingTag = tracking.varint()
        const trackingField = trackingTag >>> 3
        const trackingWire = trackingTag & 0x7
        if (trackingField === TRACKING_SYNC_ID_FIELD && trackingWire === WIRE_VARINT) {
          ids.push(tracking.varint())
        } else {
          tracking.skip(trackingWire)
        }
      }
    } else {
      reader.skip(wireType)
    }
  }
  return ids
}

/** One `BackupSource`: name = field 1, sourceId = field 2. */
function readSource(bytes: Uint8Array): BackupSourceEntry {
  const reader = new Reader(bytes)
  let name = ''
  let sourceId = 0
  while (!reader.exhausted) {
    const tag = reader.varint()
    const field = tag >>> 3
    const wireType = tag & 0x7
    if (field === 1 && wireType === WIRE_LENGTH_DELIMITED) {
      name = new TextDecoder().decode(reader.slice(reader.varint()))
    } else if (field === 2 && wireType === WIRE_VARINT) {
      sourceId = reader.varint()
    } else {
      reader.skip(wireType)
    }
  }
  return { sourceId, name }
}

/** Decompresses the file when it carries the gzip magic bytes. */
async function decodeBytes(file: File): Promise<Uint8Array> {
  const raw = new Uint8Array(await file.arrayBuffer())
  if (raw.length < 2) throw new CorruptedBackupError()
  const signature = (raw[0]! << 8) | raw[1]!
  if (signature === GZIP_MAGIC) {
    if (typeof DecompressionStream === 'undefined') throw new CorruptedBackupError()
    const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  }
  if (JSON_SIGNATURES.includes(signature)) throw new JsonBackupError()
  return raw
}

/** Reads the sources and the tracker ids of a Mihon backup file. */
export async function readBackupFile(file: File): Promise<BackupFileContents> {
  const bytes = await decodeBytes(file)
  const reader = new Reader(bytes)
  const sources: BackupSourceEntry[] = []
  const trackerIds: number[] = []
  const seen = new Set<number>()

  while (!reader.exhausted) {
    const tag = reader.varint()
    const field = tag >>> 3
    const wireType = tag & 0x7
    if (field === 0) throw new CorruptedBackupError()
    if (field === ENTRY_FIELD && wireType === WIRE_LENGTH_DELIMITED) {
      const entry = reader.slice(reader.varint())
      for (const id of readTrackingSyncIds(entry)) {
        if (!seen.has(id)) {
          seen.add(id)
          trackerIds.push(id)
        }
      }
    } else if (field === SOURCES_FIELD && wireType === WIRE_LENGTH_DELIMITED) {
      sources.push(readSource(reader.slice(reader.varint())))
    } else {
      reader.skip(wireType)
    }
  }

  return { sources, trackerIds }
}
