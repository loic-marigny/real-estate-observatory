/// <reference types="vitest" />
/// <reference types="vite/client" />

/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('echarts-for-react', () => ({
  default: () => <div data-testid="echarts" />,
}))

vi.mock('../services/filosofiDataService', () => ({
  queryFilosofiTrend: vi.fn(),
  FILOSOFI_TREND_INDICATORS: ['median_income', 'd1_income', 'd9_income'],
}))

vi.mock('../services/dvfService', () => ({
  queryDvfTrend: vi.fn(),
}))

import EvolutionChartsSection from './EvolutionChartsSection'
import { queryFilosofiTrend } from '../services/filosofiDataService'
import { queryDvfTrend } from '../services/dvfService'

const mockQueryFilosofiTrend = vi.mocked(queryFilosofiTrend)
const mockQueryDvfTrend = vi.mocked(queryDvfTrend)

describe('EvolutionChartsSection', () => {
  it('renders the description and loads trend data for both FiLoSoFi and DVF', async () => {
    mockQueryFilosofiTrend.mockResolvedValue({
      availableYears: [2017, 2018, 2023],
      geographyLevel: 'commune',
      departmentSource: 'official',
      series: [
        {
          indicator: 'median_income',
          label: 'Revenu médian',
          points: [
            { year: 2017, value: 21000 },
            { year: 2018, value: 22000 },
            { year: 2023, value: 24000 },
          ],
        },
        {
          indicator: 'd1_income',
          label: 'Décile D1 (10% plus pauvres)',
          points: [
            { year: 2017, value: 10000 },
            { year: 2018, value: 10500 },
            { year: 2023, value: 11000 },
          ],
        },
        {
          indicator: 'd9_income',
          label: 'Décile D9 (10% plus riches)',
          points: [
            { year: 2017, value: 50000 },
            { year: 2018, value: 52000 },
            { year: 2023, value: 55000 },
          ],
        },
      ],
    })

    mockQueryDvfTrend.mockResolvedValue({
      availableYears: [2021, 2022, 2023, 2024],
      points: [
        {
          year: 2021,
          medianPricePerSquareMeter: 2350.0,
        },
        {
          year: 2022,
          medianPricePerSquareMeter: 2480.0,
        },
        {
          year: 2023,
          medianPricePerSquareMeter: 2550.0,
        },
        {
          year: 2024,
          medianPricePerSquareMeter: 2622.95,
        },
      ],
    })

    render(
      <EvolutionChartsSection description="Test description for income and real estate trends." />,
    )

    expect(screen.getByText(/Test description for income and real estate trends/)).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('Revenus (FiLoSoFi)')).toBeTruthy()
    })

    expect(screen.getByText('Prix immobilier (DVF)')).toBeTruthy()
    expect(screen.getByText('Revenu médian')).toBeTruthy()
    expect(screen.getByText('Prix médian au m²')).toBeTruthy()

    const echartsElements = screen.getAllByTestId('echarts')
    expect(echartsElements.length).toBe(2)
  })
})
