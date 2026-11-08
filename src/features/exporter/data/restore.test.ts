import test from 'node:test'
import assert from 'node:assert/strict'

import { Window } from 'happy-dom'

import { FALLBACK_DOCUMENT_DEFAULTS } from '@/shared/lib/nodeDefaults'
import type {
  ImageNodeContent,
  PaperDocument,
  PaperNode,
  TextNodeContent,
} from '@/shared/types/paper'
import { createDataJs } from './generate'
import { toBase64Script } from './pdfjsClassic'
import { base64ToBytes, extractInlinePdfEntries, parseDataJsDocument, rewriteDocumentPaths } from './restore'

// node:test 运行环境没有 DOMParser，用 happy-dom 的 Window 提供浏览器同构实现
const domWindow = new Window()

class ShimDOMParser {
  parseFromString(html: string) {
    return new domWindow.DOMParser().parseFromString(html, 'text/html')
  }
}

if (typeof globalThis.DOMParser === 'undefined') {
  Object.defineProperty(globalThis, 'DOMParser', {
    value: ShimDOMParser,
    writable: true,
    configurable: true,
  })
}

function createFixtureDocument(): PaperDocument {
  return {
    meta: {
      id: 'doc-restore',
      title: '复原测试',
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
            content: { kind: 'text', richText: '<p>支线内容</p>' },
            layout: { x: 200, y: 320, collapsed: false },
          },
        ],
      },
    },
  }
}

void test('parseDataJsDocument round-trips createDataJs output including events and subCanvases', () => {
  const document = createFixtureDocument()
  const restored = parseDataJsDocument(createDataJs(document))
  assert.deepStrictEqual(restored, document)
})

void test('parseDataJsDocument rejects scripts that are not data.js exports', () => {
  assert.throws(() => {
    parseDataJsDocument('window.SOMETHING_ELSE = {}')
  }, /window\.PAPERLOOM_DATA/u)
  assert.throws(() => {
    parseDataJsDocument('window.PAPERLOOM_DATA = {not-json}')
  }, /JSON/u)
  assert.throws(() => {
    parseDataJsDocument('window.PAPERLOOM_DATA = {"version":"1"}\n')
  }, /document/u)
})

function imageContentOf(node: PaperNode | undefined): ImageNodeContent {
  const content = node?.content
  if (content?.kind !== 'image') throw new Error('节点不是图片内容')
  return content
}

function textContentOf(node: PaperNode | undefined): TextNodeContent {
  const content = node?.content
  if (content?.kind !== 'text') throw new Error('节点不是文本内容')
  return content
}

void test('extractInlinePdfEntries recovers original bytes from toBase64Script output', async () => {
  const bytes = new Uint8Array(256)
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = i
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const script = await toBase64Script('./assets/refs/ref-1.pdf', blob)

  const entries = extractInlinePdfEntries(script)
  assert.strictEqual(entries.length, 1)
  const entry = entries[0]
  assert.ok(entry !== undefined)
  assert.strictEqual(entry.key, './assets/refs/ref-1.pdf')
  assert.deepStrictEqual(base64ToBytes(entry.base64), bytes)
})

void test('rewriteDocumentPaths rewrites main canvas and subCanvases back to inbox paths', () => {
  const document: PaperDocument = {
    meta: createFixtureDocument().meta,
    defaults: FALLBACK_DOCUMENT_DEFAULTS,
    rootIds: ['img-main'],
    nodes: [
      {
        id: 'img-main',
        parentIds: [],
        content: { kind: 'image', src: './res/inbox/1.png', alt: '主图' },
        layout: { x: 0, y: 0, collapsed: false },
      },
      {
        id: 'img-media',
        parentIds: ['img-main'],
        content: { kind: 'image', src: './assets/media/image-1.png', alt: '媒体图' },
        layout: { x: 0, y: 200, collapsed: false },
      },
      {
        id: 'img-keep',
        parentIds: ['img-main'],
        content: { kind: 'image', src: './res/inbox/keep.png', alt: '未收录' },
        layout: { x: 0, y: 400, collapsed: false },
      },
      {
        id: 'text-main',
        parentIds: ['img-main'],
        content: {
          kind: 'text',
          richText:
            '<p><a data-pl-ref="pdf" href="./assets/refs/ref-1.pdf" data-pl-page="2" data-pl-preview="./assets/refs/ref-1.png">论文</a></p>',
        },
        layout: { x: 0, y: 600, collapsed: false },
      },
    ],
    subCanvases: {
      'sub-1': {
        id: 'sub-1',
        hostNodeId: 'img-main',
        rootIds: ['sub-img'],
        nodes: [
          {
            id: 'sub-img',
            parentIds: [],
            content: { kind: 'image', src: './res/inbox/2.png', alt: '支线图' },
            layout: { x: 0, y: 0, collapsed: false },
          },
          {
            id: 'sub-text',
            parentIds: ['sub-img'],
            content: {
              kind: 'text',
              richText:
                '<p><a data-pl-ref="image" href="./assets/refs/ref-2.png">配图</a></p>',
            },
            layout: { x: 0, y: 200, collapsed: false },
          },
        ],
      },
    },
  }

  const pathBySource = new Map<string, string>([
    ['./res/inbox/1.png', '/res/inbox/111.png'],
    ['./assets/media/image-1.png', '/res/inbox/222.png'],
    ['./assets/refs/ref-1.pdf', '/res/inbox/333.pdf'],
    ['./assets/refs/ref-1.png', '/res/inbox/444.png'],
    ['./res/inbox/2.png', '/res/inbox/555.png'],
    ['./assets/refs/ref-2.png', '/res/inbox/666.png'],
  ])

  const rewritten = rewriteDocumentPaths(document, pathBySource)

  const nodes = rewritten.nodes
  assert.strictEqual(imageContentOf(nodes[0]).src, '/res/inbox/111.png')
  assert.strictEqual(imageContentOf(nodes[1]).src, '/res/inbox/222.png')
  assert.strictEqual(imageContentOf(nodes[2]).src, './res/inbox/keep.png')

  const mainText = textContentOf(nodes[3]).richText
  assert.ok(mainText.includes('href="/res/inbox/333.pdf"'))
  assert.ok(mainText.includes('data-pl-preview="/res/inbox/444.png"'))
  assert.ok(!mainText.includes('./assets/refs/'))

  const subNodes = rewritten.subCanvases?.['sub-1']?.nodes
  assert.strictEqual(imageContentOf(subNodes?.[0]).src, '/res/inbox/555.png')
  const subText = textContentOf(subNodes?.[1]).richText
  assert.ok(subText.includes('href="/res/inbox/666.png"'))
  assert.ok(!subText.includes('./assets/refs/'))
})
