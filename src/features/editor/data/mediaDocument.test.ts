import test from 'node:test'
import assert from 'node:assert/strict'

import type {
  ImageNodeContent,
  PaperDocument,
  PaperNode,
  TextNodeContent,
} from '@/shared/types/paper'
import { createInitialDocument, ensureSubCanvasForNode, updateTextNodeContent } from './document'
import {
  addImagePageToNode,
  moveActiveImagePageInNode,
  removeActiveImagePageFromNode,
  replaceActiveImagePageInNode,
  switchNodePageInDocument,
  toggleNodeInWatchlist,
} from './mediaDocument'

const PAGE_BREAK = '<hr data-pl-page-break="true">'

function initialPair(): { readonly doc: PaperDocument; readonly rootId: string; readonly imageId: string } {
  const doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  const imageId = doc.nodes[1]?.id
  assert.ok(rootId !== undefined)
  assert.ok(imageId !== undefined)
  return { doc, rootId, imageId }
}

function imageContentOf(doc: PaperDocument, nodeId: string): ImageNodeContent {
  const content = doc.nodes.find((node) => node.id === nodeId)?.content
  assert.ok(content !== undefined && content.kind === 'image')
  return content
}

function textContentOf(doc: PaperDocument, nodeId: string): TextNodeContent {
  const content = doc.nodes.find((node) => node.id === nodeId)?.content
  assert.ok(content !== undefined && content.kind === 'text')
  return content
}

void test('addImagePageToNode appends pages, activates the last and syncs src/alt', () => {
  const { doc, imageId, rootId } = initialPair()
  const next = addImagePageToNode(doc, imageId, [
    { src: '/b.png', alt: 'B' },
    { src: '/c.png', alt: 'C' },
  ])
  const content = imageContentOf(next, imageId)
  assert.equal(content.items?.length, 3)
  assert.equal(content.activeIndex, 2)
  assert.equal(content.src, '/c.png')
  assert.equal(content.alt, 'C')
  assert.equal(imageContentOf(doc, imageId).items, undefined)
  assert.equal(addImagePageToNode(next, 'missing', [{ src: '/x.png', alt: 'X' }]), next)
  assert.equal(addImagePageToNode(next, imageId, []), next)
  assert.equal(addImagePageToNode(next, rootId, [{ src: '/x.png', alt: 'X' }]), next)
})

void test('replaceActiveImagePageInNode replaces only the active page', () => {
  const { doc, imageId } = initialPair()
  let next = addImagePageToNode(doc, imageId, [
    { src: '/b.png', alt: 'B' },
    { src: '/c.png', alt: 'C' },
  ])
  next = switchNodePageInDocument(next, imageId, 'index', 0)
  next = replaceActiveImagePageInNode(next, imageId, { src: '/a2.png', alt: 'A2' })
  const content = imageContentOf(next, imageId)
  assert.equal(content.activeIndex, 0)
  assert.equal(content.src, '/a2.png')
  assert.equal(content.alt, 'A2')
  assert.deepEqual(
    content.items?.map((item) => item.src),
    ['/a2.png', '/b.png', '/c.png'],
  )
})

void test('removeActiveImagePageFromNode deletes the active page and steps back', () => {
  const { doc, imageId } = initialPair()
  let next = addImagePageToNode(doc, imageId, [
    { src: '/b.png', alt: 'B' },
    { src: '/c.png', alt: 'C' },
  ])
  next = removeActiveImagePageFromNode(next, imageId)
  let content = imageContentOf(next, imageId)
  assert.equal(content.items?.length, 2)
  assert.equal(content.activeIndex, 1)
  assert.equal(content.src, '/b.png')

  next = switchNodePageInDocument(next, imageId, 'index', 0)
  next = removeActiveImagePageFromNode(next, imageId)
  content = imageContentOf(next, imageId)
  assert.equal(content.items?.length, 1)
  assert.equal(content.activeIndex, 0)
  assert.equal(content.src, '/b.png')
  assert.equal(removeActiveImagePageFromNode(next, imageId), next)
})

