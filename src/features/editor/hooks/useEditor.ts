import { useMemo, useState } from 'react'

import type { PaperDocument } from '@/shared/types/paper'
import { createInitialDocument } from '../data/document'
import { useDocumentMutations } from './useDocumentMutations'
import { useEditorSelection } from './useEditorSelection'
import { useNodeMutations } from './useNodeMutations'
import { useStructureMutations } from './useStructureMutations'

/** 编辑器状态：持有文档、选中/编辑/放大的节点，暴露单节点编辑、结构拖动与文档级宏观操作 */
export function useEditor() {
  const [document, setDocument] = useState<PaperDocument>(createInitialDocument)
  const selection = useEditorSelection(document.nodes)
  const setters = useMemo(
    () => ({
      setDocument,
      setSelectedNodeId: selection.setSelectedNodeId,
      setEditingNodeId: selection.setEditingNodeId,
      setExpandedMediaNodeId: selection.setExpandedMediaNodeId,
    }),
    [selection.setSelectedNodeId, selection.setEditingNodeId, selection.setExpandedMediaNodeId],
  )

  const nodeMutations = useNodeMutations(setters)
  const documentMutations = useDocumentMutations(setters)
  const structureMutations = useStructureMutations(setters)

  return {
    document,
    selectedNodeId: selection.selectedNodeId,
    selectedNode: selection.selectedNode,
    editingNodeId: selection.editingNodeId,
    expandedMediaNodeId: selection.expandedMediaNodeId,
    detailMediaNodeId: selection.detailMediaNodeId,
    detailReference: selection.detailReference,
    selectNode: selection.selectNode,
    startEditing: selection.startEditing,
    stopEditing: selection.stopEditing,
    collapseExpandedMedia: selection.collapseExpandedMedia,
    openMediaDetail: selection.openMediaDetail,
    openReferenceDetail: selection.openReferenceDetail,
    collapseDetail: selection.collapseDetail,
    ...nodeMutations,
    ...documentMutations,
    ...structureMutations,
  }
}
