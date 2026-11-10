import test from 'node:test'
import assert from 'node:assert/strict'
import { Script } from 'node:vm'

import { FALLBACK_DOCUMENT_DEFAULTS } from '@/shared/lib/nodeDefaults'
import type { ImageNodeContent, PaperDocument, PaperNode } from '@/shared/types/paper'
import { createDataJs, createExportFiles, createIndexHtml } from './generate'
import { PRESENTER_SCRIPT } from './presenterScript'
import { PRESENTER_STYLES } from './presenterStyles'
import { parseDataJsDocument, rewriteDocumentPaths } from './restore'

void test('exporter serializes subCanvases and node events and presenter script is valid JS', () => {
  const doc: PaperDocument = {
    meta: {
      id: 'doc-1',
      title: '演示测试',
      author: '',
      createdAt: '2026-11-08T00:00:00.000Z',
      updatedAt: '2026-11-08T00:00:00.000Z',
    },
    defaults: FALLBACK_DOCUMENT_DEFAULTS,
    rootIds: ['node-root'],
    nodes: [
      {
        id: 'node-root',
        parentIds: [],
        content: { kind: 'title', title: '主线节点', subtitle: '双击进支线' },
        layout: { x: 200, y: 160, collapsed: false },
        events: [
          {
            id: 'evt-open-sub',
            target: 'node',
            trigger: 'double-click',
            action: { type: 'open-canvas', canvasId: 'sub-1' },
          },
        ],
      },
    ],
    subCanvases: {
      'sub-1': {
        id: 'sub-1',
        hostNodeId: 'node-root',
        rootIds: ['node-root'],
        nodes: [
          {
            id: 'node-root',
            parentIds: [],
            content: { kind: 'title', title: '主线节点', subtitle: '双击进支线' },
            layout: { x: 200, y: 160, collapsed: false },
            events: [
              {
                id: 'evt-open-sub',
                target: 'node',
                trigger: 'double-click',
                action: { type: 'open-canvas', canvasId: 'sub-1' },
              },
            ],
          },
          {
            id: 'node-branch-child',
            parentIds: ['node-root'],
            content: { kind: 'file', fileName: 'notes.md', format: 'markdown', text: '# 支线实验记录' },
            layout: { x: 0, y: 0, collapsed: false },
          },
        ],
      },
    },
  }

  const dataJs = createDataJs(doc)
  assert.ok(dataJs.includes('"sub-1"'))
  assert.ok(dataJs.includes('"open-canvas"'))

  const indexHtml = createIndexHtml(doc)
  assert.ok(indexHtml.includes('<title>演示测试</title>'))

  // 校验组装后的客户端 IIFE 语法完全合法
  assert.doesNotThrow(() => new Script(PRESENTER_SCRIPT))
  assert.ok(PRESENTER_SCRIPT.includes('findTriggeredEvent'))
  assert.ok(PRESENTER_SCRIPT.includes('enterSubCanvas'))
  assert.ok(PRESENTER_SCRIPT.includes('PAPERLOOM_ACTION_HANDLERS'))
  assert.ok(PRESENTER_SCRIPT.includes('PAPERLOOM_ANIMATE'))

  assert.ok(PRESENTER_STYLES.includes('.breadcrumbs'))
  assert.ok(PRESENTER_STYLES.includes('.node-badge'))
  assert.ok(PRESENTER_STYLES.includes('.detail-file'))
  assert.ok(PRESENTER_STYLES.includes('prefers-reduced-motion'))
})

function mediaFetch(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!url.includes('res/inbox/')) throw new Error(`意外的资源请求：${url}`)
  return Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }))
}

async function exportWithMediaFetch(doc: PaperDocument) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = mediaFetch
  try {
    return await createExportFiles(doc)
  } finally {
    globalThis.fetch = originalFetch
  }
}

function imageContentOf(node: PaperNode | undefined): ImageNodeContent {
  const content = node?.content
  if (content === undefined || content.kind !== 'image') throw new Error('节点不是图片内容')
  return content
}

void test('createExportFiles packs every page of multi-page image nodes and rewrites all srcs', async () => {
  const doc: PaperDocument = {
    meta: {
      id: 'doc-multi',
      title: '多页导出',
      author: '',
      createdAt: '2026-11-08T00:00:00.000Z',
      updatedAt: '2026-11-08T00:00:00.000Z',
    },
    defaults: FALLBACK_DOCUMENT_DEFAULTS,
    rootIds: ['img-multi'],
    nodes: [
      {
        id: 'img-multi',
        parentIds: [],
        content: {
          kind: 'image',
          src: '/res/inbox/b.png',
          alt: '多页图',
          activeIndex: 1,
          items: [
            { src: '/res/inbox/a.png', alt: '第一页', naturalWidth: 100, naturalHeight: 80 },
            { src: '/res/inbox/b.png', alt: '第二页', naturalWidth: 200, naturalHeight: 160 },
            { src: 'data:image/png;base64,AAAA', alt: '内嵌页' },
          ],
        },
        layout: { x: 0, y: 0, collapsed: false },
      },
    ],
  }

  const files = await exportWithMediaFetch(doc)

  const paths = files.map((file) => file.path)
  assert.deepStrictEqual(
    paths.filter((path) => path.startsWith('res/inbox/')).sort(),
    ['res/inbox/a.png', 'res/inbox/b.png'],
  )

  const dataEntry = files.find((file) => file.path === 'data.js')
  assert.ok(dataEntry !== undefined)
  const dataJs = typeof dataEntry.content === 'string' ? dataEntry.content : ''
  const exportedContent = imageContentOf(parseDataJsDocument(dataJs).nodes[0])
  assert.strictEqual(exportedContent.src, './res/inbox/b.png')
  assert.strictEqual(exportedContent.activeIndex, 1)
  const exportedItems = exportedContent.items ?? []
  assert.deepStrictEqual(
    exportedItems.map((item) => item.src),
    ['./res/inbox/a.png', './res/inbox/b.png', 'data:image/png;base64,AAAA'],
  )
  assert.deepStrictEqual(
    exportedItems.map((item) => item.naturalWidth),
    [100, 200, undefined],
  )
  assert.deepStrictEqual(
    exportedItems.map((item) => item.naturalHeight),
    [80, 160, undefined],
  )

  const restoredContent = imageContentOf(
    rewriteDocumentPaths(
      parseDataJsDocument(dataJs),
      new Map([
        ['./res/inbox/a.png', '/res/inbox/a.png'],
        ['./res/inbox/b.png', '/res/inbox/b.png'],
      ]),
    ).nodes[0],
  )
  assert.strictEqual(restoredContent.src, '/res/inbox/b.png')
  const restoredItems = restoredContent.items ?? []
  assert.deepStrictEqual(
    restoredItems.map((item) => item.src),
    ['/res/inbox/a.png', '/res/inbox/b.png', 'data:image/png;base64,AAAA'],
  )
  assert.deepStrictEqual(
    restoredItems.map((item) => item.naturalWidth),
    [100, 200, undefined],
  )
  assert.deepStrictEqual(
    restoredItems.map((item) => item.naturalHeight),
    [80, 160, undefined],
  )
})
