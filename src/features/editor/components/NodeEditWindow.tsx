import type { CSSProperties, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type {
  DocumentDefaults,
  NodeLayout,
  TextNodeContent,
  TitleNodeContent,
} from '@/shared/types/paper'
import type { Point } from '../data/layout'
import { RichTextEditor } from './RichTextEditor'
import { TitleNodeEditor } from './TitleNodeEditor'

interface NodeEditWindowProps {
  readonly content: TextNodeContent | TitleNodeContent
  readonly layout: NodeLayout
  readonly position: Point
  readonly defaults: DocumentDefaults
  readonly onChangeText: (html: string) => void
  readonly onChangeTitle: (title: string, subtitle: string) => void
  readonly onClose: () => void
}

function handleEscapeKey(event: KeyboardEvent<HTMLDialogElement>, onClose: () => void): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  onClose()
}

function BottomRichTextDialog({
  content,
  fontSize,
  onChangeText,
  onClose,
}: Readonly<{
  content: TextNodeContent
  fontSize: number
  onChangeText: (html: string) => void
  onClose: () => void
}>) {
  const portalHost = document.querySelector('[data-canvas-viewport="true"]') ?? document.body
  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 底部编辑窗需拦截点击与 Escape
    <dialog
      open
      aria-label="编辑富文本节点内容"
      className="absolute inset-auto bottom-0 left-1/2 z-30 m-0 flex h-64 w-[min(780px,90%)] max-h-none max-w-none -translate-x-1/2 flex-col overflow-hidden rounded-t-2xl border-2 border-b-0 border-slate-300 bg-white p-0 shadow-[0_-16px_48px_-12px_rgba(15,23,42,0.18)] outline-none animate-in slide-in-from-bottom-4 duration-200"
      onClick={(event) => {
        event.stopPropagation()
      }}
      onKeyDown={(event) => {
        handleEscapeKey(event, onClose)
      }}
    >
      <RichTextEditor
        value={content.richText}
        fontSize={fontSize}
        onChange={onChangeText}
        onDone={onClose}
      />
    </dialog>,
    portalHost,
  )
}

/** 富文本节点从画布下侧中央弹出编辑器，纯标题节点保持原位贴合编辑 */
export function NodeEditWindow(props: Readonly<NodeEditWindowProps>) {
  const { content, layout, position, defaults, onChangeText, onChangeTitle, onClose } = props
  if (content.kind === 'text') {
    return (
      <BottomRichTextDialog
        content={content}
        fontSize={defaults.fontSize}
        onChangeText={onChangeText}
        onClose={onClose}
      />
    )
  }

  const size = resolveNodeSize(layout, defaults)
  const style: CSSProperties = {
    left: position.x,
    top: position.y,
    width: size.width,
    height: size.height,
    transform: 'translate(-50%, -50%)',
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 非模态编辑窗需要拦截 Escape 以结束编辑
    <dialog
      open
      aria-label="编辑节点内容"
      className="absolute inset-auto z-20 m-0 max-h-none max-w-none border-0 bg-transparent p-0 outline-none"
      style={style}
      onClick={(event) => { event.stopPropagation() }}
      onKeyDown={(event) => { handleEscapeKey(event, onClose) }}
    >
      <TitleNodeEditor
        content={content}
        fontSize={defaults.fontSize}
        onChange={onChangeTitle}
        onDone={onClose}
      />
    </dialog>
  )
}
