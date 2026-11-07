import { escapeHtmlAttribute, escapeHtmlText } from '@/shared/lib/html'

const MATH_SYMBOLS: Readonly<Record<string, string>> = {
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

function replaceLatexCommands(escaped: string): string {
  const withSymbols = escaped.replace(/\\([a-zA-Z]+)/gu, (full, name: string) => {
    return MATH_SYMBOLS[name] ?? full
  })

  const withFrac = withSymbols.replace(
    /\\frac\{([^{}]+)\}\{([^{}]+)\}/gu,
    '<span class="pl-frac"><span class="pl-frac-num">$1</span><span class="pl-frac-den">$2</span></span>',
  )

  return withFrac.replace(
    /\\sqrt\{([^{}]+)\}/gu,
    '<span class="pl-sqrt">√<span class="pl-sqrt-body">$1</span></span>',
  )
}

function replaceSubSup(input: string): string {
  return input
    .replace(/\^\{([^{}]+)\}/gu, '<sup>$1</sup>')
    .replace(/\^([a-zA-Z0-9+-])/gu, '<sup>$1</sup>')
    .replace(/_\{([^{}]+)\}/gu, '<sub>$1</sub>')
    .replace(/_([a-zA-Z0-9+-])/gu, '<sub>$1</sub>')
}

/** 将行内 LaTeX 公式片段转换为零依赖 HTML 数学排版结构 */
export function formatMathInnerHtml(rawTex: string): string {
  const escaped = escapeHtmlText(rawTex.trim())
  const withCommands = replaceLatexCommands(escaped)
  return replaceSubSup(withCommands)
}

/** 生成带有 data-pl-math 属性的完整行内公式 HTML 标签 */
export function renderInlineMathHtml(rawTex: string): string {
  const trimmed = rawTex.trim()
  const inner = formatMathInnerHtml(trimmed)
  return `<span class="pl-math" data-pl-math="${escapeHtmlAttribute(trimmed)}" contenteditable="false">${inner}</span>`
}
