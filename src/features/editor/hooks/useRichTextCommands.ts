import { useCallback, useEffect } from 'react'
import type { RefObject } from 'react'

import type { PaperReference } from '@/shared/types/paper'
import {
  applyFontSize,
  captureSelection,
  restoreSelection,
  runEditorCommand,
} from '../lib/richText'
import { useLinkCommands } from './useLinkCommands'

export interface RichTextCommands {
  readonly runCommand: (command: string, value?: string) => void
  readonly changeFontSize: (sizePx: number) => void
  readonly createLink: (url: string) => boolean
  readonly createReference: (reference: PaperReference) => void
  readonly rememberSelection: () => void
}

/** 组合编辑器命令、选区保存与光标恢复，供浮动工具栏直接调用 */
export function useRichTextCommands(
  editorRef: RefObject<HTMLDivElement | null>,
  selectionRef: RefObject<Range | null>,
  pendingFontSizeRef: RefObject<number | null>,
  onChange: (html: string) => void,
): RichTextCommands {
  const rememberSelection = useCallback(() => {
    const captured = captureSelection(editorRef.current)
    if (captured !== null) {
      selectionRef.current = captured
    }
  }, [editorRef, selectionRef])

  useEffect(() => {
    document.addEventListener('selectionchange', rememberSelection)
    return () => {
      document.removeEventListener('selectionchange', rememberSelection)
    }
  }, [rememberSelection])
  const { createLink, createReference } = useLinkCommands(
    editorRef,
    selectionRef,
    rememberSelection,
    onChange,
  )

  const runCommand = useCallback(
    (command: string, commandValue?: string) => {
      restoreSelection(editorRef.current, selectionRef.current)
      runEditorCommand(editorRef.current, command, commandValue, onChange)
      rememberSelection()
    },
    [editorRef, onChange, rememberSelection, selectionRef],
  )
  const changeFontSize = useCallback(
    (sizePx: number) => {
      restoreSelection(editorRef.current, selectionRef.current)
      pendingFontSizeRef.current = sizePx
      applyFontSize(editorRef.current, sizePx, onChange)
      pendingFontSizeRef.current = null
      rememberSelection()
    },
    [editorRef, onChange, pendingFontSizeRef, rememberSelection, selectionRef],
  )

  return { runCommand, changeFontSize, createLink, createReference, rememberSelection }
}
