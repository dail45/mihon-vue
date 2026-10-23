import { describe, expect, it } from 'vitest'
import { readBackupFile, JsonBackupError, CorruptedBackupError } from '../../src/api/backupFile'

/** Minimal protobuf writer helpers mirroring the Mihon backup layout. */
function varint(value: number): number[] {
  const out: number[] = []
  let v = value
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80)
    v = Math.floor(v / 128)
  }
  out.push(v)
  return out
}

function tag(field: number, wire: number): number[] {
  return varint((field << 3) | wire)
}

function lenField(field: number, bytes: number[]): number[] {
  return [...tag(field, 2), ...varint(bytes.length), ...bytes]
}

function trackingEntry(syncId: number): number[] {
  // BackupManga.tracking (field 18) holds a BackupTracking whose syncId is field 1.
  const tracking = [...tag(1, 0), ...varint(syncId)]
  return lenField(1, lenField(18, tracking))
}

function sourceEntry(sourceId: number, name: string): number[] {
  const nameBytes = Array.from(new TextEncoder().encode(name))
  return lenField(101, [...lenField(1, nameBytes), ...tag(2, 0), ...varint(sourceId)])
}

function fileOf(bytes: number[]): File {
  return new File([new Uint8Array(bytes)], 'app.mihon_test.tachibk')
}

describe('readBackupFile', () => {
  it('reads the sources and the tracker ids of a backup', async () => {
    const bytes = [...trackingEntry(2), ...trackingEntry(2), ...trackingEntry(9), ...sourceEntry(1234, 'Some Source')]
    const contents = await readBackupFile(fileOf(bytes))
    expect(contents.sources).toEqual([{ sourceId: 1234, name: 'Some Source' }])
    expect(contents.trackerIds).toEqual([2, 9])
  })

  it('rejects a JSON backup like the reference decoder', async () => {
    await expect(readBackupFile(fileOf([0x7b, 0x7d, 0x0a]))).rejects.toBeInstanceOf(JsonBackupError)
  })

  it('reports a corrupted backup', async () => {
    await expect(readBackupFile(fileOf([0x0a, 0x7f, 0x01]))).rejects.toBeInstanceOf(CorruptedBackupError)
  })
})
