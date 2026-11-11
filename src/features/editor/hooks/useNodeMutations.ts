import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { createId } from '@/shared/lib/id'
import type {
  CanvasId,
  FileNodeContent,
  ImageNodeContent,
  ImageSlideItem,
  NodeContent,
  NodeEventBinding,
  NodeId,
  NodeLayout,
  PageSwitchMode,
  PaperDocument,
  StaticFileFormat,
} from '@/shared/types/paper'
import type { AddImageNodeTarget } from '../data/document'
import {
  addChildNode,
  addFileNode,
  addImageNode,
  addImagePageToNode,
  addRichTextNode,
  addSiblingNode,
  applyInCanvas,
  canDeleteNodeInCanvas,
  changeNodeKind,
  moveActiveImagePageInNode,
  removeActiveImagePageFromNode,
  removeNode,
  removeParentNode,
  replaceActiveImagePageInNode,
  switchNodePageInDocument,
  updateEventActionTarget,
  updateFileNodeContent,
  updateImageNodeContent,
  updateNodeEventsInDocument,
  updateNodeLayout,
  updateTextNodeContent,
  updateTitleNodeContent,
} from '../data/document'
import { setNodeHidden } from '../data/nodeVisibility'

interface NodeMutationsOptions {
  readonly activeCanvasId: CanvasId | null
  readonly setDocument: Dispatch<SetStateAction<PaperDocument>>
  readonly setSelectedNodeId: Dispatch<SetStateAction<NodeId | null>>
  readonly setEditingNodeId: Dispatch<SetStateAction<NodeId | null>>
  readonly setExpandedMediaNodeId: Dispatch<SetStateAction<NodeId | null>>
}

export interface NodeMutations {
  readonly addChild: (parentId: NodeId) => void
  readonly addSibling: (nodeId: NodeId) => void
  readonly addImage: (content: ImageNodeContent, target?: AddImageNodeTarget) => void
  readonly addFile: (content: FileNodeContent, target?: AddImageNodeTarget) => void
  readonly addRichText: (richText: string, target?: AddImageNodeTarget) => void
  readonly deleteNode: (nodeId: NodeId) => void
  readonly removeParent: (nodeId: NodeId, parentId: NodeId) => void
  readonly updateContent: (nodeId: NodeId, richText: string) => void
  readonly updateTitle: (nodeId: NodeId, title: string, subtitle: string) => void
  readonly changeKind: (nodeId: NodeId, kind: NodeContent['kind']) => void
  readonly updateImage: (nodeId: NodeId, src: string, alt: string) => void
  readonly replaceImagePage: (nodeId: NodeId, item: ImageSlideItem) => void
  readonly addImagePages: (nodeId: NodeId, items: readonly ImageSlideItem[]) => void
  readonly deleteImagePage: (nodeId: NodeId) => void
  readonly moveImagePage: (nodeId: NodeId, direction: 'left' | 'right') => void
  readonly updateFile: (
    nodeId: NodeId,
    fileName: string,
    format: StaticFileFormat,
    text: string,
  ) => void
  readonly updateLayout: (nodeId: NodeId, patch: Partial<NodeLayout>) => void
  readonly updateEvents: (nodeId: NodeId, events: readonly NodeEventBinding[]) => void
  readonly switchNodePage: (nodeId: NodeId, mode: PageSwitchMode, pageIndex?: number) => void
  readonly bindEventTarget: (nodeId: NodeId, bindingId: string, targetNodeId: NodeId) => void
  readonly setHidden: (nodeId: NodeId, hidden: boolean) => void
}

