import test from 'node:test'
import assert from 'node:assert/strict'

import type { NodeEventBinding } from '@/shared/types/paper'
import {
  addChildNode,
  addParentNode,
  createInitialDocument,
  ensureSubCanvasForNode,
  updateEventActionTarget,
  updateNodeEventsInDocument,
} from '../data/document'
import { decideStructureClick } from './pendingNodeAction'
import type { PendingNodeAction } from './pendingNodeAction'

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

void test('pick-event-target pending action carries source node and binding id', () => {
  const pending: PendingNodeAction = {
    kind: 'pick-event-target',
    sourceNodeId: 'source',
    bindingId: 'bind-switch',
  }
  assert.equal(pending.kind, 'pick-event-target')
  if (pending.kind === 'pick-event-target') {
    assert.equal(pending.sourceNodeId, 'source')
    assert.equal(pending.bindingId, 'bind-switch')
  }
})

void test('updateEventActionTarget rebinds switch-node-page actions and syncs host copies', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  const imageId = doc.nodes[1]?.id
  assert.ok(rootId !== undefined)
  assert.ok(imageId !== undefined)
  const events: readonly NodeEventBinding[] = [
    {
      id: 'bind-switch',
      target: 'node',
      trigger: 'click',
      action: { type: 'switch-node-page', targetNodeId: 'placeholder', mode: 'next-loop' },
    },
    {
      id: 'bind-detail',
      target: 'node',
      trigger: 'double-click',
      action: { type: 'open-detail' },
    },
  ]
  doc = updateNodeEventsInDocument(doc, null, rootId, events)
  doc = ensureSubCanvasForNode(doc, null, rootId, 'sub-1').document

  const next = updateEventActionTarget(doc, null, rootId, 'bind-switch', imageId)
  const binding = next.nodes
    .find((node) => node.id === rootId)
    ?.events?.find((item) => item.id === 'bind-switch')
  assert.ok(binding !== undefined)
  assert.ok(binding.action.type === 'switch-node-page')
  assert.equal(binding.action.targetNodeId, imageId)
  assert.equal(binding.action.mode, 'next-loop')

  const sub = next.subCanvases?.['sub-1']
  assert.ok(sub !== undefined)
  const hostBinding = sub.nodes
    .find((node) => node.id === rootId)
    ?.events?.find((item) => item.id === 'bind-switch')
  assert.ok(hostBinding !== undefined)
  assert.ok(hostBinding.action.type === 'switch-node-page')
  assert.equal(hostBinding.action.targetNodeId, imageId)

  const fromSub = updateEventActionTarget(next, 'sub-1', rootId, 'bind-switch', rootId)
  const mainBinding = fromSub.nodes
    .find((node) => node.id === rootId)
    ?.events?.find((item) => item.id === 'bind-switch')
  assert.ok(mainBinding !== undefined)
  assert.ok(mainBinding.action.type === 'switch-node-page')
  assert.equal(mainBinding.action.targetNodeId, rootId)

  assert.equal(updateEventActionTarget(next, null, rootId, 'missing', imageId), next)
  assert.equal(updateEventActionTarget(next, null, rootId, 'bind-detail', imageId), next)
  assert.equal(updateEventActionTarget(next, null, 'missing-node', 'bind-switch', imageId), next)
})