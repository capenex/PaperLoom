import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type { NodeId, PaperNode } from '@/shared/types/paper'

export interface MediaExpansionState {
  readonly expandedMediaNodeId: NodeId | null
  readonly detailMediaNodeId: NodeId | null
  readonly expandMediaNode: (nodeId: NodeId) => void
  readonly openMediaDetail: (nodeId: NodeId) => void
  readonly collapseExpandedMedia: () => void
  readonly collapseMediaDetail: () => void
  readonly setExpandedMediaNodeId: Dispatch<SetStateAction<NodeId | null>>
}

/** 图片节点的放大与右侧大图状态；选中非图片节点会同时还原放大 */
export function useMediaExpansion(nodes: readonly PaperNode[]): MediaExpansionState {
  const [expandedMediaNodeId, setExpandedMediaNodeId] = useState<NodeId | null>(null)
  const [detailMediaNodeId, setDetailMediaNodeId] = useState<NodeId | null>(null)

  const expandMediaNode = useCallback(
    (nodeId: NodeId) => {
      const node = nodes.find((item) => item.id === nodeId)
      if (node?.content.kind !== 'image') {
        setExpandedMediaNodeId(null)
        setDetailMediaNodeId(null)
        return
      }
      setExpandedMediaNodeId(nodeId)
      setDetailMediaNodeId((current) => (current === nodeId ? current : null))
    },
    [nodes],
  )

  const openMediaDetail = useCallback(
    (nodeId: NodeId) => {
      const node = nodes.find((item) => item.id === nodeId)
      if (node?.content.kind !== 'image') return
      setExpandedMediaNodeId(nodeId)
      setDetailMediaNodeId(nodeId)
    },
    [nodes],
  )

  const collapseExpandedMedia = useCallback(() => {
    setExpandedMediaNodeId(null)
    setDetailMediaNodeId(null)
  }, [])

  const collapseMediaDetail = useCallback(() => {
    setDetailMediaNodeId(null)
  }, [])

  return {
    expandedMediaNodeId,
    detailMediaNodeId,
    expandMediaNode,
    openMediaDetail,
    collapseExpandedMedia,
    collapseMediaDetail,
    setExpandedMediaNodeId,
  }
}
