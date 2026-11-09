import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  INITIAL_RIBBON_STATE,
  RIBBON_TABS,
  doubleClickRibbonTab,
  selectRibbonTab,
  toggleRibbonCollapsed,
} from './ribbonToolbarState'

void test('RIBBON_TABS defines the four categorized workflow tabs', () => {
  assert.deepEqual(
    RIBBON_TABS.map((tab) => tab.id),
    ['home', 'insert', 'layout', 'interaction'],
  )
  assert.equal(INITIAL_RIBBON_STATE.activeTab, 'home')
  assert.equal(INITIAL_RIBBON_STATE.collapsed, false)
})

void test('selectRibbonTab switches active tab and uncollapses when collapsed', () => {
  const switched = selectRibbonTab(INITIAL_RIBBON_STATE, 'layout')
  assert.equal(switched.activeTab, 'layout')
  assert.equal(switched.collapsed, false)

  const collapsed = toggleRibbonCollapsed(switched)
  assert.equal(collapsed.collapsed, true)

  const reopened = selectRibbonTab(collapsed, 'interaction')
  assert.equal(reopened.activeTab, 'interaction')
  assert.equal(reopened.collapsed, false)
})

void test('doubleClickRibbonTab toggles collapse on active tab and expands on another tab', () => {
  const collapsedHome = doubleClickRibbonTab(INITIAL_RIBBON_STATE, 'home')
  assert.equal(collapsedHome.activeTab, 'home')
  assert.equal(collapsedHome.collapsed, true)

  const expandedHome = doubleClickRibbonTab(collapsedHome, 'home')
  assert.equal(expandedHome.activeTab, 'home')
  assert.equal(expandedHome.collapsed, false)

  const switchedFromCollapsed = doubleClickRibbonTab(collapsedHome, 'insert')
  assert.equal(switchedFromCollapsed.activeTab, 'insert')
  assert.equal(switchedFromCollapsed.collapsed, false)
})
