import type { CSSProperties, KeyboardEvent } from 'react'

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

/** 双击富文本或纯标题节点后覆盖在节点上的编辑窗，输入框与节点边框贴合 */
export function NodeEditWindow({
  content,
  layout,
  position,
  defaults,
  onChangeText,
  onChangeTitle,
  onClose,
}: Readonly<NodeEditWindowProps>) {
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
      onClick={(event) => {
        event.stopPropagation()
      }}
      onKeyDown={(event) => {
        handleEscapeKey(event, onClose)
      }}
    >
      {content.kind === 'title' ? (
        <TitleNodeEditor
          content={content}
          fontSize={defaults.fontSize}
          onChange={onChangeTitle}
          onDone={onClose}
        />
      ) : (
        <RichTextEditor
          value={content.richText}
          fontSize={defaults.fontSize}
          onChange={onChangeText}
          onDone={onClose}
        />
      )}
    </dialog>
  )
}
