export type RibbonTabId = 'home' | 'insert' | 'layout' | 'interaction'

export interface RibbonTabMeta {
  readonly id: RibbonTabId
  readonly label: string
}

export const RIBBON_TABS: readonly RibbonTabMeta[] = [
  {
    id: 'home',
    label: '开始',
  },
  {
    id: 'insert',
    label: '插入与类型',
  },
  {
    id: 'layout',
    label: '尺寸与布局',
  },
  {
    id: 'interaction',
    label: '交互与事件',
  },
]

export interface RibbonToolbarState {
  readonly activeTab: RibbonTabId
  readonly collapsed: boolean
}

export const INITIAL_RIBBON_STATE: RibbonToolbarState = {
  activeTab: 'home',
  collapsed: false,
}

/** 单击选项卡：若当前处于折叠态则自动展开并切换到目标选项卡；否则仅切换激活选项卡 */
export function selectRibbonTab(
  _state: RibbonToolbarState,
  tab: RibbonTabId,
): RibbonToolbarState {
  return {
    activeTab: tab,
    collapsed: false,
  }
}

/** 双击选项卡（仿 PPT / WPS）：切换功能区折叠/展开状态，同时激活该选项卡 */
export function doubleClickRibbonTab(
  state: RibbonToolbarState,
  tab: RibbonTabId,
): RibbonToolbarState {
  if (state.activeTab === tab) {
    return {
      activeTab: tab,
      collapsed: !state.collapsed,
    }
  }
  return {
    activeTab: tab,
    collapsed: false,
  }
}

/** 点击右侧折叠/展开按钮 */
export function toggleRibbonCollapsed(state: RibbonToolbarState): RibbonToolbarState {
  return {
    ...state,
    collapsed: !state.collapsed,
  }
}
