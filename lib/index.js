'use strict'

const ospath = require('path')
const toProc = require('./utils/to-proc')

const { name: packageName } = require('../package.json')
const ShikiSyntaxHighlighter = require('./shiki/ShikiSyntaxHighlighter')
const validateConfig = require('./utils/validate-config')
const { assetFile, partialFile } = require('./utils/asset-utils')
const { createHighlighter } = require('./shiki/highlighter-factory')

let extensionContext

function register ({ config, playbook }) {
  const logger = this.getLogger(packageName)
  const validatedConfig = validateConfig(config, packageName, logger)

  extensionContext = {
    logger,
    playbook,
    config: validatedConfig,
  }

  extensionContext.logger = logger
  extensionContext.config = validatedConfig

  this.on('contentClassified', async ({ siteAsciiDocConfig }) => {
    extensionContext.highlighter = await createHighlighter(extensionContext)

    ShikiSyntaxHighlighter.setContext(extensionContext)

    const register = { register: asciidoctorRegister }
    siteAsciiDocConfig.extensions
      ? siteAsciiDocConfig.extensions.push(register)
      : (siteAsciiDocConfig.extensions = [register])
  })

  this.on('uiLoaded', async ({ playbook, uiCatalog }) => {
    logger.info('Handle UICatalog files ...')

    const { uiOutputDir, cacheDir = './.cache/antora' } = getDirectories(playbook)
    extensionContext.playbook = playbook
    extensionContext.uiCatalog = uiCatalog
    extensionContext.uiOutputDir = uiOutputDir
    extensionContext.cacheDir = cacheDir
    extensionContext.extensionCacheDir = ospath.join(cacheDir, '..', packageName)

    await processAssets(extensionContext)
  })
}

async function processAssets (extensionContext) {
  copyShikiStyleCss(extensionContext)
  copyShikiStyleHbs(extensionContext)
}

function copyShikiStyleCss (extensionContext) {
  const { uiCatalog, uiOutputDir, logger } = extensionContext

  const basename = 'shiki.css'
  const cssDir = 'css'
  assetFile(packageName, uiCatalog, logger, uiOutputDir, cssDir, basename)
}

function copyShikiStyleHbs (extensionContext) {
  const { uiCatalog, uiOutputDir, logger } = extensionContext

  const basename = 'shiki-styles.hbs'
  const assetDir = 'partials'

  partialFile(packageName, uiCatalog, logger, uiOutputDir, assetDir, basename)
}

function getDirectories (playbook) {
  return {
    uiOutputDir: playbook.ui.outputDir,
    cacheDir: playbook.runtime.cacheDir,
  }
}

function asciidoctorRegister (registry) {
  if (!registry) return this.register('antora-shiki-extension', createExtensionGroup(registry))
  registry.$groups().$store('antora-shiki-extension', toProc(createExtensionGroup(registry)))
  return registry
}

function createExtensionGroup (registry) {
  return function () {
    const clazz = registry.$$class
    const extensionsModule = clazz.$$base_module
    const AsciidoctorModule = extensionsModule.$$base_module
    const SyntaxHighlighterRegistry = AsciidoctorModule.$$.SyntaxHighlighter
    SyntaxHighlighterRegistry.register('shiki', ShikiSyntaxHighlighter)
  }
}

module.exports = { register }
