import { useCallback } from 'react'
import type { RefObject } from 'react'

import {
  applyFontSize,
  applyLink,
  captureSelection,
  normalizeLinkUrl,
  restoreSelection,
  runEditorCommand,
} from '../lib/richText'

export interface RichTextCommands {
  readonly runCommand: (command: string, value?: string) => void
  readonly changeFontSize: (sizePx: number) => void
  readonly createLink: (url: string) => boolean
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
    selectionRef.current = captureSelection(editorRef.current)
  }, [editorRef, selectionRef])

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
      rememberSelection()
    },
    [editorRef, onChange, pendingFontSizeRef, rememberSelection, selectionRef],
  )

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

  return { runCommand, changeFontSize, createLink, rememberSelection }
}
