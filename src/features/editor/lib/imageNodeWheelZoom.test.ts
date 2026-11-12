import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'

import {
  FALLBACK_DOCUMENT_DEFAULTS,
  MAX_NODE_WIDTH,
  MIN_NODE_WIDTH,
} from '@/shared/lib/nodeDefaults'
import type { NodeSize } from '@/shared/lib/nodeDefaults'
import type { NodeId, PaperDocument, PaperNode } from '@/shared/types/paper'
import { imageNodeAt, resizeImageNodeOnWheel, scaleNodeSize } from './imageNodeWheelZoom'

const domWindow = new Window()

function installDomGlobals(): void {
  const entries: ReadonlyArray<readonly [string, unknown]> = [
    ['window', domWindow],
    ['document', domWindow.document],
    ['Node', domWindow.Node],
    ['Text', domWindow.Text],
    ['Element', domWindow.Element],
    ['HTMLElement', domWindow.HTMLElement],
    ['WheelEvent', domWindow.WheelEvent],
  ]
  for (const [key, value] of entries) {
    if (Reflect.get(globalThis, key) === undefined) {
      Object.defineProperty(globalThis, key, { value, writable: true, configurable: true })
    }
  }
}

installDomGlobals()

function imageNode(id: string, width: number, height: number): PaperNode {
  return {
    id,
    parentIds: [],
    content: { kind: 'image', src: '/res/inbox/a.png', alt: 'a', items: [], activeIndex: 0 },
    layout: { x: 0, y: 0, collapsed: false, width, height },
  }
}

function textNode(id: string): PaperNode {
  return {
    id,
    parentIds: [],
    content: { kind: 'text', richText: '' },
    layout: { x: 0, y: 0, collapsed: false },
  }
}

function fixture(nodes: readonly PaperNode[]): PaperDocument {
  return {
    meta: {
      id: 'doc-wheel',
      title: '滚轮缩放测试',
      author: '',
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    },
    defaults: FALLBACK_DOCUMENT_DEFAULTS,
    rootIds: nodes.map((item) => item.id),
    nodes,
  }
}

/** 在文档里挂一张带 data-node-id 的卡片，派发滚轮事件后返回该事件（target 已就绪） */
function wheelOnCard(nodeId: string, init: { ctrlKey?: boolean; metaKey?: boolean; deltaY: number }) {
  const card = document.createElement('div')
  card.setAttribute('data-node-id', nodeId)
  const inner = document.createElement('img')
  card.appendChild(inner)
  document.body.appendChild(card)
  const event = new WheelEvent('wheel', { bubbles: true, deltaY: init.deltaY })
  // happy-dom 的 WheelEvent 不继承 MouseEvent 的修饰键，手动补齐 ctrlKey/metaKey
  Object.defineProperty(event, 'ctrlKey', { value: init.ctrlKey ?? false, configurable: true })
  Object.defineProperty(event, 'metaKey', { value: init.metaKey ?? false, configurable: true })
  inner.dispatchEvent(event)
  card.remove()
  return event
}

void test('scaleNodeSize grows proportionally within bounds', () => {
  assert.deepEqual(scaleNodeSize({ width: 200, height: 100 }, 1.5), { width: 300, height: 150 })
  assert.deepEqual(scaleNodeSize({ width: 400, height: 200 }, 0.5), { width: 200, height: 100 })
})

void test('scaleNodeSize clamps the factor to keep both edges within limits and preserve aspect', () => {
  const grown = scaleNodeSize({ width: 800, height: 400 }, 2)
  assert.deepEqual(grown, { width: MAX_NODE_WIDTH, height: 500 })
  const shrunk = scaleNodeSize({ width: 200, height: 100 }, 0.1)
  assert.deepEqual(shrunk, { width: MIN_NODE_WIDTH, height: 60 })
})

void test('imageNodeAt resolves only image nodes from the wheel target', () => {
  const doc = fixture([imageNode('img', 200, 100), textNode('txt')])
  const imageEvent = wheelOnCard('img', { deltaY: -100 })
  assert.equal(imageNodeAt(imageEvent.target, doc)?.id, 'img')
  const textEvent = wheelOnCard('txt', { deltaY: -100 })
  assert.equal(imageNodeAt(textEvent.target, doc), null)
  assert.equal(imageNodeAt(null, doc), null)
})

void test('resizeImageNodeOnWheel scales the image node on ctrl+wheel and consumes the event', () => {
  const doc = fixture([imageNode('img', 200, 100)])
  const calls: Array<{ id: NodeId; size: NodeSize }> = []
  const event = wheelOnCard('img', { ctrlKey: true, deltaY: -100 })
  const consumed = resizeImageNodeOnWheel(event, doc, doc.defaults, (id, size) => {
    calls.push({ id, size })
  })
  assert.equal(consumed, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.id, 'img')
  const expected = scaleNodeSize({ width: 200, height: 100 }, Math.exp(0.1))
  assert.deepEqual(calls[0]?.size, expected)
})

void test('resizeImageNodeOnWheel also accepts metaKey (mac Cmd)', () => {
  const doc = fixture([imageNode('img', 200, 100)])
  let called = false
  const event = wheelOnCard('img', { metaKey: true, deltaY: 100 })
  const consumed = resizeImageNodeOnWheel(event, doc, doc.defaults, () => {
    called = true
  })
  assert.equal(consumed, true)
  assert.equal(called, true)
})

void test('resizeImageNodeOnWheel ignores plain wheel and non-image nodes', () => {
  const doc = fixture([imageNode('img', 200, 100), textNode('txt')])
  let called = false
  const onResize = (): void => {
    called = true
  }
  assert.equal(resizeImageNodeOnWheel(wheelOnCard('img', { deltaY: -100 }), doc, doc.defaults, onResize), false)
  assert.equal(resizeImageNodeOnWheel(wheelOnCard('txt', { ctrlKey: true, deltaY: -100 }), doc, doc.defaults, onResize), false)
  assert.equal(called, false)
})