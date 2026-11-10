import test from 'node:test'
import assert from 'node:assert/strict'

import type { ImageNodeContent, NodeEventBinding, PaperDocument, PaperNode } from '../types/paper'
import { PROJECT_FORMAT_VERSION } from '../types/project'
import { createProjectFile, parseProjectFile, serializeProjectFile } from './projectFile'

const META = {
  id: 'doc-1',
  title: '测试文档',
  author: '',
  createdAt: '2026-11-08T00:00:00.000Z',
  updatedAt: '2026-11-08T00:00:00.000Z',
}

const IMAGE_CONTENT = { kind: 'image', src: '/a.png', alt: 'A' }

function imageNode(content: unknown, events?: unknown): Record<string, unknown> {
  const node: Record<string, unknown> = {
    id: 'img',
    parentIds: [],
    content,
    layout: { x: 0, y: 0, collapsed: false },
  }
  if (events !== undefined) node.events = events
  return node
}

function rawProject(node: Record<string, unknown>, documentExtra?: Record<string, unknown>): string {
  return JSON.stringify({
    formatVersion: PROJECT_FORMAT_VERSION,
    savedAt: '2026-11-08T00:00:00.000Z',
    document: {
      meta: META,
      defaults: { nodeWidth: 208, nodeHeight: 112, fontSize: 16 },
      rootIds: ['img'],
      nodes: [node],
      ...documentExtra,
    },
  })
}

void test('parseProjectFile migrates legacy parentId and clears the placeholder title subtitle', () => {
  const raw = {
    formatVersion: PROJECT_FORMAT_VERSION,
    savedAt: '2026-11-08T00:00:00.000Z',
    document: {
      meta: {
        id: 'doc-1',
        title: '旧存档',
        author: '',
        createdAt: '2026-11-08T00:00:00.000Z',
        updatedAt: '2026-11-08T00:00:00.000Z',
      },
      defaults: { nodeWidth: 208, nodeHeight: 112, fontSize: 16 },
      rootIds: ['r'],
      nodes: [
        {
          id: 'r',
          parentId: null,
          content: { kind: 'title', title: '核心主题', subtitle: '在顶部栏修改标题与绑定事件' },
          layout: { x: 0, y: 0, collapsed: false },
        },
        {
          id: 'c',
          parentId: 'r',
          content: { kind: 'text', richText: '' },
          layout: { x: 0, y: 0, collapsed: false },
        },
      ],
    },
  }
  const parsed = parseProjectFile(JSON.stringify(raw))
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const nodes = parsed.project.document.nodes
  assert.deepEqual(nodes[0]?.parentIds, [])
  assert.deepEqual(nodes[1]?.parentIds, ['r'])
  const title = nodes[0]?.content
  assert.ok(title?.kind === 'title')
  assert.equal(title.subtitle, '')
})

void test('project file round-trips image items, activeIndex, watchlist and switch-node-page', () => {
  const content: ImageNodeContent = {
    kind: 'image',
    src: '/res/inbox/b.png',
    alt: '第二页',
    items: [
      { src: '/res/inbox/a.png', alt: '第一页', naturalWidth: 1920, naturalHeight: 1080 },
      { src: '/res/inbox/b.png', alt: '第二页' },
    ],
    activeIndex: 1,
  }
  const events: readonly NodeEventBinding[] = [
    {
      id: 'link-1',
      target: 'node',
      trigger: 'click',
      action: { type: 'switch-node-page', targetNodeId: 'img', mode: 'index', pageIndex: 1 },
    },
    {
      id: 'link-2',
      target: 'node',
      trigger: 'double-click',
      action: { type: 'switch-node-page', targetNodeId: 'img', mode: 'next-loop' },
    },
  ]
  const node: PaperNode = {
    id: 'img',
    parentIds: [],
    content,
    layout: { x: 0, y: 0, collapsed: false },
    events,
  }
  const document: PaperDocument = {
    meta: META,
    defaults: { nodeWidth: 208, nodeHeight: 112, fontSize: 16 },
    nodes: [node],
    rootIds: ['img'],
    watchlistNodeIds: ['img'],
  }
  const parsed = parseProjectFile(serializeProjectFile(createProjectFile(document)))
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.deepEqual(parsed.project.document, document)
})

void test('parseProjectFile rejects malformed image items and activeIndex', () => {
  assert.equal(
    parseProjectFile(rawProject(imageNode({ ...IMAGE_CONTENT, items: [{ src: 1, alt: 'x' }] }))).ok,
    false,
  )
  assert.equal(
    parseProjectFile(
      rawProject(imageNode({ ...IMAGE_CONTENT, items: [{ src: '/a.png', alt: 'x', naturalWidth: -1 }] })),
    ).ok,
    false,
  )
  assert.equal(
    parseProjectFile(
      rawProject(imageNode({ ...IMAGE_CONTENT, items: [{ src: '/a.png', alt: 'x', naturalHeight: 0 }] })),
    ).ok,
    false,
  )
  assert.equal(
    parseProjectFile(rawProject(imageNode({ ...IMAGE_CONTENT, items: 'nope' }))).ok,
    false,
  )
  assert.equal(
    parseProjectFile(rawProject(imageNode({ ...IMAGE_CONTENT, activeIndex: -1 }))).ok,
    false,
  )
  assert.equal(
    parseProjectFile(rawProject(imageNode({ ...IMAGE_CONTENT, activeIndex: 1.5 }))).ok,
    false,
  )
})

