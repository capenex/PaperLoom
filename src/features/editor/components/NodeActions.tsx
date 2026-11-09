import { Eye, EyeOff, ListPlus, Network, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

interface NodeActionsProps {
  readonly hasSelection: boolean
  readonly isRoot: boolean
  /** 是否允许删除：最后一个根节点或子画布入口宿主必须保留 */
  readonly canDelete: boolean
  readonly hidden: boolean
  readonly onAddRoot: () => void
  readonly onAddChild: () => void
  readonly onAddSibling: () => void
  readonly onToggleHidden: () => void
  readonly onDelete: () => void
}

/** 节点结构操作区（双行布局）：左侧添加根节点，中间添加子/同级一列，右侧隐藏/删除一列 */
export function NodeActions({
  hasSelection,
  isRoot,
  canDelete,
  hidden,
  onAddRoot,
  onAddChild,
  onAddSibling,
  onToggleHidden,
  onDelete,
}: Readonly<NodeActionsProps>) {
  const isHiddenActive = hasSelection && hidden

  return (
    <div className="flex h-[70px] items-stretch gap-1.5">
      <button
        type="button"
        onClick={onAddRoot}
        className="flex h-[70px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3.5 text-[13px] font-medium whitespace-nowrap text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        <Network className="size-5 text-primary" aria-hidden="true" />
        <span>添加根节点</span>
      </button>

      <div className="flex h-[70px] flex-col justify-between gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasSelection}
          className="h-8 w-full justify-start border-slate-200/90 bg-white px-3 text-[13px] text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
          onClick={onAddChild}
        >
          <Plus className="size-4 text-primary" aria-hidden="true" />
          添加子节点
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasSelection || isRoot}
          className="h-8 w-full justify-start border-slate-200/90 bg-white px-3 text-[13px] text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
          onClick={onAddSibling}
        >
          <ListPlus className="size-4 text-slate-500" aria-hidden="true" />
          添加同级
        </Button>
      </div>

      <div className="flex h-[70px] flex-col justify-between gap-1.5">
        <Button
          type="button"
          variant={isHiddenActive ? 'secondary' : 'outline'}
          size="sm"
          disabled={!hasSelection}
          className="h-8 w-24 justify-start border-slate-200/90 bg-white px-3 text-[13px] text-slate-700 shadow-2xs hover:text-slate-900"
          aria-pressed={isHiddenActive}
          onClick={onToggleHidden}
        >
          {isHiddenActive ? (
            <Eye className="size-4 text-slate-500" aria-hidden="true" />
          ) : (
            <EyeOff className="size-4 text-slate-500" aria-hidden="true" />
          )}
          {isHiddenActive ? '取消隐藏' : '隐藏'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasSelection || !canDelete}
          className="h-8 w-24 justify-start border-rose-200/80 bg-rose-50/60 px-3 text-[13px] text-rose-600 shadow-2xs hover:border-rose-300 hover:bg-rose-100/70 hover:text-rose-700"
          onClick={onDelete}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          删除
        </Button>
      </div>
    </div>
  )
}
