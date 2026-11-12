import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FALLBACK_DOCUMENT_DEFAULTS,
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
} from '@/shared/lib/nodeDefaults'
import type { ImageNodeContent, ImageSlideItem, PaperNode } from '@/shared/types/paper'
import {
  computeIdealImageBox,
  computeIdealSlideBox,
  estimateFittedNodeSize,
  fitNodeSize,
  IMAGE_FIT_MAX_HEIGHT,
  IMAGE_FIT_MAX_WIDTH,
  IMAGE_FIT_MIN_HEIGHT,
  IMAGE_FIT_MIN_WIDTH,
  IMAGE_FIT_SQUARE_EDGE,
  IMAGE_FIT_TARGET_LONG_EDGE,
} from './fitNodeSize'

function imageNode(content: ImageNodeContent): PaperNode {
  return {
    id: 'image-node',
    parentIds: [],
    content,
    layout: { x: 0, y: 0, collapsed: false },
  }
}

function imageContent(items: readonly ImageSlideItem[]): ImageNodeContent {
  const first = items[0] ?? { src: '/empty.png', alt: '' }
  return { kind: 'image', src: first.src, alt: first.alt, items, activeIndex: 0 }
}

void test('image fit constants and MIN_NODE_HEIGHT=40 match the contract', () => {
  assert.equal(MIN_NODE_HEIGHT, 40)
  assert.equal(IMAGE_FIT_TARGET_LONG_EDGE, 360)
  assert.equal(IMAGE_FIT_SQUARE_EDGE, 320)
  assert.equal(IMAGE_FIT_MIN_WIDTH, 160)
  assert.equal(IMAGE_FIT_MAX_WIDTH, 440)
  assert.equal(IMAGE_FIT_MIN_HEIGHT, 120)
  assert.equal(IMAGE_FIT_MAX_HEIGHT, 360)
})

void test('computeIdealSlideBox defaults 16:9 pseudo-image slides to 560x315', () => {
  assert.deepEqual(computeIdealSlideBox(960, 540), { width: 560, height: 315 })
  assert.deepEqual(computeIdealSlideBox(0, 0), { width: 560, height: 315 })
})

void test('computeIdealImageBox corrects near-square images to the 320 square box', () => {
  assert.deepEqual(computeIdealImageBox(2000, 2000), { width: 320, height: 320 })
  assert.deepEqual(computeIdealImageBox(60, 60), { width: 320, height: 320 })
  assert.deepEqual(computeIdealImageBox(1080, 1000), { width: 320, height: 296 })
})

void test('computeIdealImageBox scales landscape and portrait images by the 360 long edge', () => {
  assert.deepEqual(computeIdealImageBox(1920, 1080), { width: 360, height: 203 })
  assert.deepEqual(computeIdealImageBox(1080, 1920), { width: 203, height: 360 })
})

void test('computeIdealImageBox falls back to 240x180 for invalid natural sizes', () => {
  assert.deepEqual(computeIdealImageBox(0, 0), { width: 240, height: 180 })
  assert.deepEqual(computeIdealImageBox(0, 100), { width: 240, height: 180 })
  assert.deepEqual(computeIdealImageBox(-5, 10), { width: 240, height: 180 })
  assert.deepEqual(computeIdealImageBox(Number.NaN, 10), { width: 240, height: 180 })
})

void test('computeIdealImageBox lifts extreme banners and strips to the short-edge floor', () => {
  assert.deepEqual(computeIdealImageBox(4000, 200), { width: 440, height: 120 })
  assert.deepEqual(computeIdealImageBox(200, 4000), { width: 160, height: 360 })
})

