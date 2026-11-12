import { MATH_SYMBOLS } from '@/shared/lib/mathFormula'

const SERIALIZED_MATH_SYMBOLS = JSON.stringify(MATH_SYMBOLS)
/** 导出包内演示器的只读 Markdown 与行内公式渲染（与 src/shared/lib/staticMarkdown.ts 同源） */
export const PRESENTER_MARKDOWN_SCRIPT = `  var MATH_SYMBOLS = ${SERIALIZED_MATH_SYMBOLS}
  var FENCE_TOKEN = String.fromCharCode(96, 96, 96)
  var FENCE_SPLIT_RE = new RegExp('(' + FENCE_TOKEN + '[\\\\s\\\\S]*?' + FENCE_TOKEN + ')', 'g')

  function escapeHtmlText(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function escapeHtmlAttribute(value) {
    return escapeHtmlText(value)
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function replaceMathSymbols(escaped) {
    return escaped.replace(/\\\\([a-zA-Z]+)/g, function (full, name) {
      return Object.prototype.hasOwnProperty.call(MATH_SYMBOLS, name) ? MATH_SYMBOLS[name] : full
    })
  }

  function replaceMathSubSup(input) {
    return input
      .replace(/\\^\\{([^{}]+)\\}/g, '<sup>$1</sup>')
      .replace(/\\^([a-zA-Z0-9\\u0370-\\u03FF+-])/g, '<sup>$1</sup>')
      .replace(/_\\{([^{}]+)\\}/g, '<sub>$1</sub>')
      .replace(/_([a-zA-Z0-9\\u0370-\\u03FF+-])/g, '<sub>$1</sub>')
  }

  function replaceMathSqrtAndFrac(input) {
    var current = input
    for (var pass = 0; pass < 2; pass += 1) {
      current = current.replace(
        /\\\\sqrt\\{([^{}]+)\\}/g,
        '<span class="pl-sqrt">√<span class="pl-sqrt-body">$1</span></span>',
      )
      current = current.replace(
        /\\\\frac\\{([^{}]+)\\}\\{([^{}]+)\\}/g,
        '<span class="pl-frac"><span class="pl-frac-num">$1</span><span class="pl-frac-den">$2</span></span>',
      )
    }
    return current
  }

  function renderInlineMathHtml(rawTex) {
    var trimmed = String(rawTex).trim()
    var escaped = escapeHtmlText(trimmed)
    var inner = replaceMathSubSup(replaceMathSqrtAndFrac(replaceMathSubSup(replaceMathSymbols(escaped))))
    return '<span class="pl-math" data-pl-math="' + escapeHtmlAttribute(trimmed) +
      '" contenteditable="false" title="双击修改公式">' + inner + '</span>'
  }

  function formatInlineMarkdownLine(rawLine) {
    var escaped = escapeHtmlText(rawLine)
    return escaped
      .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/\\x60([^\\x60]+)\\x60/g, '<code>$1</code>')
      .replace(/\\$([^$]+)\\$/g, function (_, tex) { return renderInlineMathHtml(tex) })
      .replace(/(?:^|[^*])\\*([^*]+)\\*/g, function (full, inner) {
        var prefix = full.charAt(0) === '*' ? '' : full.charAt(0)
        return prefix + '<em>' + inner + '</em>'
      })
  }

  function renderMarkdownLine(line) {
    var trimmed = line.trim()
    if (trimmed === '') return ''
    if (trimmed.indexOf('### ') === 0) return '<h3>' + formatInlineMarkdownLine(trimmed.slice(4)) + '</h3>'
    if (trimmed.indexOf('## ') === 0) return '<h2>' + formatInlineMarkdownLine(trimmed.slice(3)) + '</h2>'
    if (trimmed.indexOf('# ') === 0) return '<h1>' + formatInlineMarkdownLine(trimmed.slice(2)) + '</h1>'
    if (trimmed.indexOf('> ') === 0) return '<blockquote>' + formatInlineMarkdownLine(trimmed.slice(2)) + '</blockquote>'
    if (trimmed.indexOf('- ') === 0 || trimmed.indexOf('* ') === 0) {
      return '<ul><li>' + formatInlineMarkdownLine(trimmed.slice(2)) + '</li></ul>'
    }
    return '<p>' + formatInlineMarkdownLine(trimmed) + '</p>'
  }

  function renderStaticMarkdownHtml(markdown) {
    var source = typeof markdown === 'string' ? markdown : ''
    var segments = source.split(FENCE_SPLIT_RE)
    var htmlParts = []
    for (var i = 0; i < segments.length; i += 1) {
      var segment = segments[i]
      if (segment.indexOf(FENCE_TOKEN) === 0 && segment.lastIndexOf(FENCE_TOKEN) === segment.length - 3 && segment.length >= 6) {
        var lines = segment.slice(3, -3).replace(/^\\r?\\n/, '').split(/\\r?\\n/)
        var codeBody = lines.length > 1 && /^[a-z0-9_-]+$/i.test(lines[0] || '')
          ? lines.slice(1).join('\\n')
          : lines.join('\\n')
        htmlParts.push('<pre class="pl-code-block"><code>' + escapeHtmlText(codeBody) + '</code></pre>')
      } else {
        var textLines = segment.split(/\\r?\\n/)
        for (var j = 0; j < textLines.length; j += 1) {
          var rendered = renderMarkdownLine(textLines[j])
          if (rendered !== '') htmlParts.push(rendered)
        }
      }
    }
    return htmlParts.join('')
  }
`