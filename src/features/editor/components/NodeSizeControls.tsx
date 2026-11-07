import {
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
} from '@/shared/lib/nodeDefaults'
import { SizeSlider } from './SizeSlider'

interface NodeSizeControlsProps {
  readonly width: number
  readonly height: number
  readonly onWidthChange: (width: number) => void
  readonly onHeightChange: (height: number) => void
}

/** 选中节点的尺寸调节；写入节点自身布局，覆盖文档预设 */
export function NodeSizeControls({
  width,
  height,
  onWidthChange,
  onHeightChange,
}: Readonly<NodeSizeControlsProps>) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <SizeSlider
        label="宽度"
        value={width}
        min={MIN_NODE_WIDTH}
        max={MAX_NODE_WIDTH}
        onChange={onWidthChange}
      />
      <SizeSlider
        label="高度"
        value={height}
        min={MIN_NODE_HEIGHT}
        max={MAX_NODE_HEIGHT}
        onChange={onHeightChange}
      />
    </div>
  )
}
