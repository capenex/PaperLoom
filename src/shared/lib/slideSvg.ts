/**
 * PPT 式单页伪图片（.slide.svg）序列化与反序列化引擎
 *
 * 将 SlideDocumentSpec 编译为带 <metadata id="paperloom-slide-v1"> 的标准独立 SVG，
 * 并支持从 SVG 文本中无损还原 SlideDocumentSpec 图层供二次编辑。
 */

import type {
  SlideArrowElement,
  SlideAspectPreset,
  SlideDocumentSpec,
  SlideElement,
  SlideImageElement,
  SlideShapeElement,
  SlideTextElement,
} from '@/shared/types/slide'

export const SLIDE_METADATA_ID = 'paperloom-slide-v1'

const ASPECT_DIMENSIONS: Readonly<
  Record<SlideAspectPreset, { readonly width: number; readonly height: number }>
> = {
  '16:9': { width: 960, height: 540 },
  '4:3': { width: 800, height: 600 },
  '1:1': { width: 720, height: 720 },
}

export function dimensionsForSlideAspect(aspect: SlideAspectPreset): {
  readonly width: number
  readonly height: number
} {
  return ASPECT_DIMENSIONS[aspect]
}

export function createDefaultSlideSpec(
  title = '幻灯片标题',
  aspect: SlideAspectPreset = '16:9',
): SlideDocumentSpec {
  const { width, height } = dimensionsForSlideAspect(aspect)
  return {
    version: 1,
    aspect,
    width,
    height,
    background: '#ffffff',
    elements: [
      {
        id: 'slide-title-1',
        kind: 'text',
        x: 64,
        y: 48,
        width: width - 128,
        height: 64,
        text: title,
        fontSize: 32,
        fontWeight: 'bold',
        color: '#0f172a',
        align: 'left',
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderRadius: 8,
      },
      {
        id: 'slide-body-1',
        kind: 'text',
        x: 64,
        y: 132,
        width: Math.round((width - 128) * 0.55),
        height: 220,
        text: '• 双击文本框可直接编辑多行要点\n• 支持插入文件池图片或直接粘贴截图\n• 支持添加高亮标注框与指示箭头',
        fontSize: 20,
        fontWeight: 'normal',
        color: '#334155',
        align: 'left',
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderRadius: 12,
      },
    ],
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function unescapeXml(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&')
}

function textAnchorForAlign(
  align: 'left' | 'center' | 'right',
  x: number,
  width: number,
  padding: number,
): { readonly anchor: 'start' | 'middle' | 'end'; readonly textX: number } {
  if (align === 'center') {
    return { anchor: 'middle', textX: Math.round(x + width / 2) }
  }
  if (align === 'right') {
    return { anchor: 'end', textX: Math.round(x + width - padding) }
  }
  return { anchor: 'start', textX: Math.round(x + padding) }
}

function renderTextElementSvg(el: SlideTextElement): string {
  const parts: string[] = []
  const hasBg = el.backgroundColor !== '' && el.backgroundColor !== 'transparent'
  const hasBorder = el.borderColor !== '' && el.borderColor !== 'transparent'
  if (hasBg || hasBorder) {
    parts.push(
      `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${el.borderRadius}" fill="${hasBg ? escapeXml(el.backgroundColor) : 'none'}" stroke="${hasBorder ? escapeXml(el.borderColor) : 'none'}" stroke-width="${hasBorder ? 2 : 0}" />`,
    )
  }
  const padding = hasBg || hasBorder ? 16 : 4
  const { anchor, textX } = textAnchorForAlign(el.align, el.x, el.width, padding)
  const lineHeight = Math.round(el.fontSize * 1.4)
  const startY = Math.round(el.y + padding + el.fontSize)
  const lines = el.text.split(/\r?\n/u)
  const tspans = lines
    .map(
      (line, idx) =>
        `<tspan x="${textX}" y="${startY + idx * lineHeight}">${escapeXml(line === '' ? ' ' : line)}</tspan>`,
    )
    .join('')

  parts.push(
    `<text font-family="system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="${el.fontSize}" font-weight="${el.fontWeight}" fill="${escapeXml(el.color)}" text-anchor="${anchor}">${tspans}</text>`,
  )
  return `<g data-slide-id="${escapeXml(el.id)}">${parts.join('')}</g>`
}

function renderImageElementSvg(el: SlideImageElement): string {
  const clipId = `clip-${escapeXml(el.id)}`
  const ratio = el.objectFit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'
  const clipDef =
    el.borderRadius > 0
      ? `<defs><clipPath id="${clipId}"><rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${el.borderRadius}" /></clipPath></defs>`
      : ''
  const clipAttr = el.borderRadius > 0 ? ` clip-path="url(#${clipId})"` : ''
  return `<g data-slide-id="${escapeXml(el.id)}">${clipDef}<image x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" href="${escapeXml(el.dataUrl)}" preserveAspectRatio="${ratio}"${clipAttr} /></g>`
}

function radiusForShape(el: SlideShapeElement): number {
  if (el.shape === 'pill') return Math.round(Math.min(el.width, el.height) / 2)
  if (el.shape === 'rounded' || el.shape === 'callout') return 14
  return 0
}

function renderShapeElementSvg(el: SlideShapeElement): string {
  const rx = radiusForShape(el)
  const dashAttr = el.dashed ? ' stroke-dasharray="8 6"' : ''
  const fill = el.fill === '' || el.fill === 'transparent' ? 'none' : escapeXml(el.fill)
  const stroke = el.stroke === '' || el.stroke === 'transparent' ? 'none' : escapeXml(el.stroke)
  const rectSvg = `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${el.strokeWidth}"${dashAttr} />`

  if (el.text.trim() === '') {
    return `<g data-slide-id="${escapeXml(el.id)}">${rectSvg}</g>`
  }
  const lines = el.text.split(/\r?\n/u)
  const lineHeight = Math.round(el.fontSize * 1.35)
  const totalTextHeight = lines.length * lineHeight
  const firstLineY = Math.round(el.y + (el.height - totalTextHeight) / 2 + el.fontSize * 0.9)
  const centerX = Math.round(el.x + el.width / 2)
  const tspans = lines
    .map(
      (line, idx) =>
        `<tspan x="${centerX}" y="${firstLineY + idx * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('')
  const textSvg = `<text font-family="system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="${el.fontSize}" font-weight="bold" fill="${escapeXml(el.textColor)}" text-anchor="middle">${tspans}</text>`
  return `<g data-slide-id="${escapeXml(el.id)}">${rectSvg}${textSvg}</g>`
}

function renderArrowElementSvg(el: SlideArrowElement): string {
  const endMarkerId = `arrow-end-${escapeXml(el.id)}`
  const startMarkerId = `arrow-start-${escapeXml(el.id)}`
  const color = escapeXml(el.color)
  const dashAttr = el.dashed ? ' stroke-dasharray="8 6"' : ''
  const startDef = el.doubleHeaded
    ? `<marker id="${startMarkerId}" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}" /></marker>`
    : ''
  const defs = `<defs>${startDef}<marker id="${endMarkerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}" /></marker></defs>`
  const markerStartAttr = el.doubleHeaded ? ` marker-start="url(#${startMarkerId})"` : ''
  const line = `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${color}" stroke-width="${el.strokeWidth}" stroke-linecap="round"${dashAttr}${markerStartAttr} marker-end="url(#${endMarkerId})" />`
  return `<g data-slide-id="${escapeXml(el.id)}">${defs}${line}</g>`
}

function renderElementSvg(element: SlideElement): string {
  if (element.kind === 'text') return renderTextElementSvg(element)
  if (element.kind === 'image') return renderImageElementSvg(element)
  if (element.kind === 'shape') return renderShapeElementSvg(element)
  return renderArrowElementSvg(element)
}

/** 将幻灯片画板模型序列化为标准自包含 SVG 字符串 */
export function serializeSlideToSvg(spec: SlideDocumentSpec): string {
  const metadataJson = escapeXml(JSON.stringify(spec))
  const body = spec.elements.map(renderElementSvg).join('\n  ')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}" fill="none">
  <metadata id="${SLIDE_METADATA_ID}">${metadataJson}</metadata>
  <rect width="${spec.width}" height="${spec.height}" fill="${escapeXml(spec.background)}" />
  ${body}
</svg>`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSlideAspect(value: unknown): value is SlideAspectPreset {
  return value === '16:9' || value === '4:3' || value === '1:1'
}

function parseSlideElement(raw: unknown): SlideElement | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.kind !== 'string') return null
  if (raw.kind === 'text' && typeof raw.text === 'string' && typeof raw.x === 'number') {
    return {
      id: raw.id,
      kind: 'text',
      x: raw.x,
      y: typeof raw.y === 'number' ? raw.y : 0,
      width: typeof raw.width === 'number' ? raw.width : 320,
      height: typeof raw.height === 'number' ? raw.height : 80,
      text: raw.text,
      fontSize: typeof raw.fontSize === 'number' ? raw.fontSize : 20,
      fontWeight: raw.fontWeight === 'bold' ? 'bold' : 'normal',
      color: typeof raw.color === 'string' ? raw.color : '#0f172a',
      align: raw.align === 'center' || raw.align === 'right' ? raw.align : 'left',
      backgroundColor: typeof raw.backgroundColor === 'string' ? raw.backgroundColor : 'transparent',
      borderColor: typeof raw.borderColor === 'string' ? raw.borderColor : 'transparent',
      borderRadius: typeof raw.borderRadius === 'number' ? raw.borderRadius : 8,
    }
  }
  if (raw.kind === 'image' && typeof raw.dataUrl === 'string' && typeof raw.x === 'number') {
    return {
      id: raw.id,
      kind: 'image',
      x: raw.x,
      y: typeof raw.y === 'number' ? raw.y : 0,
      width: typeof raw.width === 'number' ? raw.width : 320,
      height: typeof raw.height === 'number' ? raw.height : 240,
      ...(typeof raw.inboxSrc === 'string' ? { inboxSrc: raw.inboxSrc } : {}),
      dataUrl: raw.dataUrl,
      alt: typeof raw.alt === 'string' ? raw.alt : '',
      objectFit: raw.objectFit === 'cover' ? 'cover' : 'contain',
      borderRadius: typeof raw.borderRadius === 'number' ? raw.borderRadius : 8,
    }
  }
  if (raw.kind === 'shape' && typeof raw.x === 'number') {
    const shape =
      raw.shape === 'rounded' || raw.shape === 'pill' || raw.shape === 'callout'
        ? raw.shape
        : 'rect'
    return {
      id: raw.id,
      kind: 'shape',
      shape,
      x: raw.x,
      y: typeof raw.y === 'number' ? raw.y : 0,
      width: typeof raw.width === 'number' ? raw.width : 200,
      height: typeof raw.height === 'number' ? raw.height : 100,
      fill: typeof raw.fill === 'string' ? raw.fill : 'rgba(59, 130, 246, 0.12)',
      stroke: typeof raw.stroke === 'string' ? raw.stroke : '#2563eb',
      strokeWidth: typeof raw.strokeWidth === 'number' ? raw.strokeWidth : 2,
      dashed: Boolean(raw.dashed),
      text: typeof raw.text === 'string' ? raw.text : '',
      textColor: typeof raw.textColor === 'string' ? raw.textColor : '#1e40af',
      fontSize: typeof raw.fontSize === 'number' ? raw.fontSize : 18,
    }
  }
  if (raw.kind === 'arrow' && typeof raw.x1 === 'number' && typeof raw.x2 === 'number') {
    return {
      id: raw.id,
      kind: 'arrow',
      x1: raw.x1,
      y1: typeof raw.y1 === 'number' ? raw.y1 : 0,
      x2: raw.x2,
      y2: typeof raw.y2 === 'number' ? raw.y2 : 0,
      color: typeof raw.color === 'string' ? raw.color : '#ef4444',
      strokeWidth: typeof raw.strokeWidth === 'number' ? raw.strokeWidth : 3,
      dashed: Boolean(raw.dashed),
      doubleHeaded: Boolean(raw.doubleHeaded),
    }
  }
  return null
}

/** 从 .slide.svg 文件内容中解析还原 SlideDocumentSpec；非幻灯片 SVG 返回 null */
export function parseSlideFromSvg(svgText: string): SlideDocumentSpec | null {
  const pattern = new RegExp(
    `<metadata\\s+id=["']${SLIDE_METADATA_ID}["']>([\\s\\S]*?)</metadata>`,
    'iu',
  )
  const match = pattern.exec(svgText)
  const encodedJson = match?.[1]
  if (encodedJson === undefined) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(unescapeXml(encodedJson.trim()))
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.elements)) return null
  const aspect = isSlideAspect(parsed.aspect) ? parsed.aspect : '16:9'
  const dims = dimensionsForSlideAspect(aspect)
  const elements: SlideElement[] = []
  for (const item of parsed.elements) {
    const el = parseSlideElement(item)
    if (el !== null) elements.push(el)
  }
  return {
    version: 1,
    aspect,
    width: typeof parsed.width === 'number' ? parsed.width : dims.width,
    height: typeof parsed.height === 'number' ? parsed.height : dims.height,
    background: typeof parsed.background === 'string' ? parsed.background : '#ffffff',
    elements,
  }
}
