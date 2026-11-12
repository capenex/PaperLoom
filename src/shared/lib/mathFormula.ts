import { escapeHtmlAttribute, escapeHtmlText } from './html'

export const MATH_SYMBOLS: Readonly<Record<string, string>> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  phi: 'φ',
  omega: 'ω',
  Delta: 'Δ',
  Gamma: 'Γ',
  Lambda: 'Λ',
  Omega: 'Ω',
  Phi: 'Φ',
  Pi: 'Π',
  Sigma: 'Σ',
  Theta: 'Θ',
  sum: '∑',
  prod: '∏',
  int: '∫',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  pm: '±',
  mp: '∓',
  times: '×',
  div: '÷',
  cdot: '·',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  equiv: '≡',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  subseteq: '⊆',
  cup: '∪',
  cap: '∩',
  forall: '∀',
  exists: '∃',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  iff: '⇔',
}

function replaceSymbols(escaped: string): string {
  return escaped.replace(/\\([a-zA-Z]+)/gu, (full, name: string) => {
    return MATH_SYMBOLS[name] ?? full
  })
}

function replaceSubSup(input: string): string {
  return input
    .replace(/\^\{([^{}]+)\}/gu, '<sup>$1</sup>')
    .replace(/\^([a-zA-Z0-9\u0370-\u03FF+-])/gu, '<sup>$1</sup>')
    .replace(/_\{([^{}]+)\}/gu, '<sub>$1</sub>')
    .replace(/_([a-zA-Z0-9\u0370-\u03FF+-])/gu, '<sub>$1</sub>')
}

function replaceSqrtAndFrac(input: string): string {
  let current = input
  for (let pass = 0; pass < 2; pass += 1) {
    current = current.replace(
      /\\sqrt\{([^{}]+)\}/gu,
      '<span class="pl-sqrt">√<span class="pl-sqrt-body">$1</span></span>',
    )
    current = current.replace(
      /\\frac\{([^{}]+)\}\{([^{}]+)\}/gu,
      '<span class="pl-frac"><span class="pl-frac-num">$1</span><span class="pl-frac-den">$2</span></span>',
    )
  }
  return current
}

/** 将行内 LaTeX 公式片段转换为零依赖 HTML 数学排版结构 */
export function formatMathInnerHtml(rawTex: string): string {
  const escaped = escapeHtmlText(rawTex.trim())
  const withSymbols = replaceSymbols(escaped)
  const withInnerSubSup = replaceSubSup(withSymbols)
  const withStructures = replaceSqrtAndFrac(withInnerSubSup)
  return replaceSubSup(withStructures)
}

/** 生成带有 data-pl-math 属性的完整行内公式 HTML 标签 */
export function renderInlineMathHtml(rawTex: string): string {
  const trimmed = rawTex.trim()
  const inner = formatMathInnerHtml(trimmed)
  return `<span class="pl-math" data-pl-math="${escapeHtmlAttribute(trimmed)}" contenteditable="false" title="双击修改公式">$${escapeHtmlText(trimmed)}$</span>`.replace(
    `>$${escapeHtmlText(trimmed)}$<`,
    `>${inner}<`,
  )
}
