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

function findNodeKind(
  nodes: readonly PaperNode[],
  nodeId: NodeId,
): PaperNode['content']['kind'] | null {
  return nodes.find((item) => item.id === nodeId)?.content.kind ?? null
}

/** 图片与静态文件节点的右侧详情状态；单击选中图片节点不再放大画布卡片，默认事件仅弹出右栏大图 */
export function useMediaExpansion(nodes: readonly PaperNode[]): MediaExpansionState {
  const [expandedMediaNodeId, setExpandedMediaNodeId] = useState<NodeId | null>(null)
  const [detailMediaNodeId, setDetailMediaNodeId] = useState<NodeId | null>(null)

  const expandMediaNode = useCallback((_nodeId: NodeId) => {
    setExpandedMediaNodeId(null)
  }, [])

  const openMediaDetail = useCallback(
    (nodeId: NodeId) => {
      const kind = findNodeKind(nodes, nodeId)
      if (kind !== 'image' && kind !== 'file') return
      setExpandedMediaNodeId(null)
      setDetailMediaNodeId(nodeId)
    },
    [nodes],
  )

  const collapseExpandedMedia = useCallback(() => {
    setExpandedMediaNodeId(null)
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
