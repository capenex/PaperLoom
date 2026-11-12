import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { PRESENTER_THEME_TOKENS, SHARED_RICH_TEXT_STYLES } from './presenterTheme'

void test('presenterTheme tokens and rich-text typography match src/index.css', () => {
  const indexCss = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')
  assert.ok(indexCss.includes(PRESENTER_THEME_TOKENS.primary))
  assert.ok(indexCss.includes(PRESENTER_THEME_TOKENS.fontSans))
  assert.ok(indexCss.includes(PRESENTER_THEME_TOKENS.fontMono))
  assert.ok(indexCss.includes('font-size: 1.35em;'))
  assert.ok(SHARED_RICH_TEXT_STYLES.includes('font-size: 1.35em;'))
  assert.ok(indexCss.includes('margin-top: 0.35em;'))
  assert.ok(SHARED_RICH_TEXT_STYLES.includes('margin-top: 0.35em;'))
  // 行内公式保持纯文本内嵌排布，不加方框边框
  assert.ok(!SHARED_RICH_TEXT_STYLES.includes('.pl-math {\n  display: inline-flex'))
  assert.ok(SHARED_RICH_TEXT_STYLES.includes('font-variant-numeric: lining-nums;'))
})
