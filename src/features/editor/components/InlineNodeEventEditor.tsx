import { useState } from 'react'
import { ExternalLink, GitBranch, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
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
  NodeEventTarget,
  NodeEventTrigger,
  PaperNode,
} from '@/shared/types/paper'
import { RibbonDivider, RibbonGroup } from './RibbonPrimitives'

type ActionOptionValue =
  | 'edit-node'
  | 'open-canvas'
  | 'return-parent-canvas'
  | 'open-detail'
  | 'open-reference-preview'

interface InlineNodeEventEditorProps {
  readonly node: PaperNode | undefined
  readonly activeCanvasId: CanvasId | null
  readonly isHostRoot: boolean
  readonly onUpdateEvents: (events: readonly NodeEventBinding[]) => void
  readonly onEnterSubCanvas: (canvasId: CanvasId) => void
  readonly onEditNodeText: () => void
}

const SELECT_BOX_CLS =
  'h-6 cursor-pointer rounded border border-slate-200/90 bg-slate-50/70 px-1.5 text-xs font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-primary disabled:cursor-not-allowed'

const TARGET_LABELS: Readonly<Record<NodeEventTarget, string>> = {
  node: '节点本身',
  reference: '引用链接',
  'reference-popup': '预览小窗',
}

const TRIGGER_LABELS: Readonly<Record<NodeEventTrigger, string>> = {
  'double-click': '双击',
  'second-click': '再次单击',
  click: '单击',
}

const ACTION_LABELS: Readonly<Record<ActionOptionValue, string>> = {
  'edit-node': '编辑内容',
  'open-canvas': '展开支线',
  'return-parent-canvas': '返回上级',
  'open-detail': '弹出详情',
  'open-reference-preview': '预览小窗',
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

function optionValueToAction(
  value: ActionOptionValue,
  existingAction: NodeEventAction | undefined,
): NodeEventAction {
  if (value === 'edit-node') return { type: 'edit-node' }
  if (value === 'return-parent-canvas') return { type: 'return-parent-canvas' }
  if (value === 'open-detail') return { type: 'open-detail' }
  if (value === 'open-reference-preview') return { type: 'open-reference-preview' }
  const canvasId =
    existingAction?.type === 'open-canvas' ? existingAction.canvasId : createId()
  return { type: 'open-canvas', canvasId }
}

function isActionOption(val: string): val is ActionOptionValue {
  return val in ACTION_LABELS
}

function formatBindingTabLabel(index: number, binding: NodeEventBinding): string {
  const target = resolveBindingTarget(binding)
  return `${index + 1}. ${TARGET_LABELS[target]}·${TRIGGER_LABELS[binding.trigger]} → ${ACTION_LABELS[binding.action.type]}`
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
  onAdd,
  onResetDefaults,
  onBindOrEnterBranch,
  onEditNodeText,
}: Readonly<{
  disabled: boolean
  hasSubCanvas: boolean
  canEditRichText: boolean
  onAdd: () => void
  onResetDefaults: () => void
  onBindOrEnterBranch: () => void
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
    </div>
  )
}

