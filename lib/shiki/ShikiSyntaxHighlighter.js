'use strict'

const { JSDOM } = require('jsdom')

const START_RX = (theme) => new RegExp(
    `<pre class="shiki ${theme}" style="background-color: #([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})" tabindex="0"><code>`, 'i'
)
const END = '</code></pre>'
const HIGHLIGHT_CLASS = 'highlighted'

class ShikiSyntaxHighlighter {
  static setContext (context) {
    ShikiSyntaxHighlighter.extensionContext = context
  }

  format (node, lang, opts = {}) {
    const logger = node.getLogger()

    logger.debug('Render source with shiki...')
    logger.debug(' > Source file: ' + node.document.reader.file)

    // Use the function with your XML string
    return moveConumsInsidePreviousLineSpan(node.getContent(), logger)
  }

  handlesHighlighting () {
    return true
  }

  highlight (node, source, lang, opts) {
    const { highlighter, config } = ShikiSyntaxHighlighter.extensionContext
    const logger = node.getLogger()

    const useLineNumbers = calculateLineNumbers(node, opts, config)

    const theme = calculateTheme(node, config.theme)
    const startNumber = opts.start_line_number || 1

    logger.debug(' > Theme: ' + theme)
    logger.debug(' > Use line-numbers: ' + useLineNumbers)
    logger.debug(' > Use start-number: ' + startNumber)

    try {
      const generatedHtml = highlighter.codeToHtml(source, {
        lang: lang,
        theme: theme,
        lineOptions: getHighlightedLines(opts, logger),
      })

      const backgroundColor = extractBackgroundColor(highlighter, theme)
      const lineNumberColor = calculateLineNumberColor(backgroundColor, highlighter, theme)

      //Leaving the html default results in nested pre/code elements,
      //which is rendered as an unattractive box around the highlighted code.
      const reducedHtml = removeGeneratedPreAndCodeTags(generatedHtml, theme, logger)
      // eslint-disable-next-line max-len
      return encloseInPreAndCodeTags(reducedHtml, theme, lang, useLineNumbers, backgroundColor, startNumber, lineNumberColor)
    } catch (e) {
      console.error(Object.getOwnPropertyNames(e))
      logger.error(e.message, e)
      return source
    }
  }
}

