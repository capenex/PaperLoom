import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { createId } from '@/shared/lib/id'
import type {
  ImageNodeContent,
  NodeContent,
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
  changeNodeKind,
  removeNode,
  updateFileNodeContent,
  updateImageNodeContent,
  updateNodeLayout,
  updateTextNodeContent,
  updateTitleNodeContent,
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
}

function useNodeTreeActions({
  setDocument,
  setSelectedNodeId,
  setEditingNodeId,
  setExpandedMediaNodeId,
}: Readonly<NodeMutationsOptions>) {
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
  const addImage = useCallback(
    (content: ImageNodeContent, target?: AddImageNodeTarget) => {
      const newNodeId = createId()
      setDocument((current) => addImageNode(current, newNodeId, content, target))
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

  return { addChild, addSibling, addImage, deleteNode }
}

function useNodeTextAndKindActions({
  setDocument,
  setEditingNodeId,
  setExpandedMediaNodeId,
}: Readonly<NodeMutationsOptions>) {
  const updateContent = useCallback(
    (nodeId: NodeId, richText: string) => {
      setDocument((current) => updateTextNodeContent(current, nodeId, richText))
    },
    [setDocument],
  )
  const updateTitle = useCallback(
    (nodeId: NodeId, title: string, subtitle: string) => {
      setDocument((current) => updateTitleNodeContent(current, nodeId, title, subtitle))
    },
    [setDocument],
  )
  const changeKind = useCallback(
    (nodeId: NodeId, kind: NodeContent['kind']) => {
      setDocument((current) => changeNodeKind(current, nodeId, kind))
      if (kind !== 'text' && kind !== 'title') {
        setEditingNodeId((current) => (current === nodeId ? null : current))
      }
      if (kind !== 'image') {
        setExpandedMediaNodeId((current) => (current === nodeId ? null : current))
      }
    },
    [setDocument, setEditingNodeId, setExpandedMediaNodeId],
  )

  return { updateContent, updateTitle, changeKind }
}

function useNodeAssetAndLayoutActions({
  setDocument,
  setEditingNodeId,
}: Readonly<NodeMutationsOptions>) {
  const updateImage = useCallback(
    (nodeId: NodeId, src: string, alt: string) => {
      setDocument((current) => updateImageNodeContent(current, nodeId, src, alt))
      setEditingNodeId((current) => (current === nodeId ? null : current))
    },
    [setDocument, setEditingNodeId],
  )
  const updateFile = useCallback(
    (nodeId: NodeId, fileName: string, format: StaticFileFormat, text: string) => {
      setDocument((current) => updateFileNodeContent(current, nodeId, fileName, format, text))
      setEditingNodeId((current) => (current === nodeId ? null : current))
    },
    [setDocument, setEditingNodeId],
  )
  const updateLayout = useCallback(
    (nodeId: NodeId, patch: Partial<NodeLayout>) => {
      setDocument((current) => updateNodeLayout(current, nodeId, patch))
    },
    [setDocument],
  )

  return { updateImage, updateFile, updateLayout }
}

/** 文档结构与字段编辑操作，新增节点后同步选中并退出编辑态 */
export function useNodeMutations(options: Readonly<NodeMutationsOptions>): NodeMutations {
  const treeActions = useNodeTreeActions(options)
  const textAndKindActions = useNodeTextAndKindActions(options)
  const assetAndLayoutActions = useNodeAssetAndLayoutActions(options)
  return { ...treeActions, ...textAndKindActions, ...assetAndLayoutActions }
}