function useNodeInsertActions({
  activeCanvasId,
  setDocument,
  setSelectedNodeId,
  setEditingNodeId,
}: Readonly<NodeMutationsOptions>) {
  const addChild = useCallback(
    (parentId: NodeId) => {
      const newNodeId = createId()
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) => addChildNode(slice, parentId, newNodeId)),
      )
      setSelectedNodeId(newNodeId)
      setEditingNodeId(null)
    },
    [activeCanvasId, setDocument, setSelectedNodeId, setEditingNodeId],
  )
  const addSibling = useCallback(
    (nodeId: NodeId) => {
      const newNodeId = createId()
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) => addSiblingNode(slice, nodeId, newNodeId)),
      )
      setSelectedNodeId(newNodeId)
      setEditingNodeId(null)
    },
    [activeCanvasId, setDocument, setSelectedNodeId, setEditingNodeId],
  )
  const addImage = useCallback(
    (content: ImageNodeContent, target?: AddImageNodeTarget) => {
      const newNodeId = createId()
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) =>
          addImageNode(slice, newNodeId, content, target),
        ),
      )
      setSelectedNodeId(newNodeId)
      setEditingNodeId(null)
    },
    [activeCanvasId, setDocument, setSelectedNodeId, setEditingNodeId],
  )
  const addFile = useCallback(
    (content: FileNodeContent, target?: AddImageNodeTarget) => {
      const newNodeId = createId()
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) =>
          addFileNode(slice, newNodeId, content, target),
        ),
      )
      setSelectedNodeId(newNodeId)
      setEditingNodeId(null)
    },
    [activeCanvasId, setDocument, setSelectedNodeId, setEditingNodeId],
  )
  const addRichText = useCallback(
    (richText: string, target?: AddImageNodeTarget) => {
      const newNodeId = createId()
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) =>
          addRichTextNode(slice, newNodeId, richText, target),
        ),
      )
      setSelectedNodeId(newNodeId)
      setEditingNodeId(null)
    },
    [activeCanvasId, setDocument, setSelectedNodeId, setEditingNodeId],
  )
  return { addChild, addSibling, addImage, addFile, addRichText }
}

function useNodeDeleteAction({
  activeCanvasId,
  setDocument,
  setSelectedNodeId,
  setEditingNodeId,
  setExpandedMediaNodeId,
}: Readonly<NodeMutationsOptions>) {
  return useCallback(
    (nodeId: NodeId) => {
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) => {
          const target = slice.nodes.find((item) => item.id === nodeId)
          if (target === undefined || !canDeleteNodeInCanvas(curr, activeCanvasId, target)) {
            return slice
          }
          return removeNode(slice, nodeId)
        }),
      )
      setSelectedNodeId((curr) => (curr === nodeId ? null : curr))
      setEditingNodeId((curr) => (curr === nodeId ? null : curr))
      setExpandedMediaNodeId((curr) => (curr === nodeId ? null : curr))
    },
    [activeCanvasId, setDocument, setSelectedNodeId, setEditingNodeId, setExpandedMediaNodeId],
  )
}

function useNodeTextAndKindActions({
  activeCanvasId,
  setDocument,
  setEditingNodeId,
  setExpandedMediaNodeId,
}: Readonly<NodeMutationsOptions>) {
  const updateContent = useCallback(
    (nodeId: NodeId, richText: string) => {
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) =>
          updateTextNodeContent(slice, nodeId, richText),
        ),
      )
    },
    [activeCanvasId, setDocument],
  )
  const updateTitle = useCallback(
    (nodeId: NodeId, title: string, subtitle: string) => {
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) =>
          updateTitleNodeContent(slice, nodeId, title, subtitle),
        ),
      )
    },
    [activeCanvasId, setDocument],
  )
  const changeKind = useCallback(
    (nodeId: NodeId, kind: NodeContent['kind']) => {
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) => changeNodeKind(slice, nodeId, kind)),
      )
      if (kind !== 'text') {
        setEditingNodeId((curr) => (curr === nodeId ? null : curr))
      }
      if (kind !== 'image') {
        setExpandedMediaNodeId((curr) => (curr === nodeId ? null : curr))
      }
    },
    [activeCanvasId, setDocument, setEditingNodeId, setExpandedMediaNodeId],
  )
  return { updateContent, updateTitle, changeKind }
}

