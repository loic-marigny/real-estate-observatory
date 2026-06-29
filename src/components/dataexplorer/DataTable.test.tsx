/// <reference types="vitest" />

/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTable } from './DataTable'

describe('DataTable', () => {
  it('renders the standardized remote mode from columns and rows', () => {
    const onSearchQueryChange = vi.fn()
    const onPageChange = vi.fn()
    const onPageSizeChange = vi.fn()

    render(
      <DataTable
        mode="remote"
        columns={[
          { key: 'city', label: 'Commune', type: 'text' },
          { key: 'value', label: 'Valeur', type: 'number' },
        ]}
        rows={[
          { city: 'Paris', value: 12_500 },
          { city: 'Lyon', value: 9_800 },
        ]}
        searchQuery=""
        onSearchQueryChange={onSearchQueryChange}
        pageSize={20}
        page={1}
        totalRows={42}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        footnote="Source test"
      />,
    )

    expect(screen.getByText('Commune')).toBeTruthy()
    expect(screen.getByText('Valeur')).toBeTruthy()
    expect(screen.getByText('Paris')).toBeTruthy()
    expect(screen.getByText((content) => content.includes('12') && content.includes('500'))).toBeTruthy()
    expect(screen.getByText(/42 lignes correspondantes/i)).toBeTruthy()
    expect(screen.getByText('Source test')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Rechercher dans les colonnes texte'), {
      target: { value: 'Lyon' },
    })
    fireEvent.click(screen.getByText('Suivant'))

    expect(onSearchQueryChange).toHaveBeenCalledWith('Lyon')
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})