function EventBindingTabsRow({
  events,
  activeBindingId,
  onSelectBinding,
}: Readonly<{
  events: readonly NodeEventBinding[]
  activeBindingId: string | null
  onSelectBinding: (id: string) => void
}>) {
  if (events.length === 0) {
    return (
      <div className="flex h-8 items-center">
        <span className="inline-flex h-8 items-center rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 text-[13px] text-slate-400 select-none">
          暂无绑定事件
        </span>
      </div>
    )
  }

  return (
    <div role="tablist" aria-label="当前节点事件列表" className="flex h-8 items-center gap-1.5">
      {events.map((binding, index) => {
        const isCurrent = binding.id === activeBindingId
        return (
          <button
            key={binding.id}
            type="button"
            role="tab"
            aria-selected={isCurrent}
            onClick={() => {
              onSelectBinding(binding.id)
            }}
            className={cn(
              'inline-flex h-8 cursor-pointer items-center rounded-lg border px-3 text-[13px] font-medium whitespace-nowrap transition-colors',
              isCurrent
                ? 'border-primary bg-primary text-white shadow-2xs'
                : 'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {formatBindingTabLabel(index, binding)}
          </button>
        )
      })}
    </div>
  )
}

function TargetAndTriggerSelects({
  hasBinding,
  target,
  trigger,
  fieldCls,
  onChangeTarget,
  onChangeTrigger,
}: Readonly<{
  hasBinding: boolean
  target: NodeEventTarget
  trigger: NodeEventTrigger
  fieldCls: string
  onChangeTarget: (target: NodeEventTarget) => void
  onChangeTrigger: (trigger: NodeEventTrigger) => void
}>) {
  return (
    <>
      <label className={fieldCls}>
        <span className="shrink-0 text-slate-500">触发对象</span>
        <select
          aria-label="事件触发对象"
          disabled={!hasBinding}
          value={target}
          onChange={(e) => {
            const val = e.target.value
            if (val === 'node' || val === 'reference' || val === 'reference-popup') {
              onChangeTarget(val)
            }
          }}
          className={SELECT_BOX_CLS}
        >
          <option value="node">节点本身</option>
          <option value="reference">节点内引用链接</option>
          <option value="reference-popup">引用预览小窗</option>
        </select>
      </label>

      <label className={fieldCls}>
        <span className="shrink-0 text-slate-500">触发时机</span>
        <select
          aria-label="事件触发时机"
          disabled={!hasBinding}
          value={trigger}
          onChange={(e) => {
            const val = e.target.value
            if (val === 'double-click' || val === 'second-click' || val === 'click') {
              onChangeTrigger(val)
            }
          }}
          className={SELECT_BOX_CLS}
        >
          <option value="double-click">双击</option>
          {target === 'node' && <option value="second-click">选中后再次单击</option>}
          <option value="click">单击</option>
        </select>
      </label>
    </>
  )
}

function EventBindingFieldsRow({
  kind,
  binding,
  onChangeTarget,
  onChangeTrigger,
  onChangeAction,
  onDelete,
  onEnterCanvas,
}: Readonly<{
  kind: NodeContent['kind'] | undefined
  binding: NodeEventBinding | undefined
  onChangeTarget: (target: NodeEventTarget) => void
  onChangeTrigger: (trigger: NodeEventTrigger) => void
  onChangeAction: (action: ActionOptionValue) => void
  onDelete: () => void
  onEnterCanvas: (canvasId: CanvasId) => void
}>) {
  const hasBinding = binding !== undefined
  const target: NodeEventTarget = binding === undefined ? 'node' : resolveBindingTarget(binding)
  const trigger: NodeEventTrigger = binding === undefined ? 'double-click' : binding.trigger
  const actionVal: ActionOptionValue =
    binding === undefined ? 'open-canvas' : binding.action.type
  const fieldCls = cn(
    'flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 text-[13px] font-medium text-slate-700 shadow-2xs',
    !hasBinding && 'pointer-events-none opacity-45 select-none',
  )

  return (
    <div className="flex h-8 items-center gap-2">
      <TargetAndTriggerSelects
        hasBinding={hasBinding}
        target={target}
        trigger={trigger}
        fieldCls={fieldCls}
        onChangeTarget={onChangeTarget}
        onChangeTrigger={onChangeTrigger}
      />

      <label className={fieldCls}>
        <span className="shrink-0 text-slate-500">执行动作</span>
        <select
          aria-label="事件执行动作"
          disabled={!hasBinding}
          value={actionVal}
          onChange={(e) => {
            if (isActionOption(e.target.value)) onChangeAction(e.target.value)
          }}
          className={SELECT_BOX_CLS}
        >
          {(kind === undefined || kind === 'text' || actionVal === 'edit-node') && (
            <option value="edit-node">开始编辑节点内容</option>
          )}
          <option value="open-canvas">展开支线画布</option>
          <option value="return-parent-canvas">返回上级画布</option>
          <option value="open-detail">弹出详情视图（大图/PDF/全文）</option>
          <option value="open-reference-preview">弹出引用预览小窗</option>
        </select>
      </label>

      {binding?.action.type === 'open-canvas' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-primary/30 bg-primary/10 px-3 text-[13px] font-semibold text-primary hover:bg-primary/15"
          onClick={() => {
            if (binding.action.type === 'open-canvas') onEnterCanvas(binding.action.canvasId)
          }}
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          进入支线
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="删除此事件绑定"
        disabled={!hasBinding}
        className="h-8 border-rose-200/80 bg-rose-50/60 px-3 text-[13px] text-rose-600 shadow-2xs hover:border-rose-300 hover:bg-rose-100/70 hover:text-rose-700"
        onClick={onDelete}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        删除事件
      </Button>
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
          onEditNodeText={onEditNodeText}
        />
      </RibbonGroup>
      <RibbonDivider />
      <RibbonGroup>
        <div className="flex h-[70px] flex-col justify-between gap-1.5">
          <EventBindingTabsRow
            events={events}
            activeBindingId={activeBinding?.id ?? null}
            onSelectBinding={setSelectedBindingId}
          />
          <EventBindingFieldsRow
            kind={node?.content.kind}
            binding={activeBinding}
            onChangeTarget={(nextTarget) => {
              if (activeBinding === undefined) return
              const nextTrigger =
                nextTarget !== 'node' && activeBinding.trigger === 'second-click'
                  ? 'click'
                  : activeBinding.trigger
              replaceActiveBinding({ target: nextTarget, trigger: nextTrigger })
            }}
            onChangeTrigger={(nextTrigger) => {
              replaceActiveBinding({ trigger: nextTrigger })
            }}
            onChangeAction={(nextActionVal) => {
              if (activeBinding !== undefined) {
                replaceActiveBinding({
                  action: optionValueToAction(nextActionVal, activeBinding.action),
                })
              }
            }}
            onDelete={() => {
              if (activeBinding !== undefined) {
                saveVisibleEvents(events.filter((i) => i.id !== activeBinding.id))
              }
            }}
            onEnterCanvas={onEnterSubCanvas}
          />
        </div>
      </RibbonGroup>
    </div>
  )
}
