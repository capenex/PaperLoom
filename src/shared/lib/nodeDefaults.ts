import type { DocumentDefaults, NodeLayout } from '@/shared/types/paper'

/** 节点未显式设置宽高时使用的默认尺寸 */
export const DEFAULT_NODE_WIDTH = 208
export const DEFAULT_NODE_HEIGHT = 112

/** 多媒体（图片）节点点击放大时的缩放倍数（1.5x） */
export const EXPANDED_MEDIA_SCALE = 1.5

/** 节点文字未显式设置字号时使用的默认字号 */
export const DEFAULT_FONT_SIZE = 16

/** 字号可选项：富文本局部字号与文档预设字号共用 */
export const FONT_SIZE_OPTIONS: readonly number[] = [12, 14, 16, 20, 24, 32]

/** 编辑栏允许的节点尺寸范围 */
export const MIN_NODE_WIDTH = 120
export const MAX_NODE_WIDTH = 640
export const MIN_NODE_HEIGHT = 64
export const MAX_NODE_HEIGHT = 480

export interface NodeSize {
  readonly width: number
  readonly height: number
}

/** 新建文档使用的预设兜底值 */
export const FALLBACK_DOCUMENT_DEFAULTS: DocumentDefaults = {
  nodeWidth: DEFAULT_NODE_WIDTH,
  nodeHeight: DEFAULT_NODE_HEIGHT,
  fontSize: DEFAULT_FONT_SIZE,
}

/** 解析节点的实际渲染尺寸；缺省时回落到文档预设，保证画布与导出包一致 */
export function resolveNodeSize(layout: NodeLayout, defaults: DocumentDefaults): NodeSize {
  return {
    width: layout.width ?? defaults.nodeWidth,
    height: layout.height ?? defaults.nodeHeight,
  }
}
