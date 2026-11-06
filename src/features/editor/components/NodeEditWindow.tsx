import type { CSSProperties, KeyboardEvent } from 'react'

import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type { PaperNode } from '@/shared/types/paper'
import { RichTextEditor } from './RichTextEditor'
import type { Point } from './layout'

interface NodeEditWindowProps {
  readonly node: PaperNode
  readonly position: Point
  readonly onChange: (html: string) => void
  readonly onClose: () => void
}

/** 双击节点后覆盖在节点上的编辑窗，输入框与节点边框贴合 */
export function NodeEditWindow({ node, position, onChange, onClose }: Readonly<NodeEditWindowProps>) {
  const size = resolveNodeSize(node.layout)
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
        value={node.content.richText}
        onChange={onChange}
        tone={node.parentId === null ? 'dark' : 'light'}
        onDone={onClose}
      />
    </dialog>
  )
}
