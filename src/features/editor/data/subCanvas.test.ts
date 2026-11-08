import test from 'node:test'
import assert from 'node:assert/strict'

import { findBoundSubCanvasId, findTriggeredEvent, resolveNodeEvents } from '@/shared/lib/nodeEvents'
import { createProjectFile, parseProjectFile, serializeProjectFile } from '@/shared/lib/projectFile'
import {
  activeCanvasDocument,
  applyInCanvas,
  canDeleteNodeInCanvas,
  changeNodeKind,
  createInitialDocument,
  updateNodeEventsInDocument,
  updateTextNodeContent,
  updateTitleNodeContent,
} from './document'

void test('default events are bound to text, title, image and file nodes and resolved accurately', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  const imageNode = doc.nodes[1]
  assert.ok(rootId !== undefined)
  assert.ok(imageNode !== undefined)

  const rootNode = doc.nodes[0]
  assert.ok(rootNode !== undefined)
  const rootEvents = resolveNodeEvents(rootNode)
  assert.equal(rootEvents.length, 1)
  assert.equal(rootEvents[0]?.trigger, 'double-click')
  assert.equal(rootEvents[0]?.action.type, 'edit-node')
  assert.equal(findTriggeredEvent(rootNode, 'double-click')?.action.type, 'edit-node')

  const imageEvents = resolveNodeEvents(imageNode)
  assert.equal(imageEvents.length, 1)
  assert.equal(imageEvents[0]?.trigger, 'second-click')
  assert.equal(imageEvents[0]?.action.type, 'open-detail')
  assert.equal(findTriggeredEvent(imageNode, 'second-click')?.action.type, 'open-detail')

  doc = changeNodeKind(doc, rootId, 'file')
  const fileNode = doc.nodes.find((n) => n.id === rootId)
  assert.ok(fileNode !== undefined)
  assert.equal(findTriggeredEvent(fileNode, 'double-click')?.action.type, 'open-detail')
})

void test('binding open-canvas creates subCanvas with protected shared host node', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)

  doc = updateNodeEventsInDocument(doc, null, rootId, [
    {
      id: 'evt-branch-1',
      trigger: 'double-click',
      action: { type: 'open-canvas', canvasId: 'branch-canvas-1' },
    },
  ])

  const hostInMain = doc.nodes.find((n) => n.id === rootId)
  assert.ok(hostInMain !== undefined)
  assert.equal(findBoundSubCanvasId(hostInMain, null), 'branch-canvas-1')
  assert.equal(findBoundSubCanvasId(hostInMain, 'branch-canvas-1'), null)

  const subSlice = activeCanvasDocument(doc, 'branch-canvas-1')
  assert.equal(subSlice.rootIds[0], rootId)
  assert.equal(subSlice.nodes.length, 2)

  const hostInSub = subSlice.nodes.find((n) => n.id === rootId)
  assert.ok(hostInSub !== undefined)
  assert.equal(canDeleteNodeInCanvas(doc, 'branch-canvas-1', hostInSub), false)
})

void test('shared host node syncs content bidirectionally and serializes cleanly', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)

  doc = updateNodeEventsInDocument(doc, null, rootId, [
    {
      id: 'evt-branch-1',
      trigger: 'double-click',
      action: { type: 'open-canvas', canvasId: 'branch-canvas-1' },
    },
  ])

  doc = applyInCanvas(doc, null, (slice) =>
    updateTextNodeContent(slice, rootId, '<p>主线与支线共享标题</p>'),
  )
  const syncedInSub = activeCanvasDocument(doc, 'branch-canvas-1').nodes.find((n) => n.id === rootId)
  assert.equal(syncedInSub?.content.kind, 'text')

  doc = applyInCanvas(doc, 'branch-canvas-1', (slice) => changeNodeKind(slice, rootId, 'title'))
  doc = applyInCanvas(doc, 'branch-canvas-1', (slice) =>
    updateTitleNodeContent(slice, rootId, '额外探索实验', '尝试失败但保留支线记录'),
  )
  const syncedInMain = doc.nodes.find((n) => n.id === rootId)
  assert.equal(syncedInMain?.content.kind, 'title')
  if (syncedInMain?.content.kind === 'title') {
    assert.equal(syncedInMain.content.title, '额外探索实验')
  }

  const parsed = parseProjectFile(serializeProjectFile(createProjectFile(doc)))
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.ok(parsed.project.document.subCanvases?.['branch-canvas-1'] !== undefined)
  }
})

void test('text nodes with embedded PDF references resolve reference and popup target events', () => {
  let doc = createInitialDocument()
  const textNodeId = doc.nodes.find((n) => n.content.kind === 'text')?.id
  assert.ok(textNodeId !== undefined)

  doc = updateTextNodeContent(
    doc,
    textNodeId,
    '<p>参见 <a data-pl-ref="pdf" data-pl-page="3" href="/paper.pdf">论文.pdf</a></p>',
  )
  const refNode = doc.nodes.find((n) => n.id === textNodeId)
  assert.ok(refNode !== undefined)

  assert.equal(
    findTriggeredEvent(refNode, 'click', null, 'reference')?.action.type,
    'open-reference-preview',
  )
  assert.equal(
    findTriggeredEvent(refNode, 'double-click', null, 'reference')?.action.type,
    'open-detail',
  )
  assert.equal(
    findTriggeredEvent(refNode, 'click', null, 'reference-popup')?.action.type,
    'open-detail',
  )
})
