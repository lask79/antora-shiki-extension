const fs = require('fs')
const ospath = require('path')

// Async function to create a syntax highlighter using the Shiki library
async function createHighlighter ({ logger, config, playbook }) {
  // Log the process of creating the highlighter
  logger.info('Creating shiki highlighter ...')
  const shiki = require('shiki')
  logger.info(' > Instantiate shiki highlighter')

  // Check for the presence of 'asciidoc' in the languages configuration
  const asciidocIncluded = config.languages.includes('asciidoc')

  // Filter out 'asciidoc' from the list of languages
  const filteredLanguages = config.languages.filter((lang) => lang !== 'asciidoc')
  const registerLanguages = config.registerLanguages

  if (registerLanguages.length > 0 || asciidocIncluded) {
    logger.info(' > Register custom language grammar:')
  }

  // If asciidoc is included, load its grammar
  if (asciidocIncluded) {
    const asciidocGrammarPath = ospath.join(__dirname, '../../data/languages/Asciidoctor.json')
    logger.info(`   > asciidoc -> ${asciidocGrammarPath}`)
    const asciidocGrammar = JSON.parse(fs.readFileSync(asciidocGrammarPath, 'utf8'))

    // Add asciidoc language with its configuration
    filteredLanguages.push({
      id: 'asciidoc',
      scopeName: 'text.asciidoc',
      grammar: asciidocGrammar,
      aliases: ['adoc'],
    })
  }

  // Register any additional languages specified in the configuration
  if (registerLanguages.length > 0) {
    for (const language of registerLanguages) {
      // Log and construct language registration information
      const grammarPath = ospath.join(playbook.dir, language.grammarPath)
      logger.info(`   > ${language.id} -> ${grammarPath}`)

      const registerLanguage = {
        id: language.id,
        path: grammarPath,
        scopeName: language.scopeName || '',
        aliases: language.aliases || [],
      }

      // Add the language to the filtered languages list
      filteredLanguages.push(registerLanguage)
    }
  }

  // Configure Shiki highlighter options
  const shikiOptions = {
    langs: filteredLanguages,
    theme: config.themes.length === 0 ? config.theme : undefined,
    themes: config.themes.length > 0 ? config.themes : undefined,
  }

  // Return the instantiated Shiki highlighter
  return await shiki.getHighlighter(shikiOptions)
}

// Export the function
module.exports = { createHighlighter }
