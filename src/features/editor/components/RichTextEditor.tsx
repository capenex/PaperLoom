/* eslint-disable jsx-a11y/prefer-tag-over-role -- contentEditable 富文本输入必须使用 div */
import { useEffect, useRef } from 'react'
import type { ClipboardEvent, DragEvent, KeyboardEvent, RefObject } from 'react'
import { Check } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { useRichTextCommands } from '../hooks/useRichTextCommands'
import type { RichTextCommands } from '../hooks/useRichTextCommands'
import {
  applyMarkdownShortcut,
  exitHeadingOrQuoteOnEnter,
  flushPendingInlineMarkdown,
} from '../lib/markdownShortcuts'
import { extractImageFiles } from '../lib/inboxUpload'
import { emitHtml, insertPlainText } from '../lib/richText'
import { RichTextToolbar } from './RichTextToolbar'

/** 底部弹出编辑器输入框样式：宽敞留白，节点本身在画布正上方实时渲染 */
const RICH_TEXT_INPUT_CLASS =
  'rich-text-editor min-h-0 flex-1 w-full overflow-y-auto bg-white px-5 py-4 leading-relaxed text-slate-700 outline-none'

interface RichTextEditorProps {
  readonly value: string
  readonly fontSize: number
  readonly onChange: (html: string) => void
  readonly onDone: () => void
}

interface RichTextInputProps {
  readonly editorRef: RefObject<HTMLDivElement | null>
  readonly pendingFontSizeRef: RefObject<number | null>
  readonly initialHtml: string
  readonly fontSize: number
  readonly onChange: (html: string) => void
  readonly onSelectionChange: () => void
  readonly onEscape: () => void
}

interface FloatingFormatToolbarProps {
  readonly commands: RichTextCommands
  readonly onDone: () => void
}

function useInitialContent(
  editorRef: RefObject<HTMLDivElement | null>,
  pendingFontSizeRef: RefObject<number | null>,
  html: string,
  onChange: (html: string) => void,
): void {
  const initialValue = useRef(html)
  const initialOnChange = useRef(onChange)

  useEffect(() => {
    const element = editorRef.current
    if (element === null) return
    element.innerHTML = initialValue.current
    if (flushPendingInlineMarkdown(element)) {
      emitHtml(element, initialOnChange.current, pendingFontSizeRef.current)
    }
    element.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    const selection = window.getSelection()
    if (selection === null) return
    selection.removeAllRanges()
    selection.addRange(range)
  }, [editorRef, pendingFontSizeRef])
}

function emitContent(
  editorRef: RefObject<HTMLDivElement | null>,
  pendingFontSizeRef: RefObject<number | null>,
  onChange: (html: string) => void,
): void {
  applyMarkdownShortcut(editorRef.current)
  emitHtml(editorRef.current, onChange, pendingFontSizeRef.current)
}

function flushAndEmit(
  editorRef: RefObject<HTMLDivElement | null>,
  pendingFontSizeRef: RefObject<number | null>,
  onChange: (html: string) => void,
): boolean {
  if (flushPendingInlineMarkdown(editorRef.current)) {
    emitHtml(editorRef.current, onChange, pendingFontSizeRef.current)
    return true
  }
  return false
}

function pastePlainText(
  event: ClipboardEvent<HTMLDivElement>,
  editorRef: RefObject<HTMLDivElement | null>,
  pendingFontSizeRef: RefObject<number | null>,
  onChange: (html: string) => void,
  onSelectionChange: () => void,
): void {
  if (extractImageFiles(event.clipboardData).length > 0) return
  event.preventDefault()
  insertPlainText(editorRef.current, event.clipboardData.getData('text/plain'))
  flushPendingInlineMarkdown(editorRef.current)
  emitContent(editorRef, pendingFontSizeRef, onChange)
  onSelectionChange()
}

function dropPlainText(
  event: DragEvent<HTMLDivElement>,
  editorRef: RefObject<HTMLDivElement | null>,
  pendingFontSizeRef: RefObject<number | null>,
  onChange: (html: string) => void,
  onSelectionChange: () => void,
): void {
  if (extractImageFiles(event.dataTransfer).length > 0) return
  event.preventDefault()
  insertPlainText(editorRef.current, event.dataTransfer.getData('text/plain'))
  flushPendingInlineMarkdown(editorRef.current)
  emitContent(editorRef, pendingFontSizeRef, onChange)
  onSelectionChange()
}

function handleEditorKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  editorRef: RefObject<HTMLDivElement | null>,
  pendingFontSizeRef: RefObject<number | null>,
  onChange: (html: string) => void,
  onEscape: () => void,
): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    flushAndEmit(editorRef, pendingFontSizeRef, onChange)
    onEscape()
    return
  }
  if (event.key === 'ArrowRight' && flushAndEmit(editorRef, pendingFontSizeRef, onChange)) {
    event.preventDefault()
    return
  }
  if (event.key === 'Enter') {
    flushAndEmit(editorRef, pendingFontSizeRef, onChange)
  }
  if (exitHeadingOrQuoteOnEnter(editorRef.current, event.key, event.shiftKey)) {
    event.preventDefault()
    emitContent(editorRef, pendingFontSizeRef, onChange)
  }
}

function RichTextInput({
  editorRef,
  pendingFontSizeRef,
  initialHtml,
  fontSize,
  onChange,
  onSelectionChange,
  onEscape,
}: Readonly<RichTextInputProps>) {
  useInitialContent(editorRef, pendingFontSizeRef, initialHtml, onChange)

  return (
    <div
      ref={editorRef}
      role="textbox"
      aria-multiline="true"
      aria-label="节点内容"
      contentEditable
      tabIndex={0}
      spellCheck={false}
      data-placeholder="输入内容，支持 # 标题、**加粗**、`代码`、$公式$ 等快捷语法…"
      className={RICH_TEXT_INPUT_CLASS}
      style={{ fontSize }}
      onInput={() => {
        emitContent(editorRef, pendingFontSizeRef, onChange)
      }}
      onCompositionEnd={() => {
        emitContent(editorRef, pendingFontSizeRef, onChange)
      }}
      onPaste={(event) => {
        pastePlainText(event, editorRef, pendingFontSizeRef, onChange, onSelectionChange)
      }}
      onDrop={(event) => {
        dropPlainText(event, editorRef, pendingFontSizeRef, onChange, onSelectionChange)
      }}
      onKeyUp={onSelectionChange}
      onMouseUp={onSelectionChange}
      onBlur={() => {
        flushAndEmit(editorRef, pendingFontSizeRef, onChange)
        onSelectionChange()
      }}
      onKeyDown={(event) => {
        handleEditorKeyDown(event, editorRef, pendingFontSizeRef, onChange, onEscape)
      }}
    />
  )
}

function FloatingFormatToolbar({ commands, onDone }: Readonly<FloatingFormatToolbarProps>) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/90 px-4 py-1.5">
      <div className="flex flex-wrap items-center gap-0.5">
        <RichTextToolbar
          onCommand={commands.runCommand}
          onFontSize={commands.changeFontSize}
          onLink={commands.createLink}
          onReference={commands.createReference}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400">上方节点实时渲染 · Esc 完成</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-primary hover:bg-primary/10 hover:text-primary"
          aria-label="完成编辑"
          title="完成编辑（Esc）"
          onClick={onDone}
        >
          <Check aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

export function RichTextEditor({
  value,
  fontSize,
  onChange,
  onDone,
}: Readonly<RichTextEditorProps>) {
  const editorRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const pendingFontSizeRef = useRef<number | null>(null)
  const commands = useRichTextCommands(editorRef, selectionRef, pendingFontSizeRef, onChange)

  function finishEditing(): void {
    flushAndEmit(editorRef, pendingFontSizeRef, onChange)
    onDone()
  }

  return (
    <div className="flex h-full w-full flex-col">
      <FloatingFormatToolbar commands={commands} onDone={finishEditing} />
      <RichTextInput
        editorRef={editorRef}
        pendingFontSizeRef={pendingFontSizeRef}
        initialHtml={value}
        fontSize={fontSize}
        onChange={onChange}
        onSelectionChange={commands.rememberSelection}
        onEscape={finishEditing}
      />
    </div>
  )
}
