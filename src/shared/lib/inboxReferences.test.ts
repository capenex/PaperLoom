import test from 'node:test'
import assert from 'node:assert/strict'
import type { PaperDocument } from '@/shared/types/paper'
import {
  collectDocumentInboxUsage,
  rewriteDocumentInboxPaths,
} from './inboxReferences'

function createSampleDoc(): PaperDocument {
  return {
    meta: {
      id: 'doc-1',
      title: 'Test Doc',
      author: 'Tester',
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    },
    rootIds: ['node-1'],
    defaults: {
      nodeWidth: 280,
      nodeHeight: 160,
      fontSize: 16,
    },
    nodes: [
      {
        id: 'node-1',
        parentIds: [],
        content: {
          kind: 'image',
          src: '/res/inbox/slides/intro.slide.svg',
          alt: 'Intro Slide',
          items: [
            { src: '/res/inbox/slides/intro.slide.svg', alt: 'Intro Slide' },
            { src: './res/inbox/figs/chart.png', alt: 'Chart' },
          ],
          activeIndex: 0,
        },
        layout: { x: 0, y: 0, collapsed: false },
      },
      {
        id: 'node-2',
        parentIds: ['node-1'],
        content: {
          kind: 'text',
          richText:
            '<p>See <a data-pl-ref="true" data-pl-kind="pdf" data-pl-src="res/inbox/papers/paper.pdf">paper</a> and <img src="/res/inbox/figs/chart.png" /></p>',
        },
        layout: { x: 360, y: 0, collapsed: false },
      },
    ],
  }
}

void test('collects inbox references across image items and richText HTML attributes', () => {
  const doc = createSampleDoc()
  const usage = collectDocumentInboxUsage(doc)

  assert.deepEqual(usage.get('slides/intro.slide.svg'), ['node-1'])
  assert.deepEqual(usage.get('figs/chart.png'), ['node-1', 'node-2'])
  assert.deepEqual(usage.get('papers/paper.pdf'), ['node-2'])
})

void test('returns empty map when no inbox references exist', () => {
  const doc = createSampleDoc()
  const emptyDoc: PaperDocument = {
    ...doc,
    nodes: [],
  }
  const usage = collectDocumentInboxUsage(emptyDoc)
  assert.equal(usage.size, 0)
})

void test('rewrites exact file paths when a single file is renamed', () => {
  const doc = createSampleDoc()
  const updated = rewriteDocumentInboxPaths(
    doc,
    'slides/intro.slide.svg',
    'slides/01-overview.slide.svg',
  )
  const usage = collectDocumentInboxUsage(updated)
  assert.equal(usage.has('slides/intro.slide.svg'), false)
  assert.deepEqual(usage.get('slides/01-overview.slide.svg'), ['node-1'])
})

void test('rewrites all nested file paths when a folder is renamed', () => {
  const doc = createSampleDoc()
  const updated = rewriteDocumentInboxPaths(doc, 'figs', '01-绪论')
  const updated2 = rewriteDocumentInboxPaths(updated, 'papers', '01-绪论')

  const usage = collectDocumentInboxUsage(updated2)
  assert.equal(usage.has('figs/chart.png'), false)
  assert.equal(usage.has('papers/paper.pdf'), false)
  assert.deepEqual(usage.get('01-绪论/chart.png'), ['node-1', 'node-2'])
  assert.deepEqual(usage.get('01-绪论/paper.pdf'), ['node-2'])
})
