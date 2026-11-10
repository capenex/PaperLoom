import test from 'node:test'
import assert from 'node:assert/strict'

import type { ImageNodeContent, ImageSlideItem } from '../types/paper'
import {
  buildImageContentWithItems,
  computeNextPageIndex,
  resolveActiveImageIndex,
  resolveActiveImageItem,
  resolveImageItems,
} from './mediaPages'

const ITEMS: readonly ImageSlideItem[] = [
  { src: '/a.png', alt: 'A', naturalWidth: 100, naturalHeight: 50 },
  { src: '/b.png', alt: 'B' },
  { src: '/c.png', alt: 'C', naturalWidth: 30, naturalHeight: 90 },
]

function imageContent(overrides: Partial<ImageNodeContent> = {}): ImageNodeContent {
  return { kind: 'image', src: '/single.png', alt: '单图', ...overrides }
}

void test('resolveImageItems falls back to a single item when items is absent or empty', () => {
  assert.deepEqual(resolveImageItems(imageContent()), [{ src: '/single.png', alt: '单图' }])
  assert.deepEqual(resolveImageItems(imageContent({ items: [] })), [
    { src: '/single.png', alt: '单图' },
  ])
  assert.deepEqual(resolveImageItems(imageContent({ items: ITEMS })), ITEMS)
})

void test('resolveActiveImageIndex defaults to 0 and clamps into range', () => {
  assert.equal(resolveActiveImageIndex(imageContent({ items: ITEMS })), 0)
  assert.equal(resolveActiveImageIndex(imageContent({ items: ITEMS, activeIndex: 1 })), 1)
  assert.equal(resolveActiveImageIndex(imageContent({ items: ITEMS, activeIndex: -5 })), 0)
  assert.equal(resolveActiveImageIndex(imageContent({ items: ITEMS, activeIndex: 99 })), 2)
  assert.equal(resolveActiveImageIndex(imageContent({ activeIndex: 9 })), 0)
  assert.equal(resolveActiveImageIndex(imageContent({ items: [], activeIndex: 3 })), 0)
})

void test('resolveActiveImageItem returns the clamped active page', () => {
  assert.deepEqual(resolveActiveImageItem(imageContent()), { src: '/single.png', alt: '单图' })
  assert.deepEqual(resolveActiveImageItem(imageContent({ items: ITEMS, activeIndex: 1 })), ITEMS[1])
  assert.deepEqual(resolveActiveImageItem(imageContent({ items: ITEMS, activeIndex: 99 })), ITEMS[2])
  assert.deepEqual(resolveActiveImageItem(imageContent({ items: ITEMS, activeIndex: -1 })), ITEMS[0])
})

void test('buildImageContentWithItems syncs src/alt to the active page and preserves items', () => {
  const built = buildImageContentWithItems(ITEMS, 1)
  assert.deepEqual(built, {
    kind: 'image',
    src: '/b.png',
    alt: 'B',
    items: ITEMS,
    activeIndex: 1,
  })
})

void test('buildImageContentWithItems clamps the index and falls back on empty items', () => {
  assert.deepEqual(buildImageContentWithItems(ITEMS, 99), {
    kind: 'image',
    src: '/c.png',
    alt: 'C',
    items: ITEMS,
    activeIndex: 2,
  })
  assert.deepEqual(buildImageContentWithItems(ITEMS, -3), {
    kind: 'image',
    src: '/a.png',
    alt: 'A',
    items: ITEMS,
    activeIndex: 0,
  })
  assert.deepEqual(buildImageContentWithItems([], 4), {
    kind: 'image',
    src: '',
    alt: '',
    items: [],
    activeIndex: 0,
  })
})

void test('computeNextPageIndex returns 0 when there is at most one page', () => {
  assert.equal(computeNextPageIndex(0, 0, 'next-loop'), 0)
  assert.equal(computeNextPageIndex(0, 1, 'last'), 0)
  assert.equal(computeNextPageIndex(0, 1, 'index', 5), 0)
  assert.equal(computeNextPageIndex(3, -2, 'prev-loop'), 0)
})

void test('computeNextPageIndex handles first and last modes', () => {
  assert.equal(computeNextPageIndex(2, 3, 'first'), 0)
  assert.equal(computeNextPageIndex(0, 3, 'last'), 2)
})

void test('computeNextPageIndex loops next and prev across boundaries', () => {
  assert.equal(computeNextPageIndex(0, 3, 'next-loop'), 1)
  assert.equal(computeNextPageIndex(2, 3, 'next-loop'), 0)
  assert.equal(computeNextPageIndex(0, 3, 'prev-loop'), 2)
  assert.equal(computeNextPageIndex(2, 3, 'prev-loop'), 1)
})

void test('computeNextPageIndex clamps the index mode target', () => {
  assert.equal(computeNextPageIndex(0, 3, 'index', 1), 1)
  assert.equal(computeNextPageIndex(0, 3, 'index', 99), 2)
  assert.equal(computeNextPageIndex(0, 3, 'index', -1), 0)
  assert.equal(computeNextPageIndex(0, 3, 'index'), 0)
})