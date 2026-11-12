import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'

import {
  FALLBACK_DOCUMENT_DEFAULTS,
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
} from '@/shared/lib/nodeDefaults'
import { estimateFittedNodeSize } from './fitNodeSize'
import { cleanBrowserArtifacts } from './markdownClean'
import { decompileRichTextToEditableHtml } from './markdownDecompile'
import {
  compileMarkdownRichTextHtml,
  insertMarkdownPageBreak,
  splitRichTextPages,
  toggleMarkdownListPrefix,
} from './markdownRichText'
import { collectMarkdownSyntaxSpans } from './markdownSyntaxSpans'
import {
  applyFontSize,
  applyReference,
  clearEditorFormatting,
  guardSelectionAgainstMarkdownSyntax,
} from './richText'

const domWindow = new Window()

function installDomGlobals(): void {
  const entries: ReadonlyArray<readonly [string, unknown]> = [
    ['window', domWindow],
    ['document', domWindow.document],
    ['Node', domWindow.Node],
    ['Text', domWindow.Text],
    ['Element', domWindow.Element],
    ['HTMLElement', domWindow.HTMLElement],
    ['HTMLDivElement', domWindow.HTMLDivElement],
    ['HTMLBRElement', domWindow.HTMLBRElement],
    ['DocumentFragment', domWindow.DocumentFragment],
    ['NodeFilter', domWindow.NodeFilter],
  ]
  for (const [key, value] of entries) {
    if (Reflect.get(globalThis, key) === undefined) {
      Object.defineProperty(globalThis, key, {
        value,
        writable: true,
        configurable: true,
      })
    }
  }
}

installDomGlobals()

void test('decompileRichTextToEditableHtml converts headings, lists, math, code and cleans oklch spans while preserving rich-text tags', () => {
  const corruptedNodeHtml =
    '<h1>\u200B<a href="/res/inbox/1794139925174.png" data-pl-ref="image">目标人群定</a>位<span style="color: oklch(0.372 0.044 257.287); font-size: 16px;">高校学生 / 科研人员（最典型）</span></h1><div><ul><li>汇报、开题答辩</li></ul></div><div></div>'

  const editable = decompileRichTextToEditableHtml(corruptedNodeHtml)
  assert.equal(
    editable,
    '<div># <a href="/res/inbox/1794139925174.png" data-pl-ref="image">目标人群定</a>位高校学生 / 科研人员（最典型）</div><div>- 汇报、开题答辩</div>',
  )
})

void test('compileMarkdownRichTextHtml compiles Markdown syntax and preserves inline rich-text formatting', () => {
  const editorHtml =
    '<div># <a href="/res/inbox/1794139925174.png" data-pl-ref="image">目标人群定</a>位</div>' +
    '<div>- <font color="#7c3aed">高校学生</font> / 科研人员（**最典型**）</div>' +
    '<div>汇报、开题答辩、`npm test` 与公式 $E = mc^2$</div>'

  const compiled = compileMarkdownRichTextHtml(editorHtml)
  assert.ok(
    compiled.startsWith(
      '<h1><a href="/res/inbox/1794139925174.png" data-pl-ref="image">目标人群定</a>位</h1>',
    ),
  )
  assert.ok(
    compiled.includes(
      '<ul><li><font color="#7c3aed">高校学生</font> / 科研人员（<strong data-pl-md="**">最典型</strong>）</li></ul>',
    ),
  )
  assert.ok(compiled.includes('<code>npm test</code>'))
  assert.ok(compiled.includes('class="pl-math"'))
  assert.ok(compiled.includes('data-pl-math="E = mc^2"'))

  // Round-trip back to editable Markdown source + rich-text HTML
  const roundTripped = decompileRichTextToEditableHtml(compiled)
  assert.equal(roundTripped, editorHtml)
})

void test('splitting a merged heading line with Enter compiles into heading + paragraph cleanly', () => {
  const afterEnterSplitInEditor =
    '<div># <a href="/res/inbox/1794139925174.png" data-pl-ref="image">目标人群定</a>位</div>' +
    '<div>高校学生 / 科研人员（最典型）</div>' +
    '<div>- 汇报、开题答辩</div>'

  const compiled = compileMarkdownRichTextHtml(afterEnterSplitInEditor)
  assert.equal(
    compiled,
    '<h1><a href="/res/inbox/1794139925174.png" data-pl-ref="image">目标人群定</a>位</h1>' +
      '<div>高校学生 / 科研人员（最典型）</div>' +
      '<ul><li>汇报、开题答辩</li></ul>',
  )
})

