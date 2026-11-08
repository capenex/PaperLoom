import test from 'node:test'
import assert from 'node:assert/strict'
import { Script } from 'node:vm'

import { FALLBACK_DOCUMENT_DEFAULTS } from '@/shared/lib/nodeDefaults'
import type { PaperDocument } from '@/shared/types/paper'
import { createDataJs, createIndexHtml } from './generate'
import { PRESENTER_SCRIPT } from './presenterScript'
import { PRESENTER_STYLES } from './presenterStyles'

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
        parentId: null,
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
            parentId: null,
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
            parentId: 'node-root',
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
