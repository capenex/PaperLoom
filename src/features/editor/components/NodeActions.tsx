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
      <Button type="button" variant="outline" size="sm" onClick={onAddChild}>
        <Plus aria-hidden="true" />
        添加子节点
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isRoot}
        title={isRoot ? '根节点没有同级节点，请在未选中节点时添加根节点' : '在所选节点之后插入同级节点'}
        onClick={onAddSibling}
      >
        <ListPlus aria-hidden="true" />
        添加同级
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
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
