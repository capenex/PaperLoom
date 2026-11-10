import { ExternalLink, Trash2 } from 'lucide-react'
import { cn } from 'cn'

import { Button } from '@/shared/components/ui/button'
import { resolveBindingTarget } from '@/shared/lib/nodeEvents'
import type {
  CanvasId,
  NodeContent,
  NodeEventBinding,
  NodeEventTarget,
  NodeEventTrigger,
  NodeId,
  PaperNode,
} from '@/shared/types/paper'
import type { ActionOptionValue } from '../lib/eventBindingUi'
import {
  SELECT_BOX_CLS,
  actionToOptionValue,
  formatBindingTabLabel,
  isActionOption,
  optionValueToAction,
  ribbonFieldCls,
} from '../lib/eventBindingUi'
import { SwitchNodePageControls } from './SwitchNodePageControls'

interface EventBindingPaneProps {
  readonly node: PaperNode | undefined
  readonly events: readonly NodeEventBinding[]
  readonly activeBinding: NodeEventBinding | undefined
  readonly canvasNodes: readonly PaperNode[]
  readonly watchlistNodes: readonly PaperNode[]
  readonly onSelectBinding: (id: string) => void
  readonly onReplaceBinding: (patch: Partial<NodeEventBinding>) => void
  readonly onSaveVisibleEvents: (events: readonly NodeEventBinding[]) => void
  readonly onEnterCanvas: (canvasId: CanvasId) => void
  readonly onArmPick: (sourceNodeId: NodeId, bindingId: string) => void
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

function ActionTypeSelect({
  kind,
  actionVal,
  hasBinding,
  fieldCls,
  onSelect,
}: Readonly<{
  kind: NodeContent['kind'] | undefined
  actionVal: ActionOptionValue
  hasBinding: boolean
  fieldCls: string
  onSelect: (value: ActionOptionValue) => void
}>) {
  return (
    <label className={fieldCls}>
      <span className="shrink-0 text-slate-500">执行动作</span>
      <select
        aria-label="事件执行动作"
        disabled={!hasBinding}
        value={actionVal}
        onChange={(e) => {
          if (isActionOption(e.target.value)) onSelect(e.target.value)
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
        <option value="switch-node-page">切换目标节点页码</option>
      </select>
    </label>
  )
}

function DeleteBindingButton({
  disabled,
  onDelete,
}: Readonly<{ disabled: boolean; onDelete: () => void }>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label="删除此事件绑定"
      disabled={disabled}
      className="h-8 border-rose-200/80 bg-rose-50/60 px-3 text-[13px] text-rose-600 shadow-2xs hover:border-rose-300 hover:bg-rose-100/70 hover:text-rose-700"
      onClick={onDelete}
    >
      <Trash2 className="size-4" aria-hidden="true" />
      删除事件
    </Button>
  )
}

function EventBindingFieldsRow({
  kind,
  binding,
  sourceNodeId,
  watchlistNodes,
  canvasNodes,
  onReplaceBinding,
  onArmPick,
  onDelete,
  onEnterCanvas,
}: Readonly<{
  kind: NodeContent['kind'] | undefined
  binding: NodeEventBinding | undefined
  sourceNodeId: NodeId | undefined
  watchlistNodes: readonly PaperNode[]
  canvasNodes: readonly PaperNode[]
  onReplaceBinding: (patch: Partial<NodeEventBinding>) => void
  onArmPick: (sourceNodeId: NodeId, bindingId: string) => void
  onDelete: () => void
  onEnterCanvas: (canvasId: CanvasId) => void
}>) {
  const hasBinding = binding !== undefined
  const target: NodeEventTarget = binding === undefined ? 'node' : resolveBindingTarget(binding)
  const trigger: NodeEventTrigger = binding === undefined ? 'double-click' : binding.trigger
  const actionVal: ActionOptionValue =
    binding === undefined ? 'open-canvas' : actionToOptionValue(binding.action)
  const fieldCls = ribbonFieldCls(hasBinding)

  return (
    <div className="flex h-8 items-center gap-2">
      <TargetAndTriggerSelects
        hasBinding={hasBinding}
        target={target}
        trigger={trigger}
        fieldCls={fieldCls}
        onChangeTarget={(nextTarget) => {
          if (binding === undefined) return
          const nextTrigger =
            nextTarget !== 'node' && binding.trigger === 'second-click' ? 'click' : binding.trigger
          onReplaceBinding({ target: nextTarget, trigger: nextTrigger })
        }}
        onChangeTrigger={(nextTrigger) => {
          onReplaceBinding({ trigger: nextTrigger })
        }}
      />

      <ActionTypeSelect
        kind={kind}
        actionVal={actionVal}
        hasBinding={hasBinding}
        fieldCls={fieldCls}
        onSelect={(val) => {
          if (binding === undefined || sourceNodeId === undefined) return
          onReplaceBinding({ action: optionValueToAction(val, binding.action, sourceNodeId) })
        }}
      />

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

      {binding?.action.type === 'switch-node-page' && (
        <SwitchNodePageControls
          action={binding.action}
          bindingId={binding.id}
          sourceNodeId={sourceNodeId}
          watchlistNodes={watchlistNodes}
          canvasNodes={canvasNodes}
          onChangeAction={(nextAction) => {
            onReplaceBinding({ action: nextAction })
          }}
          onArmPick={onArmPick}
        />
      )}

      <DeleteBindingButton disabled={!hasBinding} onDelete={onDelete} />
    </div>
  )
}

export function EventBindingPane({
  node,
  events,
  activeBinding,
  canvasNodes,
  watchlistNodes,
  onSelectBinding,
  onReplaceBinding,
  onSaveVisibleEvents,
  onEnterCanvas,
  onArmPick,
}: Readonly<EventBindingPaneProps>) {
  return (
    <div className="flex h-[70px] flex-col justify-between gap-1.5">
      <EventBindingTabsRow
        events={events}
        activeBindingId={activeBinding?.id ?? null}
        onSelectBinding={onSelectBinding}
      />
      <EventBindingFieldsRow
        kind={node?.content.kind}
        binding={activeBinding}
        sourceNodeId={node?.id}
        canvasNodes={canvasNodes}
        watchlistNodes={watchlistNodes}
        onReplaceBinding={onReplaceBinding}
        onArmPick={onArmPick}
        onEnterCanvas={onEnterCanvas}
        onDelete={() => {
          if (activeBinding !== undefined) {
            onSaveVisibleEvents(events.filter((i) => i.id !== activeBinding.id))
          }
        }}
      />
    </div>
  )
}
