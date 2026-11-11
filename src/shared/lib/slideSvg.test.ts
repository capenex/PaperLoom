import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDefaultSlideSpec,
  parseSlideFromSvg,
  serializeSlideToSvg,
} from './slideSvg'
import type { SlideDocumentSpec } from '../types/slide'

void test('round-trips default slide spec through valid standalone SVG', () => {
  const spec = createDefaultSlideSpec('核心架构图解', '16:9')
  const svg = serializeSlideToSvg(spec)
  assert.equal(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), true)
  assert.equal(svg.includes('viewBox="0 0 960 540"'), true)
  assert.equal(svg.includes('核心架构图解'), true)

  const restored = parseSlideFromSvg(svg)
  assert.notEqual(restored, null)
  assert.equal(restored?.aspect, '16:9')
  assert.equal(restored?.width, 960)
  assert.equal(restored?.height, 540)
  assert.equal(restored?.elements.length, 2)
  const first = restored?.elements[0]
  assert.equal(first?.kind, 'text')
  if (first?.kind === 'text') {
    assert.equal(first.text, '核心架构图解')
  }
})

void test('preserves text, image, shape, and arrow elements on round-trip', () => {
  const customSpec: SlideDocumentSpec = {
    version: 1,
    aspect: '4:3',
    width: 800,
    height: 600,
    background: '#f8fafc',
    elements: [
      {
        id: 'shape-1',
        kind: 'shape',
        shape: 'rounded',
        x: 100,
        y: 120,
        width: 240,
        height: 90,
        fill: 'rgba(59,130,246,0.15)',
        stroke: '#2563eb',
        strokeWidth: 2,
        dashed: true,
        text: '重点区域 <A & B>',
        textColor: '#1e40af',
        fontSize: 18,
      },
      {
        id: 'arrow-1',
        kind: 'arrow',
        x1: 340,
        y1: 165,
        x2: 520,
        y2: 240,
        color: '#ef4444',
        strokeWidth: 3,
        dashed: false,
        doubleHeaded: true,
      },
      {
        id: 'img-1',
        kind: 'image',
        x: 420,
        y: 250,
        width: 300,
        height: 200,
        inboxSrc: '/res/inbox/chart.png',
        dataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        alt: '实验结果',
        objectFit: 'contain',
        borderRadius: 12,
      },
    ],
  }

  const svg = serializeSlideToSvg(customSpec)
  const parsed = parseSlideFromSvg(svg)
  assert.deepEqual(parsed, customSpec)
})
