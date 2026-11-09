import { useCallback, useState } from 'react'

import type { DocumentDefaults, NodeId, PaperDocument } from '@/shared/types/paper'
import type { Point } from '../data/layout'
import { fitNodeSize } from '../lib/fitNodeSize'
import { decideStructureClick } from '../lib/pendingNodeAction'
import type { PendingNodeAction } from '../lib/pendingNodeAction'

interface PendingNodeActionOptions {
  readonly document: PaperDocument
  readonly defaults: DocumentDefaults
  readonly addParent: (nodeId: NodeId, targetId: NodeId) => void
  readonly detachAsRoot: (nodeId: NodeId, anchor: Point) => void
  readonly updateLayout: (nodeId: NodeId, patch: { width?: number; height?: number }) => void
  readonly selectNode: (nodeId: NodeId) => void
}

export interface PendingNodeActionControls {
  readonly pending: PendingNodeAction | null
  readonly armStructure: (selectedId: NodeId | null) => void
  readonly armFit: () => void
  readonly cancel: () => void
  /** 待命期点击节点：返回 true 表示已被待命指令消费 */
  readonly handleNodeClick: (nodeId: NodeId) => boolean
  /** 待命期点击空白（worldPoint 为点击处世界坐标）；null 代表 Esc，直接取消 */
  readonly handleBackground: (worldPoint: Point | null) => boolean
}

/** 编辑栏两个待命按钮：结构移动（Alt 等价）与贴合内容（Ctrl 等价） */
export function usePendingNodeAction(
  options: Readonly<PendingNodeActionOptions>,
): PendingNodeActionControls {
  const [pending, setPending] = useState<PendingNodeAction | null>(null)

  const cancel = useCallback(() => {
    setPending(null)
  }, [])

  const armStructure = useCallback(
    (selectedId: NodeId | null) => {
      setPending((current) =>
        current?.kind === 'structure' ? null : { kind: 'structure', sourceId: selectedId },
      )
    },
    [],
  )

  const armFit = useCallback(() => {
    setPending((current) => (current?.kind === 'fit' ? null : { kind: 'fit' }))
  }, [])

  const handleNodeClick = useCallback(
    (nodeId: NodeId): boolean => {
      if (pending === null) return false
      if (pending.kind === 'fit') {
        const node = options.document.nodes.find((item) => item.id === nodeId)
        const fitted = node === undefined ? null : fitNodeSize(node, options.defaults)
        if (node !== undefined && fitted !== null) {
          options.updateLayout(nodeId, fitted)
          options.selectNode(nodeId)
        }
        setPending(null)
        return true
      }
      const sourceId = pending.sourceId
      const decision = decideStructureClick(options.document, sourceId, nodeId, null)
      if (decision.type === 'pick-source') {
        setPending({ kind: 'structure', sourceId: decision.nodeId })
        options.selectNode(decision.nodeId)
        return true
      }
      if (decision.type === 'add-parent' && sourceId !== null) {
        options.addParent(sourceId, decision.targetId)
        setPending(null)
        return true
      }
      if (decision.type === 'cancel') {
        setPending(null)
        return true
      }
      return true
    },
    [pending, options],
  )

  const handleBackground = useCallback(
    (worldPoint: Point | null): boolean => {
      if (pending === null) return false
      if (pending.kind === 'fit' || worldPoint === null) {
        setPending(null)
        return true
      }
      const decision = decideStructureClick(options.document, pending.sourceId, null, worldPoint)
      if (decision.type === 'detach' && pending.sourceId !== null) {
        options.detachAsRoot(pending.sourceId, decision.anchor)
        setPending(null)
      }
      return true
    },
    [pending, options],
  )

  return { pending, armStructure, armFit, cancel, handleNodeClick, handleBackground }
}