import { useCallback } from 'react'
import type { RefObject } from 'react'

import type { PaperReference } from '@/shared/types/paper'
import { applyReference, restoreSelection } from '../lib/richText'

export interface LinkCommands {
  readonly createReference: (reference: PaperReference) => void
}

/** 插入本地引用：先恢复光标选区，插入后重新记录选区 */
export function useLinkCommands(
  editorRef: RefObject<HTMLDivElement | null>,
  selectionRef: RefObject<Range | null>,
  rememberSelection: () => void,
  onChange: (html: string) => void,
): LinkCommands {
  const createReference = useCallback(
    (reference: PaperReference) => {
      restoreSelection(editorRef.current, selectionRef.current)
      applyReference(editorRef.current, reference, onChange)
      rememberSelection()
    },
    [editorRef, onChange, rememberSelection, selectionRef],
  )

  return { createReference }
}
