import { EXPANDED_MEDIA_SCALE, resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type { DocumentDefaults, NodeId, PaperNode } from '@/shared/types/paper'
import type { DocumentLayout } from '../data/layout'

interface EditorConnectionsProps {
  readonly nodes: readonly PaperNode[]
  readonly layout: DocumentLayout
  readonly defaults: DocumentDefaults
  readonly expandedMediaNodeId?: NodeId | null
}

function renderConnectionEdge(
  node: PaperNode,
  parentId: NodeId,
  positions: DocumentLayout['positions'],
  widths: ReadonlyMap<NodeId, number>,
) {
  const source = positions.get(parentId)
  const target = positions.get(node.id)
  const parentWidth = widths.get(parentId)
  const childWidth = widths.get(node.id)
  if (
    source === undefined ||
    target === undefined ||
    parentWidth === undefined ||
    childWidth === undefined
  ) {
    return null
  }

  const startX = source.x + parentWidth / 2
  const endX = target.x - childWidth / 2
  const controlX = (startX + endX) / 2
  const path = `M ${startX} ${source.y} C ${controlX} ${source.y}, ${controlX} ${target.y}, ${endX} ${target.y}`

  return (
    <g key={`${node.id}:${parentId}`}>
      <path
        d={path}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.42}
      />
      <circle cx={startX} cy={source.y} r={3} fill="var(--color-primary)" opacity={0.55} />
      <circle cx={endX} cy={target.y} r={3} fill="var(--color-primary)" opacity={0.75} />
    </g>
  )
}

export function EditorConnections({
  nodes,
  layout,
  defaults,
  expandedMediaNodeId = null,
}: Readonly<EditorConnectionsProps>) {
  const widths = new Map<NodeId, number>()
  const present = new Set<NodeId>()
  for (const node of nodes) {
    const baseWidth = resolveNodeSize(node.layout, defaults).width
    const isExpandedImage = node.id === expandedMediaNodeId && node.content.kind === 'image'
    widths.set(node.id, isExpandedImage ? baseWidth * EXPANDED_MEDIA_SCALE : baseWidth)
    present.add(node.id)
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      aria-hidden="true"
    >
      {nodes.flatMap((node) =>
        node.parentIds
          .filter((parentId) => present.has(parentId))
          .map((parentId) => renderConnectionEdge(node, parentId, layout.positions, widths)),
      )}
    </svg>
  )
}
