import test from 'node:test'
import assert from 'node:assert/strict'
import { buildChildrenMap, describeLevelProblem } from '@/shared/lib/nodeTree'
import {
  activeCanvasDocument,
  addChildNode,
  addParentNode,
  applyInCanvas,
  changeNodeKind,
  createInitialDocument,
  detachNodeAsRoot,
  ensureSubCanvasForNode,
  removeParentNode,
  updateTitleNodeContent,
} from './document'
import { copyNodeToClipboard, pasteClipboardIntoDocument } from './nodeClipboard'

void test('Ctrl+C (single) copies only the selected node and appends it as the last child of the selected target on paste', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)

  doc = addChildNode(doc, rootId, 'branch-a')
  doc = changeNodeKind(doc, 'branch-a', 'title')
  doc = updateTitleNodeContent(doc, 'branch-a', '核心分支', '副标题')
  doc = addChildNode(doc, 'branch-a', 'grandchild-1')

  const payload = copyNodeToClipboard(doc, 'branch-a', 'single')
  assert.ok(payload !== null)
  assert.equal(payload.mode, 'single')
  assert.equal(payload.nodes.length, 1)

  // Pasting while 'branch-a' is selected appends the cloned single node after 'branch-a' (as its last child)
  const pasted = pasteClipboardIntoDocument(doc, payload, 'branch-a')
  assert.ok(pasted !== null)
  const nextDoc = pasted.document
  assert.equal(describeLevelProblem(nextDoc.nodes, nextDoc.rootIds), null)

  const childrenOfBranchA = buildChildrenMap(nextDoc.nodes).get('branch-a') ?? []
  assert.deepEqual(
    childrenOfBranchA.map((n) => n.id),
    ['grandchild-1', pasted.pastedRootId],
  )
  const pastedNode = nextDoc.nodes.find((n) => n.id === pasted.pastedRootId)
  assert.equal(pastedNode?.content.kind, 'title')
  if (pastedNode?.content.kind === 'title') {
    assert.equal(pastedNode.content.title, '核心分支')
    assert.equal(pastedNode.content.subtitle, '副标题')
  }
  // Single-node copy does not copy grandchild-1 under the pasted node
  assert.deepEqual(buildChildrenMap(nextDoc.nodes).get(pasted.pastedRootId) ?? [], [])
})

void test('Ctrl+Shift+C (subtree) copies the entire subtree and remaps internal IDs and multi-parent edges safely', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)

  doc = addChildNode(doc, rootId, 'sub-root')
  doc = addChildNode(doc, rootId, 'outside-uncle')
  doc = addChildNode(doc, 'sub-root', 'sub-child-1')
  doc = addChildNode(doc, 'sub-root', 'sub-child-2')
  // Give sub-child-2 a second parent outside the copied subtree ('outside-uncle')
  doc = addParentNode(doc, 'sub-child-2', 'outside-uncle')
  doc = addChildNode(doc, 'sub-child-1', 'sub-grandchild')

  const payload = copyNodeToClipboard(doc, 'sub-root', 'subtree')
  assert.ok(payload !== null)
  assert.equal(payload.mode, 'subtree')
  assert.equal(payload.nodes.length, 4)

  // Paste subtree under 'sub-grandchild'
  const pasted = pasteClipboardIntoDocument(doc, payload, 'sub-grandchild')
  assert.ok(pasted !== null)
  const nextDoc = pasted.document
  // Outside parent 'outside-uncle' was stripped from cloned sub-child-2 so DAG level invariant holds
  assert.equal(describeLevelProblem(nextDoc.nodes, nextDoc.rootIds), null)

  const childrenMap = buildChildrenMap(nextDoc.nodes)
  const pastedChildren = childrenMap.get(pasted.pastedRootId) ?? []
  assert.equal(pastedChildren.length, 2)
  const pastedFirstChildId = pastedChildren[0]?.id
  assert.ok(pastedFirstChildId !== undefined)
  assert.equal((childrenMap.get(pastedFirstChildId) ?? []).length, 1)
})

void test('Cross-canvas copy-paste strips open-canvas and return-parent-canvas events and generates fresh IDs', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)

  const ensured = ensureSubCanvasForNode(doc, null, rootId)
  doc = ensured.document
  const canvasId = ensured.canvasId

  // Copy the host node inside the sub-canvas (which has return-parent-canvas bound)
  const subSlice = activeCanvasDocument(doc, canvasId)
  const hostPayload = copyNodeToClipboard(subSlice, rootId, 'subtree')
  assert.ok(hostPayload !== null)

  // Paste into the sub-canvas under the host node
  const pastedInSub = pasteClipboardIntoDocument(subSlice, hostPayload, rootId)
  assert.ok(pastedInSub !== null)
  assert.notEqual(pastedInSub.pastedRootId, rootId)
  const pastedNode = pastedInSub.document.nodes.find((n) => n.id === pastedInSub.pastedRootId)
  assert.ok(pastedNode !== undefined)
  // Must not retain return-parent-canvas or open-canvas on the pasted clone
  const hasCanvasEvents = (pastedNode.events ?? []).some(
    (ev) => ev.action.type === 'open-canvas' || ev.action.type === 'return-parent-canvas',
  )
  assert.equal(hasCanvasEvents, false)

  // Apply back into document and also paste into main canvas as a new root (selectedNodeId = null)
  doc = applyInCanvas(doc, canvasId, () => pastedInSub.document)
  const pastedInMain = pasteClipboardIntoDocument(doc, hostPayload, null)
  assert.ok(pastedInMain !== null)
  assert.equal(pastedInMain.document.rootIds.includes(pastedInMain.pastedRootId), true)
  assert.equal(
    describeLevelProblem(pastedInMain.document.nodes, pastedInMain.document.rootIds),
    null,
  )
})

void test('Disconnecting a node from its parent and re-attaching it places it at the last position among siblings', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)

  // Initial children of root: [sampleImageId, 'c1', 'c2', 'c3']
  const sampleImageId = doc.nodes[1]?.id
  assert.ok(sampleImageId !== undefined)
  doc = addChildNode(doc, rootId, 'c1')
  doc = addChildNode(doc, rootId, 'c2')
  doc = addChildNode(doc, rootId, 'c3')

  const initialOrder = (buildChildrenMap(doc.nodes).get(rootId) ?? []).map((n) => n.id)
  assert.deepEqual(initialOrder, [sampleImageId, 'c1', 'c2', 'c3'])

  // 1. Detach 'c1' as root and re-attach 'c1' back to rootId -> 'c1' must now be last: [sampleImageId, 'c2', 'c3', 'c1']
  doc = detachNodeAsRoot(doc, 'c1', { x: 200, y: 200 })
  doc = addParentNode(doc, 'c1', rootId)
  const orderAfterDetachReattach = (buildChildrenMap(doc.nodes).get(rootId) ?? []).map((n) => n.id)
  assert.deepEqual(orderAfterDetachReattach, [sampleImageId, 'c2', 'c3', 'c1'])

  // 2. Remove parent via removeParentNode on 'c2' and re-attach 'c2' back to rootId -> 'c2' must now be last: [sampleImageId, 'c3', 'c1', 'c2']
  doc = removeParentNode(doc, 'c2', rootId)
  doc = addParentNode(doc, 'c2', rootId)
  const orderAfterRemoveReattach = (buildChildrenMap(doc.nodes).get(rootId) ?? []).map((n) => n.id)
  assert.deepEqual(orderAfterRemoveReattach, [sampleImageId, 'c3', 'c1', 'c2'])
})