void test('computeIdealImageBox stays inside the image fit bounds', () => {
  const samples: readonly (readonly [number, number])[] = [
    [1, 1],
    [3, 2],
    [2, 3],
    [10000, 1],
    [1, 10000],
    [921, 1000],
    [1000, 921],
  ]
  for (const [width, height] of samples) {
    const box = computeIdealImageBox(width, height)
    assert.ok(box.width >= IMAGE_FIT_MIN_WIDTH && box.width <= IMAGE_FIT_MAX_WIDTH)
    assert.ok(box.height >= IMAGE_FIT_MIN_HEIGHT && box.height <= IMAGE_FIT_MAX_HEIGHT)
  }
})

void test('estimateFittedNodeSize envelopes mixed landscape and portrait image pages', () => {
  const node = imageNode(
    imageContent([
      { src: '/wide.png', alt: '横图', naturalWidth: 1920, naturalHeight: 1080 },
      { src: '/tall.png', alt: '竖图', naturalWidth: 1080, naturalHeight: 1920 },
    ]),
  )
  assert.deepEqual(estimateFittedNodeSize(node, FALLBACK_DOCUMENT_DEFAULTS), {
    width: 360,
    height: 360,
  })
})

void test('multi-page image fit reserves pager height when every page is a short banner', () => {
  const node = imageNode(
    imageContent([
      { src: '/a.png', alt: 'A', naturalWidth: 4000, naturalHeight: 200 },
      { src: '/b.png', alt: 'B', naturalWidth: 3000, naturalHeight: 300 },
    ]),
  )
  assert.deepEqual(estimateFittedNodeSize(node, FALLBACK_DOCUMENT_DEFAULTS), {
    width: 440,
    height: 136,
  })
})

void test('single image page fits without pager reserve and unknown pages are skipped', () => {
  const single = imageNode(
    imageContent([{ src: '/one.png', alt: '单图', naturalWidth: 2000, naturalHeight: 2000 }]),
  )
  assert.deepEqual(estimateFittedNodeSize(single, FALLBACK_DOCUMENT_DEFAULTS), {
    width: 320,
    height: 320,
  })

  const mixed = imageNode(
    imageContent([
      { src: '/known.png', alt: '已知', naturalWidth: 1920, naturalHeight: 1080 },
      { src: '/unknown.png', alt: '未知' },
    ]),
  )
  assert.deepEqual(estimateFittedNodeSize(mixed, FALLBACK_DOCUMENT_DEFAULTS), {
    width: 360,
    height: 203,
  })
})

void test('image fit returns null when no page has a measurable natural size', () => {
  const node = imageNode({ kind: 'image', src: '/fresh.png', alt: '新图' })
  assert.equal(estimateFittedNodeSize(node, FALLBACK_DOCUMENT_DEFAULTS), null)
  assert.equal(fitNodeSize(node, FALLBACK_DOCUMENT_DEFAULTS), null)
})

void test('fitNodeSize matches the pure estimate for stored image sizes without DOM', () => {
  const node = imageNode(
    imageContent([
      { src: '/wide.png', alt: '横图', naturalWidth: 1920, naturalHeight: 1080 },
      { src: '/tall.png', alt: '竖图', naturalWidth: 1080, naturalHeight: 1920 },
    ]),
  )
  assert.deepEqual(fitNodeSize(node, FALLBACK_DOCUMENT_DEFAULTS), { width: 360, height: 360 })
})

void test('image envelope stays inside global node size limits', () => {
  const node = imageNode(
    imageContent([
      { src: '/wide.png', alt: '横图', naturalWidth: 10000, naturalHeight: 1 },
      { src: '/tall.png', alt: '竖图', naturalWidth: 1, naturalHeight: 10000 },
    ]),
  )
  const size = estimateFittedNodeSize(node, FALLBACK_DOCUMENT_DEFAULTS)
  assert.ok(size !== null)
  assert.ok(size.width >= MIN_NODE_WIDTH && size.width <= MAX_NODE_WIDTH)
  assert.ok(size.height >= MIN_NODE_HEIGHT && size.height <= MAX_NODE_HEIGHT)
  assert.deepEqual(size, { width: 440, height: 360 })
})