function calculateConumColors(backgroundColor, highlighter, theme, config = {}) {
  // If both colors are configured, use them
  if (config.conumsBgColor && config.conumsFgColor) {
    return {
      background: config.conumsBgColor,
      foreground: config.conumsFgColor
    }
  }

  // Get theme's foreground color
  const themeFg = highlighter.getForegroundColor(theme)

  // Calculate background color (default or configured)
  const bgColor = config.conumsBgColor || (() => {
    // By default, use a slightly dimmed version of the theme's foreground color
    return adjustBrightness(themeFg, -15)
  })()

  // Calculate foreground color (default or configured)
  const fgColor = config.conum_fg_color || (() => {
    // Calculate brightness of the background color
    const r = parseInt(bgColor.substr(1, 2), 16)
    const g = parseInt(bgColor.substr(3, 2), 16)
    const b = parseInt(bgColor.substr(5, 2), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000

    // For dark backgrounds, use a light foreground and vice versa
    return brightness < 128 ? '#ffffff' : '#000000'
  })()

  return {
    background: bgColor,
    foreground: fgColor
  }
}

function encloseInPreAndCodeTags (html, theme, lang, useLineNumbers, backgroundColor, startNumber, lineNumberColor) {
  const { highlighter, config } = ShikiSyntaxHighlighter.extensionContext
  const lineNumberClass = useLineNumbers ? 'has-line-numbers' : ''
  
  // Handle conum styling classes
  let conumClasses = ''
  let conumStyles = ''
  if (config.conumsOverride) {
    conumClasses = 'override-conums' + (config.conumsShowBorder ? ' with-conum-border' : '')
    const conumColors = calculateConumColors(backgroundColor, highlighter, theme, config)
    conumStyles = `--shiki-conum-bg-color: ${conumColors.background}; --shiki-conum-fg-color: ${conumColors.foreground};`
  }

  const backgroundColorStyle = backgroundColor ? `style="--shiki-background-color: ${backgroundColor}; ${conumStyles}"` : ''
  const startAtLineNumberStyle = startNumber ? `--shiki-line-number-start: ${startNumber};` : ''
  const lineNumberColorStyle = lineNumberColor ? ` --shiki-line-number-color: ${lineNumberColor};` : ''
  const lineNumberStyle = `style="${startAtLineNumberStyle}${lineNumberColorStyle}"`

  return `<pre class="shiki highlight ${theme}" ${backgroundColorStyle}><code ${lang ? ` data-lang="${lang}"` : ''} class="shiki ${lineNumberClass} ${conumClasses}"${lineNumberStyle}>${html}</code></pre>`
}

function removeGeneratedPreAndCodeTags (html, theme, logger) {
  const regexp = START_RX(theme)
  const found = html.match(regexp)

  if (found) {
    logger.debug(` > Use regexp to find pre/code blocks from shiki: ${regexp}`)
    logger.debug(' > Found:' + found[0])
  } else {
    logger.error(` > Use regexp to find pre/code blocks from shiki: ${regexp}`)
    logger.error(' > Not found by regexp:\n' + html)
  }
  // logger.debug(found ? found[0] : ' > Nnot found:\n' + html)

  html = html.replace(regexp, '')
  html = html.slice(0, -END.length)
  return html
}

function extractBackgroundColor (highlighter, theme) {
  return highlighter.getBackgroundColor(theme)
}

function getHighlightedLines (opts, logger) {
  let highlightedLines = []

  if (opts.number_lines && opts.highlight_lines) {
    logger.debug(' > highlight-lines: ' + opts.highlight_lines)
    highlightedLines = opts.highlight_lines.map((curLine) => {
      return {
        line: curLine,
        classes: [HIGHLIGHT_CLASS],
      }
    })
  }

  return highlightedLines
}

function calculateTheme (node, siteTheme) {
  if (node.hasAttribute('theme')) {
    return node.getAttribute('theme')
  }

  return node.document.getAttribute('shiki-theme') || siteTheme
}

function calculateLineNumbers (node, opts, config) {
  if (node.getAttribute('linenums') === 'nolinenums') {
    return false
  }

  const siteLevelLineNumbers = config.useLineNumbers || false
  const pageLevelLineNumbers = node.document.getAttribute('shiki-line-numbers')
  const blockLevelLineNumbers = opts.number_lines ? !!opts.number_lines : undefined

  return toBoolean(blockLevelLineNumbers ?? pageLevelLineNumbers ?? siteLevelLineNumbers)
}

function calculateLineNumberColor (backgroundColor, highlighter, theme, config = {}) {
  // Allow override from config
  if (config.lineNumberColor) return config.lineNumberColor

  // Convert hex to RGB
  const r = parseInt(backgroundColor.substr(1, 2), 16)
  const g = parseInt(backgroundColor.substr(3, 2), 16)
  const b = parseInt(backgroundColor.substr(5, 2), 16)

  // Calculate brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness < 128 ? adjustBrightness(backgroundColor, 200) : adjustBrightness(backgroundColor, -100)
}

function adjustBrightness (hex, percent) {
  let r = parseInt(hex.substr(1, 2), 16)
  let g = parseInt(hex.substr(3, 2), 16)
  let b = parseInt(hex.substr(5, 2), 16)

  r = parseInt(r * (100 + percent) / 100, 10)
  g = parseInt(g * (100 + percent) / 100, 10)
  b = parseInt(b * (100 + percent) / 100, 10)

  r = (r < 255) ? r : 255
  g = (g < 255) ? g : 255
  b = (b < 255) ? b : 255

  const rr = (r.toString(16).length === 1) ? '0' + r.toString(16) : r.toString(16)
  const gg = (g.toString(16).length === 1) ? '0' + g.toString(16) : g.toString(16)
  const bb = (b.toString(16).length === 1) ? '0' + b.toString(16) : b.toString(16)

  return '#' + rr + gg + bb
}

function moveConumsInsidePreviousLineSpan (xmlString, logger) {
  const dom = new JSDOM(xmlString)
  const document = dom.window.document

  document.querySelectorAll('i.conum').forEach((icon) => {
    const prevSpan = icon.previousElementSibling
    if (prevSpan && prevSpan.tagName === 'SPAN') {
      const bold = icon.nextSibling.tagName === 'B' ? icon.nextSibling : null
      prevSpan.appendChild(icon)
      logger.warn(' > Conum: ' + icon)
      if (bold) {
        prevSpan.appendChild(bold)
        logger.warn(' > Conum: ' + bold)
      }
    }
  })

  return dom.serialize()
}

function toBoolean (value) {
  if (typeof value === 'string') {
    return value.toLowerCase().trim() === 'true'
  }
  return !!value // Convert to boolean if not a string
}

module.exports = ShikiSyntaxHighlighter