function useNodeAssetAndLayoutActions({
  activeCanvasId,
  setDocument,
  setEditingNodeId,
}: Readonly<NodeMutationsOptions>) {
  const updateImage = useCallback(
    (nodeId: NodeId, src: string, alt: string) => {
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) =>
          updateImageNodeContent(slice, nodeId, src, alt),
        ),
      )
      setEditingNodeId((curr) => (curr === nodeId ? null : curr))
    },
    [activeCanvasId, setDocument, setEditingNodeId],
  )
  const updateFile = useCallback(
    (nodeId: NodeId, fileName: string, format: StaticFileFormat, text: string) => {
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) =>
          updateFileNodeContent(slice, nodeId, fileName, format, text),
        ),
      )
      setEditingNodeId((curr) => (curr === nodeId ? null : curr))
    },
    [activeCanvasId, setDocument, setEditingNodeId],
  )
  const updateLayout = useCallback(
    (nodeId: NodeId, patch: Partial<NodeLayout>) => {
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) => updateNodeLayout(slice, nodeId, patch)),
      )
    },
    [activeCanvasId, setDocument],
  )
  const updateEvents = useCallback(
    (nodeId: NodeId, events: readonly NodeEventBinding[]) => {
      setDocument((curr) => updateNodeEventsInDocument(curr, activeCanvasId, nodeId, events))
    },
    [activeCanvasId, setDocument],
  )
  const switchNodePage = useCallback(
    (nodeId: NodeId, mode: PageSwitchMode, pageIndex?: number) => {
      setDocument((curr) =>
        switchNodePageInDocument(curr, nodeId, mode, pageIndex, activeCanvasId),
      )
    },
    [activeCanvasId, setDocument],
  )
  const bindEventTarget = useCallback(
    (nodeId: NodeId, bindingId: string, targetNodeId: NodeId) => {
      setDocument((curr) =>
        updateEventActionTarget(curr, activeCanvasId, nodeId, bindingId, targetNodeId),
      )
    },
    [activeCanvasId, setDocument],
  )
  const setHidden = useCallback(
    (nodeId: NodeId, hidden: boolean) => {
      setDocument((curr) =>
        applyInCanvas(curr, activeCanvasId, (slice) => setNodeHidden(slice, nodeId, hidden)),
      )
    },
    [activeCanvasId, setDocument],
  )
  return {
    updateImage,
    updateFile,
    updateLayout,
    updateEvents,
    switchNodePage,
    bindEventTarget,
    setHidden,
  }
}

function useNodeImagePageActions({
  activeCanvasId,
  setDocument,
}: Readonly<Pick<NodeMutationsOptions, 'activeCanvasId' | 'setDocument'>>) {
  const replaceImagePage = useCallback(
    (nodeId: NodeId, item: ImageSlideItem) => {
      setDocument((curr) => replaceActiveImagePageInNode(curr, nodeId, item, activeCanvasId))
    },
    [activeCanvasId, setDocument],
  )
  const addImagePages = useCallback(
    (nodeId: NodeId, items: readonly ImageSlideItem[]) => {
      setDocument((curr) => addImagePageToNode(curr, nodeId, items, activeCanvasId))
    },
    [activeCanvasId, setDocument],
  )
  const deleteImagePage = useCallback(
    (nodeId: NodeId) => {
      setDocument((curr) => removeActiveImagePageFromNode(curr, nodeId, activeCanvasId))
    },
    [activeCanvasId, setDocument],
  )
  const moveImagePage = useCallback(
    (nodeId: NodeId, direction: 'left' | 'right') => {
      setDocument((curr) => moveActiveImagePageInNode(curr, nodeId, direction, activeCanvasId))
    },
    [activeCanvasId, setDocument],
  )
  return { replaceImagePage, addImagePages, deleteImagePage, moveImagePage }
}

/** 文档结构与字段编辑操作（自动作用于当前激活的主画布或支线画布，并同步同源节点） */
export function useNodeMutations(options: Readonly<NodeMutationsOptions>): NodeMutations {
  const insertActions = useNodeInsertActions(options)
  const deleteNode = useNodeDeleteAction(options)
  const removeParent = useCallback(
    (nodeId: NodeId, parentId: NodeId) => {
      options.setDocument((curr) =>
        applyInCanvas(curr, options.activeCanvasId, (slice) =>
          removeParentNode(slice, nodeId, parentId),
        ),
      )
    },
    [options],
  )
  const textAndKindActions = useNodeTextAndKindActions(options)
  const assetAndLayoutActions = useNodeAssetAndLayoutActions(options)
  const imagePageActions = useNodeImagePageActions(options)
  return {
    ...insertActions,
    deleteNode,
    removeParent,
    ...textAndKindActions,
    ...assetAndLayoutActions,
    ...imagePageActions,
  }
}
