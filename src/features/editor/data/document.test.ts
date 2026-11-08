import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createInboxFileName,
  createInboxRelativePath,
  extractInboxRelativePath,
} from '@/shared/lib/inbox'
import { DEFAULT_FONT_SIZE, EXPANDED_MEDIA_SCALE } from '@/shared/lib/nodeDefaults'
import {
  addChildNode,
  addImageNode,
  addParentNode,
  addRootNode,
  addSiblingNode,
  canAddParent,
  changeNodeKind,
  createInitialDocument,
  detachNodeAsRoot,
  removeNode,
  removeParentNode,
  updateFileNodeContent,
  updateImageNodeContent,
  updateNodeLayout,
  updateTextNodeContent,
  updateTitleNodeContent,
} from './document'
import { layoutDocument } from './layout'
import { displaceLayoutForExpandedMedia } from './mediaExpansionLayout'
import {
  createReferenceAnchorHtml,
  referenceKindFromFileName,
  referenceKindFromMime,
} from '@/shared/lib/reference'
import {
  matchAnyInlineMarkdown,
  matchBlockPrefix,
  matchInlineMarkdown,
} from '../lib/markdownShortcuts'
import { renderInlineMathHtml } from '../lib/mathFormula'

void test('createInitialDocument creates root node, sample image child node, and default fontSize 16', () => {
  const doc = createInitialDocument()
  assert.equal(DEFAULT_FONT_SIZE, 16)
  assert.equal(doc.defaults.fontSize, 16)
  assert.equal(doc.rootIds.length, 1)
  assert.equal(doc.nodes.length, 2)
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)
  assert.equal(doc.nodes[0]?.id, rootId)
  assert.deepEqual(doc.nodes[0]?.parentIds, [])
  assert.deepEqual(doc.nodes[1]?.parentIds, [rootId])
  assert.equal(doc.nodes[1]?.content.kind, 'image')
})

void test('addRootNode, addChildNode, addSiblingNode, addParentNode, and removeNode mutate tree immutably', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)

  doc = addChildNode(doc, rootId, 'child-text-1')
  assert.equal(doc.nodes.length, 3)

  doc = addSiblingNode(doc, 'child-text-1', 'child-text-2')
  assert.equal(doc.nodes.length, 4)

  doc = addRootNode(doc, 'root-2')
  assert.equal(doc.rootIds.length, 2)
  assert.equal(doc.nodes.length, 5)

  assert.equal(canAddParent(doc, 'child-text-2', 'root-2'), false)
  doc = detachNodeAsRoot(doc, 'child-text-1', { x: 300, y: 400 })
  assert.equal(doc.rootIds.includes('child-text-1'), true)

  doc = removeNode(doc, 'root-2')
  assert.equal(doc.rootIds.includes('root-2'), false)
  assert.deepEqual(doc.nodes.find((n) => n.id === 'child-text-2')?.parentIds, [rootId])

  doc = addChildNode(doc, rootId, 'uncle')
  doc = addChildNode(doc, 'child-text-2', 'grand')
  assert.equal(canAddParent(doc, 'grand', 'uncle'), true)
  doc = addParentNode(doc, 'grand', 'uncle')
  assert.deepEqual(doc.nodes.find((n) => n.id === 'grand')?.parentIds, ['child-text-2', 'uncle'])
})

void test('updateTextNodeContent, changeNodeKind, updateImageNodeContent, and updateNodeLayout work', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)
  doc = updateTextNodeContent(doc, rootId, '<p>Updated PaperLoom</p>')
  const root = doc.nodes.find((n) => n.id === rootId)
  assert.equal(root?.content.kind, 'text')
  if (root?.content.kind === 'text') {
    assert.equal(root.content.richText, '<p>Updated PaperLoom</p>')
  }

  doc = changeNodeKind(doc, rootId, 'image')
  assert.equal(doc.nodes.find((n) => n.id === rootId)?.content.kind, 'image')

  doc = updateImageNodeContent(doc, rootId, 'blob:custom-image', '自定义图片')
  const updatedRoot = doc.nodes.find((n) => n.id === rootId)
  assert.equal(updatedRoot?.content.kind, 'image')
  if (updatedRoot?.content.kind === 'image') {
    assert.equal(updatedRoot.content.src, 'blob:custom-image')
    assert.equal(updatedRoot.content.alt, '自定义图片')
  }

  doc = changeNodeKind(doc, rootId, 'text')
  assert.equal(doc.nodes.find((n) => n.id === rootId)?.content.kind, 'text')

  doc = updateNodeLayout(doc, rootId, { width: 320, height: 180 })
  assert.equal(doc.nodes.find((n) => n.id === rootId)?.layout.width, 320)
  assert.equal(doc.nodes.find((n) => n.id === rootId)?.layout.height, 180)
})

