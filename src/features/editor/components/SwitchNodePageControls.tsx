import { cn } from 'cn'

import { Button } from '@/shared/components/ui/button'
import type { NodeId, PageSwitchMode, PaperNode } from '@/shared/types/paper'
import type { SwitchNodePageAction } from '../lib/eventBindingUi'
import { SELECT_BOX_CLS, ribbonFieldCls } from '../lib/eventBindingUi'
import { nodeDisplayLabel, nodeKindLabel, nodePageCount } from '../lib/nodeLabel'

interface SwitchNodePageControlsProps {
  readonly action: SwitchNodePageAction
  readonly bindingId: string
  readonly sourceNodeId: NodeId | undefined
  readonly watchlistNodes: readonly PaperNode[]
  readonly canvasNodes: readonly PaperNode[]
  readonly onChangeAction: (action: SwitchNodePageAction) => void
  readonly onArmPick: (sourceNodeId: NodeId, bindingId: string) => void
}

interface PageModeOption {
  readonly value: string
  readonly label: string
}

function findNodeAcross(nodes: readonly PaperNode[], nodeId: string): PaperNode | undefined {
  return nodes.find((node) => node.id === nodeId)
}

function targetOptionLabel(node: PaperNode, starred: boolean): string {
  const prefix = starred ? '★ ' : ''
  return `${prefix}[${nodeKindLabel(node.content.kind)}] ${nodeDisplayLabel(node)} (${nodePageCount(node)}页)`
}

function isCanvasPageTarget(node: PaperNode): boolean {
  if (node.content.kind === 'image') return true
  return node.content.kind === 'text' && nodePageCount(node) >= 2
}

function displayPageCount(node: PaperNode | undefined): number {
  return node === undefined ? 5 : Math.max(5, nodePageCount(node))
}

function modeSelectValue(action: SwitchNodePageAction): string {
  return action.mode === 'index' ? `index:${action.pageIndex ?? 0}` : action.mode
}

function parseModeValue(
  value: string,
  fallbackPageIndex: number,
): { mode: PageSwitchMode; pageIndex: number } | null {
  if (value === 'next-loop' || value === 'prev-loop') {
    return { mode: value, pageIndex: fallbackPageIndex }
  }
  const indexText = value.startsWith('index:') ? value.slice('index:'.length) : ''
  const pageIndex = Number(indexText)
  if (indexText === '' || !Number.isInteger(pageIndex)) return null
  return { mode: 'index', pageIndex }
}

function buildPageModeOptions(pageCount: number): readonly PageModeOption[] {
  const result: PageModeOption[] = []
  for (let index = 0; index < pageCount; index += 1) {
    result.push({ value: `index:${index}`, label: `第 ${index + 1} 页` })
  }
  return result
}

function retargetedSwitchAction(
  action: SwitchNodePageAction,
  targetNodeId: string,
  watchlistNodes: readonly PaperNode[],
  canvasNodes: readonly PaperNode[],
): SwitchNodePageAction {
  const nextNode =
    findNodeAcross(watchlistNodes, targetNodeId) ?? findNodeAcross(canvasNodes, targetNodeId)
  const pageIndex =
    action.mode === 'index'
      ? Math.min(action.pageIndex ?? 0, displayPageCount(nextNode) - 1)
      : action.pageIndex ?? 0
  return { type: 'switch-node-page', targetNodeId, mode: action.mode, pageIndex }
}

export function SwitchNodePageControls({
  action,
  bindingId,
  sourceNodeId,
  watchlistNodes,
  canvasNodes,
  onChangeAction,
  onArmPick,
}: Readonly<SwitchNodePageControlsProps>) {
  const watchlistIds = new Set(watchlistNodes.map((node) => node.id))
  const canvasTargets = canvasNodes.filter(
    (node) => isCanvasPageTarget(node) && !watchlistIds.has(node.id),
  )
  const targetNode =
    findNodeAcross(watchlistNodes, action.targetNodeId) ??
    findNodeAcross(canvasNodes, action.targetNodeId)
  const isKnownTarget = targetNode !== undefined
  const fieldCls = ribbonFieldCls(true)

  return (
    <>
      <label className={fieldCls}>
        <span className="shrink-0 text-slate-500">目标节点</span>
        <select
          aria-label="联动目标节点"
          value={action.targetNodeId}
          onChange={(e) => {
            onChangeAction(
              retargetedSwitchAction(action, e.target.value, watchlistNodes, canvasNodes),
            )
          }}
          className={cn(SELECT_BOX_CLS, 'w-40')}
        >
          {watchlistNodes.length > 0 && (
            <optgroup label="★ 关注列表">
              {watchlistNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {targetOptionLabel(node, true)}
                </option>
              ))}
            </optgroup>
          )}
          {canvasTargets.length > 0 && (
            <optgroup label="当前画布多页节点">
              {canvasTargets.map((node) => (
                <option key={node.id} value={node.id}>
                  {targetOptionLabel(node, false)}
                </option>
              ))}
            </optgroup>
          )}
          {!isKnownTarget && <option value={action.targetNodeId}>未知目标</option>}
        </select>
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 border-slate-200/90 bg-white px-3 text-[13px] text-slate-700 shadow-2xs hover:bg-slate-50"
        onClick={() => {
          if (sourceNodeId !== undefined) onArmPick(sourceNodeId, bindingId)
        }}
      >
        ⌖ 点选
      </Button>
      <label className={fieldCls}>
        <span className="shrink-0 text-slate-500">页码动作</span>
        <select
          aria-label="翻页动作模式"
          value={modeSelectValue(action)}
          onChange={(e) => {
            const parsed = parseModeValue(e.target.value, action.pageIndex ?? 0)
            if (parsed === null) return
            onChangeAction({ type: 'switch-node-page', targetNodeId: action.targetNodeId, ...parsed })
          }}
          className={cn(SELECT_BOX_CLS, 'w-24')}
        >
          <option value="next-loop">下一页循环</option>
          <option value="prev-loop">上一页循环</option>
          {buildPageModeOptions(displayPageCount(targetNode)).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
