import { ExternalLink, GitBranch, Plus, RotateCcw, Trash2 } from 'lucide-react'

import { createId } from '@/shared/lib/id'
import { resolveBindingTarget } from '@/shared/lib/nodeEvents'
import type {
  CanvasId,
  NodeContent,
  NodeEventAction,
  NodeEventBinding,
  NodeEventTarget,
  NodeEventTrigger,
} from '@/shared/types/paper'

type ActionOptionValue =
  | 'edit-node'
  | 'open-canvas'
  | 'return-parent-canvas'
  | 'open-detail'
  | 'open-reference-preview'
  | 'switch-node-page'

interface NodeEventPopoverProps {
  readonly kind: NodeContent['kind']
  readonly events: readonly NodeEventBinding[]
  readonly defaultEvents: readonly NodeEventBinding[]
  readonly onUpdateEvents: (events: readonly NodeEventBinding[]) => void
  readonly onEnterCanvas: (canvasId: CanvasId) => void
  readonly onBindBranchCanvas: () => void
}

const SELECT_CLS =
  'min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none'

function actionToOptionValue(action: NodeEventAction): ActionOptionValue {
  return isActionOption(action.type) ? action.type : 'open-detail'
}

function optionValueToAction(
  value: ActionOptionValue,
  existingAction: NodeEventAction,
): NodeEventAction {
  if (value === 'switch-node-page') return existingAction
  if (value === 'edit-node') return { type: 'edit-node' }
  if (value === 'return-parent-canvas') return { type: 'return-parent-canvas' }
  if (value === 'open-detail') return { type: 'open-detail' }
  if (value === 'open-reference-preview') return { type: 'open-reference-preview' }
  const canvasId = existingAction.type === 'open-canvas' ? existingAction.canvasId : createId()
  return { type: 'open-canvas', canvasId }
}

function isActionOption(val: string): val is ActionOptionValue {
  return (
    val === 'edit-node' ||
    val === 'open-canvas' ||
    val === 'return-parent-canvas' ||
    val === 'open-detail' ||
    val === 'open-reference-preview' ||
    val === 'switch-node-page'
  )
}

function TargetRow({
  target,
  onChangeTarget,
  onDelete,
}: Readonly<{
  target: NodeEventTarget
  onChangeTarget: (target: NodeEventTarget) => void
  onDelete: () => void
}>) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 shrink-0 text-[11px] font-medium text-slate-500">触发对象</span>
      <select
        aria-label="事件触发对象"
        value={target}
        onChange={(e) => {
          const val = e.target.value
          if (val === 'node' || val === 'reference' || val === 'reference-popup') {
            onChangeTarget(val)
          }
        }}
        className={SELECT_CLS}
      >
        <option value="node">节点本身</option>
        <option value="reference">节点内引用链接</option>
        <option value="reference-popup">引用预览小窗</option>
      </select>
      <button
        type="button"
        aria-label="删除此事件绑定"
        title="删除此事件"
        onClick={onDelete}
        className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

function TriggerRow({
  target,
  trigger,
  onChangeTrigger,
}: Readonly<{
  target: NodeEventTarget
  trigger: NodeEventTrigger
  onChangeTrigger: (trigger: NodeEventTrigger) => void
}>) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 shrink-0 text-[11px] font-medium text-slate-500">触发时机</span>
      <select
        aria-label="事件触发时机"
        value={trigger}
        onChange={(e) => {
          const val = e.target.value
          if (val === 'double-click' || val === 'second-click' || val === 'click') {
            onChangeTrigger(val)
          }
        }}
        className={SELECT_CLS}
      >
        <option value="double-click">双击</option>
        {target === 'node' && <option value="second-click">选中后再次单击</option>}
        <option value="click">单击</option>
      </select>
    </div>
  )
}

function ActionRow({
  kind,
  action,
  onChangeAction,
  onEnterCanvas,
}: Readonly<{
  kind: NodeContent['kind']
  action: NodeEventAction
  onChangeAction: (value: ActionOptionValue) => void
  onEnterCanvas: (canvasId: CanvasId) => void
}>) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 shrink-0 text-[11px] font-medium text-slate-500">执行动作</span>
      <select
        aria-label="事件执行动作"
        value={actionToOptionValue(action)}
        onChange={(e) => {
          if (isActionOption(e.target.value)) onChangeAction(e.target.value)
        }}
        className={SELECT_CLS}
      >
        {(kind === 'text' || action.type === 'edit-node') && (
          <option value="edit-node">开始编辑节点内容</option>
        )}
        <option value="open-canvas">展开支线画布</option>
        <option value="return-parent-canvas">返回上级画布</option>
        <option value="open-detail">弹出详情视图（大图/PDF/全文）</option>
        <option value="open-reference-preview">弹出引用预览小窗</option>
        {action.type === 'switch-node-page' && (
          <option value="switch-node-page">切换目标页码</option>
        )}
      </select>
      {action.type === 'open-canvas' && (
        <button
          type="button"
          onClick={() => {
            onEnterCanvas(action.canvasId)
          }}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          <ExternalLink className="size-3" aria-hidden="true" />
          <span>进入支线</span>
        </button>
      )}
    </div>
  )
}

