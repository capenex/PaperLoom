import type { ReactNode } from 'react'

import type { InboxEntry } from '@/shared/lib/inbox'
import type { NodeSize } from '@/shared/lib/nodeDefaults'
import { findTriggeredEvent } from '@/shared/lib/nodeEvents'
import type {
  BreadcrumbItem,
  CanvasId,
  FileNodeContent,
  ImageNodeContent,
  ImageSlideItem,
  NodeEventAction,
  NodeId,
  PageSwitchMode,
  PaperDocument,
  PaperReference,
  StaticFileFormat,
} from '@/shared/types/paper'
import type { AddImageNodeTarget } from '../data/document'
import type { Point } from '../data/layout'
import { useReferencePreview } from '../hooks/useReferencePreview'
import { findDetailContent } from '../lib/detailContent'
import type { DetailContent } from '../lib/detailContent'
import type { PendingNodeAction } from '../lib/pendingNodeAction'
import { DetailPanel } from './DetailPanel'
import { EditorCanvas } from './EditorCanvas'
import { ReferencePreviewPopup } from './ReferencePreviewPopup'

interface EditorProps {
  readonly document: PaperDocument
  readonly filePoolSlot?: ReactNode
  readonly activeCanvasId?: CanvasId | null | undefined
  readonly activeHostNodeId?: NodeId | null | undefined
  readonly breadcrumbs?: readonly BreadcrumbItem[] | undefined
  readonly selectedNodeId: NodeId | null
  readonly editingNodeId: NodeId | null
  readonly expandedMediaNodeId: NodeId | null
  readonly detailMediaNodeId: NodeId | null
  readonly detailReference: PaperReference | null
  readonly detailCustom?: DetailContent | null | undefined
  readonly inboxEntries?: readonly InboxEntry[] | undefined
  readonly currentInboxFolder?: string | undefined
  readonly onRefreshInbox?: (() => Promise<void>) | undefined
  readonly onSelectNode: (nodeId: NodeId | null) => void
  readonly onStartEditing: (nodeId: NodeId) => void
  readonly onStopEditing: () => void
  readonly onUpdateContent: (nodeId: NodeId, richText: string) => void
  readonly onFitNodeSize: (nodeId: NodeId, size: NodeSize) => void
  readonly onSwitchNodePage: (nodeId: NodeId, mode: PageSwitchMode, pageIndex?: number) => void
  readonly onAddImage: (content: ImageNodeContent, target?: AddImageNodeTarget) => void
  readonly onAddImagePages?: ((nodeId: NodeId, items: readonly ImageSlideItem[]) => void) | undefined
  readonly onReplaceImagePage?: ((nodeId: NodeId, item: ImageSlideItem) => void) | undefined
  readonly onAddFile?: ((content: FileNodeContent, target?: AddImageNodeTarget) => void) | undefined
  readonly onUpdateFile?:
    | ((nodeId: NodeId, fileName: string, format: StaticFileFormat, text: string) => void)
    | undefined
  readonly onAddRichText?: ((richText: string, target?: AddImageNodeTarget) => void) | undefined
  readonly onTriggerEvent: (nodeId: NodeId, action: NodeEventAction) => void
  readonly onNavigateCanvas?: ((canvasId: CanvasId | null) => void) | undefined
  readonly onPopSubCanvas?: (() => void) | undefined
  readonly onOpenMediaDetail: (nodeId: NodeId) => void
  readonly onOpenReferenceDetail: (reference: PaperReference) => void
  readonly onCollapseDetail: () => void
  readonly onCollapseExpandedMedia: () => void
  readonly onMoveRoot: (nodeId: NodeId, anchor: Point) => void
  readonly onAddParent: (nodeId: NodeId, targetId: NodeId) => void
  readonly onDetachAsRoot: (nodeId: NodeId, anchor: Point) => void
  readonly pending: PendingNodeAction | null
  readonly onPendingNodeClick: (nodeId: NodeId) => boolean
  readonly onPendingBackground: (worldPoint: Point | null) => boolean
  readonly onPendingCancel: () => void
}

/** 触发预览小窗上的绑定事件（target = 'reference-popup'） */
function dispatchPopupEvent(
  nodes: readonly PaperDocument['nodes'][number][],
  nodeId: NodeId | undefined,
  trigger: 'click' | 'double-click',
  activeCanvasId: CanvasId | null,
  activeHostNodeId: NodeId | null,
  openDetailFromPopup: () => void,
  closePreview: () => void,
  onTriggerEvent: (nodeId: NodeId, action: NodeEventAction) => void,
): void {
  if (nodeId === undefined) {
    if (trigger === 'click') openDetailFromPopup()
    return
  }
  const sourceNode = nodes.find((item) => item.id === nodeId)
  if (sourceNode === undefined) {
    if (trigger === 'click') openDetailFromPopup()
    return
  }
  const binding = findTriggeredEvent(
    sourceNode,
    trigger,
    activeCanvasId,
    'reference-popup',
    activeHostNodeId,
  )
  if (binding === undefined) return
  if (binding.action.type === 'open-detail') {
    openDetailFromPopup()
  } else if (binding.action.type !== 'open-reference-preview') {
    closePreview()
    onTriggerEvent(sourceNode.id, binding.action)
  }
}

/** 编辑器：左栏详情视图 + 画布 + 引用预览弹窗 */
export function Editor(props: Readonly<EditorProps>) {
  const { document } = props
  const preview = useReferencePreview(props.onOpenReferenceDetail)
  const detail = findDetailContent(
    document.nodes,
    props.detailMediaNodeId,
    props.detailReference,
    props.detailCustom ?? null,
  )
  const canPopWithEsc =
    props.editingNodeId === null && detail === null && preview.preview === null
  const firePopup = (trigger: 'click' | 'double-click'): void => {
    dispatchPopupEvent(
      document.nodes,
      preview.preview?.nodeId,
      trigger,
      props.activeCanvasId ?? null,
      props.activeHostNodeId ?? null,
      preview.openDetailFromPopup,
      preview.closePreview,
      props.onTriggerEvent,
    )
  }

  return (
    <div className="flex h-full w-full">
      {detail !== null && <DetailPanel detail={detail} onCollapse={props.onCollapseDetail} />}
      <div className="relative flex min-w-0 flex-1">
        {props.filePoolSlot}
        <EditorCanvas
          {...props}
          canPopSubCanvasWithEscape={canPopWithEsc}
          onSelectNode={(nodeId) => {
            preview.closePreview()
            props.onSelectNode(nodeId)
          }}
          onTriggerEvent={(nodeId, action) => {
            preview.closePreview()
            props.onTriggerEvent(nodeId, action)
          }}
          onOpenReferencePreview={preview.openPreview}
          onOpenReferenceDetail={preview.openDetail}
          onBackgroundClick={() => {
            preview.closePreview()
            props.onSelectNode(null)
          }}
          onBackgroundContextMenu={() => {
            preview.closePreview()
            props.onCollapseExpandedMedia()
            props.onCollapseDetail()
          }}
        />
      </div>
      {preview.preview !== null && (
        <ReferencePreviewPopup
          preview={preview.preview}
          onOpenDetail={() => {
            firePopup('click')
          }}
          onDoubleClickDetail={() => {
            firePopup('double-click')
          }}
          onClose={preview.closePreview}
        />
      )}
    </div>
  )
}
