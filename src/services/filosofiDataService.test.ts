import { describe, expect, it } from 'vitest'

import {
  buildFilosofiQuery,
  getAvailabilityLevelKey,
  getAvailableIndicatorsFromAvailability,
  normalizeFilosofiIndicatorAvailability,
  normalizeFilosofiMetadata,
  resolveFilosofiQueryAsset,
} from './filosofiDataService'

describe('filosofiDataService', () => {
  const availability = normalizeFilosofiIndicatorAvailability({
    2017: {
      commune: {
        median_income: { available: true, coverage: 0.89, official: true },
        d1_income: { available: true, coverage: 0.15, official: true },
        d2_income: { available: false, coverage: 0, official: true },
        d3_income: { available: false, coverage: 0, official: true },
        d4_income: { available: false, coverage: 0, official: true },
        d5_income: { available: false, coverage: 0, official: true },
        d6_income: { available: false, coverage: 0, official: true },
        d7_income: { available: false, coverage: 0, official: true },
        d8_income: { available: false, coverage: 0, official: true },
        d9_income: { available: true, coverage: 0.15, official: true },
        poverty_rate: { available: true, coverage: 0.12, official: true },
      },
      department_official: {
        median_income: { available: true, coverage: 1, official: true },
      },
      department_derived: {},
    },
    2023: {
      commune: {
        median_income: { available: true, coverage: 0.8857, official: true },
        d1_income: { available: false, coverage: 0, official: true },
        d2_income: { available: false, coverage: 0, official: true },
        d3_income: { available: false, coverage: 0, official: true },
        d4_income: { available: false, coverage: 0, official: true },
        d5_income: { available: false, coverage: 0, official: true },
        d6_income: { available: false, coverage: 0, official: true },
        d7_income: { available: false, coverage: 0, official: true },
        d8_income: { available: false, coverage: 0, official: true },
        d9_income: { available: false, coverage: 0, official: true },
        poverty_rate: { available: true, coverage: 0.0714, official: true },
      },
      department_official: {
        median_income: { available: true, coverage: 1, official: true },
        d1_income: { available: true, coverage: 1, official: true },
      },
      department_derived: {},
    },
    2018: {
      commune: {
        median_income: { available: true, coverage: 1, official: true },
      },
      department_official: {},
      department_derived: {
        median_income: {
          available: true,
          coverage: 1,
          official: false,
          indicator_source: 'derived_from_communes',
        },
      },
    },
  })

  it('reads years from metadata and keeps 2022 missing', () => {
    const metadata = normalizeFilosofiMetadata({
      source: 'INSEE FiLoSoFi',
      available_years: [2017, 2018, 2019, 2020, 2021, 2023],
      missing_years: [2022],
      methodology_breaks: [
        {
          year: 2023,
          label: 'Passage à Filosofi 2',
          comparable_to_previous_year: false,
        },
      ],
      datasets: {
        commune_all_years: 'gold/filosofi/commune_all_years.parquet',
        department_official_all_years:
          'gold/filosofi/department_official/department_all_years.parquet',
        department_derived_all_years:
          'gold/filosofi/department_derived/department_all_years.parquet',
        indicator_availability: 'gold/filosofi/indicator_availability.json',
      },
    })

    expect(metadata.availableYears).toEqual([2017, 2018, 2019, 2020, 2021, 2023])
    expect(metadata.missingYears).toEqual([2022])
  })

  it('hides D2 to D8 in 2017 commune availability', () => {
    const indicators = getAvailableIndicatorsFromAvailability(
      availability,
      2017,
      'commune',
    )

    expect(indicators.map((item) => item.indicator)).toEqual([
      'median_income',
      'd1_income',
      'd9_income',
      'poverty_rate',
    ])
  })

  it('disables commune deciles in 2023', () => {
    const indicators = getAvailableIndicatorsFromAvailability(
      availability,
      2023,
      'commune',
    )

    expect(indicators.map((item) => item.indicator)).toEqual([
      'median_income',
      'poverty_rate',
    ])
  })

  it('distinguishes department official and derived buckets', () => {
    expect(getAvailabilityLevelKey('department', 'official')).toBe(
      'department_official',
    )
    expect(getAvailabilityLevelKey('department', 'derived')).toBe(
      'department_derived',
    )
    expect(resolveFilosofiQueryAsset('department', 'official')).toContain(
      'department_official',
    )
    expect(resolveFilosofiQueryAsset('department', 'derived')).toContain(
      'department_derived',
    )
  })

  it('builds targeted SQL without SELECT * and with validated columns', () => {
    const built = buildFilosofiQuery(
      {
        year: 2023,
        geographyLevel: 'commune',
        indicator: 'median_income',
        limit: 20,
        offset: 40,
        search: 'Paris',
        sortBy: 'geography_name',
        sortDirection: 'asc',
      },
      'https://assets.example/gold/filosofi/commune_all_years.parquet',
    )

    expect(built.sql).toContain('FROM read_parquet(')
    expect(built.sql).toContain('median_income AS indicator_value')
    expect(built.sql).toContain('WHERE year = 2023 AND median_income IS NOT NULL')
    expect(built.sql).toContain('LIMIT 20')
    expect(built.sql).toContain('OFFSET 40')
    expect(built.sql).toContain('ORDER BY geography_name ASC NULLS LAST')
    expect(built.sql).not.toContain('SELECT *')
  })

  it('rejects unsupported sort columns', () => {
    expect(() =>
      buildFilosofiQuery(
        {
          year: 2021,
          geographyLevel: 'commune',
          indicator: 'median_income',
          sortBy: 'drop table x',
        },
        'https://assets.example/gold/filosofi/commune_all_years.parquet',
      ),
    ).toThrow(/Unsupported sort column/)
  })
})
