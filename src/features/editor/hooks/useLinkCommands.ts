import { useCallback } from 'react'
import type { RefObject } from 'react'

import type { PaperReference } from '@/shared/types/paper'
import { applyLink, applyReference, normalizeLinkUrl, restoreSelection } from '../lib/richText'

export interface LinkCommands {
  readonly createLink: (url: string) => boolean
  readonly createReference: (reference: PaperReference) => void
}

/** 插入常规超链接与本地引用：都先恢复光标，插入后重新记录选区 */
export function useLinkCommands(
  editorRef: RefObject<HTMLDivElement | null>,
  selectionRef: RefObject<Range | null>,
  rememberSelection: () => void,
  onChange: (html: string) => void,
): LinkCommands {
  const createLink = useCallback(
    (rawUrl: string): boolean => {
      const url = normalizeLinkUrl(rawUrl)
      if (url === null) return false
      restoreSelection(editorRef.current, selectionRef.current)
      applyLink(editorRef.current, url, onChange)
      rememberSelection()
      return true
    },
    [editorRef, onChange, rememberSelection, selectionRef],
  )

  const createReference = useCallback(
    (reference: PaperReference) => {
      restoreSelection(editorRef.current, selectionRef.current)
      applyReference(editorRef.current, reference, onChange)
      rememberSelection()
    },
    [editorRef, onChange, rememberSelection, selectionRef],
  )

  return { createLink, createReference }
}
