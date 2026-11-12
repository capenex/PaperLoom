import test from 'node:test'
import assert from 'node:assert/strict'

import type { InboxEntry } from '@/shared/lib/inbox'
import {
  filterVisibleImagePoolEntries,
  resolveSelectedImageEntries,
  toggleImageSelection,
} from './filePoolImagePicker'

function makeEntry(
  overrides: Partial<InboxEntry> & Pick<InboxEntry, 'path' | 'name' | 'kind' | 'category'>,
): InboxEntry {
  const slash = overrides.path.lastIndexOf('/')
  return {
    parentPath: slash === -1 ? '' : overrides.path.slice(0, slash),
    size: 100,
    updatedAt: 1000,
    ext: overrides.kind === 'folder' ? '' : '.png',
    ...overrides,
  }
}

const SAMPLE_ENTRIES: readonly InboxEntry[] = [
  makeEntry({ path: '第一章', name: '第一章', kind: 'folder', category: 'other' }),
  makeEntry({ path: 'cover.png', name: 'cover.png', kind: 'file', category: 'image', ext: '.png' }),
  makeEntry({ path: 'deck.slide.svg', name: 'deck.slide.svg', kind: 'file', category: 'slide', ext: '.slide.svg' }),
  makeEntry({ path: 'paper.pdf', name: 'paper.pdf', kind: 'file', category: 'reference', ext: '.pdf' }),
  makeEntry({ path: 'notes.md', name: 'notes.md', kind: 'file', category: 'document', ext: '.md' }),
  makeEntry({ path: '第一章/fig-2.jpg', name: 'fig-2.jpg', kind: 'file', category: 'image', ext: '.jpg' }),
  makeEntry({ path: '第一章/fig-10.png', name: 'fig-10.png', kind: 'file', category: 'image', ext: '.png' }),
  makeEntry({ path: '第一章/readme.txt', name: 'readme.txt', kind: 'file', category: 'document', ext: '.txt' }),
]

void test('filterVisibleImagePoolEntries only keeps folders, images, and slide SVGs in current folder', () => {
  const rootEntries = filterVisibleImagePoolEntries(SAMPLE_ENTRIES, '', '')
  assert.deepEqual(
    rootEntries.map((entry) => entry.path),
    ['第一章', 'cover.png', 'deck.slide.svg'],
  )

  const subEntries = filterVisibleImagePoolEntries(SAMPLE_ENTRIES, '第一章', '')
  assert.deepEqual(
    subEntries.map((entry) => entry.path),
    ['第一章/fig-2.jpg', '第一章/fig-10.png'],
  )
})

void test('filterVisibleImagePoolEntries searches across folders and excludes non-image files', () => {
  const figMatches = filterVisibleImagePoolEntries(SAMPLE_ENTRIES, '', 'fig')
  assert.deepEqual(
    figMatches.map((entry) => entry.path),
    ['第一章/fig-2.jpg', '第一章/fig-10.png'],
  )

  const pdfMatches = filterVisibleImagePoolEntries(SAMPLE_ENTRIES, '', 'paper')
  assert.deepEqual(pdfMatches, [])
})

void test('toggleImageSelection and resolveSelectedImageEntries preserve selection order', () => {
  let selected = toggleImageSelection([], '第一章/fig-10.png')
  selected = toggleImageSelection(selected, 'cover.png')
  selected = toggleImageSelection(selected, 'deck.slide.svg')
  selected = toggleImageSelection(selected, 'cover.png')

  const resolved = resolveSelectedImageEntries(SAMPLE_ENTRIES, selected)
  assert.deepEqual(
    resolved.map((entry) => entry.path),
    ['第一章/fig-10.png', 'deck.slide.svg'],
  )
})