import { useState } from 'react'
import { GitBranch, Pencil, Plus, RotateCcw } from 'lucide-react'
import { cn } from 'cn'

import { Button } from '@/shared/components/ui/button'
import { createId } from '@/shared/lib/id'
import {
  DEFAULT_HOST_EXIT_EVENT,
  defaultEventsForNode,
  isActionActiveInCanvas,
  resolveBindingTarget,
  resolveNodeEvents,
} from '@/shared/lib/nodeEvents'
import type {
  CanvasId,
  NodeContent,
  NodeEventAction,
  NodeEventBinding,
  NodeId,
  PaperNode,
} from '@/shared/types/paper'
import { EventBindingPane } from './EventBindingPane'
import { RibbonDivider, RibbonGroup } from './RibbonPrimitives'

interface InlineNodeEventEditorProps {
  readonly node: PaperNode | undefined
  readonly activeCanvasId: CanvasId | null
  readonly isHostRoot: boolean
  readonly watchlistNodeIds: readonly NodeId[]
  readonly watchlistNodes: readonly PaperNode[]
  readonly canvasNodes: readonly PaperNode[]
  readonly onToggleWatchlist: (nodeId: NodeId) => void
  readonly onArmEventTargetPick: (sourceNodeId: NodeId, bindingId: string) => void
  readonly onUpdateEvents: (events: readonly NodeEventBinding[]) => void
  readonly onEnterSubCanvas: (canvasId: CanvasId) => void
  readonly onEditNodeText: () => void
}

function isCurrentCanvasEntryBinding(
  binding: NodeEventBinding,
  activeCanvasId: CanvasId | null,
): boolean {
  return (
    activeCanvasId !== null &&
    binding.action.type === 'open-canvas' &&
    binding.action.canvasId === activeCanvasId
  )
}

function effectiveEventsInCanvas(
  node: PaperNode,
  activeCanvasId: CanvasId | null,
  isHostRoot: boolean,
): readonly NodeEventBinding[] {
  const base = resolveNodeEvents(node).filter(
    (item) => !isCurrentCanvasEntryBinding(item, activeCanvasId),
  )
  if (!isHostRoot || activeCanvasId === null) return base
  const hasActiveDblClick = base.some(
    (item) =>
      resolveBindingTarget(item) === 'node' &&
      item.trigger === 'double-click' &&
      isActionActiveInCanvas(item.action, activeCanvasId) &&
      (item.action.type === 'open-canvas' || item.action.type === 'return-parent-canvas'),
  )
  return hasActiveDblClick ? base : [...base, DEFAULT_HOST_EXIT_EVENT]
}

function mergeSavedEventsFromCanvas(
  rawEvents: readonly NodeEventBinding[],
  nextVisibleEvents: readonly NodeEventBinding[],
  activeCanvasId: CanvasId | null,
): readonly NodeEventBinding[] {
  const parentEntryBindings = rawEvents.filter((item) =>
    isCurrentCanvasEntryBinding(item, activeCanvasId),
  )
  const cleanedVisible = nextVisibleEvents.filter(
    (item) => item.id !== DEFAULT_HOST_EXIT_EVENT.id,
  )
  return [...parentEntryBindings, ...cleanedVisible]
}

function createNewNodeBinding(kind: NodeContent['kind']): NodeEventBinding {
  const action: NodeEventAction =
    kind === 'image' || kind === 'file'
      ? { type: 'open-detail' }
      : { type: 'open-canvas', canvasId: createId() }
  return { id: createId(), target: 'node', trigger: 'double-click', action }
}

function buildBranchCanvasEvents(
  rawEvents: readonly NodeEventBinding[],
  activeCanvasId: CanvasId | null,
): { readonly created: NodeEventBinding; readonly nextEvents: readonly NodeEventBinding[] } {
  const created: NodeEventBinding = {
    id: createId(),
    target: 'node',
    trigger: 'double-click',
    action: { type: 'open-canvas', canvasId: createId() },
  }
  const filtered = rawEvents.filter(
    (item) =>
      !(
        resolveBindingTarget(item) === 'node' &&
        item.trigger === 'double-click' &&
        isActionActiveInCanvas(item.action, activeCanvasId)
      ),
  )
  return { created, nextEvents: [...filtered, created] }
}

