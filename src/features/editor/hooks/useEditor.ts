import { useCallback, useState } from 'react'

import type { NodeId, PaperDocument } from '@/shared/types/paper'
import { createInitialDocument } from '../data/document'
import { useNodeMutations } from './useNodeMutations'

/** 编辑器状态：持有文档、当前选中节点与正在编辑的节点，暴露结构、内容、尺寸编辑操作 */
export function useEditor() {
  const [document, setDocument] = useState<PaperDocument>(createInitialDocument)
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<NodeId | null>(null)

  const selectNode = useCallback((nodeId: NodeId | null) => {
    setSelectedNodeId(nodeId)
    setEditingNodeId((current) => (current === nodeId ? current : null))
  }, [])

  const startEditing = useCallback((nodeId: NodeId) => {
    setSelectedNodeId(nodeId)
    setEditingNodeId(nodeId)
  }, [])

  const stopEditing = useCallback(() => {
    setEditingNodeId(null)
  }, [])

  const { addChild, addSibling, deleteNode, updateContent, updateLayout } = useNodeMutations({
    setDocument,
    setSelectedNodeId,
    setEditingNodeId,
  })

  const selectedNode =
    selectedNodeId === null
      ? undefined
      : document.nodes.find((node) => node.id === selectedNodeId)

  return {
    document,
    selectedNodeId,
    selectedNode,
    editingNodeId,
    selectNode,
    startEditing,
    stopEditing,
    addChild,
    addSibling,
    deleteNode,
    updateContent,
    updateLayout,
  }
}
