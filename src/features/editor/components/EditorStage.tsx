import type { RefObject } from 'react'

import type { DocumentDefaults, NodeId, PaperDocument, PaperNode, PaperReference } from '@/shared/types/paper'
import type { DocumentLayout, Point } from '../data/layout'
import type { NodeDragControls } from '../hooks/useNodeDrag'
import { EditorConnections } from './EditorConnections'
import { EditorNode } from './EditorNode'
import { NodeEditWindow } from './NodeEditWindow'

interface EditorStageProps {
  readonly document: PaperDocument
  readonly layout: DocumentLayout
  readonly drag: NodeDragControls
  readonly stageRef: RefObject<HTMLDivElement | null>
  readonly selectedNodeId: NodeId | null
  readonly editingNodeId: NodeId | null
  readonly expandedMediaNodeId: NodeId | null
  readonly onSelectNode: (nodeId: NodeId | null) => void
  readonly onStartEditing: (nodeId: NodeId) => void
  readonly onUpdateContent: (nodeId: NodeId, richText: string) => void
  readonly onStopEditing: () => void
  readonly onOpenMediaDetail: (nodeId: NodeId) => void
  readonly onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void
  readonly onOpenReferenceDetail: (reference: PaperReference) => void
}

interface StageNodesProps {
  readonly nodes: readonly PaperNode[]
  readonly defaults: DocumentDefaults
  readonly positions: ReadonlyMap<NodeId, Point>
  readonly drag: NodeDragControls
  readonly selectedNodeId: NodeId | null
  readonly editingNodeId: NodeId | null
  readonly expandedMediaNodeId: NodeId | null
  readonly onSelectNode: (nodeId: NodeId | null) => void
  readonly onStartEditing: (nodeId: NodeId) => void
  readonly onOpenMediaDetail: (nodeId: NodeId) => void
  readonly onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void
  readonly onOpenReferenceDetail: (reference: PaperReference) => void
}

interface EditorEditLayerProps {
  readonly nodes: readonly PaperNode[]
  readonly defaults: DocumentDefaults
  readonly editingNodeId: NodeId | null
  readonly positions: ReadonlyMap<NodeId, Point>
  readonly onUpdateContent: (nodeId: NodeId, richText: string) => void
  readonly onClose: () => void
}

function EditorEditLayer({
  nodes,
  defaults,
  editingNodeId,
  positions,
  onUpdateContent,
  onClose,
}: Readonly<EditorEditLayerProps>) {
  const node = nodes.find((item) => item.id === editingNodeId)
  if (node === undefined || node.content.kind !== 'text') return null
  const position = positions.get(node.id)
  if (position === undefined) return null

  return (
    <NodeEditWindow
      key={node.id}
      content={node.content}
      layout={node.layout}
      position={position}
      defaults={defaults}
      onChange={(html) => {
        onUpdateContent(node.id, html)
      }}
      onClose={onClose}
    />
  )
}

function StageNodes({
  nodes,
  defaults,
  positions,
  drag,
  selectedNodeId,
  editingNodeId,
  expandedMediaNodeId,
  onSelectNode,
  onStartEditing,
  onOpenMediaDetail,
  onOpenReferencePreview,
  onOpenReferenceDetail,
}: Readonly<StageNodesProps>) {
  return (
    <>
      {nodes.map((node) => {
        const position = positions.get(node.id)
        if (position === undefined) return null
        const dragging = drag.draggingNodeId === node.id
        return (
          <EditorNode
            key={node.id}
            node={node}
            position={position}
            defaults={defaults}
            selected={node.id === selectedNodeId}
            editing={node.id === editingNodeId}
            expanded={node.id === expandedMediaNodeId}
            dragging={dragging}
            dropTarget={drag.dropTargetId === node.id}
            detachHint={dragging && drag.overBlank && node.parentId !== null}
            onSelect={onSelectNode}
            onEdit={onStartEditing}
            onOpenMediaDetail={onOpenMediaDetail}
            onOpenReferencePreview={onOpenReferencePreview}
            onOpenReferenceDetail={onOpenReferenceDetail}
            onDragStart={drag.startDrag}
            shouldSuppressClick={drag.shouldSuppressClick}
          />
        )
      })}
    </>
  )
}

/** 拖动期间用预览位置替换真实布局，其余时候原样呈现 */
function viewLayoutOf(
  layout: DocumentLayout,
  preview: ReadonlyMap<NodeId, Point> | null,
): DocumentLayout {
  return preview === null ? layout : { ...layout, positions: preview }
}

/** 舞台：按布局摆放连线与节点卡片；拖动期间整体呈现预览位置，其余时候呈现真实布局 */
export function EditorStage({
  document,
  layout,
  drag,
  stageRef,
  selectedNodeId,
  editingNodeId,
  expandedMediaNodeId,
  onSelectNode,
  onStartEditing,
  onUpdateContent,
  onStopEditing,
  onOpenMediaDetail,
  onOpenReferencePreview,
  onOpenReferenceDetail,
}: Readonly<EditorStageProps>) {
  const viewLayout = viewLayoutOf(layout, drag.previewPositions)

  return (
    <div
      ref={stageRef}
      className="relative m-auto shrink-0"
      style={{ width: layout.width, height: layout.height }}
    >
      <EditorConnections nodes={document.nodes} layout={viewLayout} defaults={document.defaults} />
      <StageNodes
        nodes={document.nodes}
        defaults={document.defaults}
        positions={viewLayout.positions}
        drag={drag}
        selectedNodeId={selectedNodeId}
        editingNodeId={editingNodeId}
        expandedMediaNodeId={expandedMediaNodeId}
        onSelectNode={onSelectNode}
        onStartEditing={onStartEditing}
        onOpenMediaDetail={onOpenMediaDetail}
        onOpenReferencePreview={onOpenReferencePreview}
        onOpenReferenceDetail={onOpenReferenceDetail}
      />
      <EditorEditLayer
        nodes={document.nodes}
        defaults={document.defaults}
        editingNodeId={editingNodeId}
        positions={layout.positions}
        onUpdateContent={onUpdateContent}
        onClose={onStopEditing}
      />
    </div>
  )
}
