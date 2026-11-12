/* eslint-disable jsx-a11y/prefer-tag-over-role -- contentEditable 富文本输入必须使用 div */
import { useEffect, useRef } from 'react'
import type { ClipboardEvent, DragEvent, KeyboardEvent, RefObject } from 'react'
import { Check } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { useRichTextCommands } from '../hooks/useRichTextCommands'
import type { RichTextCommands } from '../hooks/useRichTextCommands'
import { extractImageFiles } from '../lib/inboxUpload'
import { unwrapElement } from '../lib/markdownClean'
import { decompileRichTextToEditableHtml } from '../lib/markdownDecompile'
import { compileMarkdownRichTextHtml } from '../lib/markdownRichText'
import { emitHtml, insertPlainText, placeCaretAtEnd } from '../lib/richText'
import { RichTextToolbar } from './RichTextToolbar'

const PURE_MD_TAG_TEXT = /^[\s\u00A0\u200B]*(?:#{1,3}|[-*>]|\d+\.|\*{1,2}|~~|`|\$)+[\s\u00A0\u200B]*$/u

/** 底部弹出编辑器输入框样式：宽敞留白、标准 I 型文本光标与主题色插入符，节点在画布正上方实时渲染 */
const RICH_TEXT_INPUT_CLASS =
  'rich-text-editor min-h-0 flex-1 w-full cursor-text overflow-y-auto bg-white px-5 py-4 leading-relaxed text-slate-700 caret-primary outline-none'

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

function stripInjectedOklchStyleInPlace(editor: HTMLDivElement | null): void {
  if (editor === null) return
  editor.querySelectorAll('span[style*="oklch"]').forEach((span) => {
    span.removeAttribute('style')
  })
  editor.querySelectorAll('a, font, span, b, strong, i, em, u, s, del, strike').forEach((el) => {
    if (el.classList.contains('pl-math')) return
    if (PURE_MD_TAG_TEXT.test(el.textContent ?? '')) {
      unwrapElement(el)
    }
  })
}

function useInitialContent(
  editorRef: RefObject<HTMLDivElement | null>,
  html: string,
  onChange: (html: string) => void,
  onSelectionChange: () => void,
): void {
  const initialValue = useRef(html)
  const initialOnChange = useRef(onChange)
  const initialOnSelectionChange = useRef(onSelectionChange)

  useEffect(() => {
    const element = editorRef.current
    if (element === null) return
    const editableHtml = decompileRichTextToEditableHtml(initialValue.current)
    element.innerHTML = editableHtml
    const compiled = compileMarkdownRichTextHtml(editableHtml)
    if (compiled !== initialValue.current) {
      initialOnChange.current(compiled)
    }
    element.focus({ preventScroll: true })
    placeCaretAtEnd(element)
    initialOnSelectionChange.current()
  }, [editorRef])
}

function emitContent(
  editorRef: RefObject<HTMLDivElement | null>,
  pendingFontSizeRef: RefObject<number | null>,
  onChange: (html: string) => void,
): void {
  stripInjectedOklchStyleInPlace(editorRef.current)
  emitHtml(editorRef.current, onChange, pendingFontSizeRef.current)
}

function pastePlainText(
  event: ClipboardEvent<HTMLDivElement>,
  editorRef: RefObject<HTMLDivElement | null>,
  pendingFontSizeRef: RefObject<number | null>,
  onChange: (html: string) => void,
  onSelectionChange: () => void,
): void {
  const plainText = event.clipboardData.getData('text/plain')
  if (plainText === '' && extractImageFiles(event.clipboardData).length > 0) return
  event.preventDefault()
  event.stopPropagation()
  insertPlainText(editorRef.current, plainText)
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
  const plainText = event.dataTransfer.getData('text/plain')
  if (plainText === '' && extractImageFiles(event.dataTransfer).length > 0) return
  event.preventDefault()
  event.stopPropagation()
  insertPlainText(editorRef.current, plainText)
  emitContent(editorRef, pendingFontSizeRef, onChange)
  onSelectionChange()
}

function handleEditorKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  composing: boolean,
  editorRef: RefObject<HTMLDivElement | null>,
  pendingFontSizeRef: RefObject<number | null>,
  onChange: (html: string) => void,
  onEscape: () => void,
): void {
  if (composing || event.nativeEvent.isComposing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emitContent(editorRef, pendingFontSizeRef, onChange)
    onEscape()
    return
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    insertPlainText(editorRef.current, '  ')
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
  const composingRef = useRef(false)
  useInitialContent(editorRef, initialHtml, onChange, onSelectionChange)

  return (
    <div
      ref={editorRef}
      role="textbox"
      aria-multiline="true"
      aria-label="节点内容"
      contentEditable
      tabIndex={0}
      spellCheck={false}
      data-placeholder="输入 Markdown 源码（# 标题、- 列表、**加粗**、`代码`、$公式$、\转义），或选中文本设置富文本样式…"
      className={RICH_TEXT_INPUT_CLASS}
      style={{ fontSize }}
      onCompositionStart={() => {
        composingRef.current = true
      }}
      onCompositionEnd={() => {
        composingRef.current = false
        emitContent(editorRef, pendingFontSizeRef, onChange)
        onSelectionChange()
      }}
      onInput={(event) => {
        if (composingRef.current || event.nativeEvent.isComposing) return
        emitContent(editorRef, pendingFontSizeRef, onChange)
        onSelectionChange()
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
        if (composingRef.current) return
        emitContent(editorRef, pendingFontSizeRef, onChange)
      }}
      onKeyDown={(event) => {
        handleEditorKeyDown(
          event,
          composingRef.current,
          editorRef,
          pendingFontSizeRef,
          onChange,
          onEscape,
        )
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
          onReference={commands.createReference}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400">Markdown 源码 + 富文本 · 上方节点实时渲染 · Esc 完成</span>
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
    emitContent(editorRef, pendingFontSizeRef, onChange)
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
