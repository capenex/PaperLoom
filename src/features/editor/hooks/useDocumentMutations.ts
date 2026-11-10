import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { createId } from '@/shared/lib/id'
import type { CanvasId, DocumentDefaults, NodeId, PaperDocument } from '@/shared/types/paper'
import { addRootNode, applyInCanvas, toggleNodeInWatchlist, updateDocumentDefaults } from '../data/document'

interface DocumentMutationsOptions {
  readonly activeCanvasId: CanvasId | null
  readonly setDocument: Dispatch<SetStateAction<PaperDocument>>
  readonly setSelectedNodeId: Dispatch<SetStateAction<NodeId | null>>
  readonly setEditingNodeId: Dispatch<SetStateAction<NodeId | null>>
  readonly onResetCanvasStack?: () => void
}

export interface DocumentMutations {
  readonly addRoot: () => void
  readonly updateDefaults: (patch: Partial<DocumentDefaults>) => void
  readonly toggleWatchlist: (nodeId: NodeId) => void
  /** 用外部载入的文档整体替换当前画布（用于打开工程文件） */
  readonly replaceDocument: (document: PaperDocument) => void
}

/** 文档级宏观操作：在当前画布新增根节点、修改全局预设、替换整份文档 */
export function useDocumentMutations({
  activeCanvasId,
  setDocument,
  setSelectedNodeId,
  setEditingNodeId,
  onResetCanvasStack,
}: Readonly<DocumentMutationsOptions>): DocumentMutations {
  const addRoot = useCallback(() => {
    const newNodeId = createId()
    setDocument((current) =>
      applyInCanvas(current, activeCanvasId, (slice) => addRootNode(slice, newNodeId)),
    )
    setSelectedNodeId(newNodeId)
    setEditingNodeId(null)
  }, [activeCanvasId, setDocument, setSelectedNodeId, setEditingNodeId])

  const updateDefaults = useCallback(
    (patch: Partial<DocumentDefaults>) => {
      setDocument((current) => updateDocumentDefaults(current, patch))
    },
    [setDocument],
  )

  const toggleWatchlist = useCallback(
    (nodeId: NodeId) => {
      setDocument((current) => toggleNodeInWatchlist(current, nodeId))
    },
    [setDocument],
  )

  const replaceDocument = useCallback(
    (next: PaperDocument) => {
      setDocument(next)
      setSelectedNodeId(null)
      setEditingNodeId(null)
      onResetCanvasStack?.()
    },
    [onResetCanvasStack, setDocument, setSelectedNodeId, setEditingNodeId],
  )

  return { addRoot, updateDefaults, toggleWatchlist, replaceDocument }
}
