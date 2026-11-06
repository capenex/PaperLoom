/* eslint-disable jsx-a11y/prefer-tag-over-role -- 卡片需要容纳块级富文本，原生 button 只能包含短语内容 */
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react'
import { cn } from 'cn'

import { resolveNodeSize } from '@/shared/lib/nodeDefaults'
import type { NodeId, PaperNode } from '@/shared/types/paper'
import { plainTextFromHtml } from '../lib/richText'
import type { Point } from './layout'

interface EditorNodeProps {
  readonly node: PaperNode
  readonly position: Point
  readonly selected: boolean
  readonly editing: boolean
  readonly onSelect: (nodeId: NodeId) => void
  readonly onEdit: (nodeId: NodeId) => void
}

interface NodeBodyProps {
  readonly node: PaperNode
  readonly isRoot: boolean
}

function cardClassName(isRoot: boolean, selected: boolean, editing: boolean): string {
  return cn(
    'absolute flex cursor-pointer flex-col overflow-hidden rounded-[10px] border px-3 py-2 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none',
    isRoot
      ? 'node-root border-slate-800 bg-slate-900 text-white shadow-xl shadow-slate-900/15'
      : 'border-slate-200 bg-white text-slate-900',
    selected && !editing && 'ring-2 ring-primary ring-offset-2 ring-offset-[#fbfcfe]',
  )
}

function NodeBody({ node, isRoot }: Readonly<NodeBodyProps>) {
  const richText = node.content.richText

  if (richText.trim() === '') {
    return (
      <div className="flex h-full items-center justify-center">
        <span className={cn('text-xs', isRoot ? 'text-slate-500' : 'text-slate-400')}>
          空白节点
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'node-rich-text min-h-0 flex-1 overflow-hidden text-xs leading-5',
        isRoot ? 'text-slate-200' : 'text-slate-600',
      )}
      dangerouslySetInnerHTML={{ __html: richText }}
    />
  )
}

function nodeAccessibleLabel(node: PaperNode): string {
  const text = plainTextFromHtml(node.content.richText)
  if (text === '') return '空白节点'
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

function selectNodeOnClick(
  event: MouseEvent<HTMLDivElement>,
  nodeId: NodeId,
  onSelect: (nodeId: NodeId) => void,
): void {
  event.stopPropagation()
  onSelect(nodeId)
}

function editNodeOnDoubleClick(
  event: MouseEvent<HTMLDivElement>,
  nodeId: NodeId,
  onEdit: (nodeId: NodeId) => void,
): void {
  event.stopPropagation()
  onEdit(nodeId)
}

function selectNodeOnKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  nodeId: NodeId,
  onSelect: (nodeId: NodeId) => void,
): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  onSelect(nodeId)
}

export function EditorNode({
  node,
  position,
  selected,
  editing,
  onSelect,
  onEdit,
}: Readonly<EditorNodeProps>) {
  const size = resolveNodeSize(node.layout)
  const isRoot = node.parentId === null

  const style: CSSProperties = {
    left: position.x,
    top: position.y,
    width: size.width,
    height: size.height,
    transform: 'translate(-50%, -50%)',
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`节点：${nodeAccessibleLabel(node)}，双击编辑内容`}
      title="双击编辑内容"
      data-node-id={node.id}
      className={cardClassName(isRoot, selected, editing)}
      style={style}
      onClick={(event) => {
        selectNodeOnClick(event, node.id, onSelect)
      }}
      onDoubleClick={(event) => {
        editNodeOnDoubleClick(event, node.id, onEdit)
      }}
      onKeyDown={(event) => {
        selectNodeOnKeyDown(event, node.id, onSelect)
      }}
    >
      <NodeBody node={node} isRoot={isRoot} />
    </div>
  )
}
