/** PDF 切图工具：pdf.js 渲染、拖框裁剪与引用生成，全部与界面无关 */

import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
// eslint-disable-next-line import/default -- Vite 的 ?url 后缀在运行时给出 worker 资源地址，pdfjs 的类型声明里没有这个默认导出
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import type { PaperReference } from '@/shared/types/paper'

export interface CropPoint {
  readonly x: number
  readonly y: number
}

export interface CropRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type PdfLoadingTask = ReturnType<typeof pdfjsLib.getDocument>

export const MIN_CROP_SIZE = 12

export const CROP_PAGE_WIDTH = 760
export const CROP_PAGE_HEIGHT = 540

/** 详情查看器的页面栅格宽度：按此高分辨率宽度渲染，以保证滚轮放大时依然清晰 */
export const DETAIL_PAGE_WIDTH = 1600

let workerConfigured = false

export function ensurePdfWorker(): void {
  if (workerConfigured) return
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  workerConfigured = true
}

export function openPdfDocument(data: ArrayBuffer): PdfLoadingTask {
  ensurePdfWorker()
  return pdfjsLib.getDocument({ data })
}

export function openPdfDocumentByUrl(src: string): PdfLoadingTask {
  ensurePdfWorker()
  return pdfjsLib.getDocument({ url: src })
}

export function clampPageNumber(pageNumber: number, pageCount: number): number {
  return Math.min(Math.max(1, pageNumber), Math.max(1, pageCount))
}

/** 把所选页画进画布，缩放到不超过给定宽高 */
export async function renderPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  maxWidth: number,
  maxHeight = Number.POSITIVE_INFINITY,
): Promise<void> {
  const page = await pdf.getPage(pageNumber)
  const natural = page.getViewport({ scale: 1 })
  const scale = Math.min(maxWidth / natural.width, maxHeight / natural.height)
  const viewport = page.getViewport({ scale })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await page.render({ canvas, viewport }).promise
}

export function cropPointOf(rect: DOMRect, clientX: number, clientY: number): CropPoint {
  return {
    x: Math.min(rect.width, Math.max(0, clientX - rect.left)),
    y: Math.min(rect.height, Math.max(0, clientY - rect.top)),
  }
}

export function cropRectBetween(start: CropPoint, end: CropPoint): CropRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

export function isCropUsable(crop: CropRect | null): crop is CropRect {
  return crop !== null && crop.width >= MIN_CROP_SIZE && crop.height >= MIN_CROP_SIZE
}

/** 按画布实际像素把选框裁成 PNG；选框太小时视为没有切图 */
export function cropToPreview(
  canvas: HTMLCanvasElement | null,
  crop: CropRect | null,
): Promise<Blob | null> {
  if (canvas === null || !isCropUsable(crop)) return Promise.resolve(null)
  const ratio = canvas.width / canvas.getBoundingClientRect().width
  const width = Math.max(1, Math.round(crop.width * ratio))
  const height = Math.max(1, Math.round(crop.height * ratio))
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const context = output.getContext('2d')
  if (context === null) return Promise.resolve(null)
  const sx = Math.round(crop.x * ratio)
  const sy = Math.round(crop.y * ratio)
  context.drawImage(canvas, sx, sy, width, height, 0, 0, width, height)
  return new Promise<Blob | null>((resolve) => {
    output.toBlob(resolve, 'image/png')
  })
}

/** 预览图给单击弹窗，页码给双击跳转全文 */
export function createPdfReference(file: File, pageNumber: number, preview: Blob): PaperReference {
  return {
    kind: 'pdf',
    src: URL.createObjectURL(file),
    label: file.name,
    page: pageNumber,
    previewSrc: URL.createObjectURL(preview),
  }
}
