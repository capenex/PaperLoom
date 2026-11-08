/**
 * 收件箱资源（res/inbox/）命名与路径工具
 *
 * 粘贴或拖入画布的图片、以及本地引用附件（PDF / HTML / 图片）统一放入 res/inbox/ 下，
 * 并以毫秒时间戳命名。
 */

export const INBOX_DIRECTORY = 'res/inbox'

/** 资源写入失败的统一提示：对象 URL 活不过刷新，写进工程文件就是死链接，绝不静默降级 */
export const INBOX_UPLOAD_FAILED =
  '资源写入 res/inbox 失败，请确认开发服务器（npm run dev）正在运行'

const MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
}

const ASSET_EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'text/html': 'html',
}

const ASSET_EXTENSION_BY_NAME: Readonly<Record<string, string>> = {
  pdf: 'pdf',
  html: 'html',
  htm: 'html',
}

const KNOWN_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'bmp'])

const INBOX_PATH_PATTERN = /(?:^|[#/])res\/inbox\/([0-9A-Za-z._-]+)$/u

let lastTimestampMs = 0

/** 生成严格递增的毫秒时间戳，避免同一毫秒内批量拖入多张图片时重名 */
export function nextInboxTimestamp(nowMs = Date.now()): number {
  const next = Math.max(nowMs, lastTimestampMs + 1)
  lastTimestampMs = next
  return next
}

function fileExtensionOf(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex === -1) return ''
  return fileName.slice(dotIndex + 1).trim().toLowerCase()
}

/** 根据 MIME 类型或原始文件名推断图片扩展名，缺省为 png */
export function extensionForImage(mimeType: string, fileName = ''): string {
  const normalizedMime = mimeType.trim().toLowerCase()
  const byMime = MIME_TO_EXTENSION[normalizedMime]
  if (byMime !== undefined) return byMime

  const ext = fileExtensionOf(fileName)
  if (ext !== '' && KNOWN_IMAGE_EXTENSIONS.has(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext
  }
  return 'png'
}

/** 根据 MIME 类型或原始文件名推断通用资源扩展名（图片之外还有 PDF 与 HTML），缺省按图片处理 */
export function extensionForAsset(mimeType: string, fileName = ''): string {
  const normalizedMime = mimeType.trim().toLowerCase()
  const byMime = ASSET_EXTENSION_BY_MIME[normalizedMime]
  if (byMime !== undefined) return byMime

  const byName = ASSET_EXTENSION_BY_NAME[fileExtensionOf(fileName)]
  if (byName !== undefined) return byName

  return extensionForImage(mimeType, fileName)
}

/** 生成以时间戳命名的通用资源文件名，例如 1762521600000.pdf */
export function createInboxAssetFileName(
  mimeType: string,
  fileName = '',
  nowMs = Date.now(),
): string {
  const timestamp = nextInboxTimestamp(nowMs)
  const ext = extensionForAsset(mimeType, fileName)
  return `${timestamp}.${ext}`
}

/** 生成以时间戳命名的图片文件名，例如 1762521600000.png */
export function createInboxFileName(
  mimeType: string,
  fileName = '',
  nowMs = Date.now(),
): string {
  return createInboxAssetFileName(mimeType, fileName, nowMs)
}

/** 生成 res/inbox/<timestamp>.<ext> 相对路径 */
export function createInboxRelativePath(inboxFileName: string): string {
  return `${INBOX_DIRECTORY}/${inboxFileName}`
}

/** 把任意资源字节写入 res/inbox/<timestamp>.<ext>，返回应用内持久化路径 /res/inbox/<name> */
export async function uploadBlobToInbox(
  blob: Blob,
  fileName = '',
  nowMs = Date.now(),
): Promise<string> {
  const inboxFileName = createInboxAssetFileName(blob.type, fileName, nowMs)
  let response: Response
  try {
    response = await fetch(`/api/res/inbox?name=${encodeURIComponent(inboxFileName)}`, {
      method: 'POST',
      headers: {
        'content-type': blob.type || 'application/octet-stream',
      },
      body: blob,
    })
  } catch {
    throw new Error(INBOX_UPLOAD_FAILED)
  }
  if (!response.ok) {
    throw new Error(INBOX_UPLOAD_FAILED)
  }
  return `/${createInboxRelativePath(inboxFileName)}`
}

/** 从节点 src 中提取 res/inbox/<name> 相对路径；非收件箱资源返回 null */
export function extractInboxRelativePath(source: string): string | null {
  const trimmed = source.trim()
  const match = INBOX_PATH_PATTERN.exec(trimmed)
  const fileName = match?.[1]
  if (fileName === undefined) return null
  return createInboxRelativePath(fileName)
}
