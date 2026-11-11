/**
 * PPT 式单页伪图片（.slide.svg）数据模型
 *
 * 每一页幻灯片单独存为一个自包含的 .slide.svg 文件：
 * - 图像显示层为标准 SVG 图元，任何 <img src="xxx.slide.svg"> 均可原生高清渲染；
 * - 图层源码嵌入在 SVG 内部的 <metadata id="paperloom-slide-v1"> 中，支持随时二次编辑。
 */

export type SlideAspectPreset = '16:9' | '4:3' | '1:1'

export interface SlideTextElement {
  readonly id: string
  readonly kind: 'text'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly text: string
  readonly fontSize: number
  readonly fontWeight: 'normal' | 'bold'
  readonly color: string
  readonly align: 'left' | 'center' | 'right'
  readonly backgroundColor: string
  readonly borderColor: string
  readonly borderRadius: number
}

export interface SlideImageElement {
  readonly id: string
  readonly kind: 'image'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** 文件池原路径（可选，便于溯源） */
  readonly inboxSrc?: string
  /** 内联 Base64 Data URL，确保 <img src="xxx.slide.svg"> 独立渲染不破图 */
  readonly dataUrl: string
  readonly alt: string
  readonly objectFit: 'contain' | 'cover'
  readonly borderRadius: number
}

export interface SlideShapeElement {
  readonly id: string
  readonly kind: 'shape'
  readonly shape: 'rect' | 'rounded' | 'pill' | 'callout'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly fill: string
  readonly stroke: string
  readonly strokeWidth: number
  readonly dashed: boolean
  readonly text: string
  readonly textColor: string
  readonly fontSize: number
}

export interface SlideArrowElement {
  readonly id: string
  readonly kind: 'arrow'
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly color: string
  readonly strokeWidth: number
  readonly dashed: boolean
  readonly doubleHeaded: boolean
}

export type SlideElement =
  | SlideTextElement
  | SlideImageElement
  | SlideShapeElement
  | SlideArrowElement

export interface SlideDocumentSpec {
  readonly version: 1
  readonly aspect: SlideAspectPreset
  readonly width: number
  readonly height: number
  readonly background: string
  readonly elements: readonly SlideElement[]
}
