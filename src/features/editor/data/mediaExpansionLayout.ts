/**
 * 多媒体（图片）节点放大时的周围节点挤压位移算法
 *
 * 当某张图片节点处于放大态（EXPANDED_MEDIA_SCALE = 3）时，
 * 保持该图片节点自身中心不动，自动将其左、右、上、下方的邻近节点与子树向外推开。
 */

import { EXPANDED_MEDIA_SCALE, resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type { DocumentDefaults, NodeId, PaperNode } from '@/shared/types/paper'
import { collectSubtreeIds } from './document'
import type { DocumentLayout, Point } from './layout'

const COLLISION_GAP = 24

function computeSubtreeVerticalShifts(
  nodes: readonly PaperNode[],
  positions: ReadonlyMap<NodeId, Point>,
  expandedNodeId: NodeId,
  center: Point,
  halfWidth: number,
  pushY: number,
): ReadonlyMap<NodeId, number> {
  const shifts = new Map<NodeId, number>()
  for (const node of nodes) {
    if (node.id === expandedNodeId) continue
    const pos = positions.get(node.id)
    if (pos === undefined || Math.abs(pos.x - center.x) >= halfWidth) continue

    const shiftY = pos.y < center.y ? -pushY : pushY
    for (const subtreeNodeId of collectSubtreeIds(nodes, node.id)) {
      if (subtreeNodeId !== expandedNodeId && !shifts.has(subtreeNodeId)) {
        shifts.set(subtreeNodeId, shiftY)
      }
    }
  }
  return shifts
}

function resolveResidualOverlap(
  point: Point,
  nodeWidth: number,
  nodeHeight: number,
  center: Point,
  expandedWidth: number,
  expandedHeight: number,
): Point {
  const minDistX = expandedWidth / 2 + nodeWidth / 2 + COLLISION_GAP
  const minDistY = expandedHeight / 2 + nodeHeight / 2 + COLLISION_GAP
  const dx = point.x - center.x
  const dy = point.y - center.y
  const overlapX = minDistX - Math.abs(dx)
  const overlapY = minDistY - Math.abs(dy)
  if (overlapX <= 0 || overlapY <= 0) return point

  if (overlapX < overlapY) {
    return { x: point.x + (dx < 0 ? -overlapX : overlapX), y: point.y }
  }
  return { x: point.x, y: point.y + (dy < 0 ? -overlapY : overlapY) }
}

/** 根据当前放大的多媒体节点，计算挤压周围节点后的画布布局（保持舞台尺寸与放大节点中心不变） */
export function displaceLayoutForExpandedMedia(
  baseLayout: DocumentLayout,
  nodes: readonly PaperNode[],
  defaults: DocumentDefaults,
  expandedNodeId: NodeId | null,
): DocumentLayout {
  if (expandedNodeId === null) return baseLayout
  const expandedNode = nodes.find((node) => node.id === expandedNodeId)
  if (expandedNode === undefined || expandedNode.content.kind !== 'image') return baseLayout
  const center = baseLayout.positions.get(expandedNodeId)
  if (center === undefined) return baseLayout

  const baseSize = resolveNodeSize(expandedNode.layout, defaults)
  const expW = baseSize.width * EXPANDED_MEDIA_SCALE
  const expH = baseSize.height * EXPANDED_MEDIA_SCALE
  const halfW = baseSize.width / 2
  const pushX = (expW - baseSize.width) / 2
  const pushY = (expH - baseSize.height) / 2
  const verticalShifts = computeSubtreeVerticalShifts(
    nodes,
    baseLayout.positions,
    expandedNodeId,
    center,
    halfW,
    pushY,
  )

  const positions = new Map<NodeId, Point>()
  for (const node of nodes) {
    const pos = baseLayout.positions.get(node.id)
    if (pos === undefined) continue
    if (node.id === expandedNodeId) {
      positions.set(node.id, pos)
      continue
    }
    const dx = pos.x - center.x
    const offsetX = dx <= -halfW ? -pushX : dx >= halfW ? pushX : 0
    const offsetY = verticalShifts.get(node.id) ?? 0
    const size = resolveNodeSize(node.layout, defaults)
    const shifted = { x: pos.x + offsetX, y: pos.y + offsetY }
    positions.set(node.id, resolveResidualOverlap(shifted, size.width, size.height, center, expW, expH))
  }

  return { ...baseLayout, positions }
}
