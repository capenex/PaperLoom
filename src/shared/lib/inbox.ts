/**
 * 收件箱图片资源（res/inbox/）命名与路径工具
 *
 * 粘贴或拖入画布的图片统一放入 res/inbox/ 下，并以毫秒时间戳命名。
 */

export const INBOX_DIRECTORY = 'res/inbox'

const MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
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

/** 根据 MIME 类型或原始文件名推断图片扩展名，缺省为 png */
export function extensionForImage(mimeType: string, fileName = ''): string {
  const normalizedMime = mimeType.trim().toLowerCase()
  const byMime = MIME_TO_EXTENSION[normalizedMime]
  if (byMime !== undefined) return byMime

  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex !== -1) {
    const ext = fileName.slice(dotIndex + 1).trim().toLowerCase()
    if (KNOWN_IMAGE_EXTENSIONS.has(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext
    }
  }
  return 'png'
}

/** 生成以时间戳命名的图片文件名，例如 1762521600000.png */
export function createInboxFileName(
  mimeType: string,
  fileName = '',
  nowMs = Date.now(),
): string {
  const timestamp = nextInboxTimestamp(nowMs)
  const ext = extensionForImage(mimeType, fileName)
  return `${timestamp}.${ext}`
}

/** 生成 res/inbox/<timestamp>.<ext> 相对路径 */
export function createInboxRelativePath(inboxFileName: string): string {
  return `${INBOX_DIRECTORY}/${inboxFileName}`
}

/** 从节点 src 中提取 res/inbox/<name> 相对路径；非收件箱资源返回 null */
export function extractInboxRelativePath(source: string): string | null {
  const trimmed = source.trim()
  const match = INBOX_PATH_PATTERN.exec(trimmed)
  const fileName = match?.[1]
  if (fileName === undefined) return null
  return createInboxRelativePath(fileName)
}