void test('toggleMarkdownListPrefix toggles - and 1. prefixes on editor lines without creating ul/ol DOM', () => {
  const editor = document.createElement('div')
  editor.innerHTML = '<div>第一行</div><div>第二行</div>'

  toggleMarkdownListPrefix(editor, 'insertUnorderedList')
  assert.equal(editor.querySelector('ul'), null)
  assert.equal(editor.innerHTML, '<div>第一行</div><div>- 第二行</div>')

  toggleMarkdownListPrefix(editor, 'insertOrderedList')
  assert.equal(editor.querySelector('ol'), null)
  assert.equal(editor.innerHTML, '<div>第一行</div><div>1. 第二行</div>')

  toggleMarkdownListPrefix(editor, 'insertOrderedList')
  assert.equal(editor.innerHTML, '<div>第一行</div><div>第二行</div>')
})

void test('Markdown syntax tokens like - or # cannot retain links or references and compile cleanly to list/heading', () => {
  const linkedHyphenHtml =
    '<div><a href="/res/inbox/1794139925174.png" data-pl-ref="image">-</a> 高校学生 / 科研人员（最典型）</div>' +
    '<div><a href="https://example.com">- 汇报、开题答辩</a></div>'

  const editor = document.createElement('div')
  editor.innerHTML = linkedHyphenHtml
  cleanBrowserArtifacts(editor)

  assert.equal(
    editor.innerHTML,
    '<div>- 高校学生 / 科研人员（最典型）</div><div>- <a href="https://example.com">汇报、开题答辩</a></div>',
  )

  const compiled = compileMarkdownRichTextHtml(linkedHyphenHtml)
  assert.equal(
    compiled,
    '<ul><li>高校学生 / 科研人员（最典型）</li><li><a href="https://example.com">汇报、开题答辩</a></li></ul>',
  )
})

void test('clearEditorFormatting removes hyperlinks, local references, and inline styles, and guardSelectionAgainstMarkdownSyntax protects prefixes', () => {
  const editor = document.createElement('div')
  editor.innerHTML =
    '<div># <a href="/res/inbox/1794139925174.png" data-pl-ref="image">目标人群定</a>位</div>' +
    '<div>- <a href="https://example.com">高校学生</a> / <font style="font-size: 32px">科研人员</font></div>'
  document.body.appendChild(editor)

  // 1. Collapsed caret inside local reference -> clearEditorFormatting unwraps the reference anchor
  const refText = editor.querySelector('a[data-pl-ref]')?.firstChild
  assert.ok(refText instanceof Text)
  const selection = window.getSelection()
  assert.ok(selection !== null)
  const collapsedRange = document.createRange()
  collapsedRange.setStart(refText, 2)
  collapsedRange.collapse(true)
  selection.removeAllRanges()
  selection.addRange(collapsedRange)

  clearEditorFormatting(editor)
  assert.equal(editor.querySelector('a[data-pl-ref]'), null)
  assert.equal(editor.firstElementChild?.innerHTML, '# 目标人群定位')

  // 2. Selecting across hyperlink and font-size -> clearEditorFormatting removes both
  const secondLine = editor.children[1]
  assert.ok(secondLine instanceof HTMLElement)
  const fullRange = document.createRange()
  fullRange.selectNodeContents(secondLine)
  selection.removeAllRanges()
  selection.addRange(fullRange)

  clearEditorFormatting(editor)
  assert.equal(secondLine.querySelector('a'), null)
  assert.equal(secondLine.innerHTML, '- 高校学生 / 科研人员')
  assert.equal(secondLine.textContent, '- 高校学生 / 科研人员')

  // 3. Selecting only "- " is blocked by guardSelectionAgainstMarkdownSyntax
  const secondLineText = secondLine.firstChild
  assert.ok(secondLineText instanceof Text)
  const dashOnlyRange = document.createRange()
  dashOnlyRange.setStart(secondLineText, 0)
  dashOnlyRange.setEnd(secondLineText, 2)
  selection.removeAllRanges()
  selection.addRange(dashOnlyRange)
  assert.equal(guardSelectionAgainstMarkdownSyntax(editor), false)

  // 4. Selecting "- 高校学生" trims "- " out of the selection start
  const lineWithPrefixRange = document.createRange()
  lineWithPrefixRange.setStart(secondLineText, 0)
  lineWithPrefixRange.setEnd(secondLineText, 6)
  selection.removeAllRanges()
  selection.addRange(lineWithPrefixRange)
  assert.equal(guardSelectionAgainstMarkdownSyntax(editor), true)
  assert.equal(selection.toString(), '高校学生')

  editor.remove()
})

