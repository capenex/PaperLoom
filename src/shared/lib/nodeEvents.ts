/**
 * 节点事件绑定默认规则与查询工具
 *
 * 将「多媒体节点二次点击弹出右侧大图」「静态文件双击弹出右侧全文」
 * 统一纳入节点事件系统，并支持绑定「双击展开支线画布」与「播放节点动效」。
 */

import type {
  CanvasId,
  NodeContent,
  NodeEventAction,
  NodeEventBinding,
  NodeEventTarget,
  NodeEventTrigger,
  PaperNode,
} from '../types/paper'
import { REFERENCE_KIND_ATTR } from './reference'

const DEFAULT_TEXT_EVENTS: readonly NodeEventBinding[] = [
  {
    id: 'default-text-edit-node',
    target: 'node',
    trigger: 'double-click',
    action: { type: 'edit-node' },
  },
]

const DEFAULT_IMAGE_EVENTS: readonly NodeEventBinding[] = [
  {
    id: 'default-image-open-detail',
    target: 'node',
    trigger: 'second-click',
    action: { type: 'open-detail' },
  },
]

const DEFAULT_FILE_EVENTS: readonly NodeEventBinding[] = [
  {
    id: 'default-file-open-detail',
    target: 'node',
    trigger: 'double-click',
    action: { type: 'open-detail' },
  },
]

/** 节点内含本地引用（如 PDF 引用链接）时的默认子元素级事件绑定 */
export const DEFAULT_REFERENCE_EVENTS: readonly NodeEventBinding[] = [
  {
    id: 'default-reference-open-preview',
    target: 'reference',
    trigger: 'click',
    action: { type: 'open-reference-preview' },
  },
  {
    id: 'default-reference-open-detail',
    target: 'reference',
    trigger: 'double-click',
    action: { type: 'open-detail' },
  },
  {
    id: 'default-popup-open-detail',
    target: 'reference-popup',
    trigger: 'click',
    action: { type: 'open-detail' },
  },
]

/** 解析事件绑定的目标对象（缺省视为节点本身 'node'） */
export function resolveBindingTarget(binding: NodeEventBinding): NodeEventTarget {
  return binding.target ?? 'node'
}

/** 判断文本节点是否内嵌了本地引用锚点（data-pl-ref） */
export function nodeHasEmbeddedReference(node: PaperNode): boolean {
  return node.content.kind === 'text' && node.content.richText.includes(REFERENCE_KIND_ATTR)
}

/** 按节点类型返回默认绑定的交互事件列表 */
export function defaultEventsForKind(kind: NodeContent['kind']): readonly NodeEventBinding[] {
  if (kind === 'image') return DEFAULT_IMAGE_EVENTS
  if (kind === 'file') return DEFAULT_FILE_EVENTS
  return DEFAULT_TEXT_EVENTS
}

/** 按节点完整内容返回默认事件（富文本节点默认双击编辑，内嵌 PDF/本地引用时附加引用与小窗事件） */
export function defaultEventsForNode(node: PaperNode): readonly NodeEventBinding[] {
  if (nodeHasEmbeddedReference(node)) {
    return [...DEFAULT_TEXT_EVENTS, ...DEFAULT_REFERENCE_EVENTS]
  }
  return defaultEventsForKind(node.content.kind)
}

/** 解析节点当前生效的事件列表：若节点未显式配置节点级事件，则补齐该节点的默认事件 */
export function resolveNodeEvents(node: PaperNode): readonly NodeEventBinding[] {
  if (node.events === undefined) {
    return defaultEventsForNode(node)
  }
  const isTextOrTitle = node.content.kind === 'text' || node.content.kind === 'title'
  const hasNodeTarget = node.events.some((binding) => resolveBindingTarget(binding) === 'node')
  if (isTextOrTitle && !hasNodeTarget) {
    return [...DEFAULT_TEXT_EVENTS, ...node.events]
  }
  return node.events
}

/** 判断某动作在当前画布下是否可执行（处于目标子画布内部时不再重复打开自身） */
export function isActionActiveInCanvas(
  action: NodeEventAction,
  activeCanvasId: CanvasId | null = null,
): boolean {
  if (action.type === 'open-canvas' && action.canvasId === activeCanvasId) {
    return false
  }
  return true
}

/** 查找节点在指定目标对象与触发时机下可执行的事件绑定 */
export function findTriggeredEvent(
  node: PaperNode,
  trigger: NodeEventTrigger,
  activeCanvasId: CanvasId | null = null,
  target: NodeEventTarget = 'node',
): NodeEventBinding | undefined {
  return resolveNodeEvents(node).find(
    (binding) =>
      resolveBindingTarget(binding) === target &&
      binding.trigger === trigger &&
      isActionActiveInCanvas(binding.action, activeCanvasId),
  )
}

/** 查找节点本身上绑定的支线子画布 ID（若当前已在该子画布内则返回 null） */
export function findBoundSubCanvasId(
  node: PaperNode,
  activeCanvasId: CanvasId | null = null,
): CanvasId | null {
  for (const binding of resolveNodeEvents(node)) {
    if (
      resolveBindingTarget(binding) === 'node' &&
      binding.action.type === 'open-canvas' &&
      binding.action.canvasId !== activeCanvasId
    ) {
      return binding.action.canvasId
    }
  }
  return null
}
