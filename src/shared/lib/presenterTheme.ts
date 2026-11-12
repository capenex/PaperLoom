/** 编辑端与离线导出端共用的设计令牌及富文本排版样式 */
export const PRESENTER_THEME_TOKENS = {
  fontSans: '"Plus Jakarta Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontMath: '"KaTeX_Main", "Latin Modern Math", "STIX Two Math", "Cambria Math", "Times New Roman", serif',
  primary: 'oklch(0.48 0.16 285)',
  primaryMuted25: 'oklch(0.48 0.16 285 / 0.25)',
  primaryMuted40: 'oklch(0.48 0.16 285 / 0.4)',
  primaryMuted60: 'oklch(0.48 0.16 285 / 0.6)',
  primarySoft10: 'oklch(0.48 0.16 285 / 0.1)',
  primarySoft15: 'oklch(0.48 0.16 285 / 0.15)',
  canvasBg: '#fbfcfe',
  canvasDot: '#cbd5e1',
  foreground: '#0f172a',
  cardShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.06), 0 1px 3px -1px rgba(15, 23, 42, 0.04)',
  cardHoverShadow: '0 10px 24px -4px rgba(15, 23, 42, 0.1)',
  cardExpandedShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
  detailCardShadow: '0 16px 40px -12px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.05), 0 0 0 1px rgba(15, 23, 42, 0.05)',
  pdfPageShadow: '0 8px 28px -6px rgba(15, 23, 42, 0.12)',
} as const

/** 与 src/index.css 完全一致的 .node-rich-text 排版样式 */
export const SHARED_RICH_TEXT_STYLES = `.node-rich-text {
  min-height: 0;
  overflow: hidden;
  line-height: 1.625;
  color: #475569;
  overflow-wrap: anywhere;
}

.node-rich-text.has-pager {
  padding-bottom: 20px;
}

.node-rich-text p {
  margin: 0;
}

.node-rich-text p + p {
  margin-top: 0.35em;
}

.node-rich-text ul {
  margin: 0;
  padding-left: 1.25em;
  list-style: disc;
}

.node-rich-text ol {
  margin: 0;
  padding-left: 1.25em;
  list-style: decimal;
}

.node-rich-text a {
  color: ${PRESENTER_THEME_TOKENS.primary};
  text-decoration: underline;
  text-underline-offset: 2px;
}

.node-rich-text a[data-pl-ref] {
  cursor: pointer;
  text-decoration-style: dotted;
}

.node-rich-text h1 {
  margin: 0 0 0.28em;
  font-size: 1.35em;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.28;
  color: #0f172a;
}

.node-rich-text h2 {
  margin: 0 0 0.22em;
  font-size: 1.18em;
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.32;
  color: #0f172a;
}

.node-rich-text h3 {
  margin: 0 0 0.16em;
  font-size: 1.06em;
  font-weight: 600;
  line-height: 1.38;
  color: #1e293b;
}

.node-rich-text blockquote {
  margin: 0.25em 0;
  padding: 0.25em 0.65em;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #475569;
  font-style: italic;
}

.node-rich-text code {
  padding: 0.12em 0.4em;
  border-radius: 5px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  font-family: ${PRESENTER_THEME_TOKENS.fontMono};
  font-size: 0.85em;
  font-weight: 500;
  color: #be185d;
}

.node-rich-text .pl-math {
  display: inline;
  margin: 0 0.08em;
  padding: 0;
  font-family: ${PRESENTER_THEME_TOKENS.fontMath};
  font-size: 1.06em;
  font-style: italic;
  color: inherit;
  line-height: inherit;
  letter-spacing: 0.01em;
  font-variant-numeric: lining-nums;
}

.node-rich-text .pl-frac {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  vertical-align: middle;
  margin: 0 0.15em;
  font-size: 0.85em;
  line-height: 1.05;
}

.node-rich-text .pl-frac-num {
  padding: 0 0.2em 0.08em;
  border-bottom: 1px solid currentColor;
}

.node-rich-text .pl-frac-den {
  padding: 0.08em 0.2em 0;
}

.node-rich-text .pl-sqrt {
  display: inline-flex;
  align-items: baseline;
}

.node-rich-text .pl-sqrt-body {
  border-top: 1px solid currentColor;
  padding: 0 0.15em;
}`
