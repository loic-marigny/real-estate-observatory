/// <reference types="vitest" />

/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FilosofiQueryPanel } from './FilosofiQueryPanel'

describe('FilosofiQueryPanel', () => {
  it('renders controls without the results table and hides the sort filter', () => {
    const onYearChange = vi.fn()

    render(
      <FilosofiQueryPanel
        years={[2021, 2023]}
        selectedYear={2023}
        onYearChange={onYearChange}
        geographyLevel="commune"
        onGeographyLevelChange={vi.fn()}
        departmentSource="official"
        onDepartmentSourceChange={vi.fn()}
        indicators={[
          {
            indicator: 'median_income',
            label: 'Revenu médian',
            available: true,
            coverage: 100,
            official: true,
            indicatorSource: 'test',
            comparableWithPreviousYears: true,
          },
        ]}
        selectedIndicator="median_income"
        onIndicatorChange={vi.fn()}
        warnings={['Test warning']}
      />,
    )

    expect(screen.getByText('Année')).toBeTruthy()
    expect(screen.getByText('Indicateur')).toBeTruthy()
    expect(screen.queryByText('Tri')).toBeNull()
    expect(screen.getByText('Test warning')).toBeTruthy()
    expect(screen.queryByText(/Requête exécutée sur/i)).toBeNull()

    fireEvent.change(screen.getByDisplayValue('2023'), {
      target: { value: '2021' },
    })

    expect(onYearChange).toHaveBeenCalledWith(2021)
  })
})
