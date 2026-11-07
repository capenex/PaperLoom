import type { NodeId, PaperDocument, PaperReference } from '@/shared/types/paper'
import type { Point } from '../data/layout'
import { useReferencePreview } from '../hooks/useReferencePreview'
import { findDetailContent } from '../lib/detailContent'
import { DetailPanel } from './DetailPanel'
import { EditorCanvas } from './EditorCanvas'
import { ReferencePreviewPopup } from './ReferencePreviewPopup'

interface EditorProps {
  readonly document: PaperDocument
  readonly selectedNodeId: NodeId | null
  readonly editingNodeId: NodeId | null
  readonly expandedMediaNodeId: NodeId | null
  readonly detailMediaNodeId: NodeId | null
  readonly detailReference: PaperReference | null
  readonly onSelectNode: (nodeId: NodeId | null) => void
  readonly onStartEditing: (nodeId: NodeId) => void
  readonly onStopEditing: () => void
  readonly onUpdateContent: (nodeId: NodeId, richText: string) => void
  readonly onOpenMediaDetail: (nodeId: NodeId) => void
  readonly onOpenReferenceDetail: (reference: PaperReference) => void
  readonly onCollapseDetail: () => void
  readonly onCollapseExpandedMedia: () => void
  readonly onMoveRoot: (nodeId: NodeId, anchor: Point) => void
  readonly onReparentNode: (nodeId: NodeId, targetId: NodeId) => void
  readonly onDetachAsRoot: (nodeId: NodeId, anchor: Point) => void
}

/** 编辑器：画布 + 引用预览弹窗 + 右侧详情面板 */
export function Editor(props: Readonly<EditorProps>) {
  const { document } = props
  const preview = useReferencePreview(props.onOpenReferenceDetail)
  const detail = findDetailContent(document.nodes, props.detailMediaNodeId, props.detailReference)

  return (
    <div className="flex h-full w-full">
      <EditorCanvas
        document={document}
        selectedNodeId={props.selectedNodeId}
        editingNodeId={props.editingNodeId}
        expandedMediaNodeId={props.expandedMediaNodeId}
        onSelectNode={(nodeId) => {
          preview.closePreview()
          props.onSelectNode(nodeId)
        }}
        onStartEditing={props.onStartEditing}
        onStopEditing={props.onStopEditing}
        onUpdateContent={props.onUpdateContent}
        onOpenMediaDetail={props.onOpenMediaDetail}
        onOpenReferencePreview={preview.openPreview}
        onOpenReferenceDetail={preview.openDetail}
        onBackgroundClick={() => {
          preview.closePreview()
          props.onSelectNode(null)
        }}
        onBackgroundContextMenu={() => {
          preview.closePreview()
          props.onCollapseExpandedMedia()
        }}
        onMoveRoot={props.onMoveRoot}
        onReparentNode={props.onReparentNode}
        onDetachAsRoot={props.onDetachAsRoot}
      />
      {detail !== null && <DetailPanel detail={detail} onCollapse={props.onCollapseDetail} />}
      {preview.preview !== null && (
        <ReferencePreviewPopup
          preview={preview.preview}
          onOpenDetail={preview.openDetailFromPopup}
          onClose={preview.closePreview}
        />
      )}
    </div>
  )
}