void test('backslash escapes render literal syntax chars and double backslash renders one backslash', () => {
  assert.equal(compileMarkdownRichTextHtml('<div>\\\\</div>'), '<div>\\</div>')
  assert.equal(compileMarkdownRichTextHtml('<div>\\$5 和 \\$10</div>'), '<div>$5 和 $10</div>')
  assert.equal(compileMarkdownRichTextHtml('<div>\\# 不是标题</div>'), '<div># 不是标题</div>')
  assert.equal(compileMarkdownRichTextHtml('<div>\\- 不是列表</div>'), '<div>- 不是列表</div>')
  assert.equal(compileMarkdownRichTextHtml('<div>\\*不是斜体\\*</div>'), '<div>*不是斜体*</div>')
  assert.equal(compileMarkdownRichTextHtml('<div>\\`不是代码\\`</div>'), '<div>`不是代码`</div>')
  assert.equal(compileMarkdownRichTextHtml('<div>\\\\$E=mc^2$</div>'), '<div>\\<span class="pl-math" data-pl-math="E=mc^2" contenteditable="false" title="双击修改公式">E=mc<sup>2</sup></span></div>')
})

void test('escaped char keeps its own rich styling while the escape backslash is consumed', () => {
  const styledBackslash = '<div>\\<font style="font-size: 32px">\\</font></div>'
  assert.equal(
    compileMarkdownRichTextHtml(styledBackslash),
    '<div><font style="font-size: 32px">\\</font></div>',
  )

  const referencedBackslash = '<div>\\<a href="/res/inbox/x.png" data-pl-ref="image">\\</a></div>'
  assert.equal(
    compileMarkdownRichTextHtml(referencedBackslash),
    '<div><a href="/res/inbox/x.png" data-pl-ref="image">\\</a></div>',
  )

  const styledDollar = '<div>\\<font color="#7c3aed">$</font>5</div>'
  assert.equal(
    compileMarkdownRichTextHtml(styledDollar),
    '<div><font color="#7c3aed">$</font>5</div>',
  )

  const storedStyledDollar = '<div><font color="#7c3aed">$</font>5 与 \\</div>'
  const dollarSource = decompileRichTextToEditableHtml(storedStyledDollar)
  assert.equal(dollarSource, '<div><font color="#7c3aed">\\$</font>5 与 \\\\</div>')
  assert.equal(compileMarkdownRichTextHtml(dollarSource), storedStyledDollar)
})

void test('decompile escapes literal dollars and backslashes so they survive recompilation', () => {
  const stored = '<div>价格 $5 与 $10，路径 C:\\temp，星号 * 与记号 `x`</div>'
  const source = decompileRichTextToEditableHtml(stored)
  assert.equal(
    source,
    '<div>价格 \\$5 与 \\$10，路径 C:\\\\temp，星号 \\* 与记号 \\`x\\`</div>',
  )
  assert.equal(compileMarkdownRichTextHtml(source), stored)
})

void test('literal block token at line start is escaped on decompile and stays a paragraph', () => {
  const stored = '<div># 字面标题</div><div>1. 字面序号</div>'
  const source = decompileRichTextToEditableHtml(stored)
  assert.equal(source, '<div>\\# 字面标题</div><div>1\\. 字面序号</div>')
  assert.equal(compileMarkdownRichTextHtml(source), stored)
})

void test('math tex keeps a single backslash in source and round-trips', () => {
  const editorHtml = '<div>$\\frac{a}{b}$</div>'
  const compiled = compileMarkdownRichTextHtml(editorHtml)
  assert.ok(compiled.includes('data-pl-math="\\frac{a}{b}"'))
  const source = decompileRichTextToEditableHtml(compiled)
  assert.equal(source, '<div>$\\frac{a}{b}$</div>')
  assert.equal(compileMarkdownRichTextHtml(source), compiled)
})

