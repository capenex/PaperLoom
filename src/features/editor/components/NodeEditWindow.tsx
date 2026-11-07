import type { CSSProperties, KeyboardEvent } from 'react'

import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type { DocumentDefaults, NodeLayout, TextNodeContent } from '@/shared/types/paper'
import type { Point } from '../data/layout'
import { RichTextEditor } from './RichTextEditor'

interface NodeEditWindowProps {
  readonly content: TextNodeContent
  readonly layout: NodeLayout
  readonly position: Point
  readonly defaults: DocumentDefaults
  readonly onChange: (html: string) => void
  readonly onClose: () => void
}

/** 双击文字节点后覆盖在节点上的编辑窗，输入框与节点边框贴合 */
export function NodeEditWindow({
  content,
  layout,
  position,
  defaults,
  onChange,
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

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onClose()
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
      onKeyDown={handleKeyDown}
    >
      <RichTextEditor
        value={content.richText}
        fontSize={defaults.fontSize}
        onChange={onChange}
        onDone={onClose}
      />
    </dialog>
  )
}
