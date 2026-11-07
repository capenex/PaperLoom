/**
 * 编辑器图片粘贴与拖拽入库工具
 *
 * 将剪贴板或拖拽进画布的图片保存至 res/inbox/<timestamp>.<ext>，
 * 并生成对应的多媒体节点内容（ImageNodeContent）。
 */

import { createInboxFileName, createInboxRelativePath } from '@/shared/lib/inbox'
import type { ImageNodeContent } from '@/shared/types/paper'

const IMAGE_FILE_NAME_PATTERN = /\.(?:png|jpe?g|webp|gif|svg|avif|bmp)$/iu

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return IMAGE_FILE_NAME_PATTERN.test(file.name)
}

/** 图片身份键：同一张图在 files 与 items 里各出现一次，而内存 blob 的 lastModified
 *  是创建时刻，两次创建就会不同，所以不能用时间戳做键 */
function imageFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.type}`
}

/** 从剪贴板或拖拽 DataTransfer 中提取全部图片文件 */
export function extractImageFiles(dataTransfer: DataTransfer | null): readonly File[] {
  if (dataTransfer === null) return []
  const result: File[] = []
  const seen = new Set<string>()

  for (let i = 0; i < dataTransfer.files.length; i += 1) {
    const file = dataTransfer.files.item(i)
    if (file !== null && isImageFile(file)) {
      seen.add(imageFileKey(file))
      result.push(file)
    }
  }

  for (let i = 0; i < dataTransfer.items.length; i += 1) {
    const item = dataTransfer.items[i]
    if (item === undefined || item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file === null) continue
    const key = imageFileKey(file)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(file)
    }
  }

  return result
}

const PASTE_TYPE_PRIORITY = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
  'image/bmp',
]

function typeRank(file: File): number {
  const index = PASTE_TYPE_PRIORITY.indexOf(file.type)
  return index === -1 ? PASTE_TYPE_PRIORITY.length : index
}

/** 粘贴只取一张图：截图与多格式剪贴板会把同一张图暴露成多个文件项，取最标准的那份 */
export function extractPastedImageFile(dataTransfer: DataTransfer | null): File | null {
  const files = extractImageFiles(dataTransfer)
  if (files.length === 0) return null
  return files.reduce((best, file) => (typeRank(file) < typeRank(best) ? file : best))
}

/** 判断拖拽事件中是否携带文件（用于 dragover 阶段激活画布放置反馈） */
export function hasFilesInDataTransfer(dataTransfer: DataTransfer | null): boolean {
  if (dataTransfer === null) return false
  if (dataTransfer.types.includes('Files')) return true
  for (let i = 0; i < dataTransfer.items.length; i += 1) {
    if (dataTransfer.items[i]?.kind === 'file') return true
  }
  return false
}

/** 图片写入失败的统一提示；不静默降级，避免产生刷新即失效的资源链接 */
export const INBOX_SAVE_FAILED =
  '图片写入 res/inbox 失败，请确认开发服务器（npm run dev）正在运行'

async function postInboxFile(inboxFileName: string, file: File): Promise<Response | null> {
  try {
    return await fetch(`/api/res/inbox?name=${encodeURIComponent(inboxFileName)}`, {
      method: 'POST',
      headers: {
        'content-type': file.type || 'application/octet-stream',
      },
      body: file,
    })
  } catch {
    return null
  }
}

/** 将图片文件存入 res/inbox/<timestamp>.<ext>，返回可直接用于多媒体节点的 ImageNodeContent */
export async function saveImageFileToInbox(
  file: File,
  nowMs = Date.now(),
): Promise<ImageNodeContent> {
  const inboxFileName = createInboxFileName(file.type, file.name, nowMs)
  const response = await postInboxFile(inboxFileName, file)
  // 只接受真正落盘的链接：对象 URL 活不过刷新，写进工程文件就是死链接
  if (response === null || !response.ok) {
    throw new Error(INBOX_SAVE_FAILED)
  }
  return {
    kind: 'image',
    src: `/${createInboxRelativePath(inboxFileName)}`,
    alt: file.name.trim() === '' ? inboxFileName : file.name,
  }
}
