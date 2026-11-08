import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { CanvasId, NodeId, PaperDocument } from '@/shared/types/paper'
import { addParentNode, applyInCanvas, detachNodeAsRoot, moveRootAnchor } from '../data/document'
import type { Point } from '../data/layout'

interface StructureMutationsOptions {
  readonly activeCanvasId: CanvasId | null
  readonly setDocument: Dispatch<SetStateAction<PaperDocument>>
  readonly setSelectedNodeId: Dispatch<SetStateAction<NodeId | null>>
}

export interface StructureMutations {
  readonly moveRoot: (nodeId: NodeId, anchor: Point) => void
  readonly addParent: (nodeId: NodeId, targetId: NodeId) => void
  readonly detachAsRoot: (nodeId: NodeId, anchor: Point) => void
}

/** Alt 拖动落点确定的结构操作：移动根节点锚点、追加父节点、脱离为新根 */
export function useStructureMutations({
  activeCanvasId,
  setDocument,
  setSelectedNodeId,
}: Readonly<StructureMutationsOptions>): StructureMutations {
  const moveRoot = useCallback(
    (nodeId: NodeId, anchor: Point) => {
      setDocument((current) =>
        applyInCanvas(current, activeCanvasId, (slice) => moveRootAnchor(slice, nodeId, anchor)),
      )
      setSelectedNodeId(nodeId)
    },
    [activeCanvasId, setDocument, setSelectedNodeId],
  )

  const addParent = useCallback(
    (nodeId: NodeId, targetId: NodeId) => {
      setDocument((current) =>
        applyInCanvas(current, activeCanvasId, (slice) => addParentNode(slice, nodeId, targetId)),
      )
      setSelectedNodeId(nodeId)
    },
    [activeCanvasId, setDocument, setSelectedNodeId],
  )

  const detachAsRoot = useCallback(
    (nodeId: NodeId, anchor: Point) => {
      setDocument((current) =>
        applyInCanvas(current, activeCanvasId, (slice) => detachNodeAsRoot(slice, nodeId, anchor)),
      )
      setSelectedNodeId(nodeId)
    },
    [activeCanvasId, setDocument, setSelectedNodeId],
  )

  return { moveRoot, addParent, detachAsRoot }
}
