import test from 'node:test'
import assert from 'node:assert/strict'

import { Window } from 'happy-dom'

import { FALLBACK_DOCUMENT_DEFAULTS } from '@/shared/lib/nodeDefaults'
import { renderStaticMarkdownHtml } from '@/shared/lib/staticMarkdown'
import type { PaperDocument } from '@/shared/types/paper'
import { createDataJs } from './generate'
import { PRESENTER_SCRIPT } from './presenterScript'
import { PRESENTER_STYLES } from './presenterStyles'

function runPresenter(doc: PaperDocument) {
  const window = new Window()
  window.document.body.innerHTML = '<div id="app"></div>'
  window.eval(createDataJs(doc))
  window.eval(PRESENTER_SCRIPT)
  return window
}

const SAMPLE_MARKDOWN = [
  '# 实验总结',
  '## 核心公式',
  '使用 **注意力** 与 $\\frac{\\alpha + 1}{\\sqrt{d_k}}$ 计算，支持 `inline` 和 ~~旧写法~~ 与 *斜体*。',
  '> 注意边界条件',
  '- 第一项',
  '```ts',
  'const score = 1',
  '```',
].join('\n')

void test('exported presenter uses left split pane for images and matches editor card/chrome structure', () => {
  // 方案 B：图片不再使用全屏固定模态覆盖，而是在左侧分栏容器 .detail-card 内展示
  assert.ok(!PRESENTER_STYLES.includes('.detail[data-mode="image"] {\n  position: fixed;'))
  assert.ok(!PRESENTER_STYLES.includes('width: 100vw !important;'))
  assert.ok(PRESENTER_STYLES.includes('.detail-card'))
  assert.ok(PRESENTER_STYLES.includes('.node-media.is-multi img'))
  assert.ok(PRESENTER_STYLES.includes('.node-title-accent'))

  const doc: PaperDocument = {
    meta: {
      id: 'doc-parity',
      title: '样式同步测试',
      author: '',
      createdAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    },
    defaults: FALLBACK_DOCUMENT_DEFAULTS,
    rootIds: ['n-title'],
    nodes: [
      {
        id: 'n-title',
        parentIds: [],
        content: { kind: 'title', title: '主标题', subtitle: '副标题' },
        layout: { x: 0, y: 0, collapsed: false },
        events: [
          {
            id: 'e-branch',
            target: 'node',
            trigger: 'double-click',
            action: { type: 'open-canvas', canvasId: 'sub-1' },
          },
        ],
      },
      {
        id: 'n-img-single',
        parentIds: ['n-title'],
        content: { kind: 'image', src: './assets/media/a.png', alt: '单图' },
        layout: { x: 0, y: 0, collapsed: false },
      },
      {
        id: 'n-img-multi',
        parentIds: ['n-title'],
        content: {
          kind: 'image',
          src: './assets/media/p1.png',
          alt: '多图',
          activeIndex: 0,
          items: [
            { src: './assets/media/p1.png', alt: '第1页' },
            { src: './assets/media/p2.png', alt: '第2页' },
          ],
        },
        layout: { x: 0, y: 0, collapsed: false },
      },
      {
        id: 'n-md',
        parentIds: ['n-title'],
        content: { kind: 'file', fileName: 'note.md', format: 'markdown', text: SAMPLE_MARKDOWN },
        layout: { x: 0, y: 0, collapsed: false },
      },
      {
        id: 'n-code',
        parentIds: ['n-title'],
        content: { kind: 'file', fileName: 'app.ts', format: 'code', text: 'export const x = 1' },
        layout: { x: 0, y: 0, collapsed: false },
      },
    ],
    subCanvases: {
      'sub-1': {
        id: 'sub-1',
        hostNodeId: 'n-title',
        rootIds: ['n-title'],
        nodes: [
          {
            id: 'n-title',
            parentIds: [],
            content: { kind: 'title', title: '主标题', subtitle: '副标题' },
            layout: { x: 0, y: 0, collapsed: false },
          },
          {
            id: 'n-sub-leaf',
            parentIds: ['n-title'],
            content: {
              kind: 'text',
              richText: '<p><a data-pl-ref="pdf" href="./assets/refs/paper.pdf" data-pl-page="2">Attention Paper</a></p>',
            },
            layout: { x: 0, y: 0, collapsed: false },
          },
        ],
      },
    },
  }

  const win = runPresenter(doc)
  const dom = win.document

  // 1. 标题节点色条与支线角标
  const titleCard = dom.querySelector('[data-node-id="n-title"]')
  assert.ok(titleCard?.querySelector('.node-title-accent'))
  assert.equal(titleCard?.querySelector('.node-badge')?.textContent, '支线')
  assert.ok(titleCard?.querySelector('.node-badge svg'))

  // 2. 单图 cover / 多图 is-multi contain，且双击打开左侧详情分栏
  const singleMedia = dom.querySelector('[data-node-id="n-img-single"] .node-media')
  const multiMedia = dom.querySelector('[data-node-id="n-img-multi"] .node-media')
  assert.ok(singleMedia !== null && !singleMedia.classList.contains('is-multi'))
  assert.ok(multiMedia !== null && multiMedia.classList.contains('is-multi'))

  const multiCard = dom.querySelector('[data-node-id="n-img-multi"]')
  multiCard?.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }))
  const detail = dom.querySelector('.detail')
  assert.equal(detail?.classList.contains('is-open'), true)
  assert.equal(detail?.getAttribute('data-mode'), 'image')
  const detailImg = dom.querySelector('.detail-card .detail-image')
  assert.equal(detailImg?.getAttribute('src'), './assets/media/p1.png')

  // 多图翻页同步更新左栏图片
  const nextPageBtn = multiCard?.querySelector('[aria-label="下一页"]')
  nextPageBtn?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  assert.equal(detailImg?.getAttribute('src'), './assets/media/p2.png')

  // 收起按钮关闭左栏详情
  dom.querySelector('.detail-collapse')?.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  assert.ok(!detail?.classList.contains('is-open'))

  // 3. Markdown 文件卡片与详情排版与编辑器 renderStaticMarkdownHtml 完全一致
  const expectedMdHtml = renderStaticMarkdownHtml(SAMPLE_MARKDOWN)
  const mdCardBody = dom.querySelector('[data-node-id="n-md"] .node-file-md.node-rich-text')
  assert.equal(mdCardBody?.innerHTML, expectedMdHtml)
  assert.equal(dom.querySelector('[data-node-id="n-md"] .node-file-badge')?.textContent, '· MD')

  dom.querySelector('[data-node-id="n-md"]')?.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }))
  const detailFile = dom.querySelector('.detail-card .detail-file')
  assert.equal(detailFile?.getAttribute('data-file-format'), 'markdown')
  assert.equal(dom.querySelector('.detail-file-badge')?.textContent, '· Markdown')
  assert.equal(dom.querySelector('.detail-file-md')?.innerHTML, expectedMdHtml)

  dom.querySelector('[data-node-id="n-code"]')?.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }))
  assert.equal(detailFile?.getAttribute('data-file-format'), 'code')
  assert.equal(dom.querySelector('.detail-file-badge')?.textContent, '· Source Code')
  assert.equal(dom.querySelector('.detail-file-pre')?.textContent, 'export const x = 1')

  // 4. 连线端点圆点与主色
  const svgPaths = dom.querySelectorAll('svg.connections path')
  const svgCircles = dom.querySelectorAll('svg.connections circle')
  assert.equal(svgPaths.length, 4)
  assert.equal(svgCircles.length, 8)
  assert.equal(svgPaths[0]?.getAttribute('stroke'), 'oklch(0.48 0.16 285)')
  assert.equal(svgPaths[0]?.getAttribute('stroke-linecap'), 'round')

  // 5. 支线切换后展示「同源起点」角标、面包屑以及 PDF 详情头部标题与缩放重置按钮
  titleCard?.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }))
  const breadcrumbs = dom.querySelector('.breadcrumbs')
  assert.equal(breadcrumbs?.classList.contains('is-visible'), true)
  assert.equal(breadcrumbs?.querySelector('.breadcrumb-sep')?.textContent, '/')
  assert.equal(dom.querySelector('[data-node-id="n-title"] .node-badge.is-host')?.textContent, '同源起点')

  const pdfAnchor = dom.querySelector('[data-node-id="n-sub-leaf"] a[data-pl-ref="pdf"]')
  pdfAnchor?.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }))
  assert.equal(detail?.getAttribute('data-mode'), 'pdf')
  assert.equal(dom.querySelector('.detail-pdf-title')?.textContent, 'Attention Paper')
  assert.equal(dom.querySelector('.detail-pdf-zoom')?.textContent, '100%')
})