void test('updateTitleNodeContent and updateFileNodeContent work', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)

  doc = changeNodeKind(doc, rootId, 'title')
  doc = updateTitleNodeContent(doc, rootId, '架构总览', '核心模块与数据流')
  const titleNode = doc.nodes.find((n) => n.id === rootId)
  assert.equal(titleNode?.content.kind, 'title')
  if (titleNode?.content.kind === 'title') {
    assert.equal(titleNode.content.title, '架构总览')
    assert.equal(titleNode.content.subtitle, '核心模块与数据流')
  }

  doc = changeNodeKind(doc, rootId, 'file')
  doc = updateFileNodeContent(doc, rootId, 'README.md', 'markdown', '# Hello\nStatic doc')
  const fileNode = doc.nodes.find((n) => n.id === rootId)
  assert.equal(fileNode?.content.kind, 'file')
  if (fileNode?.content.kind === 'file') {
    assert.equal(fileNode.content.fileName, 'README.md')
    assert.equal(fileNode.content.format, 'markdown')
  }
})

void test('layoutDocument computes positions for all roots and children', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)
  doc = addChildNode(doc, rootId, 'child-1')
  const layout = layoutDocument(doc.nodes, doc.rootIds, doc.defaults)

  const rootPos = layout.positions.get(rootId)
  const childPos = layout.positions.get('child-1')
  assert.ok(rootPos)
  assert.ok(childPos)
  assert.ok(childPos.x > rootPos.x)
})

void test('reference helpers work accurately', () => {
  assert.equal(referenceKindFromMime('application/pdf'), 'pdf')
  assert.equal(referenceKindFromMime('text/html'), 'page')
  assert.equal(referenceKindFromFileName('paper.PDF'), 'pdf')
  assert.equal(referenceKindFromFileName('diagram.png'), 'image')

  const anchorHtml = createReferenceAnchorHtml({
    kind: 'pdf',
    src: 'blob:example',
    label: 'Paper PDF',
    page: 3,
  })
  assert.ok(anchorHtml.includes('data-pl-ref="pdf"'))
  assert.ok(anchorHtml.includes('data-pl-page="3"'))
})

void test('live Markdown shortcuts and inline math formula rendering work', () => {
  assert.deepEqual(matchBlockPrefix('# '), { kind: 'formatBlock', tag: 'h1' })
  assert.deepEqual(matchBlockPrefix('##\u00A0'), { kind: 'formatBlock', tag: 'h2' })
  assert.deepEqual(matchBlockPrefix('- '), { kind: 'command', command: 'insertUnorderedList' })
  assert.deepEqual(matchBlockPrefix('1. '), { kind: 'command', command: 'insertOrderedList' })
  assert.deepEqual(matchBlockPrefix('> '), { kind: 'formatBlock', tag: 'blockquote' })

  const boldMatch = matchInlineMarkdown('前缀 **加粗内容**')
  assert.equal(boldMatch?.startIndex, 3)
  assert.equal(boldMatch?.replacementHtml, '<strong>加粗内容</strong>')

  const codeMatch = matchInlineMarkdown('运行 `npm run dev`')
  assert.equal(codeMatch?.replacementHtml, '<code>npm run dev</code>')

  const piMatch = matchInlineMarkdown('\u200B$\\pi$')
  assert.ok(piMatch !== null)
  assert.equal(piMatch.startIndex, 1)
  assert.ok(piMatch.replacementHtml.includes('>π</span>'))

  const anywherePiMatch = matchAnyInlineMarkdown('\u200B$ \\pi $ 后续文字')
  assert.ok(anywherePiMatch !== null)
  assert.equal(anywherePiMatch.startIndex, 1)
  assert.equal(anywherePiMatch.endIndex, 8)
  assert.ok(anywherePiMatch.replacementHtml.includes('>π</span>'))

  const mathMatch = matchInlineMarkdown('能量公式 $E = mc^2$')
  assert.ok(mathMatch !== null)
  assert.ok(mathMatch.replacementHtml.includes('class="pl-math"'))
  assert.ok(mathMatch.replacementHtml.includes('E = mc<sup>2</sup>'))

  const fractionHtml = renderInlineMathHtml('\\alpha + \\frac{x_{i+1}}{y^{2n}} \\le \\sqrt{a_\\beta^2}')
  assert.ok(fractionHtml.includes('α'))
  assert.ok(fractionHtml.includes('pl-frac-num'))
  assert.ok(fractionHtml.includes('<sub>i+1</sub>'))
  assert.ok(fractionHtml.includes('<sup>2n</sup>'))
  assert.ok(fractionHtml.includes('<sub>β</sub>'))
  assert.ok(fractionHtml.includes('≤'))
  assert.ok(fractionHtml.includes('pl-sqrt-body'))

  const multiInline = matchAnyInlineMarkdown('前文 `code` 后接 **bold** 与 *italic*')
  assert.equal(multiInline?.replacementHtml, '<code>code</code>')
  const italicMatch = matchAnyInlineMarkdown('测试 *斜体文字* 结束')
  assert.equal(italicMatch?.replacementHtml, '<em>斜体文字</em>')
})

