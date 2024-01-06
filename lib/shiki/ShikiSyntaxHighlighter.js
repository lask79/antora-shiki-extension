'use strict'
// const { DOMParser, XMLSerializer } = require('xmldom')
const { JSDOM } = require('jsdom')

// const { logger } = require('handlebars')

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
    const { logger } = ShikiSyntaxHighlighter.extensionContext

    logger.debug('Render source with shiki...')
    logger.debug(' > Source file: ' + node.document.reader.file)

    // this will call the highlight function
    const content = node.getContent()
    const lineNumberClass = this.useLineNumbers ? 'has-line-numbers' : ''
    const backgroundColorStyle = this.backgroundColor ? `style="--shiki-background-color: ${this.backgroundColor};"` : ''
    const startAtLineNumberStyle = this.startNumber ? `--shiki-line-number-start: ${this.startNumber};` : ''
    const lineNumberColorStyle = this.lineNumberColor ? ` --shiki-line-number-color: ${this.lineNumberColor};` : ''
    const lineNumberStyle = `style="${startAtLineNumberStyle}${lineNumberColorStyle}"`

    const newContent = `<pre class="shiki highlight ${this.theme}" ${backgroundColorStyle}><code ${lang ? ` data-lang="${lang}"` : ''} class="shiki ${lineNumberClass}"${lineNumberStyle}>${content}</code></pre>`

    // Use the function with your XML string
    return moveConumsInsidePreviousLineSpan(newContent)
  }

  handlesHighlighting () {
    return true
  }

  highlight (node, source, lang, opts) {
    const { logger, highlighter, config } = ShikiSyntaxHighlighter.extensionContext
    this.useLineNumbers = calculateLineNumbers(node, opts, config)

    this.theme = calculateTheme(node, config.theme)
    this.startNumber = opts.start_line_number || 1

    logger.debug(' > Theme: ' + this.theme)
    logger.debug(' > Use line-numbers: ' + this.useLineNumbers)
    logger.debug(' > Use start-number: ' + this.startNumber)

    try {
      const generatedHtml = highlighter.codeToHtml(source, {
        lang: lang,
        theme: this.theme,
        lineOptions: getHighlightedLines(opts, logger),
      })

      this.backgroundColor = extractBackgroundColor(generatedHtml)
      this.lineNumberColor = calculateLineNumberColor(this.backgroundColor)

      //Leaving the html default results in nested pre/code elements,
      //which is rendered as an unattractive box around the highlighted code.
      return removeGeneratedPreAndCodeTags(generatedHtml, this.theme, logger)
    } catch (e) {
      logger.error(e)
      return source
    }
  }
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

function extractBackgroundColor (html) {
  const regex = /<pre[^>]*style="[^"]*background-color:\s*([^;"]+)/i
  const match = html.match(regex)
  const backgroundColor = match ? match[1] : null
  return backgroundColor
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
  return node.document.getAttribute('shiki-theme') || siteTheme
}

function calculateLineNumbers (node, opts, config) {
  const siteLevelLineNumbers = config.useLineNumbers || false
  const pageLevelLineNumbers = node.document.getAttribute('shiki-line-numbers')
  const blockLevelLineNumbers = !!opts.number_lines

  return siteLevelLineNumbers || pageLevelLineNumbers || blockLevelLineNumbers
}

function calculateLineNumberColor (backgroundColor) {
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

function moveConumsInsidePreviousLineSpan (xmlString) {
  const dom = new JSDOM(xmlString)
  const document = dom.window.document

  document.querySelectorAll('i.conum').forEach((icon) => {
    const prevSpan = icon.previousElementSibling
    if (prevSpan && prevSpan.tagName === 'SPAN') {
      const bold = icon.nextSibling.tagName === 'B' ? icon.nextSibling : null
      prevSpan.appendChild(icon)
      if (bold) {
        prevSpan.appendChild(bold)
      }
    }
  })

  return dom.serialize()
}

module.exports = ShikiSyntaxHighlighter
