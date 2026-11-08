import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

import type { DocumentDefaults, TextNodeContent } from '@/shared/types/paper'
import { RichTextEditor } from './RichTextEditor'

interface NodeEditWindowProps {
  readonly content: TextNodeContent
  readonly defaults: DocumentDefaults
  readonly onChangeText: (html: string) => void
  readonly onClose: () => void
}

function handleEscapeKey(event: KeyboardEvent<HTMLDialogElement>, onClose: () => void): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  onClose()
}

/** 富文本节点从画布下侧中央弹出编辑器（纯标题节点已改为在顶部栏直接输入） */
export function NodeEditWindow(props: Readonly<NodeEditWindowProps>) {
  const { content, defaults, onChangeText, onClose } = props
  const portalHost = document.querySelector('[data-canvas-viewport="true"]') ?? document.body

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 底部编辑窗需拦截点击与 Escape
    <dialog
      open
      aria-label="编辑富文本节点内容"
      className="absolute inset-auto bottom-0 left-1/2 z-30 m-0 flex h-64 w-[min(780px,90%)] max-h-none max-w-none -translate-x-1/2 cursor-default flex-col overflow-hidden rounded-t-2xl border-2 border-b-0 border-slate-300 bg-white p-0 shadow-[0_-16px_48px_-12px_rgba(15,23,42,0.18)] outline-none animate-in slide-in-from-bottom-4 duration-200"
      onClick={(event) => {
        event.stopPropagation()
      }}
      onKeyDown={(event) => {
        handleEscapeKey(event, onClose)
      }}
    >
      <RichTextEditor
        value={content.richText}
        fontSize={defaults.fontSize}
        onChange={onChangeText}
        onDone={onClose}
      />
    </dialog>,
    portalHost,
  )
}
