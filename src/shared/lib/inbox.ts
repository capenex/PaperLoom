/**
 * 收件箱资源（res/inbox/）命名、多级目录路径与上传工具
 *
 * 支持多级子文件夹（如 res/inbox/第一章/架构图.slide.svg）、中英文可读文件名、
 * 伪图片（.slide.svg）识别与安全相对路径校验。
 */

export const INBOX_DIRECTORY = 'res/inbox'

/** 资源写入失败的统一提示：对象 URL 活不过刷新，写进工程文件就是死链接，绝不静默降级 */
export const INBOX_UPLOAD_FAILED =
  '资源写入 res/inbox 失败，请确认开发服务器（npm run dev）正在运行'

export type InboxAssetCategory = 'slide' | 'image' | 'document' | 'reference' | 'other'

export interface InboxEntry {
  /** 相对于 res/inbox 的路径，使用正斜杠，如 "第一章/架构图.slide.svg" */
  readonly path: string
  /** 文件或文件夹名称，如 "架构图.slide.svg" */
  readonly name: string
  /** 父目录相对路径，根目录为 "" */
  readonly parentPath: string
  readonly kind: 'file' | 'folder'
  readonly size: number
  readonly updatedAt: number
  /** 小写扩展名，含点号；伪图片固定识别为 ".slide.svg" */
  readonly ext: string
  readonly category: InboxAssetCategory
  /** 文件内容的 SHA-256 哈希值（仅 kind === 'file' 时存在），用于跨文件池与文件夹去重 */
  readonly sha256?: string | undefined
}

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
  'text/markdown': 'md',
  'text/plain': 'txt',
  'application/json': 'json',
}

const KNOWN_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'bmp'])
const KNOWN_DOC_EXTENSIONS = new Set([
  'md',
  'markdown',
  'mdx',
  'txt',
  'json',
  'yaml',
  'yml',
  'toml',
  'py',
  'ts',
  'tsx',
  'js',
  'jsx',
  'go',
  'rs',
  'java',
  'c',
  'cpp',
  'h',
  'sh',
  'css',
  'sql',
  'xml',
  'csv',
])
const KNOWN_REF_EXTENSIONS = new Set(['pdf', 'html', 'htm'])

const FORBIDDEN_SEGMENT_CHARS_GLOBAL = /[<>:"/\\|?*]/gu
const FORBIDDEN_SEGMENT_CHAR_TEST = /[<>:"/\\|?*]/u

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) < 32) return true
  }
  return false
}

let lastTimestampMs = 0

/** 生成严格递增的毫秒时间戳，避免同一毫秒内批量拖入多张图片时重名 */
export function nextInboxTimestamp(nowMs = Date.now()): number {
  const next = Math.max(nowMs, lastTimestampMs + 1)
  lastTimestampMs = next
  return next
}

function fileExtensionOf(fileName: string): string {
  const lower = fileName.trim().toLowerCase()
  if (lower.endsWith('.slide.svg')) return 'slide.svg'
  const dotIndex = lower.lastIndexOf('.')
  if (dotIndex === -1) return ''
  return lower.slice(dotIndex + 1).trim()
}

/** 识别带点号的小写扩展名（伪图片优先识别为 .slide.svg） */
export function detectInboxExtension(fileName: string): string {
  const ext = fileExtensionOf(fileName)
  return ext === '' ? '' : `.${ext}`
}

