import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { NodeId, PaperNode, PaperReference } from '@/shared/types/paper'
import { useMediaExpansion } from './useMediaExpansion'

export interface DetailSlotState {
  readonly expandedMediaNodeId: NodeId | null
  readonly detailMediaNodeId: NodeId | null
  readonly detailReference: PaperReference | null
  readonly expandMediaNode: (nodeId: NodeId) => void
  readonly openMediaDetail: (nodeId: NodeId) => void
  readonly collapseExpandedMedia: () => void
  readonly openReferenceDetail: (reference: PaperReference) => void
  readonly collapseDetail: () => void
  readonly setExpandedMediaNodeId: Dispatch<SetStateAction<NodeId | null>>
}

/** 图片详情与本地引用详情共用右侧面板，打开其一会收起另一个 */
export function useDetailSlot(nodes: readonly PaperNode[]): DetailSlotState {
  const {
    expandedMediaNodeId,
    detailMediaNodeId,
    expandMediaNode: expandMedia,
    openMediaDetail: openMedia,
    collapseExpandedMedia: collapseMedia,
    collapseMediaDetail,
    setExpandedMediaNodeId,
  } = useMediaExpansion(nodes)
  const [detailReference, setDetailReference] = useState<PaperReference | null>(null)

  const expandMediaNode = useCallback((nodeId: NodeId) => {
    setDetailReference(null)
    expandMedia(nodeId)
  }, [expandMedia])
  const openMediaDetail = useCallback((nodeId: NodeId) => {
    setDetailReference(null)
    openMedia(nodeId)
  }, [openMedia])
  const collapseExpandedMedia = useCallback(() => {
    setDetailReference(null)
    collapseMedia()
  }, [collapseMedia])
  const openReferenceDetail = useCallback((reference: PaperReference) => {
    setDetailReference(reference)
    collapseMediaDetail()
  }, [collapseMediaDetail])
  const collapseDetail = useCallback(() => {
    setDetailReference(null)
    collapseMediaDetail()
  }, [collapseMediaDetail])

  return {
    expandedMediaNodeId,
    detailMediaNodeId,
    detailReference,
    expandMediaNode,
    openMediaDetail,
    collapseExpandedMedia,
    openReferenceDetail,
    collapseDetail,
    setExpandedMediaNodeId,
  }
}
