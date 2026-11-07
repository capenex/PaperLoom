import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

import { parseReferenceAnchor, REFERENCE_KIND_ATTR } from '@/shared/lib/reference'
import type { NodeId, PaperNode, PaperReference } from '@/shared/types/paper'

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
  readonly imageExpanded: boolean
  readonly onSelect: (nodeId: NodeId) => void
  readonly onEdit: (nodeId: NodeId) => void
  readonly onOpenMediaDetail: (nodeId: NodeId) => void
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

/** 单击本地引用锚点：不跳转、只弹预览；返回是否已处理 */
function handleReferenceClick(
  event: ReactMouseEvent<HTMLDivElement>,
  onOpenReferencePreview: (reference: PaperReference, anchor: HTMLElement) => void,
): boolean {
  const anchor = referenceAnchorOf(event.target)
  if (anchor === null) return false
  event.preventDefault()
  const reference = parseReferenceAnchor(anchor)
  if (reference !== null) onOpenReferencePreview(reference, anchor)
  return true
}

/** 双击本地引用锚点：直接进入右侧详情（PDF 即全文引用页）；返回是否已处理 */
function handleReferenceDoubleClick(
  event: ReactMouseEvent<HTMLDivElement>,
  onOpenReferenceDetail: (reference: PaperReference) => void,
): boolean {
  const anchor = referenceAnchorOf(event.target)
  if (anchor === null) return false
  event.preventDefault()
  const reference = parseReferenceAnchor(anchor)
  if (reference !== null) onOpenReferenceDetail(reference)
  return true
}

/** 单击选中节点；已放大的图片节点再次单击打开右侧大图 */
function activateNode(
  node: PaperNode,
  expanded: boolean,
  onSelect: (nodeId: NodeId) => void,
  onOpenMediaDetail: (nodeId: NodeId) => void,
): void {
  if (node.content.kind === 'image' && expanded) {
    onOpenMediaDetail(node.id)
    return
  }
  onSelect(node.id)
}

export function cardHandlers({
  node,
  imageExpanded,
  onSelect,
  onEdit,
  onOpenMediaDetail,
  onOpenReferencePreview,
  onOpenReferenceDetail,
  onDragStart,
  shouldSuppressClick,
}: Readonly<NodeCardHandlerOptions>): NodeCardHandlers {
  const activate = (): void => {
    activateNode(node, imageExpanded, onSelect, onOpenMediaDetail)
  }

  return {
    onPointerDown: (event) => {
      onDragStart(node.id, event)
    },
    onClick: (event) => {
      event.stopPropagation()
      // 拖动结束时浏览器仍会补发一次 click，不能让它改变选中状态
      if (shouldSuppressClick()) return
      // 本地引用不跳转：单击只弹预览，也不改变节点选中
      if (handleReferenceClick(event, onOpenReferencePreview)) return
      activate()
    },
    onDoubleClick: (event) => {
      if (handleReferenceDoubleClick(event, onOpenReferenceDetail)) {
        event.stopPropagation()
        return
      }
      if (node.content.kind === 'image') return
      event.stopPropagation()
      onEdit(node.id)
    },
    onContextMenu: (event) => {
      event.stopPropagation()
    },
    onKeyDown: (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      activate()
    },
  }
}
