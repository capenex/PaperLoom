import { EXPANDED_MEDIA_SCALE, resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type { DocumentDefaults, NodeId, PaperNode } from '@/shared/types/paper'
import { computeConnectionGeometry } from '../data/connectionGeometry'
import type { DocumentLayout } from '../data/layout'

interface EditorConnectionsProps {
  readonly nodes: readonly PaperNode[]
  readonly layout: DocumentLayout
  readonly defaults: DocumentDefaults
  readonly expandedMediaNodeId?: NodeId | null
}

export function EditorConnections({
  nodes,
  layout,
  defaults,
  expandedMediaNodeId = null,
}: Readonly<EditorConnectionsProps>) {
  const widths = new Map<NodeId, number>()
  for (const node of nodes) {
    const baseWidth = resolveNodeSize(node.layout, defaults).width
    const isExpandedImage = node.id === expandedMediaNodeId && node.content.kind === 'image'
    widths.set(node.id, isExpandedImage ? baseWidth * EXPANDED_MEDIA_SCALE : baseWidth)
  }
  const { edges, bridges } = computeConnectionGeometry(nodes, layout.positions, widths)

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      aria-hidden="true"
    >
      {edges.map((edge) => (
        <g key={edge.key}>
          <path
            d={edge.path}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={edge.faded ? 0.1 : 0.42}
          />
          {edge.startDot && (
            <circle
              cx={edge.start.x}
              cy={edge.start.y}
              r={3}
              fill="var(--color-primary)"
              opacity={edge.faded ? 0.1 : 0.55}
            />
          )}
          {edge.endDot && (
            <circle
              cx={edge.end.x}
              cy={edge.end.y}
              r={3}
              fill="var(--color-primary)"
              opacity={edge.faded ? 0.1 : 0.75}
            />
          )}
        </g>
      ))}
      {bridges.map((bridge) => (
        <line
          key={`bridge:${bridge.key}`}
          x1={bridge.x1}
          y1={bridge.y}
          x2={bridge.x2}
          y2={bridge.y}
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.42}
        />
      ))}
    </svg>
  )
}