void test('inbox image timestamp naming and addImageNode create multimedia nodes in res/inbox/', () => {
  const fileName1 = createInboxFileName('image/png', 'clipboard.png', 1762521600000)
  const fileName2 = createInboxFileName('image/jpeg', 'photo.jpeg', 1762521600000)
  assert.equal(fileName1, '1762521600000.png')
  assert.equal(fileName2, '1762521600001.jpg')

  const relPath = createInboxRelativePath(fileName1)
  assert.equal(relPath, 'res/inbox/1762521600000.png')
  assert.equal(extractInboxRelativePath(`/${relPath}`), 'res/inbox/1762521600000.png')
  assert.equal(
    extractInboxRelativePath(`blob:http://localhost:3000/abc#${relPath}`),
    'res/inbox/1762521600000.png',
  )

  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)

  doc = addImageNode(
    doc,
    'pasted-img-1',
    { kind: 'image', src: `/${relPath}`, alt: fileName1 },
    { parentId: rootId },
  )
  const pastedNode = doc.nodes.find((n) => n.id === 'pasted-img-1')
  assert.deepEqual(pastedNode?.parentIds, [rootId])
  assert.equal(pastedNode?.content.kind, 'image')
  if (pastedNode?.content.kind === 'image') {
    assert.equal(pastedNode.content.src, '/res/inbox/1762521600000.png')
  }

  doc = addImageNode(
    doc,
    'dropped-img-root',
    { kind: 'image', src: '/res/inbox/1762521600001.jpg', alt: fileName2 },
    { anchor: { x: 420, y: 360 } },
  )
  assert.equal(doc.rootIds.includes('dropped-img-root'), true)
})

void test('displaceLayoutForExpandedMedia scales to 1.5x and pushes surrounding nodes outward', () => {
  assert.equal(EXPANDED_MEDIA_SCALE, 1.5)
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  const imageNode = doc.nodes[1]
  assert.ok(rootId !== undefined)
  assert.ok(imageNode !== undefined)

  doc = addSiblingNode(doc, imageNode.id, 'bottom-sibling')
  doc = addChildNode(doc, rootId, 'top-sibling')
  doc = addChildNode(doc, imageNode.id, 'right-child')

  const baseLayout = layoutDocument(doc.nodes, doc.rootIds, doc.defaults)
  const expandedLayout = displaceLayoutForExpandedMedia(
    baseLayout,
    doc.nodes,
    doc.defaults,
    imageNode.id,
  )

  assert.deepEqual(
    expandedLayout.positions.get(imageNode.id),
    baseLayout.positions.get(imageNode.id),
  )

  const baseRoot = baseLayout.positions.get(rootId)
  const expRoot = expandedLayout.positions.get(rootId)
  const baseRight = baseLayout.positions.get('right-child')
  const expRight = expandedLayout.positions.get('right-child')
  const baseBottom = baseLayout.positions.get('bottom-sibling')
  const expBottom = expandedLayout.positions.get('bottom-sibling')
  const baseTop = baseLayout.positions.get('top-sibling')
  const expTop = expandedLayout.positions.get('top-sibling')

  assert.ok(baseRoot && expRoot && expRoot.x < baseRoot.x)
  assert.ok(baseRight && expRight && expRight.x > baseRight.x)
  assert.ok(baseBottom && expBottom && expBottom.y !== baseBottom.y)
  assert.ok(baseTop && expTop && expTop.y !== baseTop.y)
})

