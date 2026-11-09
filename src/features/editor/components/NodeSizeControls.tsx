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
  readonly disabled?: boolean
  readonly onWidthChange: (width: number) => void
  readonly onHeightChange: (height: number) => void
}

/** 选中节点的双行尺寸调节；未选中节点时保持原位虚化禁用 */
export function NodeSizeControls({
  width,
  height,
  disabled = false,
  onWidthChange,
  onHeightChange,
}: Readonly<NodeSizeControlsProps>) {
  return (
    <div className="flex h-[70px] flex-col justify-between gap-1.5">
      <SizeSlider
        label="宽度"
        value={width}
        min={MIN_NODE_WIDTH}
        max={MAX_NODE_WIDTH}
        disabled={disabled}
        onChange={onWidthChange}
      />
      <SizeSlider
        label="高度"
        value={height}
        min={MIN_NODE_HEIGHT}
        max={MAX_NODE_HEIGHT}
        disabled={disabled}
        onChange={onHeightChange}
      />
    </div>
  )
}
