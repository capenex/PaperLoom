import type { NodeId } from '@/shared/types/paper'

/** 世界层缩放比例：舞台元素的渲染宽度与布局宽度之比 */
export function measureWorldZoom(stage: HTMLElement | null): number {
  if (stage === null || stage.offsetWidth === 0) return 1
  return stage.getBoundingClientRect().width / stage.offsetWidth
}

/** 指针下方的节点卡片 ID；被拖动子树自身不算命中，因此结果就是可挂载的目标 */
export function cardIdAtPoint(
  clientX: number,
  clientY: number,
  excluded: ReadonlySet<NodeId>,
): NodeId | null {
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    const card = element.closest('[data-node-id]')
    if (card === null) continue
    const nodeId = card.getAttribute('data-node-id')
    if (nodeId === null || excluded.has(nodeId)) continue
    return nodeId
  }

  return null
}
