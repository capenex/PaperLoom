import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { NodeId, PaperDocument } from '@/shared/types/paper'
import { detachNodeAsRoot, moveRootAnchor, reparentNode } from '../data/document'
import type { Point } from '../data/layout'

interface StructureMutationsOptions {
  readonly setDocument: Dispatch<SetStateAction<PaperDocument>>
  readonly setSelectedNodeId: Dispatch<SetStateAction<NodeId | null>>
}

export interface StructureMutations {
  readonly moveRoot: (nodeId: NodeId, anchor: Point) => void
  readonly reparentNode: (nodeId: NodeId, targetId: NodeId) => void
  readonly detachAsRoot: (nodeId: NodeId, anchor: Point) => void
}

/** Alt 拖动落点确定的结构操作：移动根节点锚点、改挂父节点、脱离为新根 */
export function useStructureMutations({
  setDocument,
  setSelectedNodeId,
}: Readonly<StructureMutationsOptions>): StructureMutations {
  const moveRoot = useCallback(
    (nodeId: NodeId, anchor: Point) => {
      setDocument((current) => moveRootAnchor(current, nodeId, anchor))
      setSelectedNodeId(nodeId)
    },
    [setDocument, setSelectedNodeId],
  )

  const reparent = useCallback(
    (nodeId: NodeId, targetId: NodeId) => {
      setDocument((current) => reparentNode(current, nodeId, targetId))
      setSelectedNodeId(nodeId)
    },
    [setDocument, setSelectedNodeId],
  )

  const detachAsRoot = useCallback(
    (nodeId: NodeId, anchor: Point) => {
      setDocument((current) => detachNodeAsRoot(current, nodeId, anchor))
      setSelectedNodeId(nodeId)
    },
    [setDocument, setSelectedNodeId],
  )

  return { moveRoot, reparentNode: reparent, detachAsRoot }
}
