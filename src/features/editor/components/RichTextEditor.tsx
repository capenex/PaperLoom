/* eslint-disable jsx-a11y/prefer-tag-over-role -- contentEditable 富文本输入必须使用 div */
import { useEffect, useRef } from 'react'
import type { ClipboardEvent, DragEvent, KeyboardEvent, RefObject } from 'react'
import { Check } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { useRichTextCommands } from '../hooks/useRichTextCommands'
import type { RichTextCommands } from '../hooks/useRichTextCommands'
import { emitHtml, insertPlainText } from '../lib/richText'
import { RichTextToolbar } from './RichTextToolbar'

/** 编辑窗输入框样式：与白底节点卡片保持一致 */
const RICH_TEXT_INPUT_CLASS =
  'rich-text-editor h-full w-full overflow-y-auto rounded-[10px] border-2 border-primary bg-white px-3 py-2 leading-relaxed text-slate-600 outline-none'

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

function useInitialContent(editorRef: RefObject<HTMLDivElement | null>, html: string): void {
  const initialValue = useRef(html)

  useEffect(() => {
    const element = editorRef.current
    if (element === null) return
    element.innerHTML = initialValue.current
    element.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    const selection = window.getSelection()
    if (selection === null) return
    selection.removeAllRanges()
    selection.addRange(range)
  }, [editorRef])
}

function emitContent(
  editorRef: RefObject<HTMLDivElement | null>,
  pendingFontSizeRef: RefObject<number | null>,
  onChange: (html: string) => void,
): void {
  emitHtml(editorRef.current, onChange, pendingFontSizeRef.current)
}

function pastePlainText(
  event: ClipboardEvent<HTMLDivElement>,
  editorRef: RefObject<HTMLDivElement | null>,
  pendingFontSizeRef: RefObject<number | null>,
  onChange: (html: string) => void,
  onSelectionChange: () => void,
): void {
  event.preventDefault()
  insertPlainText(editorRef.current, event.clipboardData.getData('text/plain'))
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
  event.preventDefault()
  insertPlainText(editorRef.current, event.dataTransfer.getData('text/plain'))
  emitContent(editorRef, pendingFontSizeRef, onChange)
  onSelectionChange()
}

function closeOnEscape(event: KeyboardEvent<HTMLDivElement>, onEscape: () => void): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  onEscape()
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
  useInitialContent(editorRef, initialHtml)

  return (
    <div
      ref={editorRef}
      role="textbox"
      aria-multiline="true"
      aria-label="节点内容"
      contentEditable
      tabIndex={0}
      spellCheck={false}
      data-placeholder="输入内容，可设置样式、字号与链接…"
      className={RICH_TEXT_INPUT_CLASS}
      style={{ fontSize }}
      onInput={() => {
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
      onBlur={onSelectionChange}
      onKeyDown={(event) => {
        closeOnEscape(event, onEscape)
      }}
    />
  )
}

function FloatingFormatToolbar({ commands, onDone }: Readonly<FloatingFormatToolbarProps>) {
  return (
    <div className="absolute -top-10 left-0 z-30 flex w-max items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
      <RichTextToolbar
        onCommand={commands.runCommand}
        onFontSize={commands.changeFontSize}
        onLink={commands.createLink}
        onReference={commands.createReference}
      />

      <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="完成编辑"
        title="完成编辑（Esc）"
        onClick={onDone}
      >
        <Check aria-hidden="true" />
      </Button>
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

  return (
    <div className="relative h-full w-full">
      <FloatingFormatToolbar commands={commands} onDone={onDone} />
      <RichTextInput
        editorRef={editorRef}
        pendingFontSizeRef={pendingFontSizeRef}
        initialHtml={value}
        fontSize={fontSize}
        onChange={onChange}
        onSelectionChange={commands.rememberSelection}
        onEscape={onDone}
      />
    </div>
  )
}
