import { ListPlus, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

interface NodeActionsProps {
  readonly isRoot: boolean
  /** 是否允许删除：最后一个根节点必须保留 */
  readonly canDelete: boolean
  readonly onAddChild: () => void
  readonly onAddSibling: () => void
  readonly onDelete: () => void
}

function deleteTitle(canDelete: boolean): string {
  return canDelete ? '删除所选节点及其全部子节点' : '至少要保留一个根节点'
}

export function NodeActions({
  isRoot,
  canDelete,
  onAddChild,
  onAddSibling,
  onDelete,
}: Readonly<NodeActionsProps>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-slate-200/90 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
        onClick={onAddChild}
      >
        <Plus className="text-primary" aria-hidden="true" />
        添加子节点
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-slate-200/90 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
        disabled={isRoot}
        title={isRoot ? '根节点没有同级节点，请在未选中节点时添加根节点' : '在所选节点之后插入同级节点'}
        onClick={onAddSibling}
      >
        <ListPlus className="text-slate-500" aria-hidden="true" />
        添加同级
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-rose-200/80 bg-rose-50/60 text-rose-600 shadow-2xs hover:border-rose-300 hover:bg-rose-100/70 hover:text-rose-700"
        disabled={!canDelete}
        title={deleteTitle(canDelete)}
        onClick={onDelete}
      >
        <Trash2 aria-hidden="true" />
        删除
      </Button>
    </div>
  )
}
