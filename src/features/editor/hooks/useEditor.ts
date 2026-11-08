import { useCallback, useMemo, useState } from 'react'

import type { CanvasId, PaperDocument } from '@/shared/types/paper'
import { activeCanvasDocument, createInitialDocument } from '../data/document'
import { useCanvasNavigation } from './useCanvasNavigation'
import { useDocumentMutations } from './useDocumentMutations'
import { useEditorSelection } from './useEditorSelection'
import { useNodeMutations } from './useNodeMutations'
import { useStructureMutations } from './useStructureMutations'

/** 编辑器状态：持有主文档与支线画布导航栈，暴露单节点编辑、事件绑定、结构拖动与文档级操作 */
export function useEditor() {
  const [document, setDocument] = useState<PaperDocument>(createInitialDocument)
  const [activeCanvasHint, setActiveCanvasHint] = useState<CanvasId | null>(null)
  const currentSlice = useMemo(
    () => activeCanvasDocument(document, activeCanvasHint),
    [document, activeCanvasHint],
  )
  const selection = useEditorSelection(currentSlice.nodes)
  const resetCanvasSelection = useCallback(() => {
    selection.setSelectedNodeId(null)
    selection.setEditingNodeId(null)
    selection.collapseExpandedMedia()
  }, [selection])

  const navigation = useCanvasNavigation({
    document,
    setDocument,
    resetCanvasSelection,
    openMediaDetail: selection.openMediaDetail,
    startEditing: selection.startEditing,
  })
  if (navigation.activeCanvasId !== activeCanvasHint) {
    setActiveCanvasHint(navigation.activeCanvasId)
  }

  const mutationContext = useMemo(
    () => ({
      activeCanvasId: navigation.activeCanvasId,
      setDocument,
      setSelectedNodeId: selection.setSelectedNodeId,
      setEditingNodeId: selection.setEditingNodeId,
      setExpandedMediaNodeId: selection.setExpandedMediaNodeId,
      onResetCanvasStack: () => {
        navigation.navigateToCanvas(null)
      },
    }),
    [navigation, selection.setSelectedNodeId, selection.setEditingNodeId, selection.setExpandedMediaNodeId],
  )

  return {
    document,
    ...selection,
    ...navigation,
    ...useNodeMutations(mutationContext),
    ...useDocumentMutations(mutationContext),
    ...useStructureMutations(mutationContext),
  }
}
