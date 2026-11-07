import { useRef } from 'react'

import type {
  ImageNodeContent,
  NodeId,
  PaperDocument,
  PaperReference,
} from '@/shared/types/paper'
import type { AddImageNodeTarget } from '../data/document'
import type { Point } from '../data/layout'
import { useDocumentLayout } from '../hooks/useDocumentLayout'
import { useImagePasteDrop } from '../hooks/useImagePasteDrop'
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
  readonly onUpdateTitle: (nodeId: NodeId, title: string, subtitle: string) => void
  readonly onAddImage: (content: ImageNodeContent, target?: AddImageNodeTarget) => void
  readonly onOpenMediaDetail: (nodeId: NodeId) => void
  readonly onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void
  readonly onOpenReferenceDetail: (reference: PaperReference) => void
  readonly onBackgroundClick: () => void
  readonly onBackgroundContextMenu: () => void
  readonly onMoveRoot: (nodeId: NodeId, anchor: Point) => void
  readonly onReparentNode: (nodeId: NodeId, targetId: NodeId) => void
  readonly onDetachAsRoot: (nodeId: NodeId, anchor: Point) => void
}

function DropHintBanner() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5 backdrop-blur-[1px]"
    >
      <span className="rounded-lg border border-primary/20 bg-white/95 px-4 py-2 text-xs font-medium text-primary shadow-md">
        释放图片以创建多媒体节点（存入 res/inbox/）
      </span>
    </div>
  )
}

/** 画布区：装配布局、可平移缩放视口、Alt 拖动结构编辑与图片粘贴/拖入创建多媒体节点 */
export function EditorCanvas(props: Readonly<EditorCanvasProps>) {
  const { document } = props
  const stageRef = useRef<HTMLDivElement | null>(null)
  const layout = useDocumentLayout(document)
  const drag = useNodeDrag({ ...props, document, layout, stageRef })
  const imagePasteDrop = useImagePasteDrop({ ...props, layout, stageRef })

  return (
    <div
      className="relative min-w-0 flex-1"
      onDragOver={imagePasteDrop.onDragOver}
      onDragLeave={imagePasteDrop.onDragLeave}
      onDrop={imagePasteDrop.onDrop}
    >
      <CanvasViewport
        shouldIgnoreBackgroundClick={drag.shouldSuppressClick}
        onBackgroundClick={props.onBackgroundClick}
        onBackgroundContextMenu={props.onBackgroundContextMenu}
      >
        <EditorStage
          {...props}
          document={document}
          layout={layout}
          drag={drag}
          stageRef={stageRef}
        />
      </CanvasViewport>
      {imagePasteDrop.fileDropping && <DropHintBanner />}
    </div>
  )
}
