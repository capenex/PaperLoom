import { ExternalLink, Trash2 } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/shared/components/ui/button"
import {
  SelectMenu,
  type SelectMenuOption,
} from "@/shared/components/ui/select-menu"
import { resolveBindingTarget } from "@/shared/lib/nodeEvents"
import type {
  CanvasId,
  NodeContent,
  NodeEventBinding,
  NodeEventTarget,
  NodeEventTrigger,
  NodeId,
  PaperNode,
} from "@/shared/types/paper"
import type { ActionOptionValue } from "../lib/eventBindingUi"
import {
  actionToOptionValue,
  formatBindingTabLabel,
  isActionOption,
  optionValueToAction,
  ribbonFieldCls,
} from "../lib/eventBindingUi"
import { SwitchNodePageControls } from "./SwitchNodePageControls"

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

const TARGET_OPTIONS: readonly SelectMenuOption<NodeEventTarget>[] = [
  { value: "node", label: "节点本身" },
  { value: "reference", label: "节点内引用链接", triggerLabel: "引用链接" },
  { value: "reference-popup", label: "引用预览小窗", triggerLabel: "预览小窗" },
]

function buildTriggerOptions(
  target: NodeEventTarget,
): readonly SelectMenuOption<NodeEventTrigger>[] {
  if (target === "node") {
    return [
      { value: "double-click", label: "双击" },
      {
        value: "second-click",
        label: "选中后再次单击",
        triggerLabel: "再次单击",
      },
      { value: "click", label: "单击" },
    ]
  }
  return [
    { value: "double-click", label: "双击" },
    { value: "click", label: "单击" },
  ]
}

function buildActionOptions(
  kind: NodeContent["kind"] | undefined,
  actionVal: ActionOptionValue,
): readonly SelectMenuOption<ActionOptionValue>[] {
  const options: SelectMenuOption<ActionOptionValue>[] = []
  if (kind === undefined || kind === "text" || actionVal === "edit-node") {
    options.push({
      value: "edit-node",
      label: "开始编辑节点内容",
      triggerLabel: "编辑节点内容",
      badge: "文本",
    })
  }
  options.push(
    {
      value: "open-canvas",
      label: "展开支线画布",
      badge: "子画布",
    },
    {
      value: "return-parent-canvas",
      label: "返回上级画布",
      badge: "导航",
    },
    {
      value: "open-detail",
      label: "弹出左栏详情（大图/PDF/全文）",
      triggerLabel: "弹出左栏详情",
      badge: "左栏",
    },
    {
      value: "open-reference-preview",
      label: "弹出引用预览小窗",
      triggerLabel: "引用预览小窗",
      badge: "预览",
    },
    {
      value: "switch-node-page",
      label: "切换目标节点页码",
      badge: "联动",
    },
  )
  return options
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
    <div
      role="tablist"
      aria-label="当前节点事件列表"
      className="flex h-8 items-center gap-1.5"
    >
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
              "inline-flex h-8 cursor-pointer items-center rounded-lg border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
              isCurrent
                ? "border-primary bg-primary text-white shadow-2xs"
                : "border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50",
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
      <div className={fieldCls}>
        <span className="shrink-0 text-slate-500">触发对象</span>
        <SelectMenu
          ariaLabel="事件触发对象"
          disabled={!hasBinding}
          value={target}
          options={TARGET_OPTIONS}
          triggerClassName="min-w-22"
          contentClassName="w-44"
          onValueChange={onChangeTarget}
        />
      </div>

      <div className={fieldCls}>
        <span className="shrink-0 text-slate-500">触发时机</span>
        <SelectMenu
          ariaLabel="事件触发时机"
          disabled={!hasBinding}
          value={trigger}
          options={buildTriggerOptions(target)}
          triggerClassName="min-w-20"
          contentClassName="w-40"
          onValueChange={onChangeTrigger}
        />
      </div>
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
  kind: NodeContent["kind"] | undefined
  actionVal: ActionOptionValue
  hasBinding: boolean
  fieldCls: string
  onSelect: (value: ActionOptionValue) => void
}>) {
  return (
    <div className={fieldCls}>
      <span className="shrink-0 text-slate-500">执行动作</span>
      <SelectMenu
        ariaLabel="事件执行动作"
        disabled={!hasBinding}
        value={actionVal}
        options={buildActionOptions(kind, actionVal)}
        triggerClassName="min-w-36"
        contentClassName="w-64"
        onValueChange={(nextValue) => {
          if (isActionOption(nextValue)) onSelect(nextValue)
        }}
      />
    </div>
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
  kind: NodeContent["kind"] | undefined
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
  const target: NodeEventTarget =
    binding === undefined ? "node" : resolveBindingTarget(binding)
  const trigger: NodeEventTrigger =
    binding === undefined ? "double-click" : binding.trigger
  const actionVal: ActionOptionValue =
    binding === undefined ? "open-canvas" : actionToOptionValue(binding.action)
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
            nextTarget !== "node" && binding.trigger === "second-click"
              ? "click"
              : binding.trigger
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
          if (binding !== undefined && sourceNodeId !== undefined) {
            onReplaceBinding({ action: optionValueToAction(val, binding.action, sourceNodeId) })
          }
        }}
      />

      {binding?.action.type === "open-canvas" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-primary/30 bg-primary/10 px-3 text-[13px] font-semibold text-primary hover:bg-primary/15"
          onClick={() => { if (binding.action.type === "open-canvas") onEnterCanvas(binding.action.canvasId) }}
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          进入支线
        </Button>
      )}

      {binding?.action.type === "switch-node-page" && (
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
    <div
      className={cn(
        "flex h-[70px] flex-col justify-between gap-1.5",
        node === undefined && "pointer-events-none opacity-45 select-none",
      )}
    >
      <EventBindingTabsRow
        events={events}
        activeBindingId={activeBinding?.id ?? null}
        onSelectBinding={onSelectBinding}
      />
      <EventBindingFieldsRow
        kind={node?.content.kind}
        binding={activeBinding}
        sourceNodeId={node?.id}
        watchlistNodes={watchlistNodes}
        canvasNodes={canvasNodes}
        onReplaceBinding={onReplaceBinding}
        onArmPick={onArmPick}
        onDelete={() => {
          if (activeBinding === undefined) return
          onSaveVisibleEvents(
            events.filter((item) => item.id !== activeBinding.id),
          )
        }}
        onEnterCanvas={onEnterCanvas}
      />
    </div>
  )
}
