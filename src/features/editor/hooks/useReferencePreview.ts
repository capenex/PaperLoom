import { useCallback, useRef, useState } from 'react'

import type { PaperReference } from '@/shared/types/paper'
import type { ReferencePreview } from '../lib/referencePreview'
import { placeReferencePreview } from '../lib/referencePreview'

export interface ReferencePreviewControls {
  readonly preview: ReferencePreview | null
  readonly openPreview: (reference: PaperReference, anchor: HTMLElement) => void
  readonly openDetail: (reference: PaperReference) => void
  readonly openDetailFromPopup: () => void
  readonly closePreview: () => void
}

/** 引用预览弹窗状态：单击锚点打开弹窗，弹窗内点击或双击锚点进入右侧详情 */
export function useReferencePreview(
  onOpenReferenceDetail: (reference: PaperReference) => void,
): ReferencePreviewControls {
  const [preview, setPreview] = useState<ReferencePreview | null>(null)
  const previewRef = useRef<ReferencePreview | null>(null)

  const show = useCallback((next: ReferencePreview | null) => {
    previewRef.current = next
    setPreview(next)
  }, [])

  const openPreview = useCallback(
    (reference: PaperReference, anchor: HTMLElement) => {
      show({ reference, ...placeReferencePreview(anchor.getBoundingClientRect()) })
    },
    [show],
  )

  const closePreview = useCallback(() => {
    show(null)
  }, [show])

  const openDetail = useCallback(
    (reference: PaperReference) => {
      show(null)
      onOpenReferenceDetail(reference)
    },
    [onOpenReferenceDetail, show],
  )

  const openDetailFromPopup = useCallback(() => {
    const current = previewRef.current
    if (current !== null) openDetail(current.reference)
  }, [openDetail])

  return { preview, openPreview, openDetail, openDetailFromPopup, closePreview }
}
