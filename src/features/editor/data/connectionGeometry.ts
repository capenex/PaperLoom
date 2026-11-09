import type { NodeId, PaperNode } from '@/shared/types/paper'
import type { Point } from './layout'

export interface ConnectionEdge {
  readonly key: string
  readonly path: string
  readonly start: Point
  readonly end: Point
  /** 端点落在隐藏节点上时不画圆点，让进出线与贯通线接成一根 */
  readonly startDot: boolean
  readonly endDot: boolean
  readonly faded: boolean
}

/** 隐藏节点内部的水平贯通线：仅当两侧都有可见节点时出现，左边缘接进线、右边缘接出线 */
export interface ConnectionBridge {
  readonly key: string
  readonly y: number
  readonly x1: number
  readonly x2: number
}

export interface ConnectionGeometry {
  readonly edges: readonly ConnectionEdge[]
  readonly bridges: readonly ConnectionBridge[]
}

/** 父卡片右边缘到子卡片左边缘的三次贝塞尔；两端切线水平，可与贯通线平滑衔接 */
export function connectionPath(start: Point, end: Point): string {
  const controlX = (start.x + end.x) / 2
  return `M ${start.x} ${start.y} C ${controlX} ${start.y}, ${controlX} ${end.y}, ${end.x} ${end.y}`
}

export function computeConnectionGeometry(
  nodes: readonly PaperNode[],
  positions: ReadonlyMap<NodeId, Point>,
  widths: ReadonlyMap<NodeId, number>,
): ConnectionGeometry {
  const byId = new Map<NodeId, PaperNode>()
  for (const node of nodes) byId.set(node.id, node)

  const edges: ConnectionEdge[] = []
  const hasVisibleParent = new Set<NodeId>()
  const hasVisibleChild = new Set<NodeId>()
  for (const node of nodes) {
    for (const parentId of node.parentIds) {
      const parent = byId.get(parentId)
      if (parent === undefined) continue
      if (parent.isHidden !== true) hasVisibleParent.add(node.id)
      if (node.isHidden !== true) hasVisibleChild.add(parent.id)
    }
  }
  for (const node of nodes) {
    const target = positions.get(node.id)
    const childWidth = widths.get(node.id)
    if (target === undefined || childWidth === undefined) continue
    for (const parentId of node.parentIds) {
      const parent = byId.get(parentId)
      const source = positions.get(parentId)
      const parentWidth = widths.get(parentId)
      if (parent === undefined || source === undefined || parentWidth === undefined) continue
      const start = { x: source.x + parentWidth / 2, y: source.y }
      const end = { x: target.x - childWidth / 2, y: target.y }
      const faded =
        (parent.isHidden === true && (!hasVisibleParent.has(parent.id) || !hasVisibleChild.has(parent.id))) ||
        (node.isHidden === true && (!hasVisibleParent.has(node.id) || !hasVisibleChild.has(node.id)))
      edges.push({
        key: `${node.id}:${parentId}`,
        path: connectionPath(start, end),
        start,
        end,
        startDot: parent.isHidden !== true,
        endDot: node.isHidden !== true,
        faded,
      })
    }
  }

  const bridges: ConnectionBridge[] = []
  for (const node of nodes) {
    if (node.isHidden !== true || !hasVisibleParent.has(node.id) || !hasVisibleChild.has(node.id)) continue
    const center = positions.get(node.id)
    const width = widths.get(node.id)
    if (center === undefined || width === undefined) continue
    bridges.push({ key: node.id, y: center.y, x1: center.x - width / 2, x2: center.x + width / 2 })
  }
  return { edges, bridges }
}