function EventActionColumns({
  disabled,
  hasSubCanvas,
  canEditRichText,
  watched,
  onAdd,
  onResetDefaults,
  onBindOrEnterBranch,
  onToggleWatchlist,
  onEditNodeText,
}: Readonly<{
  disabled: boolean
  hasSubCanvas: boolean
  canEditRichText: boolean
  watched: boolean
  onAdd: () => void
  onResetDefaults: () => void
  onBindOrEnterBranch: () => void
  onToggleWatchlist: () => void
  onEditNodeText: () => void
}>) {
  const btnCls =
    'h-8 justify-start border-slate-200/90 bg-white px-3 text-[13px] text-slate-700 shadow-2xs hover:bg-slate-50'
  return (
    <div className="flex h-[70px] items-stretch gap-1.5">
      <div className="flex h-[70px] flex-col justify-between gap-1.5">
        <Button type="button" variant="outline" size="sm" disabled={disabled} className={btnCls} onClick={onAdd}>
          <Plus className="size-4 text-primary" aria-hidden="true" />
          新增事件
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled} className={btnCls} onClick={onResetDefaults}>
          <RotateCcw className="size-4 text-slate-500" aria-hidden="true" />
          恢复默认
        </Button>
      </div>
      <div className="flex h-[70px] flex-col justify-between gap-1.5">
        <Button type="button" variant="outline" size="sm" disabled={disabled} className={btnCls} onClick={onBindOrEnterBranch}>
          <GitBranch className="size-4 text-primary" aria-hidden="true" />
          {hasSubCanvas ? '进入支线' : '绑定支线'}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!canEditRichText} className={btnCls} onClick={onEditNodeText}>
          <Pencil className="size-4 text-slate-500" aria-hidden="true" />
          编辑文字
        </Button>
      </div>
      <div className="flex h-[70px] flex-col justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            btnCls,
            watched && 'border-primary/40 bg-primary/10 font-semibold text-primary hover:bg-primary/15',
          )}
          onClick={onToggleWatchlist}
        >
          ★ {watched ? '已关注' : '关注'}
        </Button>
      </div>
    </div>
  )
}

/** 「交互与事件」功能区内联事件编辑器：无需弹窗，直接在双行功能区内管理、切换与编辑节点事件 */
export function InlineNodeEventEditor(props: Readonly<InlineNodeEventEditorProps>) {
  const { node, activeCanvasId, isHostRoot, onUpdateEvents, onEnterSubCanvas, onEditNodeText } =
    props
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null)
  const rawEvents = node === undefined ? [] : resolveNodeEvents(node)
  const events = node === undefined ? [] : effectiveEventsInCanvas(node, activeCanvasId, isHostRoot)
  const activeBinding = events.find((item) => item.id === selectedBindingId) ?? events[0]
  const existingBranch = rawEvents.find(
    (item) =>
      resolveBindingTarget(item) === 'node' &&
      item.action.type === 'open-canvas' &&
      item.action.canvasId !== activeCanvasId,
  )

  const saveVisibleEvents = (nextVisible: readonly NodeEventBinding[]): void => {
    onUpdateEvents(mergeSavedEventsFromCanvas(rawEvents, nextVisible, activeCanvasId))
  }

  const replaceActiveBinding = (patch: Partial<NodeEventBinding>): void => {
    if (activeBinding === undefined) return
    const updated = { ...activeBinding, ...patch }
    saveVisibleEvents(events.map((i) => (i.id === activeBinding.id ? updated : i)))
  }

  return (
    <div className="flex h-[70px] items-stretch gap-3">
      <RibbonGroup>
        <EventActionColumns
          disabled={node === undefined}
          hasSubCanvas={existingBranch !== undefined}
          canEditRichText={node?.content.kind === 'text'}
          watched={node !== undefined && props.watchlistNodeIds.includes(node.id)}
          onAdd={() => {
            if (node === undefined) return
            const created = createNewNodeBinding(node.content.kind)
            setSelectedBindingId(created.id)
            saveVisibleEvents([...events, created])
          }}
          onResetDefaults={() => {
            if (node !== undefined) saveVisibleEvents(defaultEventsForNode(node))
          }}
          onBindOrEnterBranch={() => {
            if (existingBranch !== undefined && existingBranch.action.type === 'open-canvas') {
              onEnterSubCanvas(existingBranch.action.canvasId)
              return
            }
            const { created, nextEvents } = buildBranchCanvasEvents(rawEvents, activeCanvasId)
            setSelectedBindingId(created.id)
            onUpdateEvents(nextEvents)
          }}
          onToggleWatchlist={() => {
            if (node !== undefined) props.onToggleWatchlist(node.id)
          }}
          onEditNodeText={onEditNodeText}
        />
      </RibbonGroup>
      <RibbonDivider />
      <RibbonGroup>
        <EventBindingPane
          node={node}
          events={events}
          activeBinding={activeBinding}
          canvasNodes={props.canvasNodes}
          watchlistNodes={props.watchlistNodes}
          onSelectBinding={setSelectedBindingId}
          onReplaceBinding={replaceActiveBinding}
          onSaveVisibleEvents={saveVisibleEvents}
          onEnterCanvas={onEnterSubCanvas}
          onArmPick={props.onArmEventTargetPick}
        />
      </RibbonGroup>
    </div>
  )
}
