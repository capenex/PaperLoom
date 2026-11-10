import { cn } from 'cn'

import { createId } from '@/shared/lib/id'
import { resolveBindingTarget } from '@/shared/lib/nodeEvents'
import type {
  NodeEventAction,
  NodeEventBinding,
  NodeEventTarget,
  NodeEventTrigger,
  NodeId,
} from '@/shared/types/paper'

export type ActionOptionValue =
  | 'edit-node'
  | 'open-canvas'
  | 'return-parent-canvas'
  | 'open-detail'
  | 'open-reference-preview'
  | 'switch-node-page'

export type SwitchNodePageAction = Extract<NodeEventAction, { readonly type: 'switch-node-page' }>

export const TARGET_LABELS: Readonly<Record<NodeEventTarget, string>> = {
  node: '节点本身',
  reference: '引用链接',
  'reference-popup': '预览小窗',
}

export const TRIGGER_LABELS: Readonly<Record<NodeEventTrigger, string>> = {
  'double-click': '双击',
  'second-click': '再次单击',
  click: '单击',
}

export const ACTION_LABELS: Readonly<Record<ActionOptionValue, string>> = {
  'edit-node': '编辑内容',
  'open-canvas': '展开支线',
  'return-parent-canvas': '返回上级',
  'open-detail': '弹出详情',
  'open-reference-preview': '预览小窗',
  'switch-node-page': '切换目标页码',
}

export const SELECT_BOX_CLS =
  'h-6 cursor-pointer rounded border border-slate-200/90 bg-slate-50/70 px-1.5 text-xs font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-primary disabled:cursor-not-allowed'

const RIBBON_FIELD_CLS =
  'flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 text-[13px] font-medium text-slate-700 shadow-2xs'

export function ribbonFieldCls(hasBinding: boolean): string {
  return cn(RIBBON_FIELD_CLS, hasBinding ? '' : 'pointer-events-none opacity-45 select-none')
}

export function isActionOption(val: string): val is ActionOptionValue {
  return val in ACTION_LABELS
}

export function actionToOptionValue(action: NodeEventAction): ActionOptionValue {
  return isActionOption(action.type) ? action.type : 'open-detail'
}

export function optionValueToAction(
  value: ActionOptionValue,
  existingAction: NodeEventAction | undefined,
  fallbackTargetNodeId: NodeId,
): NodeEventAction {
  if (value === 'edit-node') return { type: 'edit-node' }
  if (value === 'return-parent-canvas') return { type: 'return-parent-canvas' }
  if (value === 'open-detail') return { type: 'open-detail' }
  if (value === 'open-reference-preview') return { type: 'open-reference-preview' }
  if (value === 'switch-node-page') {
    if (existingAction?.type === 'switch-node-page') return existingAction
    return { type: 'switch-node-page', targetNodeId: fallbackTargetNodeId, mode: 'next-loop' }
  }
  const canvasId = existingAction?.type === 'open-canvas' ? existingAction.canvasId : createId()
  return { type: 'open-canvas', canvasId }
}

export function formatBindingTabLabel(index: number, binding: NodeEventBinding): string {
  const target = resolveBindingTarget(binding)
  return `${index + 1}. ${TARGET_LABELS[target]}·${TRIGGER_LABELS[binding.trigger]} → ${ACTION_LABELS[actionToOptionValue(binding.action)]}`
}