/** 根据文件名推断文件池资源分类 */
export function classifyInboxFileName(fileName: string): InboxAssetCategory {
  const ext = fileExtensionOf(fileName)
  if (ext === 'slide.svg') return 'slide'
  if (KNOWN_IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (KNOWN_REF_EXTENSIONS.has(ext)) return 'reference'
  if (KNOWN_DOC_EXTENSIONS.has(ext)) return 'document'
  return 'other'
}

/** 判断路径或 URL 是否为 .slide.svg 伪图片 */
export function isSlideSvgPath(pathOrUrl: string): boolean {
  const clean = (pathOrUrl.split('?')[0] ?? '').split('#')[0] ?? ''
  return clean.trim().toLowerCase().endsWith('.slide.svg')
}

/** 净化单个文件或文件夹名称，保留中文、字母、数字、空格与常用标点 */
export function sanitizeInboxSegment(rawName: string): string {
  let noControl = ''
  for (let index = 0; index < rawName.length; index += 1) {
    noControl += rawName.charCodeAt(index) < 32 ? '-' : (rawName[index] ?? '')
  }
  const cleaned = noControl.replace(FORBIDDEN_SEGMENT_CHARS_GLOBAL, '-').trim()
  if (cleaned === '' || cleaned === '.' || cleaned === '..') return ''
  return cleaned
}

/** 校验相对于 res/inbox/ 的多级路径是否安全合法 */
export function isSafeInboxRelativePath(relPath: string): boolean {
  if (relPath === '' || relPath.startsWith('/') || relPath.endsWith('/')) return false
  if (relPath.includes('\\') || hasControlCharacter(relPath)) return false
  const segments = relPath.split('/')
  if (segments.length === 0) return false
  return segments.every((segment) => {
    if (segment === '' || segment === '.' || segment === '..') return false
    return !FORBIDDEN_SEGMENT_CHAR_TEST.test(segment)
  })
}

/** 根据 MIME 类型或原始文件名推断图片扩展名，缺省为 png */
export function extensionForImage(mimeType: string, fileName = ''): string {
  const ext = fileExtensionOf(fileName)
  if (ext === 'slide.svg') return 'slide.svg'
  const normalizedMime = mimeType.trim().toLowerCase()
  const byMime = MIME_TO_EXTENSION[normalizedMime]
  if (byMime !== undefined) return byMime

  if (ext !== '' && KNOWN_IMAGE_EXTENSIONS.has(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext
  }
  return 'png'
}

/** 根据 MIME 类型或原始文件名推断通用资源扩展名 */
export function extensionForAsset(mimeType: string, fileName = ''): string {
  const ext = fileExtensionOf(fileName)
  if (ext === 'slide.svg') return 'slide.svg'
  if (KNOWN_REF_EXTENSIONS.has(ext)) return ext === 'htm' ? 'html' : ext
  if (KNOWN_DOC_EXTENSIONS.has(ext)) return ext
  if (KNOWN_IMAGE_EXTENSIONS.has(ext)) return ext === 'jpeg' ? 'jpg' : ext

  const normalizedMime = mimeType.trim().toLowerCase()
  const byMime = ASSET_EXTENSION_BY_MIME[normalizedMime]
  if (byMime !== undefined) return byMime

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

/** 生成 res/inbox/<relPath> 相对路径 */
export function createInboxRelativePath(inboxRelativePath: string): string {
  const trimmed = inboxRelativePath.replace(/^\/+/u, '')
  return `${INBOX_DIRECTORY}/${trimmed}`
}

/** 生成浏览器可请求的 /res/inbox/<encodedRelPath> 地址（可选附加 ?t= 缓存刷新戳） */
export function buildInboxUrl(relPath: string, cacheBust?: number): string {
  const trimmed = relPath.replace(/^\/+/u, '')
  const encoded = trimmed
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  const base = `/${INBOX_DIRECTORY}/${encoded}`
  return cacheBust === undefined ? base : `${base}?t=${cacheBust}`
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const INBOX_LOOKUP_PATTERN = /(?:^|[#/])res\/inbox\/(.+)$/u

/**
 * 从任意节点 src 或 href 中提取相对于 res/inbox/ 的内部路径（已解码、已剥离 ?t= 参数）。
 * 例如 "/res/inbox/%E7%AC%AC%E4%B8%80%E7%AB%A0/a.slide.svg?t=1" -> "第一章/a.slide.svg"
 */
export function normalizeInboxLookupPath(source: string): string | null {
  const withoutQuery = source.trim().split('?')[0] ?? ''
  const match = INBOX_LOOKUP_PATTERN.exec(withoutQuery)
  const rawRel = match?.[1]
  if (rawRel === undefined) return null
  const decoded = rawRel
    .split('/')
    .map((segment) => safeDecodeUri(segment))
    .join('/')
  return isSafeInboxRelativePath(decoded) ? decoded : null
}

/** 从节点 src 中提取 res/inbox/<relPath> 相对路径；非收件箱资源返回 null */
export function extractInboxRelativePath(source: string): string | null {
  const relPath = normalizeInboxLookupPath(source)
  return relPath === null ? null : createInboxRelativePath(relPath)
}

/** 把任意资源字节写入 res/inbox/<path>，返回应用内持久化路径 /res/inbox/<path> */
export async function uploadBlobToInbox(
  blob: Blob,
  fileName = '',
  nowMs = Date.now(),
  folderPath = '',
  preserveFileName = false,
  overwrite = false,
): Promise<string> {
  const sanitizedName = preserveFileName ? sanitizeInboxSegment(fileName) : ''
  const baseName =
    sanitizedName === '' ? createInboxAssetFileName(blob.type, fileName, nowMs) : sanitizedName
  const cleanFolder = folderPath.trim().replace(/^\/+|\/+$/gu, '')
  const targetRelPath = cleanFolder === '' ? baseName : `${cleanFolder}/${baseName}`

  const overwriteParam = overwrite ? '1' : '0'
  let response: Response
  try {
    response = await fetch(
      `/api/res/inbox?path=${encodeURIComponent(targetRelPath)}&overwrite=${overwriteParam}`,
      {
        method: 'POST',
        headers: {
          'content-type': blob.type || 'application/octet-stream',
        },
        body: blob,
      },
    )
  } catch {
    throw new Error(INBOX_UPLOAD_FAILED)
  }
  if (!response.ok) {
    throw new Error(INBOX_UPLOAD_FAILED)
  }
  try {
    const json: unknown = await response.json()
    if (
      typeof json === 'object' &&
      json !== null &&
      'src' in json &&
      typeof json.src === 'string'
    ) {
      return json.src
    }
  } catch {
    // 兼容旧响应兜底
  }
  return buildInboxUrl(targetRelPath)
}
