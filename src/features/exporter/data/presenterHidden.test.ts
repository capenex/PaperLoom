import test from 'node:test'
import assert from 'node:assert/strict'

import { Window } from 'happy-dom'

import { FALLBACK_DOCUMENT_DEFAULTS } from '@/shared/lib/nodeDefaults'
import type { PaperDocument, PaperNode } from '@/shared/types/paper'
import { createDataJs } from './generate'
import { PRESENTER_SCRIPT } from './presenterScript'

function textNode(id: string, parentIds: readonly string[], richText: string): PaperNode {
  return {
    id,
    parentIds,
    content: { kind: 'text', richText },
    layout: { x: 0, y: 0, collapsed: false },
  }
}

function runPresenter(nodes: readonly PaperNode[]) {
  const doc: PaperDocument = {
    meta: {
      id: 'doc-presenter-hidden',
      title: '隐藏演示',
      author: '',
      createdAt: '2026-11-09T00:00:00.000Z',
      updatedAt: '2026-11-09T00:00:00.000Z',
    },
    defaults: FALLBACK_DOCUMENT_DEFAULTS,
    rootIds: ['a'],
    nodes,
  }
  const window = new Window()
  window.document.body.innerHTML = '<div id="app"></div>'
  window.eval(createDataJs(doc))
  window.eval(PRESENTER_SCRIPT)
  return window.document
}

void test('presenter omits hidden cards but keeps their slot and bridges the line through them', () => {
  const relay: PaperNode = { ...textNode('h', ['a'], '<p>中继</p>'), isHidden: true }
  const hiddenDoc = runPresenter([
    textNode('a', [], '<p>起点</p>'),
    relay,
    textNode('c', ['h'], '<p>终点</p>'),
  ])
  assert.equal(hiddenDoc.querySelector('[data-node-id="h"]'), null)
  assert.ok(hiddenDoc.querySelector('[data-node-id="a"]'))
  assert.equal(hiddenDoc.querySelectorAll('svg.connections path').length, 2)
  const bridge = hiddenDoc.querySelector('svg.connections line')
  assert.ok(bridge)
  assert.equal(bridge.getAttribute('y1'), bridge.getAttribute('y2'))

  const visibleDoc = runPresenter([
    textNode('a', [], '<p>起点</p>'),
    textNode('h', ['a'], '<p>中继</p>'),
    textNode('c', ['h'], '<p>终点</p>'),
  ])
  assert.equal(visibleDoc.querySelectorAll('svg.connections line').length, 0)
  const leftOf = (doc: typeof hiddenDoc) =>
    doc.querySelector('[data-node-id="c"]')?.getAttribute('style')
  assert.equal(leftOf(hiddenDoc), leftOf(visibleDoc))
})
