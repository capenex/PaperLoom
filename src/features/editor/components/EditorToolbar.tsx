import { useState } from 'react'
import type { ReactNode } from 'react'

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
import type { PendingNodeAction } from '../lib/pendingNodeAction'
import {
  INITIAL_RIBBON_STATE,
  doubleClickRibbonTab,
  selectRibbonTab,
  toggleRibbonCollapsed,
} from '../lib/ribbonToolbarState'
import {
  HomeRibbonPanel,
  InsertRibbonPanel,
  InteractionRibbonPanel,
  LayoutRibbonPanel,
} from './RibbonPanels'
import type { RibbonPanelSharedProps } from './RibbonPanels'
import { RibbonTabBar } from './RibbonPrimitives'

interface EditorToolbarProps {
  readonly brandSlot?: ReactNode
  readonly rightSlot?: ReactNode
  readonly selectedNode: PaperNode | undefined
  readonly defaults: DocumentDefaults
  readonly rootCount: number
  readonly activeCanvasId?: CanvasId | null
  readonly activeHostNodeId?: NodeId | null
  readonly onAddRoot: () => void
  readonly onUpdateDefaults: (patch: Partial<DocumentDefaults>) => void
  readonly onAddChild: (nodeId: NodeId) => void
  readonly onAddSibling: (nodeId: NodeId) => void
  readonly onDeleteNode: (nodeId: NodeId) => void
  readonly onChangeNodeKind: (nodeId: NodeId, kind: NodeContent['kind']) => void
  readonly onUpdateNodeTitle: (nodeId: NodeId, title: string, subtitle: string) => void
  readonly onUpdateNodeImage: (nodeId: NodeId, src: string, alt: string) => void
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
  readonly pending: PendingNodeAction | null
  readonly onArmStructure: () => void
  readonly onArmFit: () => void
}

function ActiveRibbonDeck({
  activeTab,
  panelProps,
}: Readonly<{
  activeTab: typeof INITIAL_RIBBON_STATE.activeTab
  panelProps: RibbonPanelSharedProps
}>) {
  if (activeTab === 'insert') return <InsertRibbonPanel {...panelProps} />
  if (activeTab === 'layout') return <LayoutRibbonPanel {...panelProps} />
  if (activeTab === 'interaction') return <InteractionRibbonPanel {...panelProps} />
  return <HomeRibbonPanel {...panelProps} />
}

/** PPT / WPS 式双层分类与可折叠编辑栏：顶层常驻分类选项卡与文件下拉菜单，下层按选项卡展示功能区 */
export function EditorToolbar({
  brandSlot,
  rightSlot,
  selectedNode,
  defaults,
  rootCount,
  activeCanvasId = null,
  activeHostNodeId = null,
  onAddRoot,
  onUpdateDefaults,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onChangeNodeKind,
  onUpdateNodeTitle,
  onUpdateNodeImage,
  onUpdateNodeFile,
  onUpdateLayout,
  onUpdateNodeEvents,
  onEnterSubCanvas,
  onEditNodeText,
  parents,
  onRemoveParent,
  onSetNodeHidden,
  pending,
  onArmStructure,
  onArmFit,
}: Readonly<EditorToolbarProps>) {
  const [ribbonState, setRibbonState] = useState(INITIAL_RIBBON_STATE)

  const panelProps: RibbonPanelSharedProps = {
    selectedNode,
    defaults,
    rootCount,
    activeCanvasId,
    activeHostNodeId,
    onAddRoot,
    onUpdateDefaults,
    onAddChild,
    onAddSibling,
    onDeleteNode,
    onChangeNodeKind,
    onUpdateNodeTitle,
    onUpdateNodeImage,
    onUpdateNodeFile,
    onUpdateLayout,
    onUpdateNodeEvents,
    onEnterSubCanvas,
    onEditNodeText,
    parents,
    onRemoveParent,
    onSetNodeHidden,
    pending,
    onArmStructure,
    onArmFit,
  }

  return (
    <div className="flex flex-col">
      <RibbonTabBar
        activeTab={ribbonState.activeTab}
        collapsed={ribbonState.collapsed}
        brandSlot={brandSlot}
        rightSlot={rightSlot}
        onSelectTab={(tab) => {
          setRibbonState((prev) => selectRibbonTab(prev, tab))
        }}
        onDoubleClickTab={(tab) => {
          setRibbonState((prev) => doubleClickRibbonTab(prev, tab))
        }}
        onToggleCollapsed={() => {
          setRibbonState((prev) => toggleRibbonCollapsed(prev))
        }}
      />
      {!ribbonState.collapsed && (
        <div
          role="tabpanel"
          aria-label="编辑栏功能区"
          className="flex h-[86px] items-center border-t border-slate-200/75 bg-slate-50/70 px-4"
        >
          <ActiveRibbonDeck activeTab={ribbonState.activeTab} panelProps={panelProps} />
        </div>
      )}
    </div>
  )
}
