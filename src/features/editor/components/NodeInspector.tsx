import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type {
  CanvasId,
  DocumentDefaults,
  NodeContent,
  NodeEventBinding,
  NodeId,
  NodeLayout,
  PaperNode,
  StaticFileFormat,
} from '@/shared/types/paper'
import { plainTextFromHtml } from '../lib/richText'
import { NodeActions } from './NodeActions'
import { NodeEventControl } from './NodeEventControl'
import { NodeSizeControls } from './NodeSizeControls'
import { NodeTypeControl } from './NodeTypeControl'

interface NodeInspectorProps {
  readonly node: PaperNode
  readonly defaults: DocumentDefaults
  readonly rootCount: number
  readonly activeCanvasId: CanvasId | null
  readonly isHostRoot: boolean
  readonly onAddRoot: () => void
  readonly onAddChild: (nodeId: NodeId) => void
  readonly onAddSibling: (nodeId: NodeId) => void
  readonly onDelete: (nodeId: NodeId) => void
  readonly onChangeKind: (nodeId: NodeId, kind: NodeContent['kind']) => void
  readonly onUpdateTitle: (nodeId: NodeId, title: string, subtitle: string) => void
  readonly onUpdateImage: (nodeId: NodeId, src: string, alt: string) => void
  readonly onUpdateFile: (
    nodeId: NodeId,
    fileName: string,
    format: StaticFileFormat,
    text: string,
  ) => void
  readonly onUpdateLayout: (nodeId: NodeId, patch: Partial<NodeLayout>) => void
  readonly onUpdateNodeEvents: (nodeId: NodeId, events: readonly NodeEventBinding[]) => void
  readonly onEnterSubCanvas: (nodeId: NodeId, canvasId: CanvasId) => void
  readonly onEditNodeText: (nodeId: NodeId) => void
  readonly parents: readonly PaperNode[]
  readonly onRemoveParent: (nodeId: NodeId, parentId: NodeId) => void
  readonly onSetHidden: (nodeId: NodeId, hidden: boolean) => void
}

function parentLabel(parent: PaperNode): string {
  const content = parent.content
  if (content.kind === 'title') return content.title || '标题节点'
  if (content.kind === 'file') return content.fileName
  if (content.kind === 'image') return content.alt || '图片节点'
  return plainTextFromHtml(content.richText).slice(0, 12) || '空白节点'
}

/** 多父节点父列表（固定 h-6 高度）：未选中或无父节点时展示虚化占位，保证编辑栏高度恒定 */
export function ParentChips({
  node,
  parents,
  onRemoveParent,
}: Readonly<{
  node: PaperNode | undefined
  parents: readonly PaperNode[]
  onRemoveParent: (nodeId: NodeId, parentId: NodeId) => void
}>) {
  if (node === undefined || parents.length === 0) {
    return (
      <div className="flex h-6 items-center gap-1 opacity-45 select-none">
        <span className="text-[11px] text-slate-400">父节点</span>
        <span className="inline-flex h-5 items-center rounded border border-slate-200 bg-slate-100/70 px-1.5 text-[11px] text-slate-500">
          {node === undefined ? '未选中节点' : '无（当前为根节点）'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex h-6 items-center gap-1">
      <span className="text-[11px] text-slate-400">父节点</span>
      {parents.map((parent) => (
        <span
          key={parent.id}
          className="inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-white px-1.5 text-[11px] text-slate-600 shadow-2xs"
        >
          {parentLabel(parent)}
          <button
            type="button"
            aria-label={`移除父节点 ${parentLabel(parent)}`}
            title="移除该父节点（删到空则升为根节点）"
            className="cursor-pointer text-slate-400 hover:text-red-500"
            onClick={() => {
              onRemoveParent(node.id, parent.id)
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}

export function NodeInspector(props: Readonly<NodeInspectorProps>) {
  const { node, defaults, rootCount, isHostRoot } = props
  const size = resolveNodeSize(node.layout, defaults)
  const isRoot = node.parentIds.length === 0
  const canDelete = !isHostRoot && (!isRoot || rootCount > 1)

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <NodeActions
        hasSelection
        isRoot={isRoot}
        canDelete={canDelete}
        hidden={node.isHidden === true}
        onAddRoot={props.onAddRoot}
        onAddChild={() => {
          props.onAddChild(node.id)
        }}
        onAddSibling={() => {
          props.onAddSibling(node.id)
        }}
        onToggleHidden={() => {
          props.onSetHidden(node.id, node.isHidden !== true)
        }}
        onDelete={() => {
          props.onDelete(node.id)
        }}
      />
      <NodeTypeControl
        content={node.content}
        onChangeKind={(kind) => {
          props.onChangeKind(node.id, kind)
        }}
        onUpdateTitle={(title, subtitle) => {
          props.onUpdateTitle(node.id, title, subtitle)
        }}
        onPickImage={(src, alt) => {
          props.onUpdateImage(node.id, src, alt)
        }}
        onPickFile={(name, format, text) => {
          props.onUpdateFile(node.id, name, format, text)
        }}
      />
      <NodeEventControl
        node={node}
        activeCanvasId={props.activeCanvasId}
        isHostRoot={props.isHostRoot}
        onUpdateEvents={(events) => {
          props.onUpdateNodeEvents(node.id, events)
        }}
        onEnterSubCanvas={(canvasId) => {
          props.onEnterSubCanvas(node.id, canvasId)
        }}
        onEditNodeText={() => {
          props.onEditNodeText(node.id)
        }}
      />
      <NodeSizeControls
        width={size.width}
        height={size.height}
        onWidthChange={(width) => {
          props.onUpdateLayout(node.id, { width })
        }}
        onHeightChange={(height) => {
          props.onUpdateLayout(node.id, { height })
        }}
      />
    </div>
  )
}
