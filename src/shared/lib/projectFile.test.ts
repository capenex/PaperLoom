import test from 'node:test'
import assert from 'node:assert/strict'

import { PROJECT_FORMAT_VERSION } from '../types/project'
import { parseProjectFile } from './projectFile'

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