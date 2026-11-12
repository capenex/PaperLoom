import {
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
  resolveNodeSize,
} from '@/shared/lib/nodeDefaults'
import type { NodeSize } from '@/shared/lib/nodeDefaults'
import type { DocumentDefaults, NodeId, PaperDocument, PaperNode } from '@/shared/types/paper'

const WHEEL_RESIZE_SPEED = 0.001

/** 等比缩放节点尺寸：把整体倍率夹在宽高上下限内，保证不越界也不变形 */
export function scaleNodeSize(current: NodeSize, factor: number): NodeSize {
  const minFactor = Math.max(MIN_NODE_WIDTH / current.width, MIN_NODE_HEIGHT / current.height)
  const maxFactor = Math.min(MAX_NODE_WIDTH / current.width, MAX_NODE_HEIGHT / current.height)
  const clamped = Math.min(maxFactor, Math.max(minFactor, factor))
  return {
    width: Math.round(current.width * clamped),
    height: Math.round(current.height * clamped),
  }
}

/** 滚轮落点所属的图片节点；落在非图片节点或空白处返回 null */
export function imageNodeAt(target: EventTarget | null, document: PaperDocument): PaperNode | null {
  if (!(target instanceof Element)) return null
  const card = target.closest('[data-node-id]')
  if (card === null) return null
  const nodeId = card.getAttribute('data-node-id')
  if (nodeId === null) return null
  const node = document.nodes.find((item) => item.id === nodeId)
  if (node === undefined || node.content.kind !== 'image') return null
  return node
}

/** Ctrl/Cmd + 滚轮落在图片节点上时等比缩放该节点；返回是否已消费此次滚轮 */
export function resizeImageNodeOnWheel(
  event: WheelEvent,
  document: PaperDocument,
  defaults: DocumentDefaults,
  onResize: (nodeId: NodeId, size: NodeSize) => void,
): boolean {
  if (!event.ctrlKey && !event.metaKey) return false
  const node = imageNodeAt(event.target, document)
  if (node === null) return false
  const current = resolveNodeSize(node.layout, defaults)
  const factor = Math.exp(-event.deltaY * WHEEL_RESIZE_SPEED)
  onResize(node.id, scaleNodeSize(current, factor))
  return true
}