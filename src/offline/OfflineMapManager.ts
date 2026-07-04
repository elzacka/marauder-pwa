const OPFS_FILENAME = 'tiles-gb.pmtiles'

export async function hasOfflineTiles(): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory()
    await root.getFileHandle(OPFS_FILENAME)
    return true
  } catch {
    return false
  }
}

export async function getOfflineFile(): Promise<File | null> {
  try {
    const root = await navigator.storage.getDirectory()
    const handle = await root.getFileHandle(OPFS_FILENAME)
    return await handle.getFile()
  } catch {
    return null
  }
}

export async function downloadToOPFS(
  url: string,
  onProgress: (downloaded: number, total: number) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Nedlasting mislyktes: ${response.status}`)
  if (!response.body) throw new Error('Ingen datastrøm i respons')

  const total = parseInt(response.headers.get('content-length') ?? '0', 10)

  await navigator.storage.persist()

  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(OPFS_FILENAME, { create: true })
  const writable = await handle.createWritable()

  let downloaded = 0
  const reader = response.body.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      await writable.write(value)
      downloaded += value.length
      onProgress(downloaded, total)
    }
    await writable.close()
  } catch (err) {
    await writable.abort()
    throw err
  }
}

export async function deleteOfflineTiles(): Promise<void> {
  const root = await navigator.storage.getDirectory()
  await root.removeEntry(OPFS_FILENAME)
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(0)} MB` : `${(bytes / 1024).toFixed(0)} KB`
}