function PopoverHeader({
  onAdd,
  onResetDefaults,
}: Readonly<{ onAdd: () => void; onResetDefaults: () => void }>) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <span className="text-xs font-bold text-slate-800">节点与引用事件绑定</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          <Plus className="size-3" aria-hidden="true" />
          <span>新增</span>
        </button>
        <button
          type="button"
          title="恢复该节点的默认事件（含内嵌引用默认事件）"
          onClick={onResetDefaults}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <RotateCcw className="size-3" aria-hidden="true" />
          <span>默认</span>
        </button>
      </div>
    </div>
  )
}

function EventBindingItem({
  kind,
  binding,
  onChange,
  onDelete,
  onEnterCanvas,
}: Readonly<{
  kind: NodeContent['kind']
  binding: NodeEventBinding
  onChange: (next: NodeEventBinding) => void
  onDelete: () => void
  onEnterCanvas: (canvasId: CanvasId) => void
}>) {
  const target = resolveBindingTarget(binding)
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50/70 p-2 text-xs">
      <TargetRow
        target={target}
        onChangeTarget={(nextTarget) => {
          const trigger =
            nextTarget !== 'node' && binding.trigger === 'second-click' ? 'click' : binding.trigger
          onChange({ ...binding, target: nextTarget, trigger })
        }}
        onDelete={onDelete}
      />
      <TriggerRow
        target={target}
        trigger={binding.trigger}
        onChangeTrigger={(trigger) => {
          onChange({ ...binding, trigger })
        }}
      />
      <ActionRow
        kind={kind}
        action={binding.action}
        onChangeAction={(val) => {
          onChange({ ...binding, action: optionValueToAction(val, binding.action) })
        }}
        onEnterCanvas={onEnterCanvas}
      />
    </div>
  )
}

function EmptyEventsState({
  kind,
  onBind,
}: Readonly<{ kind: NodeContent['kind']; onBind: () => void }>) {
  const hint =
    kind === 'title'
      ? '纯标题节点专为触发事件设计，当前暂未绑定事件'
      : '当前无绑定事件'
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 py-4 text-center">
      <span className="text-xs text-slate-400">{hint}</span>
      <button
        type="button"
        onClick={onBind}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-95"
      >
        <GitBranch className="size-3.5" aria-hidden="true" />
        <span>一键绑定「双击展开支线画布」</span>
      </button>
    </div>
  )
}

/** 节点事件编辑浮窗主体 */
export function NodeEventPopover(props: Readonly<NodeEventPopoverProps>) {
  const { kind, events, defaultEvents, onUpdateEvents, onEnterCanvas, onBindBranchCanvas } = props
  const handleAdd = (): void => {
    const action: NodeEventAction =
      kind === 'image' || kind === 'file'
        ? { type: 'open-detail' }
        : { type: 'open-canvas', canvasId: createId() }
    onUpdateEvents([...events, { id: createId(), target: 'node', trigger: 'double-click', action }])
  }

  return (
    <section
      aria-label="节点绑定事件编辑器"
      className="absolute top-9 left-0 z-50 w-84 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_16px_40px_-8px_rgba(15,23,42,0.18)]"
    >
      <PopoverHeader
        onAdd={handleAdd}
        onResetDefaults={() => {
          onUpdateEvents(defaultEvents)
        }}
      />
      {events.length === 0 ? (
        <EmptyEventsState kind={kind} onBind={onBindBranchCanvas} />
      ) : (
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {events.map((b) => (
            <EventBindingItem
              key={b.id}
              kind={kind}
              binding={b}
              onChange={(next) => {
                onUpdateEvents(events.map((i) => (i.id === b.id ? next : i)))
              }}
              onDelete={() => {
                onUpdateEvents(events.filter((i) => i.id !== b.id))
              }}
              onEnterCanvas={onEnterCanvas}
            />
          ))}
        </div>
      )}
      <p className="mt-2.5 text-[11px] leading-relaxed text-slate-400">
        提示：在支线子画布内，同源起点节点默认绑定「双击返回上级画布」。
      </p>
    </section>
  )
}
