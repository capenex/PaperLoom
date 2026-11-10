import { useRef } from 'react'

import type { NodeSize } from '@/shared/lib/nodeDefaults'
import type {
  BreadcrumbItem,
  CanvasId,
  ImageNodeContent,
  NodeEventAction,
  NodeId,
  PageSwitchMode,
  PaperDocument,
  PaperReference,
} from '@/shared/types/paper'
import type { AddImageNodeTarget } from '../data/document'
import { canAddParent } from '../data/document'
import type { Point } from '../data/layout'
import { useDocumentLayout } from '../hooks/useDocumentLayout'
import { useImagePasteDrop } from '../hooks/useImagePasteDrop'
import { useNodeDrag } from '../hooks/useNodeDrag'
import type { PendingNodeAction } from '../lib/pendingNodeAction'
import { CanvasBreadcrumbs } from './CanvasBreadcrumbs'
import { CanvasViewport } from './CanvasViewport'
import { EditorStage } from './EditorStage'

interface EditorCanvasProps {
  readonly document: PaperDocument
  readonly activeCanvasId?: CanvasId | null | undefined
  readonly activeHostNodeId?: NodeId | null | undefined
  readonly breadcrumbs?: readonly BreadcrumbItem[] | undefined
  readonly canPopSubCanvasWithEscape?: boolean | undefined
  readonly selectedNodeId: NodeId | null
  readonly editingNodeId: NodeId | null
  readonly expandedMediaNodeId: NodeId | null
  readonly onSelectNode: (nodeId: NodeId | null) => void
  readonly onStartEditing: (nodeId: NodeId) => void
  readonly onStopEditing: () => void
  readonly onUpdateContent: (nodeId: NodeId, richText: string) => void
  readonly onFitNodeSize: (nodeId: NodeId, size: NodeSize) => void
  readonly onSwitchNodePage: (nodeId: NodeId, mode: PageSwitchMode, pageIndex?: number) => void
  readonly onAddImage: (content: ImageNodeContent, target?: AddImageNodeTarget) => void
  readonly onTriggerEvent: (nodeId: NodeId, action: NodeEventAction) => void
  readonly onNavigateCanvas?: ((canvasId: CanvasId | null) => void) | undefined
  readonly onPopSubCanvas?: (() => void) | undefined
  readonly onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void
  readonly onOpenReferenceDetail: (reference: PaperReference) => void
  readonly onBackgroundClick: () => void
  readonly onBackgroundContextMenu: () => void
  readonly onCollapseDetail: () => void
  readonly onMoveRoot: (nodeId: NodeId, anchor: Point) => void
  readonly onAddParent: (nodeId: NodeId, targetId: NodeId) => void
  readonly onDetachAsRoot: (nodeId: NodeId, anchor: Point) => void
  readonly pending: PendingNodeAction | null
  readonly onPendingNodeClick: (nodeId: NodeId) => boolean
  readonly onPendingBackground: (worldPoint: Point | null) => boolean
  readonly onPendingCancel: () => void
}

const EMPTY_TARGETS: ReadonlySet<NodeId> = new Set()

function pendingHint(pending: PendingNodeAction): string {
  if (pending.kind === 'fit') return '贴合内容：点击一个节点按内容自适应尺寸；右键 / Esc 取消'
  if (pending.kind === 'pick-event-target') {
    return '点击画布上的目标节点以绑定联动；右键 / Esc 取消'
  }
  return pending.sourceId === null
    ? '结构移动：先点击源节点，再点击目标节点或空白；右键 / Esc 取消'
    : '结构移动：点击目标节点追加父节点，点击空白按点击处脱离为根；右键 / Esc 取消'
}

function PendingHintBanner({ pending }: Readonly<{ pending: PendingNodeAction }>) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute top-3 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-primary/30 bg-white/95 px-4 py-2 text-xs font-medium text-primary shadow-md"
    >
      {pendingHint(pending)}
    </div>
  )
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

function resolveFocusTarget(
  document: PaperDocument,
  editingNodeId: NodeId | null,
  layout: ReturnType<typeof useDocumentLayout>,
) {
  if (editingNodeId === null) return null
  const node = document.nodes.find((item) => item.id === editingNodeId)
  if (node?.content.kind !== 'text') return null
  const position = layout.positions.get(editingNodeId)
  if (position === undefined) return null
  return {
    key: editingNodeId,
    x: position.x,
    y: position.y,
    stageWidth: layout.width,
    stageHeight: layout.height,
  }
}

