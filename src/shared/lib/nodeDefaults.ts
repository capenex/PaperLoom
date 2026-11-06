import type { NodeLayout } from '@/shared/types/paper'

/** 节点未显式设置宽高时使用的默认尺寸 */
export const DEFAULT_NODE_WIDTH = 208
export const DEFAULT_NODE_HEIGHT = 112

/** 编辑栏允许的节点尺寸范围 */
export const MIN_NODE_WIDTH = 120
export const MAX_NODE_WIDTH = 640
export const MIN_NODE_HEIGHT = 64
export const MAX_NODE_HEIGHT = 480

export interface NodeSize {
  readonly width: number
  readonly height: number
}

/** 解析节点的实际渲染尺寸，缺省值集中在此处，保证画布与导出包一致 */
export function resolveNodeSize(layout: NodeLayout): NodeSize {
  return {
    width: layout.width ?? DEFAULT_NODE_WIDTH,
    height: layout.height ?? DEFAULT_NODE_HEIGHT,
  }
}
