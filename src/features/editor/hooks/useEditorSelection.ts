import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { NodeId, PaperNode } from '@/shared/types/paper'
import { useDetailSlot } from './useDetailSlot'
import type { DetailSlotState } from './useDetailSlot'

export interface EditorSelectionState extends DetailSlotState {
  readonly selectedNodeId: NodeId | null
  readonly selectedNode: PaperNode | undefined
  readonly editingNodeId: NodeId | null
  readonly selectNode: (nodeId: NodeId | null) => void
  readonly startEditing: (nodeId: NodeId) => void
  readonly stopEditing: () => void
  readonly setSelectedNodeId: Dispatch<SetStateAction<NodeId | null>>
  readonly setEditingNodeId: Dispatch<SetStateAction<NodeId | null>>
}

function findSelectedNode(
  nodes: readonly PaperNode[],
  selectedNodeId: NodeId | null,
): PaperNode | undefined {
  if (selectedNodeId === null) return undefined
  return nodes.find((node) => node.id === selectedNodeId)
}

/** 选中、编辑与右侧详情状态；选中其他节点或空白处会退出图片放大 */
export function useEditorSelection(nodes: readonly PaperNode[]): EditorSelectionState {
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<NodeId | null>(null)
  const detail = useDetailSlot(nodes)
  const { expandMediaNode, collapseExpandedMedia } = detail

  const selectNode = useCallback(
    (nodeId: NodeId | null) => {
      setSelectedNodeId(nodeId)
      setEditingNodeId((current) => (current === nodeId ? current : null))
      if (nodeId === null) collapseExpandedMedia()
      else expandMediaNode(nodeId)
    },
    [collapseExpandedMedia, expandMediaNode],
  )
  const startEditing = useCallback(
    (nodeId: NodeId) => {
      setSelectedNodeId(nodeId)
      setEditingNodeId(nodeId)
      collapseExpandedMedia()
    },
    [collapseExpandedMedia],
  )
  const stopEditing = useCallback(() => {
    setEditingNodeId(null)
  }, [])

  return {
    ...detail,
    selectedNodeId,
    selectedNode: findSelectedNode(nodes, selectedNodeId),
    editingNodeId,
    selectNode,
    startEditing,
    stopEditing,
    setSelectedNodeId,
    setEditingNodeId,
  }
}
