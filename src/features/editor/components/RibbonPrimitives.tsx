import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from 'cn'

import { Button } from '@/shared/components/ui/button'
import { RIBBON_TABS } from '../lib/ribbonToolbarState'
import type { RibbonTabId } from '../lib/ribbonToolbarState'

export function RibbonDivider() {
  return <span className="h-[70px] w-px shrink-0 bg-slate-200/80" aria-hidden="true" />
}

export function RibbonGroup({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return <div className="flex h-[70px] shrink-0 items-stretch gap-2">{children}</div>
}

interface RibbonTabBarProps {
  readonly activeTab: RibbonTabId
  readonly collapsed: boolean
  readonly brandSlot?: ReactNode
  readonly rightSlot?: ReactNode
  readonly onSelectTab: (tab: RibbonTabId) => void
  readonly onDoubleClickTab: (tab: RibbonTabId) => void
  readonly onToggleCollapsed: () => void
}

export function RibbonTabBar({
  activeTab,
  collapsed,
  brandSlot,
  rightSlot,
  onSelectTab,
  onDoubleClickTab,
  onToggleCollapsed,
}: Readonly<RibbonTabBarProps>) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-3 px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {brandSlot}
        {brandSlot !== undefined && (
          <span className="h-4 w-px shrink-0 bg-slate-200/80" aria-hidden="true" />
        )}
        {rightSlot}
        <div
          role="tablist"
          aria-label="编辑栏功能分类"
          className="flex items-center gap-1"
        >
          {RIBBON_TABS.map((tab) => {
            const isActive = activeTab === tab.id && !collapsed
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  onSelectTab(tab.id)
                }}
                onDoubleClick={() => {
                  onDoubleClickTab(tab.id)
                }}
                className={cn(
                  'relative h-7 cursor-pointer rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors select-none',
                  isActive
                    ? 'bg-primary/8 font-semibold text-primary after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex shrink-0 items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={!collapsed}
          className="h-7 px-2.5 text-[13px] text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          onClick={onToggleCollapsed}
        >
          {collapsed ? (
            <>
              <ChevronDown className="size-4" aria-hidden="true" />
              展开功能区
            </>
          ) : (
            <>
              <ChevronUp className="size-4" aria-hidden="true" />
              收起功能区
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
