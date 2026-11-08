import type { RefObject } from 'react'

import type {
  CanvasId,
  DocumentDefaults,
  NodeEventAction,
  NodeId,
  PaperDocument,
  PaperNode,
  PaperReference,
} from '@/shared/types/paper'
import type { DocumentLayout, Point } from '../data/layout'
import { displaceLayoutForExpandedMedia } from '../data/mediaExpansionLayout'
import type { NodeDragControls } from '../hooks/useNodeDrag'
import { EditorConnections } from './EditorConnections'
import { EditorNode } from './EditorNode'
import { NodeEditWindow } from './NodeEditWindow'

interface EditorStageProps {
  readonly document: PaperDocument
  readonly layout: DocumentLayout
  readonly drag: NodeDragControls
  readonly stageRef: RefObject<HTMLDivElement | null>
  readonly activeCanvasId?: CanvasId | null | undefined
  readonly activeHostNodeId?: NodeId | null | undefined
  readonly selectedNodeId: NodeId | null
  readonly editingNodeId: NodeId | null
  readonly expandedMediaNodeId: NodeId | null
  readonly onSelectNode: (nodeId: NodeId | null) => void
  readonly onStartEditing: (nodeId: NodeId) => void
  readonly onUpdateContent: (nodeId: NodeId, richText: string) => void
  readonly onUpdateTitle: (nodeId: NodeId, title: string, subtitle: string) => void
  readonly onStopEditing: () => void
  readonly onTriggerEvent: (nodeId: NodeId, action: NodeEventAction) => void
  readonly onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void
  readonly onOpenReferenceDetail: (reference: PaperReference) => void
}

interface StageNodesProps {
  readonly nodes: readonly PaperNode[]
  readonly defaults: DocumentDefaults
  readonly positions: ReadonlyMap<NodeId, Point>
  readonly drag: NodeDragControls
  readonly activeCanvasId: CanvasId | null
  readonly activeHostNodeId: NodeId | null
  readonly selectedNodeId: NodeId | null
  readonly editingNodeId: NodeId | null
  readonly expandedMediaNodeId: NodeId | null
  readonly onSelectNode: (nodeId: NodeId | null) => void
  readonly onStartEditing: (nodeId: NodeId) => void
  readonly onTriggerEvent: (nodeId: NodeId, action: NodeEventAction) => void
  readonly onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void
  readonly onOpenReferenceDetail: (reference: PaperReference) => void
}

interface EditorEditLayerProps {
  readonly nodes: readonly PaperNode[]
  readonly defaults: DocumentDefaults
  readonly editingNodeId: NodeId | null
  readonly positions: ReadonlyMap<NodeId, Point>
  readonly onUpdateContent: (nodeId: NodeId, richText: string) => void
  readonly onUpdateTitle: (nodeId: NodeId, title: string, subtitle: string) => void
  readonly onClose: () => void
}

function EditorEditLayer({
  nodes,
  defaults,
  editingNodeId,
  positions,
  onUpdateContent,
  onUpdateTitle,
  onClose,
}: Readonly<EditorEditLayerProps>) {
  const node = nodes.find((item) => item.id === editingNodeId)
  if (node === undefined) return null
  if (node.content.kind !== 'text' && node.content.kind !== 'title') return null
  const position = positions.get(node.id)
  if (position === undefined) return null

  return (
    <NodeEditWindow
      key={node.id}
      content={node.content}
      layout={node.layout}
      position={position}
      defaults={defaults}
      onChangeText={(html) => {
        onUpdateContent(node.id, html)
      }}
      onChangeTitle={(title, subtitle) => {
        onUpdateTitle(node.id, title, subtitle)
      }}
      onClose={onClose}
    />
  )
}

function StageNodes(props: Readonly<StageNodesProps>) {
  const { nodes, defaults, positions, drag } = props
  const anyDragging = drag.draggingNodeId !== null
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
            selected={node.id === props.selectedNodeId}
            editing={node.id === props.editingNodeId}
            expanded={node.id === props.expandedMediaNodeId}
            activeCanvasId={props.activeCanvasId}
            isHostRoot={node.id === props.activeHostNodeId}
            dragging={dragging}
            anyDragging={anyDragging}
            dropTarget={drag.dropTargetId === node.id}
            detachHint={dragging && drag.overBlank && node.parentId !== null}
            onSelect={props.onSelectNode}
            onEdit={props.onStartEditing}
            onTriggerEvent={props.onTriggerEvent}
            onOpenReferencePreview={props.onOpenReferencePreview}
            onOpenReferenceDetail={props.onOpenReferenceDetail}
            onDragStart={drag.startDrag}
            shouldSuppressClick={drag.shouldSuppressClick}
          />
        )
      })}
    </>
  )
}

/** 拖动期间用预览位置替换真实布局；非拖动但存在放大图片时，自动推开周围节点 */
function viewLayoutOf(
  layout: DocumentLayout,
  preview: ReadonlyMap<NodeId, Point> | null,
  nodes: readonly PaperNode[],
  defaults: DocumentDefaults,
  expandedMediaNodeId: NodeId | null,
): DocumentLayout {
  if (preview !== null) return { ...layout, positions: preview }
  return displaceLayoutForExpandedMedia(layout, nodes, defaults, expandedMediaNodeId)
}

/** 舞台：按布局摆放连线与节点卡片；拖动期间整体呈现预览位置，图片放大时自动挤压周围节点 */
export function EditorStage({ stageRef, ...rest }: Readonly<EditorStageProps>) {
  const { document, layout, drag } = rest
  const viewLayout = viewLayoutOf(
    layout,
    drag.previewPositions,
    document.nodes,
    document.defaults,
    rest.expandedMediaNodeId,
  )

  return (
    <div
      ref={stageRef}
      className="relative m-auto shrink-0"
      style={{ width: viewLayout.width, height: viewLayout.height }}
    >
      <EditorConnections
        nodes={document.nodes}
        layout={viewLayout}
        defaults={document.defaults}
        expandedMediaNodeId={rest.expandedMediaNodeId}
      />
      <StageNodes
        {...rest}
        nodes={document.nodes}
        defaults={document.defaults}
        positions={viewLayout.positions}
        activeCanvasId={rest.activeCanvasId ?? null}
        activeHostNodeId={rest.activeHostNodeId ?? null}
      />
      <EditorEditLayer
        nodes={document.nodes}
        defaults={document.defaults}
        editingNodeId={rest.editingNodeId}
        positions={viewLayout.positions}
        onUpdateContent={rest.onUpdateContent}
        onUpdateTitle={rest.onUpdateTitle}
        onClose={rest.onStopEditing}
      />
    </div>
  )
}