/** 待命指令期的点击拦截与合法目标高亮；非待命期原样透传 */
function pendingInterception(props: Readonly<EditorCanvasProps>, document: PaperDocument) {
  const pendingSource = props.pending?.kind === 'structure' ? props.pending.sourceId : null
  const extraDropTargets =
    pendingSource === null
      ? EMPTY_TARGETS
      : new Set(
          document.nodes
            .filter((node) => canAddParent(document, pendingSource, node.id))
            .map((node) => node.id),
        )
  const handleSelectNode = (nodeId: NodeId | null): void => {
    if (nodeId !== null && props.pending !== null && props.onPendingNodeClick(nodeId)) return
    props.onSelectNode(nodeId)
  }
  const handleBackgroundClick = (
    _screen: { readonly x: number; readonly y: number },
    world: { readonly x: number; readonly y: number },
  ): void => {
    if (props.pending !== null) {
      props.onPendingBackground(world)
      return
    }
    props.onBackgroundClick()
  }
  const handleEscape = (): void => {
    if (props.pending !== null) {
      props.onPendingBackground(null)
      return
    }
    props.onCollapseDetail()
    props.onBackgroundClick()
  }
  return { extraDropTargets, handleSelectNode, handleBackgroundClick, handleEscape }
}

/** 画布区：装配布局、支线面包屑导航、可平移缩放视口、Alt 拖动结构编辑与图片粘贴/拖入 */
export function EditorCanvas(props: Readonly<EditorCanvasProps>) {
  const { document } = props
  const stageRef = useRef<HTMLDivElement | null>(null)
  const layout = useDocumentLayout(document)
  const drag = useNodeDrag({ ...props, document, layout, stageRef })
  const imagePasteDrop = useImagePasteDrop({ ...props, layout, stageRef })
  const focusTarget = resolveFocusTarget(document, props.editingNodeId, layout)
  const hostId = props.activeHostNodeId ?? null
  const hostPosition = hostId === null ? undefined : layout.positions.get(hostId)
  const entryTarget =
    hostPosition === undefined
      ? null
      : {
          x: hostPosition.x,
          y: hostPosition.y,
          stageWidth: layout.width,
          stageHeight: layout.height,
        }
  const { extraDropTargets, handleSelectNode, handleBackgroundClick, handleEscape } =
    pendingInterception(props, document)

  return (
    <div
      className="relative min-w-0 flex-1"
      onDragOver={imagePasteDrop.onDragOver}
      onDragLeave={imagePasteDrop.onDragLeave}
      onDrop={imagePasteDrop.onDrop}
      onContextMenuCapture={(event) => {
        if (props.pending === null) return
        event.preventDefault()
        event.stopPropagation()
        props.onPendingCancel()
      }}
    >
      {props.breadcrumbs !== undefined &&
        props.breadcrumbs.length > 0 &&
        props.onNavigateCanvas !== undefined &&
        props.onPopSubCanvas !== undefined && (
          <CanvasBreadcrumbs
            breadcrumbs={props.breadcrumbs}
            canPopWithEscape={Boolean(props.canPopSubCanvasWithEscape)}
            onNavigate={props.onNavigateCanvas}
            onPop={props.onPopSubCanvas}
          />
        )}
      <CanvasViewport
        focusTarget={focusTarget}
        canvasKey={props.activeCanvasId ?? 'main'}
        entryTarget={entryTarget}
        stageSize={{ width: layout.width, height: layout.height }}
        shouldIgnoreBackgroundClick={drag.shouldSuppressClick}
        onBackgroundClick={handleBackgroundClick}
        onEscape={handleEscape}
        onBackgroundContextMenu={props.onBackgroundContextMenu}
      >
        <EditorStage
          {...props}
          document={document}
          layout={layout}
          drag={drag}
          stageRef={stageRef}
          onSelectNode={handleSelectNode}
          extraDropTargets={extraDropTargets}
        />
      </CanvasViewport>
      {props.pending !== null && <PendingHintBanner pending={props.pending} />}
      {imagePasteDrop.fileDropping && <DropHintBanner />}
    </div>
  )
}
