const defaultTheme = 'nord'
const defaultLanguages = ['asciidoc', 'java', 'js', 'shell', 'bash', 'console', 'zsh', 'yaml', 'xml', 'diff']
const defaultUseLineNumbers = false

function validateConfig (config, packageName, logger) {
  const {
    theme = defaultTheme,
    themes = [],
    languages = defaultLanguages,
    useLineNumbers = defaultUseLineNumbers,
    registerLanguages = [],
    ...unknownOptions
  } = config

  if (Object.keys(unknownOptions).length) {
    const unrecognizedOptions = Object.keys(unknownOptions).join(', ')
    throw new Error(`Unrecognized options specified for ${packageName}: ${unrecognizedOptions}`)
  }

  let newThemes = themes
  if (newThemes.length > 0) {
    newThemes.unshift(theme)
    newThemes = themes.filter((value, index, self) => self.indexOf(value) === index)
  }

  const validatedConfig = {
    theme,
    themes: newThemes,
    languages,
    useLineNumbers,
    registerLanguages,
  }

  logger.info(`Registering ${packageName} with config`)
  logger.info(` > Default Theme: ${validatedConfig.theme}`)
  logger.info(` > Themes to load: ${Array.from(validatedConfig.themes).join(', ')}`)
  logger.info(` > Supported languages: ${Array.from(validatedConfig.languages).sort().join(', ')}`)
  logger.info(` > Use line numbers: ${validatedConfig.useLineNumbers}`)

  return validatedConfig
}

module.exports = validateConfig