void test('layoutDocument pushes wide child nodes and neighboring subtrees outward so connections stay visible', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)

  doc = updateNodeLayout(doc, rootId, { width: 179, height: 100 })
  const child1Id = doc.nodes[1]?.id
  assert.ok(child1Id !== undefined)
  doc = updateNodeLayout(doc, child1Id, { width: 460, height: 144 })
  doc = addSiblingNode(doc, child1Id, 'wide-child-2')
  doc = updateNodeLayout(doc, 'wide-child-2', { width: 541, height: 144 })

  const layout = layoutDocument(doc.nodes, doc.rootIds, doc.defaults)
  const rootPos = layout.positions.get(rootId)
  const child1Pos = layout.positions.get(child1Id)
  const child2Pos = layout.positions.get('wide-child-2')
  assert.ok(rootPos && child1Pos && child2Pos)

  const parentRightEdge = rootPos.x + 179 / 2
  const child1LeftEdge = child1Pos.x - 460 / 2
  const child2LeftEdge = child2Pos.x - 541 / 2
  assert.ok(child1LeftEdge - parentRightEdge >= 95.5)
  assert.ok(child2LeftEdge - parentRightEdge >= 95.5)

  doc = addRootNode(doc, 'second-root')
  const rootAnchor = doc.nodes.find((n) => n.id === rootId)?.layout
  assert.ok(rootAnchor)
  doc = updateNodeLayout(doc, 'second-root', { x: rootAnchor.x, y: rootAnchor.y + 40, width: 208, height: 144 })
  const multiLayout = layoutDocument(doc.nodes, doc.rootIds, doc.defaults)
  const secondRootPos = multiLayout.positions.get('second-root')
  const updatedChild2Pos = multiLayout.positions.get('wide-child-2')
  assert.ok(secondRootPos && updatedChild2Pos)
  assert.ok(secondRootPos.y - 144 / 2 >= updatedChild2Pos.y + 144 / 2 + 48 - 1)
})

void test('multi-parent nodes survive single-parent deletion and cascade only when all parents die', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)
  doc = addChildNode(doc, rootId, 'n1')
  doc = addChildNode(doc, rootId, 'n2')
  doc = addChildNode(doc, 'n1', 'n3')

  assert.equal(canAddParent(doc, 'n3', 'n2'), true)
  assert.equal(canAddParent(doc, 'n3', 'n1'), false)
  assert.equal(canAddParent(doc, 'n2', 'n3'), false)
  doc = addParentNode(doc, 'n3', 'n2')
  assert.deepEqual(doc.nodes.find((n) => n.id === 'n3')?.parentIds, ['n1', 'n2'])

  doc = removeNode(doc, 'n1')
  assert.deepEqual(doc.nodes.find((n) => n.id === 'n3')?.parentIds, ['n2'])

  doc = removeNode(doc, 'n2')
  assert.equal(doc.nodes.some((n) => n.id === 'n3'), false)
})

void test('removeParentNode promotes to root when the last parent edge is removed', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)
  doc = addChildNode(doc, rootId, 'a')
  doc = addChildNode(doc, 'a', 'b')

  doc = removeParentNode(doc, 'b', 'a')
  assert.deepEqual(doc.nodes.find((n) => n.id === 'b')?.parentIds, [])
  assert.equal(doc.rootIds.includes('b'), true)
})

void test('leveled layout places a shared child once in the next column of both parents', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)
  doc = addChildNode(doc, rootId, 'n1')
  doc = addChildNode(doc, rootId, 'n2')
  doc = addChildNode(doc, 'n1', 'n3')
  doc = addParentNode(doc, 'n3', 'n2')

  const layout = layoutDocument(doc.nodes, doc.rootIds, doc.defaults)
  assert.equal(layout.positions.size, doc.nodes.length)
  const p1 = layout.positions.get('n1')
  const p2 = layout.positions.get('n2')
  const p3 = layout.positions.get('n3')
  assert.ok(p1 && p2 && p3)
  assert.equal(p1.x, p2.x)
  assert.ok(p3.x > p1.x)
  assert.ok(p2.y > p1.y)
  assert.equal(p3.y, (p1.y + p2.y) / 2)
})

void test('each root tree lays out independently: chains stay aligned and shared children center', () => {
  let doc = createInitialDocument()
  const rootId = doc.rootIds[0]
  assert.ok(rootId !== undefined)
  doc = addChildNode(doc, rootId, 'n1')
  doc = addChildNode(doc, rootId, 'n2')
  doc = addChildNode(doc, 'n1', 'n3')
  doc = addParentNode(doc, 'n3', 'n2')
  doc = addRootNode(doc, 'log')
  doc = addChildNode(doc, 'log', 'first')
  doc = addChildNode(doc, 'first', 'second')

  const layout = layoutDocument(doc.nodes, doc.rootIds, doc.defaults)
  const n1 = layout.positions.get('n1')
  const n2 = layout.positions.get('n2')
  const n3 = layout.positions.get('n3')
  const first = layout.positions.get('first')
  const second = layout.positions.get('second')
  assert.ok(n1 && n2 && n3 && first && second)
  assert.equal(n3.y, (n1.y + n2.y) / 2)
  assert.equal(second.y, first.y)
  assert.equal(second.x - first.x, n1.x - (layout.positions.get(rootId)?.x ?? 0))
})

