/// <reference types="vitest" />

/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'

import { getBundledAssetUrl } from './dataAssetConfig'

describe('dataAssetConfig', () => {
  it('resolves bundled asset URLs from the current document location', () => {
    window.history.replaceState({}, '', '/real-estate-observatory/')

    expect(getBundledAssetUrl('data/dvf_summary.json')).toBe(
      'http://localhost:3000/real-estate-observatory/data/dvf_summary.json',
    )
  })
})
