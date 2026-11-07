import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { createId } from '@/shared/lib/id'
import type { NodeId, NodeLayout, PaperDocument } from '@/shared/types/paper'
import {
  addChildNode,
  addSiblingNode,
  removeNode,
  updateNodeLayout,
  updateTextNodeContent,
} from '../data/document'

interface NodeMutationsOptions {
  readonly setDocument: Dispatch<SetStateAction<PaperDocument>>
  readonly setSelectedNodeId: Dispatch<SetStateAction<NodeId | null>>
  readonly setEditingNodeId: Dispatch<SetStateAction<NodeId | null>>
  readonly setExpandedMediaNodeId: Dispatch<SetStateAction<NodeId | null>>
}

export interface NodeMutations {
  readonly addChild: (parentId: NodeId) => void
  readonly addSibling: (nodeId: NodeId) => void
  readonly deleteNode: (nodeId: NodeId) => void
  readonly updateContent: (nodeId: NodeId, richText: string) => void
  readonly updateLayout: (nodeId: NodeId, patch: Partial<NodeLayout>) => void
}

/** 文档结构与字段编辑操作，新增节点后同步选中并退出编辑态 */
export function useNodeMutations({
  setDocument,
  setSelectedNodeId,
  setEditingNodeId,
  setExpandedMediaNodeId,
}: Readonly<NodeMutationsOptions>): NodeMutations {
  const addChild = useCallback(
    (parentId: NodeId) => {
      const newNodeId = createId()
      setDocument((current) => addChildNode(current, parentId, newNodeId))
      setSelectedNodeId(newNodeId)
      setEditingNodeId(null)
    },
    [setDocument, setSelectedNodeId, setEditingNodeId],
  )
  const addSibling = useCallback(
    (nodeId: NodeId) => {
      const newNodeId = createId()
      setDocument((current) => addSiblingNode(current, nodeId, newNodeId))
      setSelectedNodeId(newNodeId)
      setEditingNodeId(null)
    },
    [setDocument, setSelectedNodeId, setEditingNodeId],
  )
  const deleteNode = useCallback(
    (nodeId: NodeId) => {
      setDocument((current) => removeNode(current, nodeId))
      setSelectedNodeId((current) => (current === nodeId ? null : current))
      setEditingNodeId((current) => (current === nodeId ? null : current))
      setExpandedMediaNodeId((current) => (current === nodeId ? null : current))
    },
    [setDocument, setSelectedNodeId, setEditingNodeId, setExpandedMediaNodeId],
  )
  const updateContent = useCallback(
    (nodeId: NodeId, richText: string) => {
      setDocument((current) => updateTextNodeContent(current, nodeId, richText))
    },
    [setDocument],
  )

  const updateLayout = useCallback(
    (nodeId: NodeId, patch: Partial<NodeLayout>) => {
      setDocument((current) => updateNodeLayout(current, nodeId, patch))
    },
    [setDocument],
  )

  return { addChild, addSibling, deleteNode, updateContent, updateLayout }
}
