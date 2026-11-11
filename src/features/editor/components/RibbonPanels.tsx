import { Move, Scaling } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type {
  CanvasId,
  DocumentDefaults,
  ImageSlideItem,
  NodeContent,
  NodeEventBinding,
  NodeId,
  NodeLayout,
  PaperNode,
  StaticFileFormat,
} from '@/shared/types/paper'
import type { PendingNodeAction } from '../lib/pendingNodeAction'
import { DefaultsPresets } from './DocumentToolbar'
import { InlineNodeEventEditor } from './InlineNodeEventEditor'
import { NodeActions } from './NodeActions'
import { NodeSizeControls } from './NodeSizeControls'
import { NodeTypeControl } from './NodeTypeControl'
import { RibbonDivider, RibbonGroup } from './RibbonPrimitives'

export interface RibbonPanelSharedProps {
  readonly selectedNode: PaperNode | undefined
  readonly defaults: DocumentDefaults
  readonly rootCount: number
  readonly activeCanvasId: CanvasId | null
  readonly activeHostNodeId: NodeId | null
  readonly onAddRoot: () => void
  readonly onUpdateDefaults: (patch: Partial<DocumentDefaults>) => void
  readonly onAddChild: (nodeId: NodeId) => void
  readonly onAddSibling: (nodeId: NodeId) => void
  readonly onDeleteNode: (nodeId: NodeId) => void
  readonly onChangeNodeKind: (nodeId: NodeId, kind: NodeContent['kind']) => void
  readonly onUpdateNodeTitle: (nodeId: NodeId, title: string, subtitle: string) => void
  readonly onReplaceImagePage: (nodeId: NodeId, item: ImageSlideItem) => void
  readonly onAddImagePages: (nodeId: NodeId, items: readonly ImageSlideItem[]) => void
  readonly onDeleteImagePage: (nodeId: NodeId) => void
  readonly onMoveImagePage?: ((nodeId: NodeId, direction: 'left' | 'right') => void) | undefined
  readonly onCreateSlideForNode?: ((nodeId: NodeId) => void) | undefined
  readonly onEditSlidePath?: ((relPath: string) => void) | undefined
  readonly onUpdateNodeFile: (
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
  readonly onSetNodeHidden: (nodeId: NodeId, hidden: boolean) => void
  readonly watchlistNodeIds: readonly NodeId[]
  readonly watchlistNodes: readonly PaperNode[]
  readonly canvasNodes: readonly PaperNode[]
  readonly onToggleWatchlist: (nodeId: NodeId) => void
  readonly onArmEventTargetPick: (sourceNodeId: NodeId, bindingId: string) => void
  readonly pending: PendingNodeAction | null
  readonly onArmStructure: () => void
  readonly onArmFit: () => void
}

/** 画布工具双行按钮列：结构移动（上）+ 贴合内容（下） */
function PendingActionColumn({
  pending,
  onArmStructure,
  onArmFit,
}: Readonly<{
  pending: PendingNodeAction | null
  onArmStructure: () => void
  onArmFit: () => void
}>) {
  return (
    <div className="flex h-[70px] shrink-0 flex-col justify-between gap-1.5">
      <Button
        type="button"
        variant={pending?.kind === 'structure' ? 'default' : 'outline'}
        size="sm"
        className="h-8 w-full justify-start px-3 text-[13px]"
        onClick={onArmStructure}
      >
        <Move className="size-4" aria-hidden="true" />
        结构移动
      </Button>
      <Button
        type="button"
        variant={pending?.kind === 'fit' ? 'default' : 'outline'}
        size="sm"
        className="h-8 w-full justify-start px-3 text-[13px]"
        onClick={onArmFit}
      >
        <Scaling className="size-4" aria-hidden="true" />
        贴合内容
      </Button>
    </div>
  )
}

function SharedNodeActions({ props }: Readonly<{ props: RibbonPanelSharedProps }>) {
  const { selectedNode, rootCount, activeHostNodeId } = props
  const hasSelection = selectedNode !== undefined
  const isRoot = selectedNode === undefined || selectedNode.parentIds.length === 0
  const isHostRoot = selectedNode !== undefined && selectedNode.id === activeHostNodeId
  const canDelete = hasSelection && !isHostRoot && (!isRoot || rootCount > 1)

  return (
    <NodeActions
      hasSelection={hasSelection}
      isRoot={isRoot}
      canDelete={canDelete}
      hidden={selectedNode?.isHidden === true}
      onAddRoot={props.onAddRoot}
      onAddChild={() => {
        if (selectedNode !== undefined) props.onAddChild(selectedNode.id)
      }}
      onAddSibling={() => {
        if (selectedNode !== undefined) props.onAddSibling(selectedNode.id)
      }}
      onToggleHidden={() => {
        if (selectedNode !== undefined) {
          props.onSetNodeHidden(selectedNode.id, selectedNode.isHidden !== true)
        }
      }}
      onDelete={() => {
        if (selectedNode !== undefined) props.onDeleteNode(selectedNode.id)
      }}
    />
  )
}

function SharedNodeTypeControl({ props }: Readonly<{ props: RibbonPanelSharedProps }>) {
  const { selectedNode } = props
  return (
    <NodeTypeControl
      content={selectedNode?.content}
      onChangeKind={(kind) => {
        if (selectedNode !== undefined) props.onChangeNodeKind(selectedNode.id, kind)
      }}
      onUpdateTitle={(title, subtitle) => {
        if (selectedNode !== undefined) {
          props.onUpdateNodeTitle(selectedNode.id, title, subtitle)
        }
      }}
      onReplaceImagePage={(item) => {
        if (selectedNode !== undefined) props.onReplaceImagePage(selectedNode.id, item)
      }}
      onAddImagePages={(items) => {
        if (selectedNode !== undefined) props.onAddImagePages(selectedNode.id, items)
      }}
      onDeleteImagePage={() => {
        if (selectedNode !== undefined) props.onDeleteImagePage(selectedNode.id)
      }}
      onMoveImagePage={
        props.onMoveImagePage === undefined
          ? undefined
          : (direction) => {
              if (selectedNode !== undefined) props.onMoveImagePage?.(selectedNode.id, direction)
            }
      }
      onCreateSlideForNode={
        props.onCreateSlideForNode === undefined
          ? undefined
          : () => {
              if (selectedNode !== undefined) props.onCreateSlideForNode?.(selectedNode.id)
            }
      }
      onEditSlidePath={props.onEditSlidePath}
      onPickFile={(name, format, text) => {
        if (selectedNode !== undefined) {
          props.onUpdateNodeFile(selectedNode.id, name, format, text)
        }
      }}
      onEditText={() => {
        if (selectedNode !== undefined) props.onEditNodeText(selectedNode.id)
      }}
    />
  )
}

/** 「开始」选项卡：包含节点结构、画布工具与节点类型/内容 */
export function HomeRibbonPanel(props: Readonly<RibbonPanelSharedProps>) {
  return (
    <div className="flex h-[70px] items-stretch gap-3">
      <RibbonGroup>
        <SharedNodeActions props={props} />
      </RibbonGroup>
      <RibbonDivider />
      <RibbonGroup>
        <PendingActionColumn
          pending={props.pending}
          onArmStructure={props.onArmStructure}
          onArmFit={props.onArmFit}
        />
      </RibbonGroup>
      <RibbonDivider />
      <RibbonGroup>
        <SharedNodeTypeControl props={props} />
      </RibbonGroup>
    </div>
  )
}

/** 「插入与类型」选项卡：包含添加根/子/同级与隐藏/删除，以及节点类型/媒体替换 */
export function InsertRibbonPanel(props: Readonly<RibbonPanelSharedProps>) {
  return (
    <div className="flex h-[70px] items-stretch gap-3">
      <RibbonGroup>
        <SharedNodeActions props={props} />
      </RibbonGroup>
      <RibbonDivider />
      <RibbonGroup>
        <SharedNodeTypeControl props={props} />
      </RibbonGroup>
    </div>
  )
}

/** 「尺寸与布局」选项卡：当前节点尺寸（未选中时虚化）+ 自适应重排 + 文档全局预设 */
export function LayoutRibbonPanel(props: Readonly<RibbonPanelSharedProps>) {
  const { selectedNode, defaults } = props
  const size =
    selectedNode === undefined
      ? { width: defaults.nodeWidth, height: defaults.nodeHeight }
      : resolveNodeSize(selectedNode.layout, defaults)

  return (
    <div className="flex h-[70px] items-stretch gap-3">
      <RibbonGroup>
        <NodeSizeControls
          width={size.width}
          height={size.height}
          disabled={selectedNode === undefined}
          onWidthChange={(width) => {
            if (selectedNode !== undefined) props.onUpdateLayout(selectedNode.id, { width })
          }}
          onHeightChange={(height) => {
            if (selectedNode !== undefined) props.onUpdateLayout(selectedNode.id, { height })
          }}
        />
      </RibbonGroup>
      <RibbonDivider />
      <RibbonGroup>
        <PendingActionColumn
          pending={props.pending}
          onArmStructure={props.onArmStructure}
          onArmFit={props.onArmFit}
        />
      </RibbonGroup>
      <RibbonDivider />
      <RibbonGroup>
        <DefaultsPresets defaults={defaults} onUpdateDefaults={props.onUpdateDefaults} />
      </RibbonGroup>
    </div>
  )
}

/** 「交互与事件」选项卡：专注节点与引用事件编辑，将原事件弹窗整合进功能区 */
export function InteractionRibbonPanel(props: Readonly<RibbonPanelSharedProps>) {
  const { selectedNode, activeCanvasId, activeHostNodeId } = props
  const isHostRoot = selectedNode !== undefined && selectedNode.id === activeHostNodeId

  return (
    <InlineNodeEventEditor
      node={selectedNode}
      activeCanvasId={activeCanvasId}
      isHostRoot={isHostRoot}
      watchlistNodeIds={props.watchlistNodeIds}
      watchlistNodes={props.watchlistNodes}
      canvasNodes={props.canvasNodes}
      onToggleWatchlist={props.onToggleWatchlist}
      onArmEventTargetPick={props.onArmEventTargetPick}
      onUpdateEvents={(events) => {
        if (selectedNode !== undefined) props.onUpdateNodeEvents(selectedNode.id, events)
      }}
      onEnterSubCanvas={(canvasId) => {
        if (selectedNode !== undefined) props.onEnterSubCanvas(selectedNode.id, canvasId)
      }}
      onEditNodeText={() => {
        if (selectedNode !== undefined) props.onEditNodeText(selectedNode.id)
      }}
    />
  )
}
