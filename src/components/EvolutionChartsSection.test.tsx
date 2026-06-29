/// <reference types="vitest" />
/// <reference types="vite/client" />

/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

vi.mock('echarts-for-react', () => ({
  default: () => <div data-testid="echarts" />,
}))

vi.mock('../services/filosofiNationalSeriesService', () => ({
  queryFilosofiNationalTrend: vi.fn(),
}))

vi.mock('../services/dvfService', () => ({
  queryDvfTrend: vi.fn(),
}))

import EvolutionChartsSection from './EvolutionChartsSection'
import { queryFilosofiNationalTrend } from '../services/filosofiNationalSeriesService'
import { queryDvfTrend } from '../services/dvfService'

const mockQueryFilosofiNationalTrend = vi.mocked(queryFilosofiNationalTrend)
const mockQueryDvfTrend = vi.mocked(queryDvfTrend)

describe('EvolutionChartsSection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    cleanup()
  })

  it('renders one combined chart for official FiLoSoFi national series and DVF', async () => {
    mockQueryFilosofiNationalTrend.mockResolvedValue({
      availableYears: [2018, 2023],
      geographyLevel: 'commune',
      departmentSource: 'official',
      series: [
        {
          indicator: 'median_income',
          label: 'Revenu médian',
          points: [
            { year: 2018, value: 22000 },
            { year: 2023, value: 24000 },
          ],
        },
        {
          indicator: 'd1_income',
          label: 'Décile D1 (10% plus pauvres)',
          points: [
            { year: 2018, value: 10500 },
            { year: 2023, value: 11000 },
          ],
        },
        {
          indicator: 'd9_income',
          label: 'Décile D9 (10% plus riches)',
          points: [
            { year: 2018, value: 52000 },
            { year: 2023, value: 55000 },
          ],
        },
      ],
    })

    mockQueryDvfTrend.mockResolvedValue({
      availableYears: [2014, 2021, 2022, 2023, 2024],
      points: [
        {
          year: 2014,
          medianPricePerSquareMeter: 2100,
          d1PricePerSquareMeter: 1600,
          d9PricePerSquareMeter: 2900,
        },
        {
          year: 2024,
          medianPricePerSquareMeter: 2623,
          d1PricePerSquareMeter: 2000,
          d9PricePerSquareMeter: 3500,
        },
      ],
    })

    render(
      <EvolutionChartsSection description="Test description for income and real estate trends." />,
    )

    await waitFor(() => {
      expect(screen.getByText('Revenus et prix immobiliers')).toBeTruthy()
    })

    expect(screen.getByText('Revenu médian')).toBeTruthy()
    expect(screen.getByText('Prix médian au m²')).toBeTruthy()
    expect(
      screen.getByText(/Revenus : série nationale Insee, France hexagonale/i),
    ).toBeTruthy()
    expect(screen.getAllByTestId('echarts').length).toBe(1)
  })

  it('keeps one combined chart visible when FiLoSoFi loading fails', async () => {
    mockQueryFilosofiNationalTrend.mockRejectedValue(new Error('FiLoSoFi unavailable'))
    mockQueryDvfTrend.mockResolvedValue({
      availableYears: [2023, 2024],
      points: [
        {
          year: 2023,
          medianPricePerSquareMeter: 2550,
          d1PricePerSquareMeter: 1950,
          d9PricePerSquareMeter: 3400,
        },
        {
          year: 2024,
          medianPricePerSquareMeter: 2623,
          d1PricePerSquareMeter: 2000,
          d9PricePerSquareMeter: 3500,
        },
      ],
    })

    render(<EvolutionChartsSection description="Test partial failure." />)

    await waitFor(() => {
      expect(screen.getByText('Revenus et prix immobiliers')).toBeTruthy()
    })

    expect(screen.getByText('Prix médian au m²')).toBeTruthy()
    expect(screen.getAllByTestId('echarts').length).toBe(1)
  })
})
