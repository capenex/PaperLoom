import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { NodeId, PaperNode, PaperReference } from '@/shared/types/paper'
import type { DetailContent } from '../lib/detailContent'
import { useMediaExpansion } from './useMediaExpansion'

export interface DetailSlotState {
  readonly expandedMediaNodeId: NodeId | null
  readonly detailMediaNodeId: NodeId | null
  readonly detailReference: PaperReference | null
  readonly detailCustom: DetailContent | null
  readonly expandMediaNode: (nodeId: NodeId) => void
  readonly openMediaDetail: (nodeId: NodeId) => void
  readonly collapseExpandedMedia: () => void
  readonly openReferenceDetail: (reference: PaperReference) => void
  readonly openCustomDetail: (content: DetailContent) => void
  readonly collapseDetail: () => void
  readonly setExpandedMediaNodeId: Dispatch<SetStateAction<NodeId | null>>
}

/** 图片详情、本地引用详情与文件池双击预览共用右侧面板，打开其一会收起其他项 */
export function useDetailSlot(nodes: readonly PaperNode[]): DetailSlotState {
  const {
    expandedMediaNodeId,
    detailMediaNodeId,
    expandMediaNode,
    openMediaDetail: openMedia,
    collapseExpandedMedia,
    collapseMediaDetail,
    setExpandedMediaNodeId,
  } = useMediaExpansion(nodes)
  const [detailReference, setDetailReference] = useState<PaperReference | null>(null)
  const [detailCustom, setDetailCustom] = useState<DetailContent | null>(null)

  const openMediaDetail = useCallback((nodeId: NodeId) => {
    setDetailReference(null)
    setDetailCustom(null)
    openMedia(nodeId)
  }, [openMedia])
  const openReferenceDetail = useCallback((reference: PaperReference) => {
    setDetailReference(reference)
    setDetailCustom(null)
    collapseMediaDetail()
  }, [collapseMediaDetail])
  const openCustomDetail = useCallback((content: DetailContent) => {
    setDetailCustom(content)
    setDetailReference(null)
    collapseMediaDetail()
  }, [collapseMediaDetail])
  const collapseDetail = useCallback(() => {
    setDetailReference(null)
    setDetailCustom(null)
    collapseMediaDetail()
  }, [collapseMediaDetail])

  return {
    expandedMediaNodeId,
    detailMediaNodeId,
    detailReference,
    detailCustom,
    expandMediaNode,
    openMediaDetail,
    collapseExpandedMedia,
    openReferenceDetail,
    openCustomDetail,
    collapseDetail,
    setExpandedMediaNodeId,
  }
}
