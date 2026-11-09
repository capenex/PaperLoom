import test from 'node:test'
import assert from 'node:assert/strict'

import { FALLBACK_DOCUMENT_DEFAULTS } from '@/shared/lib/nodeDefaults'
import { parseProjectFile } from '@/shared/lib/projectFile'
import { PROJECT_FORMAT_VERSION } from '@/shared/types/project'
import type { NodeId, PaperDocument, PaperNode } from '@/shared/types/paper'
import { computeConnectionGeometry } from './connectionGeometry'
import type { Point } from './layout'
import { setNodeHidden, withHiddenFlag } from './nodeVisibility'
import { ensureSubCanvasForNode } from './subCanvas'

function node(id: string, parentIds: readonly string[], isHidden?: boolean): PaperNode {
  const base: PaperNode = {
    id,
    parentIds,
    content: { kind: 'text', richText: '' },
    layout: { x: 0, y: 0, collapsed: false },
  }
  return isHidden === undefined ? base : { ...base, isHidden }
}

function fixture(nodes: readonly PaperNode[]): PaperDocument {
  return {
    meta: {
      id: 'doc-hidden',
      title: '隐藏测试',
      author: '',
      createdAt: '2026-11-09T00:00:00.000Z',
      updatedAt: '2026-11-09T00:00:00.000Z',
    },
    defaults: FALLBACK_DOCUMENT_DEFAULTS,
    rootIds: nodes.filter((item) => item.parentIds.length === 0).map((item) => item.id),
    nodes,
  }
}

function geometryOf(nodes: readonly PaperNode[]) {
  const positions = new Map<NodeId, Point>()
  const widths = new Map<NodeId, number>()
  nodes.forEach((item, index) => {
    positions.set(item.id, { x: index * 300, y: index * 10 })
    widths.set(item.id, 200)
  })
  return computeConnectionGeometry(nodes, positions, widths)
}

void test('withHiddenFlag adds the flag and removes the field entirely when unhidden', () => {
  const visible = node('a', [])
  const hidden = withHiddenFlag(visible, true)
  assert.equal(hidden.isHidden, true)
  assert.equal(withHiddenFlag(hidden, true), hidden)
  const restored = withHiddenFlag(hidden, false)
  assert.equal('isHidden' in restored, false)
  assert.equal(withHiddenFlag(visible, false), visible)
})

void test('setNodeHidden returns the same document when nothing changes', () => {
  const doc = fixture([node('a', []), node('b', ['a'])])
  assert.equal(setNodeHidden(doc, 'b', false), doc)
  const next = setNodeHidden(doc, 'b', true)
  assert.equal(next.nodes[1]?.isHidden, true)
  assert.equal(next.nodes[0], doc.nodes[0])
  assert.equal('isHidden' in (setNodeHidden(next, 'b', false).nodes[1] ?? {}), false)
})

void test('a hidden node bridges only when it has both incoming and outgoing edges', () => {
  const geometry = geometryOf([node('a', []), node('h', ['a'], true), node('c', ['h'])])
  assert.equal(geometry.edges.length, 2)
  assert.deepEqual(geometry.bridges, [{ key: 'h', y: 10, x1: 200, x2: 400 }])
  const intoHidden = geometry.edges.find((edge) => edge.key === 'h:a')
  const outOfHidden = geometry.edges.find((edge) => edge.key === 'c:h')
  assert.equal(intoHidden?.startDot, true)
  assert.equal(intoHidden?.endDot, false)
  assert.equal(outOfHidden?.startDot, false)
  assert.equal(outOfHidden?.endDot, true)
  assert.equal(intoHidden?.end.x, geometry.bridges[0]?.x1)
  assert.equal(outOfHidden?.start.x, geometry.bridges[0]?.x2)

  const leaf = geometryOf([node('a', []), node('h', ['a'], true)])
  assert.equal(leaf.bridges.length, 0)
  const hiddenRoot = geometryOf([node('h', [], true), node('c', ['h'])])
  assert.equal(hiddenRoot.bridges.length, 0)
})

void test('a hidden relay with several parents still yields a single bridge', () => {
  const geometry = geometryOf([
    node('a', []),
    node('b', []),
    node('h', ['a', 'b'], true),
    node('c', ['h']),
  ])
  assert.equal(geometry.edges.length, 3)
  assert.equal(geometry.bridges.length, 1)
})

void test('a sub-canvas created from a hidden host starts visible', () => {
  const doc = fixture([node('host', [], true)])
  const { document, canvasId } = ensureSubCanvasForNode(doc, null, 'host', 'sub-1')
  const subHost = document.subCanvases?.[canvasId]?.nodes.find((item) => item.id === 'host')
  assert.ok(subHost !== undefined)
  assert.equal('isHidden' in subHost, false)
  assert.equal(document.nodes[0]?.isHidden, true)
})

void test('parseProjectFile accepts boolean or missing isHidden and rejects other types', () => {
  const parse = (isHidden: unknown) => {
    const doc = fixture([node('a', [])])
    const rawNode = { ...doc.nodes[0], ...(isHidden === undefined ? {} : { isHidden }) }
    return parseProjectFile(
      JSON.stringify({
        formatVersion: PROJECT_FORMAT_VERSION,
        savedAt: '2026-11-09T00:00:00.000Z',
        document: { ...doc, nodes: [rawNode] },
      }),
    )
  }
  const hidden = parse(true)
  assert.equal(hidden.ok, true)
  if (hidden.ok) assert.equal(hidden.project.document.nodes[0]?.isHidden, true)
  assert.equal(parse(false).ok, true)
  assert.equal(parse(undefined).ok, true)
  assert.equal(parse('yes').ok, false)
})