void test('switchNodePageInDocument cycles image pages and keeps src/alt in sync', () => {
  const { doc, imageId } = initialPair()
  let next = addImagePageToNode(doc, imageId, [
    { src: '/b.png', alt: 'B' },
    { src: '/c.png', alt: 'C' },
  ])
  next = switchNodePageInDocument(next, imageId, 'first')
  assert.equal(imageContentOf(next, imageId).activeIndex, 0)
  next = switchNodePageInDocument(next, imageId, 'next-loop')
  assert.equal(imageContentOf(next, imageId).src, '/b.png')
  next = switchNodePageInDocument(next, imageId, 'next-loop')
  next = switchNodePageInDocument(next, imageId, 'next-loop')
  assert.equal(imageContentOf(next, imageId).activeIndex, 0)
  next = switchNodePageInDocument(next, imageId, 'prev-loop')
  assert.equal(imageContentOf(next, imageId).activeIndex, 2)
  assert.equal(imageContentOf(next, imageId).alt, 'C')
  next = switchNodePageInDocument(next, imageId, 'index', 99)
  assert.equal(imageContentOf(next, imageId).activeIndex, 2)
  next = switchNodePageInDocument(next, imageId, 'index', 1)
  assert.equal(imageContentOf(next, imageId).src, '/b.png')
  assert.equal(switchNodePageInDocument(doc, imageId, 'next-loop'), doc)
})

void test('switchNodePageInDocument drives rich text activePageIndex via page splits', () => {
  const { doc, rootId } = initialPair()
  let next = updateTextNodeContent(doc, rootId, `甲${PAGE_BREAK}乙${PAGE_BREAK}丙`)
  assert.equal(textContentOf(next, rootId).activePageIndex, 2)
  next = switchNodePageInDocument(next, rootId, 'first')
  assert.equal(textContentOf(next, rootId).activePageIndex, 0)
  next = switchNodePageInDocument(next, rootId, 'prev-loop')
  assert.equal(textContentOf(next, rootId).activePageIndex, 2)
  next = switchNodePageInDocument(next, rootId, 'next-loop')
  assert.equal(textContentOf(next, rootId).activePageIndex, 0)
  next = switchNodePageInDocument(next, rootId, 'index', 1)
  assert.equal(textContentOf(next, rootId).activePageIndex, 1)
  next = switchNodePageInDocument(next, rootId, 'index', 42)
  assert.equal(textContentOf(next, rootId).activePageIndex, 2)
  assert.equal(textContentOf(next, rootId).richText, `甲${PAGE_BREAK}乙${PAGE_BREAK}丙`)

  const legacy: PaperDocument = {
    ...doc,
    nodes: doc.nodes.map((node) =>
      node.id === rootId
        ? { ...node, content: { kind: 'text', richText: `甲${PAGE_BREAK}乙` } }
        : node,
    ),
  }
  const switched = switchNodePageInDocument(legacy, rootId, 'next-loop')
  assert.equal(textContentOf(switched, rootId).activePageIndex, 1)

  const singlePage = updateTextNodeContent(doc, rootId, '只有一页')
  assert.equal(switchNodePageInDocument(singlePage, rootId, 'next-loop'), singlePage)
})

void test('updateTextNodeContent clamps the stored page when pages shrink', () => {
  const { doc, rootId } = initialPair()
  let next = updateTextNodeContent(doc, rootId, `甲${PAGE_BREAK}乙${PAGE_BREAK}丙`)
  next = switchNodePageInDocument(next, rootId, 'index', 2)
  next = updateTextNodeContent(next, rootId, `甲${PAGE_BREAK}乙`)
  assert.equal(textContentOf(next, rootId).activePageIndex, 1)
})

void test('toggleNodeInWatchlist adds and removes ids preserving order', () => {
  const { doc, rootId, imageId } = initialPair()
  let next = toggleNodeInWatchlist(doc, imageId)
  assert.deepEqual(next.watchlistNodeIds, [imageId])
  next = toggleNodeInWatchlist(next, rootId)
  assert.deepEqual(next.watchlistNodeIds, [imageId, rootId])
  next = toggleNodeInWatchlist(next, imageId)
  assert.deepEqual(next.watchlistNodeIds, [rootId])
  next = toggleNodeInWatchlist(next, rootId)
  assert.deepEqual(next.watchlistNodeIds, [])
})

