import { useCallback, useMemo, useState } from 'react'

import type { CanvasId, NodeEventAction, NodeId, PaperDocument } from '@/shared/types/paper'
import {
  activeCanvasDocument,
  createInitialDocument,
  resolveWatchlistNodes,
} from '../data/document'
import { useCanvasNavigation } from './useCanvasNavigation'
import { useDocumentMutations } from './useDocumentMutations'
import { useEditorSelection } from './useEditorSelection'
import { useNodeClipboard } from './useNodeClipboard'
import { useNodeMutations } from './useNodeMutations'
import { usePendingNodeAction } from './usePendingNodeAction'
import { useSlideAndFilePoolActions } from './useSlideAndFilePoolActions'
import { useStructureMutations } from './useStructureMutations'

/** 编辑器状态：持有主文档与支线画布导航栈，暴露单节点编辑、事件绑定、文件池与幻灯片画板操作 */
export function useEditor() {
  const [document, setDocument] = useState<PaperDocument>(createInitialDocument)
  const [activeCanvasHint, setActiveCanvasHint] = useState<CanvasId | null>(null)
  const currentSlice = useMemo(() => activeCanvasDocument(document, activeCanvasHint), [document, activeCanvasHint])
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
  if (navigation.activeCanvasId !== activeCanvasHint) setActiveCanvasHint(navigation.activeCanvasId)

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

  const nodeMutations = useNodeMutations(mutationContext)
  const documentMutations = useDocumentMutations(mutationContext)
  const structure = useStructureMutations(mutationContext)
  const clipboard = useNodeClipboard({
    document,
    activeCanvasId: navigation.activeCanvasId,
    selectedNodeId: selection.selectedNode?.id ?? null,
    editingNodeId: selection.editingNodeId,
    setDocument,
    setSelectedNodeId: selection.setSelectedNodeId,
    onDeleteNode: nodeMutations.deleteNode,
  })
  const pendingActions = usePendingNodeAction({
    document: currentSlice,
    defaults: currentSlice.defaults,
    addParent: structure.addParent,
    detachAsRoot: structure.detachAsRoot,
    updateLayout: nodeMutations.updateLayout,
    selectNode: selection.setSelectedNodeId,
    bindEventTarget: nodeMutations.bindEventTarget,
  })
  const slideAndPool = useSlideAndFilePoolActions({
    document,
    activeNodes: currentSlice.nodes,
    selectedNode: selection.selectedNode,
    nodeMutations,
    replaceDocument: documentMutations.replaceDocument,
  })

  const triggerNodeEvent = useCallback(
    (nodeId: NodeId, action: NodeEventAction) => {
      if (action.type === 'switch-node-page') {
        nodeMutations.switchNodePage(action.targetNodeId, action.mode, action.pageIndex)
        return
      }
      navigation.triggerNodeEvent(nodeId, action)
    },
    [navigation, nodeMutations],
  )

  return {
    document,
    ...selection,
    ...navigation,
    ...nodeMutations,
    ...documentMutations,
    ...structure,
    ...clipboard,
    ...slideAndPool,
    pending: pendingActions.pending,
    armStructure: pendingActions.armStructure,
    armFit: pendingActions.armFit,
    armEventTargetPick: pendingActions.armEventTargetPick,
    cancelPending: pendingActions.cancel,
    pendingNodeClick: pendingActions.handleNodeClick,
    pendingBackground: pendingActions.handleBackground,
    triggerNodeEvent,
    watchlistNodes: resolveWatchlistNodes(document),
  }
}
