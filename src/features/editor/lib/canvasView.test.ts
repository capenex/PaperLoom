import test from 'node:test'
import assert from 'node:assert/strict'

import { entryViewForHost, screenPositionOf } from './canvasView'

void test('entryViewForHost frames the host node left-ish and vertically centered', () => {
  const viewport = { width: 2000, height: 967 }
  const stage = { width: 3000, height: 2000 }
  const host = { x: 400, y: 1000, stageWidth: stage.width, stageHeight: stage.height }
  const view = entryViewForHost(host, viewport)
  const screen = screenPositionOf(host, stage, viewport, view)
  assert.equal(screen.x, 2000 * 0.22)
  assert.equal(screen.y, 967 / 2)
  assert.equal(view.zoom, 1)
})

void test('entryViewForHost respects narrow viewports and custom zoom', () => {
  const viewport = { width: 500, height: 800 }
  const stage = { width: 1200, height: 900 }
  const host = { x: 100, y: 100, stageWidth: stage.width, stageHeight: stage.height }
  const view = entryViewForHost(host, viewport, 2)
  const screen = screenPositionOf(host, stage, viewport, view)
  assert.equal(screen.x, 140)
  assert.equal(screen.y, 400)
  assert.equal(view.zoom, 2)
})