void test('image page edits inside a sub canvas propagate to the host copy on main', () => {
  const { doc, imageId } = initialPair()
  let next = ensureSubCanvasForNode(doc, null, imageId, 'sub-1').document
  next = addImagePageToNode(next, imageId, [{ src: '/b.png', alt: 'B' }], 'sub-1')
  const mainContent = imageContentOf(next, imageId)
  assert.equal(mainContent.items?.length, 2)
  const sub = next.subCanvases?.['sub-1']
  assert.ok(sub !== undefined)
  assert.deepEqual(sub.nodes.find((node) => node.id === imageId)?.content, mainContent)

  next = switchNodePageInDocument(next, imageId, 'next-loop', undefined, null)
  assert.equal(imageContentOf(next, imageId).activeIndex, 0)
  const subAfter = next.subCanvases?.['sub-1']
  assert.ok(subAfter !== undefined)
  assert.deepEqual(
    subAfter.nodes.find((node) => node.id === imageId)?.content,
    imageContentOf(next, imageId),
  )
})

void test('rich text host page state syncs across canvases', () => {
  const { doc, rootId } = initialPair()
  let next = updateTextNodeContent(doc, rootId, `甲${PAGE_BREAK}乙${PAGE_BREAK}丙`)
  next = ensureSubCanvasForNode(next, null, rootId, 'sub-text').document
  next = switchNodePageInDocument(next, rootId, 'first', undefined, 'sub-text')
  assert.equal(textContentOf(next, rootId).activePageIndex, 0)
  const sub = next.subCanvases?.['sub-text']
  assert.ok(sub !== undefined)
  const host = sub.nodes.find((node) => node.id === rootId)
  assert.ok(host !== undefined)
  assert.ok(host.content.kind === 'text')
  assert.equal(host.content.activePageIndex, 0)
})

void test('sub-canvas-only nodes are editable and found by cross-canvas page switching', () => {
  const { doc, imageId } = initialPair()
  let next = ensureSubCanvasForNode(doc, null, imageId, 'sub-1').document
  const subOnly: PaperNode = {
    id: 'sub-only',
    parentIds: [imageId],
    content: { kind: 'image', src: '/s.png', alt: 'S' },
    layout: { x: 0, y: 0, collapsed: false },
  }
  const sub = next.subCanvases?.['sub-1']
  assert.ok(sub !== undefined)
  next = {
    ...next,
    subCanvases: { 'sub-1': { ...sub, nodes: [...sub.nodes, subOnly] } },
  }
  next = addImagePageToNode(next, 'sub-only', [{ src: '/t.png', alt: 'T' }], 'sub-1')
  const updatedSub = next.subCanvases?.['sub-1']
  assert.ok(updatedSub !== undefined)
  const content = updatedSub.nodes.find((node) => node.id === 'sub-only')?.content
  assert.ok(content !== undefined && content.kind === 'image')
  assert.equal(content.activeIndex, 1)
  assert.equal(content.src, '/t.png')
  assert.equal(next.nodes.some((node) => node.id === 'sub-only'), false)

  next = switchNodePageInDocument(next, 'sub-only', 'prev-loop')
  const finalSub = next.subCanvases?.['sub-1']
  assert.ok(finalSub !== undefined)
  const finalContent = finalSub.nodes.find((node) => node.id === 'sub-only')?.content
  assert.ok(finalContent !== undefined && finalContent.kind === 'image')
  assert.equal(finalContent.activeIndex, 0)
  assert.equal(finalContent.src, '/s.png')
})

void test('moveActiveImagePageInNode reorders active image page left and right', () => {
  const { doc, imageId } = initialPair()
  let next = addImagePageToNode(doc, imageId, [
    { src: '/b.png', alt: 'B' },
    { src: '/c.png', alt: 'C' },
  ])
  next = moveActiveImagePageInNode(next, imageId, 'left')
  let content = imageContentOf(next, imageId)
  assert.equal(content.activeIndex, 1)
  assert.equal(content.src, '/c.png')
  assert.deepEqual(content.items?.map((item) => item.alt), ['示例图片', 'C', 'B'])

  next = moveActiveImagePageInNode(next, imageId, 'right')
  content = imageContentOf(next, imageId)
  assert.equal(content.activeIndex, 2)
  assert.deepEqual(content.items?.map((item) => item.alt), ['示例图片', 'B', 'C'])
})