import test from 'node:test'
import assert from 'node:assert/strict'

import { addChildNode, addParentNode, createInitialDocument } from '../data/document'
import { decideStructureClick } from './pendingNodeAction'

void test('decideStructureClick picks source first, then mirrors Alt drop semantics', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)
  doc = addChildNode(doc, rootId, 'n1')
  doc = addChildNode(doc, rootId, 'n2')
  doc = addChildNode(doc, 'n1', 'n3')

  assert.deepEqual(decideStructureClick(doc, null, 'n3', null), {
    type: 'pick-source',
    nodeId: 'n3',
  })
  assert.deepEqual(decideStructureClick(doc, null, null, { x: 10, y: 10 }), { type: 'none' })
  assert.deepEqual(decideStructureClick(doc, 'n3', 'n2', null), {
    type: 'add-parent',
    targetId: 'n2',
  })
  assert.deepEqual(decideStructureClick(doc, 'n3', 'n1', null), { type: 'none' })
  assert.deepEqual(decideStructureClick(doc, 'n3', 'n3', null), { type: 'cancel' })
  assert.deepEqual(decideStructureClick(doc, 'n3', null, { x: 42, y: 84 }), {
    type: 'detach',
    anchor: { x: 42, y: 84 },
  })
  assert.deepEqual(decideStructureClick(doc, 'n3', null, null), { type: 'none' })

  doc = addParentNode(doc, 'n3', 'n2')
  assert.deepEqual(decideStructureClick(doc, 'n3', 'n2', null), { type: 'none' })
})