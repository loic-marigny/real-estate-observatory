const REPAIR_REPLACEMENTS: Array<[string | RegExp, string]> = [
  ['â€™', '’'],
  ['â€˜', '‘'],
  ['â€œ', '“'],
  ['â€', '”'],
  ['â€¦', '…'],
  ['â€“', '–'],
  ['â€”', '—'],
  ['â†‘', '↑'],
  ['â†“', '↓'],
  ['â‚¬', '€'],
  ['Â²', '²'],
  ['Â·', '·'],
  ['Ã€', 'À'],
  ['Ã‚', 'Â'],
  ['Ã„', 'Ä'],
  ['Ã‡', 'Ç'],
  ['Ãˆ', 'È'],
  ['Ã‰', 'É'],
  ['ÃŠ', 'Ê'],
  ['Ã‹', 'Ë'],
  ['ÃŽ', 'Î'],
  ['ÃÏ', 'Ï'],
  ['Ã”', 'Ô'],
  ['Ã–', 'Ö'],
  ['Ã™', 'Ù'],
  ['Ã›', 'Û'],
  ['Ãœ', 'Ü'],
  ['Ã ', 'à'],
  ['Ã¢', 'â'],
  ['Ã¤', 'ä'],
  ['Ã§', 'ç'],
  ['Ã¨', 'è'],
  ['Ã©', 'é'],
  ['Ãª', 'ê'],
  ['Ã«', 'ë'],
  ['Ã®', 'î'],
  ['Ã¯', 'ï'],
  ['Ã´', 'ô'],
  ['Ã¶', 'ö'],
  ['Ã¹', 'ù'],
  ['Ã»', 'û'],
  ['Ã¼', 'ü'],
]

const FRENCH_WORD_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bdepartement\b/gi, 'département'],
  [/\bdepartements\b/gi, 'départements'],
  [/\bfonciere\b/gi, 'foncière'],
  [/\bfoncieres\b/gi, 'foncières'],
  [/\bnumero\b/gi, 'numéro'],
  [/\bbati\b/gi, 'bâti'],
  [/\bbatir\b/gi, 'bâtir'],
  [/\bagrement\b/gi, 'agrément'],
  [/\bmetadonnees\b/gi, 'métadonnées'],
  [/\bapercu\b/gi, 'aperçu'],
  [/\bselectionne\b/gi, 'sélectionné'],
  [/\blibelle\b/gi, 'libellé'],
  [/\bannee\b/gi, 'année'],
  [/\bannees\b/gi, 'années'],
  [/\breference\b/gi, 'référence'],
  [/\bresume\b/gi, 'résumé'],
]

const PREVIEW_VALUE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bterrains a bâtir\b/gi, 'terrains à bâtir'],
]

export const repairText = (value: string): string =>
  REPAIR_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replaceAll(pattern as never, replacement),
    value,
  )

export const normalizeFrenchDisplayText = (value: string): string =>
  FRENCH_WORD_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    repairText(value),
  )

export const formatPreviewLabel = (key: string, label: string): string => {
  const source = label.trim() || key.replaceAll('_', ' ')
  return normalizeFrenchDisplayText(source)
}

export const normalizePreviewValue = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value
  }

  return PREVIEW_VALUE_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) =>
      normalizeFrenchDisplayText(current).replace(pattern, replacement),
    value,
  )
}
