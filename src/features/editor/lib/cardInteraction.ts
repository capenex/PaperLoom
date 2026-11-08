import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

import { findTriggeredEvent } from '@/shared/lib/nodeEvents'
import { parseReferenceAnchor, REFERENCE_KIND_ATTR } from '@/shared/lib/reference'
import type { CanvasId, NodeEventAction, NodeId, PaperNode, PaperReference } from '@/shared/types/paper'

/** 卡片的全部指针与键盘交互，集中在一处以便组件本身保持简短 */
export interface NodeCardHandlers {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onClick: (event: ReactMouseEvent<HTMLDivElement>) => void
  readonly onDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => void
  readonly onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
}

export interface NodeCardHandlerOptions {
  readonly node: PaperNode
  readonly selected: boolean
  readonly imageExpanded: boolean
  readonly activeCanvasId?: CanvasId | null
  readonly onSelect: (nodeId: NodeId) => void
  readonly onEdit: (nodeId: NodeId) => void
  readonly onTriggerEvent: (nodeId: NodeId, action: NodeEventAction) => void
  readonly onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void
  readonly onOpenReferenceDetail: (reference: PaperReference) => void
  readonly onDragStart: (nodeId: NodeId, event: ReactPointerEvent<HTMLElement>) => void
  readonly shouldSuppressClick: () => boolean
}

/** 事件落点上的本地引用锚点；常规超链接与纯文本返回 null */
function referenceAnchorOf(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  return target.closest(`a[${REFERENCE_KIND_ATTR}]`)
}

/** 触发本地引用锚点上的绑定事件（target = 'reference'）；常规超链接与纯文本返回 false */
function handleReferenceTrigger(
  event: ReactMouseEvent<HTMLDivElement>,
  node: PaperNode,
  trigger: 'click' | 'double-click',
  activeCanvasId: CanvasId | null,
  onTriggerEvent: (nodeId: NodeId, action: NodeEventAction) => void,
  onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void,
  onOpenReferenceDetail: (reference: PaperReference) => void,
): boolean {
  const anchor = referenceAnchorOf(event.target)
  if (anchor === null) return false
  event.preventDefault()
  const reference = parseReferenceAnchor(anchor)
  if (reference === null) return true

  const binding = findTriggeredEvent(node, trigger, activeCanvasId, 'reference')
  if (binding === undefined) return true

  if (binding.action.type === 'open-reference-preview') {
    onOpenReferencePreview(reference, anchor)
  } else if (binding.action.type === 'open-detail') {
    onOpenReferenceDetail(reference)
  } else {
    onTriggerEvent(node.id, binding.action)
  }
  return true
}

/** 单击节点：未选中时先选中（图片同步 1.5x 放大），已选中时优先触发 second-click 事件（如图片默认弹窗） */
function activateNode(
  node: PaperNode,
  selected: boolean,
  expanded: boolean,
  activeCanvasId: CanvasId | null,
  onSelect: (nodeId: NodeId) => void,
  onTriggerEvent: (nodeId: NodeId, action: NodeEventAction) => void,
): void {
  const alreadyActive = selected || (node.content.kind === 'image' && expanded)
  if (alreadyActive) {
    const secondClickEvent = findTriggeredEvent(node, 'second-click', activeCanvasId, 'node')
    if (secondClickEvent !== undefined) {
      onTriggerEvent(node.id, secondClickEvent.action)
      return
    }
  }

  onSelect(node.id)
  const clickEvent = findTriggeredEvent(node, 'click', activeCanvasId, 'node')
  if (clickEvent !== undefined) {
    onTriggerEvent(node.id, clickEvent.action)
  }
}

function handleCardDoubleClick(
  event: ReactMouseEvent<HTMLDivElement>,
  node: PaperNode,
  activeCanvasId: CanvasId | null,
  onEdit: (nodeId: NodeId) => void,
  onTriggerEvent: (nodeId: NodeId, action: NodeEventAction) => void,
  onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void,
  onOpenReferenceDetail: (reference: PaperReference) => void,
): void {
  if (
    handleReferenceTrigger(
      event,
      node,
      'double-click',
      activeCanvasId,
      onTriggerEvent,
      onOpenReferencePreview,
      onOpenReferenceDetail,
    )
  ) {
    event.stopPropagation()
    return
  }
  event.stopPropagation()

  const isEditableText = node.content.kind === 'text' || node.content.kind === 'title'
  // 按住 Alt 双击始终强制进入文字编辑，避免双击事件改绑后无法编辑文字
  if (event.altKey && isEditableText) {
    onEdit(node.id)
    return
  }

  const dblClickEvent = findTriggeredEvent(node, 'double-click', activeCanvasId, 'node')
  if (dblClickEvent !== undefined) {
    onTriggerEvent(node.id, dblClickEvent.action)
  }
}

export function cardHandlers(options: Readonly<NodeCardHandlerOptions>): NodeCardHandlers {
  const { node, selected, imageExpanded, activeCanvasId = null } = options
  const activate = (): void => {
    activateNode(node, selected, imageExpanded, activeCanvasId, options.onSelect, options.onTriggerEvent)
  }
  const fireRef = (event: ReactMouseEvent<HTMLDivElement>, trigger: 'click' | 'double-click'): boolean =>
    handleReferenceTrigger(
      event,
      node,
      trigger,
      activeCanvasId,
      options.onTriggerEvent,
      options.onOpenReferencePreview,
      options.onOpenReferenceDetail,
    )

  return {
    onPointerDown: (event) => { options.onDragStart(node.id, event) },
    onClick: (event) => {
      event.stopPropagation()
      if (options.shouldSuppressClick()) return
      if (!fireRef(event, 'click')) activate()
    },
    onDoubleClick: (event) => {
      handleCardDoubleClick(
        event,
        node,
        activeCanvasId,
        options.onEdit,
        options.onTriggerEvent,
        options.onOpenReferencePreview,
        options.onOpenReferenceDetail,
      )
    },
    onContextMenu: (event) => { event.stopPropagation() },
    onKeyDown: (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      activate()
    },
  }
}
