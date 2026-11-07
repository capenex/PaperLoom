import { useRef } from 'react'

import type { NodeId, PaperDocument, PaperReference } from '@/shared/types/paper'
import type { Point } from '../data/layout'
import { useDocumentLayout } from '../hooks/useDocumentLayout'
import { useNodeDrag } from '../hooks/useNodeDrag'
import { CanvasViewport } from './CanvasViewport'
import { EditorStage } from './EditorStage'

interface EditorCanvasProps {
  readonly document: PaperDocument
  readonly selectedNodeId: NodeId | null
  readonly editingNodeId: NodeId | null
  readonly expandedMediaNodeId: NodeId | null
  readonly onSelectNode: (nodeId: NodeId | null) => void
  readonly onStartEditing: (nodeId: NodeId) => void
  readonly onStopEditing: () => void
  readonly onUpdateContent: (nodeId: NodeId, richText: string) => void
  readonly onOpenMediaDetail: (nodeId: NodeId) => void
  readonly onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void
  readonly onOpenReferenceDetail: (reference: PaperReference) => void
  readonly onBackgroundClick: () => void
  readonly onBackgroundContextMenu: () => void
  readonly onMoveRoot: (nodeId: NodeId, anchor: Point) => void
  readonly onReparentNode: (nodeId: NodeId, targetId: NodeId) => void
  readonly onDetachAsRoot: (nodeId: NodeId, anchor: Point) => void
}

/** 画布区：装配布局、可平移缩放视口与 Alt 拖动的结构编辑 */
export function EditorCanvas(props: Readonly<EditorCanvasProps>) {
  const { document } = props
  const stageRef = useRef<HTMLDivElement | null>(null)
  const layout = useDocumentLayout(document)
  const drag = useNodeDrag({
    document,
    layout,
    stageRef,
    onMoveRoot: props.onMoveRoot,
    onReparentNode: props.onReparentNode,
    onDetachAsRoot: props.onDetachAsRoot,
  })

  return (
    <div className="relative min-w-0 flex-1">
      <CanvasViewport
        shouldIgnoreBackgroundClick={drag.shouldSuppressClick}
        onBackgroundClick={props.onBackgroundClick}
        onBackgroundContextMenu={props.onBackgroundContextMenu}
      >
        <EditorStage
          document={document}
          layout={layout}
          drag={drag}
          stageRef={stageRef}
          selectedNodeId={props.selectedNodeId}
          editingNodeId={props.editingNodeId}
          expandedMediaNodeId={props.expandedMediaNodeId}
          onSelectNode={props.onSelectNode}
          onStartEditing={props.onStartEditing}
          onUpdateContent={props.onUpdateContent}
          onStopEditing={props.onStopEditing}
          onOpenMediaDetail={props.onOpenMediaDetail}
          onOpenReferencePreview={props.onOpenReferencePreview}
          onOpenReferenceDetail={props.onOpenReferenceDetail}
        />
      </CanvasViewport>
    </div>
  )
}