void test('parseProjectFile validates the optional watchlist node ids', () => {
  assert.equal(
    parseProjectFile(rawProject(imageNode(IMAGE_CONTENT), { watchlistNodeIds: ['img', 2] })).ok,
    false,
  )
  assert.equal(
    parseProjectFile(rawProject(imageNode(IMAGE_CONTENT), { watchlistNodeIds: 'img' })).ok,
    false,
  )
  assert.equal(
    parseProjectFile(rawProject(imageNode(IMAGE_CONTENT), { watchlistNodeIds: ['img'] })).ok,
    true,
  )
})

void test('parseProjectFile rejects malformed switch-node-page actions', () => {
  const withAction = (action: unknown): string =>
    rawProject(imageNode(IMAGE_CONTENT, [{ id: 'e', target: 'node', trigger: 'click', action }]))
  assert.equal(
    parseProjectFile(withAction({ type: 'switch-node-page', targetNodeId: 'img', mode: 'bogus' })).ok,
    false,
  )
  assert.equal(
    parseProjectFile(
      withAction({ type: 'switch-node-page', targetNodeId: 'img', mode: 'index', pageIndex: -1 }),
    ).ok,
    false,
  )
  assert.equal(
    parseProjectFile(
      withAction({ type: 'switch-node-page', targetNodeId: 'img', mode: 'index', pageIndex: 1.5 }),
    ).ok,
    false,
  )
  assert.equal(
    parseProjectFile(withAction({ type: 'switch-node-page', mode: 'first' })).ok,
    false,
  )
  assert.equal(
    parseProjectFile(withAction({ type: 'switch-node-page', targetNodeId: 5, mode: 'first' })).ok,
    false,
  )
  assert.equal(
    parseProjectFile(withAction({ type: 'switch-node-page', targetNodeId: 'img', mode: 'first' })).ok,
    true,
  )
  assert.equal(
    parseProjectFile(
      withAction({ type: 'switch-node-page', targetNodeId: 'img', mode: 'index', pageIndex: 0 }),
    ).ok,
    true,
  )
})

void test('parseProjectFile upgrades the legacy image default event to double-click', () => {
  const legacyEvents = [
    {
      id: 'default-image-open-detail',
      target: 'node',
      trigger: 'second-click',
      action: { type: 'open-detail' },
    },
  ]
  const parsed = parseProjectFile(rawProject(imageNode(IMAGE_CONTENT, legacyEvents)))
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  const binding = parsed.project.document.nodes[0]?.events?.[0]
  assert.equal(binding?.id, 'default-image-open-detail')
  assert.equal(binding?.trigger, 'double-click')
  assert.equal(binding?.action.type, 'open-detail')
})

void test('parseProjectFile keeps custom second-click events unchanged', () => {
  const customEvents = [
    {
      id: 'custom-second-click',
      target: 'node',
      trigger: 'second-click',
      action: { type: 'open-detail' },
    },
  ]
  const parsed = parseProjectFile(rawProject(imageNode(IMAGE_CONTENT, customEvents)))
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.project.document.nodes[0]?.events?.[0]?.trigger, 'second-click')
})

void test('project file round-trips the rich text activePageIndex', () => {
  const node = imageNode({
    kind: 'text',
    richText: '甲<hr data-pl-page-break="true">乙',
    activePageIndex: 1,
  })
  const parsed = parseProjectFile(rawProject(node))
  assert.ok(parsed.ok)
  const content = parsed.project.document.nodes[0]?.content
  assert.ok(content !== undefined && content.kind === 'text')
  assert.equal(content.activePageIndex, 1)

  const roundTrip = parseProjectFile(serializeProjectFile(createProjectFile(parsed.project.document)))
  assert.ok(roundTrip.ok)
  const restored = roundTrip.project.document.nodes[0]?.content
  assert.ok(restored !== undefined && restored.kind === 'text')
  assert.equal(restored.activePageIndex, 1)
})

void test('parseProjectFile rejects invalid text activePageIndex and accepts legacy text without it', () => {
  for (const bad of [-1, 1.5, '1']) {
    const node = imageNode({ kind: 'text', richText: 'x', activePageIndex: bad })
    assert.equal(parseProjectFile(rawProject(node)).ok, false)
  }
  const parsed = parseProjectFile(rawProject(imageNode({ kind: 'text', richText: 'x' })))
  assert.ok(parsed.ok)
  const content = parsed.project.document.nodes[0]?.content
  assert.ok(content !== undefined && content.kind === 'text')
  assert.equal(content.activePageIndex, undefined)
})