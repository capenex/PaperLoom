import type { NodeContent, NodeId, PaperDocument, PaperNode } from '@/shared/types/paper'
import { layoutTree } from './layout'
import type { Point, TreeLayout } from './layout'
import { EditorConnections } from './EditorConnections'
import { EditorNode } from './EditorNode'
import { NodeEditWindow } from './NodeEditWindow'

interface EditorProps {
  readonly document: PaperDocument
  readonly selectedNodeId: NodeId | null
  readonly editingNodeId: NodeId | null
  readonly onSelectNode: (nodeId: NodeId | null) => void
  readonly onStartEditing: (nodeId: NodeId) => void
  readonly onStopEditing: () => void
  readonly onUpdateContent: (nodeId: NodeId, patch: Partial<NodeContent>) => void
}

interface EditorStageProps {
  readonly document: PaperDocument
  readonly layout: TreeLayout
  readonly selectedNodeId: NodeId | null
  readonly editingNodeId: NodeId | null
  readonly onSelectNode: (nodeId: NodeId | null) => void
  readonly onStartEditing: (nodeId: NodeId) => void
  readonly onUpdateContent: (nodeId: NodeId, patch: Partial<NodeContent>) => void
  readonly onStopEditing: () => void
}

interface EditorEditLayerProps {
  readonly nodes: readonly PaperNode[]
  readonly editingNodeId: NodeId | null
  readonly positions: ReadonlyMap<NodeId, Point>
  readonly onUpdateContent: (nodeId: NodeId, patch: Partial<NodeContent>) => void
  readonly onClose: () => void
}

function EditorEditLayer({
  nodes,
  editingNodeId,
  positions,
  onUpdateContent,
  onClose,
}: Readonly<EditorEditLayerProps>) {
  const node = nodes.find((item) => item.id === editingNodeId)
  if (node === undefined) return null
  const position = positions.get(node.id)
  if (position === undefined) return null

  return (
    <NodeEditWindow
      key={node.id}
      node={node}
      position={position}
      onChange={(html) => {
        onUpdateContent(node.id, { richText: html })
      }}
      onClose={onClose}
    />
  )
}

function EditorStage({
  document,
  layout,
  selectedNodeId,
  editingNodeId,
  onSelectNode,
  onStartEditing,
  onUpdateContent,
  onStopEditing,
}: Readonly<EditorStageProps>) {
  return (
    <div className="relative m-auto shrink-0" style={{ width: layout.width, height: layout.height }}>
      <EditorConnections nodes={document.nodes} layout={layout} />
      {document.nodes.map((node) => {
        const position = layout.positions.get(node.id)
        if (position === undefined) return null
        return (
          <EditorNode
            key={node.id}
            node={node}
            position={position}
            selected={node.id === selectedNodeId}
            editing={node.id === editingNodeId}
            onSelect={onSelectNode}
            onEdit={onStartEditing}
          />
        )
      })}
      <EditorEditLayer
        nodes={document.nodes}
        editingNodeId={editingNodeId}
        positions={layout.positions}
        onUpdateContent={onUpdateContent}
        onClose={onStopEditing}
      />
    </div>
  )
}

export function Editor({
  document,
  selectedNodeId,
  editingNodeId,
  onSelectNode,
  onStartEditing,
  onStopEditing,
  onUpdateContent,
}: Readonly<EditorProps>) {
  const layout = layoutTree(document.nodes, document.rootId)

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 画布空白处点击仅用于取消选中，键盘等价操作是 Escape
    <div
      role="application"
      aria-label="演示画布"
      className="absolute inset-0 overflow-auto"
      style={{
        backgroundColor: '#fbfcfe',
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      onClick={() => {
        onSelectNode(null)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        onSelectNode(null)
      }}
    >
      <div className="flex min-h-full min-w-full">
        <EditorStage
          document={document}
          layout={layout}
          selectedNodeId={selectedNodeId}
          editingNodeId={editingNodeId}
          onSelectNode={onSelectNode}
          onStartEditing={onStartEditing}
          onUpdateContent={onUpdateContent}
          onStopEditing={onStopEditing}
        />
      </div>
    </div>
  )
}