void test('reopened backslash formula stays single-backslash and can carry a reference', () => {
  const editorHtml = '<div>相 $\\gamma-Ga_2O_3$ 的</div>'
  const compiled = compileMarkdownRichTextHtml(editorHtml)
  const source = decompileRichTextToEditableHtml(compiled)
  assert.equal(source, editorHtml)

  const editor = document.createElement('div')
  editor.innerHTML = source
  document.body.appendChild(editor)
  const line = editor.firstElementChild
  assert.ok(line instanceof HTMLElement)
  const textNode = line.firstChild
  assert.ok(textNode instanceof Text)
  const selection = window.getSelection()
  assert.ok(selection !== null)
  const range = document.createRange()
  range.setStart(textNode, 0)
  range.setEnd(textNode, textNode.data.length)
  selection.removeAllRanges()
  selection.addRange(range)

  assert.equal(guardSelectionAgainstMarkdownSyntax(editor), true)
  applyReference(editor, { kind: 'pdf', src: '/res/inbox/p.pdf', label: 'p.pdf' })
  const withRef = compileMarkdownRichTextHtml(editor.innerHTML)
  assert.ok(withRef.includes('data-pl-ref="pdf"'))
  assert.ok(withRef.includes('data-pl-math="\\gamma-Ga_2O_3"'))
  editor.remove()
})

void test('collectMarkdownSyntaxSpans marks escape backslash but not the escaped char', () => {
  assert.deepEqual(collectMarkdownSyntaxSpans('\\\\'), [{ start: 0, end: 1 }])
  assert.deepEqual(collectMarkdownSyntaxSpans('\\$5'), [{ start: 0, end: 1 }])
  assert.deepEqual(collectMarkdownSyntaxSpans('- 项目'), [{ start: 0, end: 2 }])
  assert.deepEqual(collectMarkdownSyntaxSpans('**加粗**'), [
    { start: 0, end: 2 },
    { start: 4, end: 6 },
  ])
  assert.deepEqual(collectMarkdownSyntaxSpans('$E=mc^2$'), [
    { start: 0, end: 1 },
    { start: 7, end: 8 },
  ])
  assert.deepEqual(collectMarkdownSyntaxSpans('普通文本'), [])
})

void test('guard protects the escape backslash but allows styling the escaped backslash', () => {
  const editor = document.createElement('div')
  editor.innerHTML = '<div>\\\\</div>'
  document.body.appendChild(editor)
  const text = editor.firstElementChild?.firstChild
  assert.ok(text instanceof Text)
  const selection = window.getSelection()
  assert.ok(selection !== null)
  const range = document.createRange()

  range.setStart(text, 0)
  range.setEnd(text, 1)
  selection.removeAllRanges()
  selection.addRange(range)
  assert.equal(guardSelectionAgainstMarkdownSyntax(editor), false)

  range.setStart(text, 1)
  range.setEnd(text, 2)
  selection.removeAllRanges()
  selection.addRange(range)
  assert.equal(guardSelectionAgainstMarkdownSyntax(editor), true)
  assert.equal(selection.toString(), '\\')

  range.setStart(text, 0)
  range.setEnd(text, 2)
  selection.removeAllRanges()
  selection.addRange(range)
  assert.equal(guardSelectionAgainstMarkdownSyntax(editor), true)
  assert.equal(selection.toString(), '\\')

  editor.remove()
})

void test('guard trims inline markdown delimiters from selection edges', () => {
  const editor = document.createElement('div')
  editor.innerHTML = '<div>**加粗**</div>'
  document.body.appendChild(editor)
  const text = editor.firstElementChild?.firstChild
  assert.ok(text instanceof Text)
  const selection = window.getSelection()
  assert.ok(selection !== null)
  const range = document.createRange()
  range.setStart(text, 0)
  range.setEnd(text, 6)
  selection.removeAllRanges()
  selection.addRange(range)

  assert.equal(guardSelectionAgainstMarkdownSyntax(editor), true)
  assert.equal(selection.toString(), '加粗')

  editor.remove()
})

