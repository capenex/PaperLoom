import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { createId } from '@/shared/lib/id'
import type {
  CanvasId,
  ImageNodeContent,
  NodeContent,
  NodeEventBinding,
  NodeId,
  NodeLayout,
  PaperDocument,
  StaticFileFormat,
} from '@/shared/types/paper'
import type { AddImageNodeTarget } from '../data/document'
import {
  addChildNode,
  addImageNode,
  addSiblingNode,
  applyInCanvas,
  canDeleteNodeInCanvas,
  changeNodeKind,
  removeNode,
  updateFileNodeContent,
  updateImageNodeContent,
  updateNodeEventsInDocument,
  updateNodeLayout,
  updateTextNodeContent,
  updateTitleNodeContent,
} from '../data/document'

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
  readonly deleteNode: (nodeId: NodeId) => void
  readonly updateContent: (nodeId: NodeId, richText: string) => void
  readonly updateTitle: (nodeId: NodeId, title: string, subtitle: string) => void
  readonly changeKind: (nodeId: NodeId, kind: NodeContent['kind']) => void
  readonly updateImage: (nodeId: NodeId, src: string, alt: string) => void
  readonly updateFile: (
    nodeId: NodeId,
    fileName: string,
    format: StaticFileFormat,
    text: string,
  ) => void
  readonly updateLayout: (nodeId: NodeId, patch: Partial<NodeLayout>) => void
  readonly updateEvents: (nodeId: NodeId, events: readonly NodeEventBinding[]) => void
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
  return { addChild, addSibling, addImage }
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
      if (kind !== 'text' && kind !== 'title') {
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
  return { updateImage, updateFile, updateLayout, updateEvents }
}

/** 文档结构与字段编辑操作（自动作用于当前激活的主画布或支线画布，并同步同源节点） */
export function useNodeMutations(options: Readonly<NodeMutationsOptions>): NodeMutations {
  const insertActions = useNodeInsertActions(options)
  const deleteNode = useNodeDeleteAction(options)
  const textAndKindActions = useNodeTextAndKindActions(options)
  const assetAndLayoutActions = useNodeAssetAndLayoutActions(options)
  return { ...insertActions, deleteNode, ...textAndKindActions, ...assetAndLayoutActions }
}
