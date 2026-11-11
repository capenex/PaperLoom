import { Crosshair } from "lucide-react"

import { Button } from "@/shared/components/ui/button"
import {
  SelectMenu,
  type SelectMenuGroup,
  type SelectMenuOption,
} from "@/shared/components/ui/select-menu"
import type { NodeId, PageSwitchMode, PaperNode } from "@/shared/types/paper"
import type { SwitchNodePageAction } from "../lib/eventBindingUi"
import { ribbonFieldCls } from "../lib/eventBindingUi"
import { nodeDisplayLabel, nodeKindLabel, nodePageCount } from "../lib/nodeLabel"

interface SwitchNodePageControlsProps {
  readonly action: SwitchNodePageAction
  readonly bindingId: string
  readonly sourceNodeId: NodeId | undefined
  readonly watchlistNodes: readonly PaperNode[]
  readonly canvasNodes: readonly PaperNode[]
  readonly onChangeAction: (action: SwitchNodePageAction) => void
  readonly onArmPick: (sourceNodeId: NodeId, bindingId: string) => void
}

function findNodeAcross(
  nodes: readonly PaperNode[],
  nodeId: string,
): PaperNode | undefined {
  return nodes.find((node) => node.id === nodeId)
}

function toTargetMenuOption(
  node: PaperNode,
  starred: boolean,
): SelectMenuOption {
  return {
    value: node.id,
    label: nodeDisplayLabel(node),
    prefixTag: nodeKindLabel(node.content.kind),
    badge: `${nodePageCount(node)}页`,
    starred,
  }
}

function isCanvasPageTarget(node: PaperNode): boolean {
  if (node.content.kind === "image") return true
  return node.content.kind === "text" && nodePageCount(node) >= 2
}

function displayPageCount(node: PaperNode | undefined): number {
  return node === undefined ? 5 : Math.max(5, nodePageCount(node))
}

function modeSelectValue(action: SwitchNodePageAction): string {
  return action.mode === "index" ? `index:${action.pageIndex ?? 0}` : action.mode
}

function parseModeValue(
  value: string,
  fallbackPageIndex: number,
): { mode: PageSwitchMode; pageIndex: number } | null {
  if (value === "next-loop" || value === "prev-loop") {
    return { mode: value, pageIndex: fallbackPageIndex }
  }
  const indexText = value.startsWith("index:")
    ? value.slice("index:".length)
    : ""
  const pageIndex = Number(indexText)
  if (indexText === "" || !Number.isInteger(pageIndex)) return null
  return { mode: "index", pageIndex }
}

function buildPageModeGroups(
  pageCount: number,
): readonly SelectMenuGroup[] {
  const indexOptions: SelectMenuOption[] = []
  for (let index = 0; index < pageCount; index += 1) {
    indexOptions.push({
      value: `index:${index}`,
      label: `第 ${index + 1} 页`,
      badge: `P${index + 1}`,
    })
  }
  return [
    {
      label: "循环翻页",
      options: [
        { value: "next-loop", label: "下一页循环", badge: "↻" },
        { value: "prev-loop", label: "上一页循环", badge: "↺" },
      ],
    },
    {
      label: "指定页码",
      options: indexOptions,
    },
  ]
}

function buildTargetGroups(
  watchlistNodes: readonly PaperNode[],
  canvasTargets: readonly PaperNode[],
  isKnownTarget: boolean,
  fallbackNodeId: string,
): readonly SelectMenuGroup[] {
  const groups: SelectMenuGroup[] = []
  if (watchlistNodes.length > 0) {
    groups.push({
      label: "★ 关注列表",
      options: watchlistNodes.map((node) => toTargetMenuOption(node, true)),
    })
  }
  if (canvasTargets.length > 0) {
    groups.push({
      label: "当前画布多页节点",
      options: canvasTargets.map((node) => toTargetMenuOption(node, false)),
    })
  }
  if (!isKnownTarget) {
    groups.push({
      label: "当前绑定",
      options: [{ value: fallbackNodeId, label: "未知目标", badge: "失效" }],
    })
  }
  return groups
}

function retargetedSwitchAction(
  action: SwitchNodePageAction,
  targetNodeId: string,
  watchlistNodes: readonly PaperNode[],
  canvasNodes: readonly PaperNode[],
): SwitchNodePageAction {
  const nextNode =
    findNodeAcross(watchlistNodes, targetNodeId) ??
    findNodeAcross(canvasNodes, targetNodeId)
  const pageIndex =
    action.mode === "index"
      ? Math.min(action.pageIndex ?? 0, displayPageCount(nextNode) - 1)
      : (action.pageIndex ?? 0)
  return {
    type: "switch-node-page",
    targetNodeId,
    mode: action.mode,
    pageIndex,
  }
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
  const targetGroups = buildTargetGroups(
    watchlistNodes,
    canvasTargets,
    isKnownTarget,
    action.targetNodeId,
  )
  const pageModeGroups = buildPageModeGroups(displayPageCount(targetNode))

  return (
    <>
      <div className={fieldCls}>
        <span className="shrink-0 text-slate-500">目标节点</span>
        <SelectMenu
          ariaLabel="联动目标节点"
          value={action.targetNodeId}
          groups={targetGroups}
          triggerClassName="w-44"
          contentClassName="w-64"
          onValueChange={(nextTargetId) => {
            onChangeAction(
              retargetedSwitchAction(
                action,
                nextTargetId,
                watchlistNodes,
                canvasNodes,
              ),
            )
          }}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 border-slate-200/90 bg-white px-2.5 text-[13px] font-medium text-slate-700 shadow-2xs hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        onClick={() => {
          if (sourceNodeId !== undefined) onArmPick(sourceNodeId, bindingId)
        }}
      >
        <Crosshair className="size-3.5 text-primary" aria-hidden="true" />
        点选
      </Button>
      <div className={fieldCls}>
        <span className="shrink-0 text-slate-500">页码动作</span>
        <SelectMenu
          ariaLabel="翻页动作模式"
          value={modeSelectValue(action)}
          groups={pageModeGroups}
          triggerClassName="w-28"
          contentClassName="w-44"
          onValueChange={(nextModeVal) => {
            const parsed = parseModeValue(nextModeVal, action.pageIndex ?? 0)
            if (parsed === null) return
            onChangeAction({
              type: "switch-node-page",
              targetNodeId: action.targetNodeId,
              ...parsed,
            })
          }}
        />
      </div>
    </>
  )
}