void test('--- separator compiles into page breaks, round-trips through decompile, and insertMarkdownPageBreak adds a new page', () => {
  const editorHtml = '<div># 第一页标题</div><div>第一页正文</div><div>---</div><div># 第二页标题</div>'
  const compiled = compileMarkdownRichTextHtml(editorHtml)
  assert.equal(
    compiled,
    '<h1>第一页标题</h1><div>第一页正文</div><hr data-pl-page-break="true"><h1>第二页标题</h1>',
  )

  const pages = splitRichTextPages(compiled)
  assert.deepEqual(pages, ['<h1>第一页标题</h1><div>第一页正文</div>', '<h1>第二页标题</h1>'])

  const decompiled = decompileRichTextToEditableHtml(compiled)
  assert.equal(decompiled, editorHtml)

  // Escaped \--- renders as literal --- paragraph and does not split pages
  const escapedCompiled = compileMarkdownRichTextHtml('<div>\\---</div>')
  assert.equal(escapedCompiled, '<div>---</div>')
  assert.equal(splitRichTextPages(escapedCompiled).length, 1)
  assert.equal(decompileRichTextToEditableHtml(escapedCompiled), '<div>\\---</div>')

  // Toolbar 新建页 button inserts --- and a trailing empty line for the new page
  const editor = document.createElement('div')
  editor.innerHTML = '<div>第一页内容</div>'
  document.body.appendChild(editor)
  insertMarkdownPageBreak(editor)
  assert.equal(editor.innerHTML, '<div>第一页内容</div><div>---</div><div><br></div>')
  const compiledAfterInsert = compileMarkdownRichTextHtml(editor.innerHTML)
  assert.deepEqual(splitRichTextPages(compiledAfterInsert), ['<div>第一页内容</div>', ''])
  editor.remove()
})

void test('multi-page estimateFittedNodeSize uses max width and max height across all pages and limits are 1000x800', () => {
  assert.equal(MAX_NODE_WIDTH, 1000)
  assert.equal(MAX_NODE_HEIGHT, 800)

  // Page 1: wide single line; Page 2: narrow 4 lines
  const page1 = '<div>这是一行非常宽的第一页横向标题文本内容用于测试多页最大宽度包络计算</div>'
  const page2 = '<div>短行一</div><div>短行二</div><div>短行三</div><div>短行四</div>'
  const multiPageHtml = `${page1}<hr data-pl-page-break="true">${page2}`

  const sizePage1Only = estimateFittedNodeSize(
    { id: 'n1', parentIds: [], content: { kind: 'text', richText: page1 }, layout: { x: 0, y: 0, collapsed: false } },
    FALLBACK_DOCUMENT_DEFAULTS,
  )
  const sizePage2Only = estimateFittedNodeSize(
    { id: 'n2', parentIds: [], content: { kind: 'text', richText: page2 }, layout: { x: 0, y: 0, collapsed: false } },
    FALLBACK_DOCUMENT_DEFAULTS,
  )
  const sizeMulti = estimateFittedNodeSize(
    { id: 'n3', parentIds: [], content: { kind: 'text', richText: multiPageHtml }, layout: { x: 0, y: 0, collapsed: false } },
    FALLBACK_DOCUMENT_DEFAULTS,
  )

  assert.ok(sizePage1Only !== null && sizePage2Only !== null && sizeMulti !== null)
  assert.equal(sizeMulti.width, Math.max(sizePage1Only.width, sizePage2Only.width))
  assert.ok(sizeMulti.height > sizePage2Only.height)
})

void test('applyReference and applyFontSize succeed on selections containing inline math formulas ($...$)', () => {
  const editor = document.createElement('div')
  editor.innerHTML = '<div>能量公式 $E = mc^2$ 的推导</div>'
  document.body.appendChild(editor)

  const line = editor.firstElementChild
  assert.ok(line instanceof HTMLElement)
  const textNode = line.firstChild
  assert.ok(textNode instanceof Text)
  const selection = window.getSelection()
  assert.ok(selection !== null)

  // Select "能量公式 $E = mc^2$" and apply a local PDF reference
  const range = document.createRange()
  range.setStart(textNode, 0)
  range.setEnd(textNode, 15)
  selection.removeAllRanges()
  selection.addRange(range)

  applyReference(editor, {
    kind: 'pdf',
    src: '/res/inbox/paper.pdf',
    label: 'paper.pdf',
    page: 3,
  })
  const compiledWithRef = compileMarkdownRichTextHtml(editor.innerHTML)
  assert.ok(compiledWithRef.includes('data-pl-ref="pdf"'))
  assert.ok(compiledWithRef.includes('class="pl-math"'))
  assert.ok(compiledWithRef.includes('data-pl-math="E = mc^2"'))

  // Select the reference and apply 24px font size so the math formula scales with text
  const fullLineRange = document.createRange()
  fullLineRange.selectNodeContents(line)
  selection.removeAllRanges()
  selection.addRange(fullLineRange)

  applyFontSize(editor, 24)
  const compiledWithSize = compileMarkdownRichTextHtml(editor.innerHTML)
  assert.ok(compiledWithSize.includes('style="font-size: 24px"'))
  assert.ok(compiledWithSize.includes('class="pl-math"'))

  editor.remove()
})

