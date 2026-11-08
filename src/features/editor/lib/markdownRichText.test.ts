import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'

import {
  cleanBrowserArtifacts,
  compileMarkdownRichTextHtml,
  decompileRichTextToEditableHtml,
  toggleMarkdownListPrefix,
} from './markdownRichText'
import {
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
