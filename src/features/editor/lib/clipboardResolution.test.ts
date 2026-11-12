import test from 'node:test'
import assert from 'node:assert/strict'

import { createInitialDocument } from '../data/document'
import { copyNodeToClipboard } from '../data/nodeClipboard'
import {
  NODE_CLIPBOARD_MIME,
  hasNodeClipboardMime,
  resolveCanvasPasteIntent,
} from './clipboardResolution'
import type { ClipboardDataLike, NodeClipboardSession } from './clipboardResolution'

function makeClipboardData(
  entries: Record<string, string> = {},
  fileCount = 0,
): ClipboardDataLike {
  return {
    types: Object.keys(entries),
    files: { length: fileCount },
    getData: (format) => entries[format] ?? '',
  }
}

function makeSession(viaCopyEvent: boolean): NodeClipboardSession {
  const doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)
  const payload = copyNodeToClipboard(doc, rootId, viaCopyEvent ? 'single' : 'subtree')
  assert.ok(payload !== null)
  return {
    token: 'copy-token-1',
    viaCopyEvent,
    payload,
  }
}

void test('Ctrl+C node -> screenshot -> Ctrl+V resolves to image instead of stale node', () => {
  const session = makeSession(true)
  const screenshotClipboard = makeClipboardData({}, 1)

  assert.equal(hasNodeClipboardMime(screenshotClipboard), false)
  assert.equal(resolveCanvasPasteIntent(screenshotClipboard, session, true, true), 'image')
})

void test('Screenshot -> Ctrl+C node -> Ctrl+V resolves to node when node token matches', () => {
  const session = makeSession(true)
  const nodeClipboard = makeClipboardData({ [NODE_CLIPBOARD_MIME]: 'copy-token-1' }, 0)

  assert.equal(hasNodeClipboardMime(nodeClipboard), true)
  assert.equal(resolveCanvasPasteIntent(nodeClipboard, session, false, false), 'node')
})

void test('Ctrl+Shift+C subtree -> screenshot -> Ctrl+V resolves to image', () => {
  const session = makeSession(false)
  const screenshotClipboard = makeClipboardData({}, 1)

  assert.equal(resolveCanvasPasteIntent(screenshotClipboard, session, true, true), 'image')
})

void test('Ctrl+Shift+C subtree -> Ctrl+V with empty clipboard resolves to node', () => {
  const session = makeSession(false)
  const emptyClipboard = makeClipboardData({}, 0)

  assert.equal(resolveCanvasPasteIntent(emptyClipboard, session, false, false), 'node')
})

void test('Ctrl+C node -> external text copy -> Ctrl+V does not paste stale node', () => {
  const session = makeSession(true)
  const externalTextClipboard = makeClipboardData({ 'text/plain': 'copied text' }, 0)

  assert.equal(resolveCanvasPasteIntent(externalTextClipboard, session, false, false), 'none')
})

void test('Image without node session resolves to image', () => {
  const screenshotClipboard = makeClipboardData({}, 1)
  assert.equal(resolveCanvasPasteIntent(screenshotClipboard, null, true, true), 'image')
})