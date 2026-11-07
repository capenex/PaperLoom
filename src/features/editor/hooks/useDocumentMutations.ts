import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { createId } from '@/shared/lib/id'
import type { DocumentDefaults, NodeId, PaperDocument } from '@/shared/types/paper'
import { addRootNode, updateDocumentDefaults } from '../data/document'

interface DocumentMutationsOptions {
  readonly setDocument: Dispatch<SetStateAction<PaperDocument>>
  readonly setSelectedNodeId: Dispatch<SetStateAction<NodeId | null>>
  readonly setEditingNodeId: Dispatch<SetStateAction<NodeId | null>>
}

export interface DocumentMutations {
  readonly addRoot: () => void
  readonly updateDefaults: (patch: Partial<DocumentDefaults>) => void
  /** 用外部载入的文档整体替换当前画布（用于打开工程文件） */
  readonly replaceDocument: (document: PaperDocument) => void
}

/** 文档级宏观操作：新增一棵树的根节点、修改全局预设；与单节点编辑无关 */
export function useDocumentMutations({
  setDocument,
  setSelectedNodeId,
  setEditingNodeId,
}: Readonly<DocumentMutationsOptions>): DocumentMutations {
  const addRoot = useCallback(() => {
    const newNodeId = createId()
    setDocument((current) => addRootNode(current, newNodeId))
    setSelectedNodeId(newNodeId)
    setEditingNodeId(null)
  }, [setDocument, setSelectedNodeId, setEditingNodeId])

  const updateDefaults = useCallback(
    (patch: Partial<DocumentDefaults>) => {
      setDocument((current) => updateDocumentDefaults(current, patch))
    },
    [setDocument],
  )

  const replaceDocument = useCallback(
    (next: PaperDocument) => {
      setDocument(next)
      setSelectedNodeId(null)
      setEditingNodeId(null)
    },
    [setDocument, setSelectedNodeId, setEditingNodeId],
  )

  return { addRoot, updateDefaults, replaceDocument }
}
