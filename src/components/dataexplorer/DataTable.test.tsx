/// <reference types="vitest" />

/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react'
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
    expect(
      screen.getByText((content) => content.includes('12') && content.includes('500')),
    ).toBeTruthy()
    expect(screen.getByText(/42 lignes correspondantes/i)).toBeTruthy()
    expect(screen.getByText('Source test')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Rechercher dans les colonnes texte'), {
      target: { value: 'Lyon' },
    })
    fireEvent.click(screen.getByText('Suivant'))

    expect(onSearchQueryChange).toHaveBeenCalledWith('Lyon')
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('sorts locally with inline arrows and applies typed local filters', () => {
    const { container } = render(
      <DataTable
        columns={[
          { key: 'name', label: 'Nom de colonne très longue pour tester le header', type: 'text' },
          { key: 'amount', label: 'Montant', type: 'number' },
          { key: 'createdAt', label: 'Date', type: 'date' },
        ]}
        rows={[
          { name: 'Beta', amount: 20, createdAt: '2024-02-10' },
          { name: 'Alpha', amount: 10, createdAt: '2024-01-05' },
          { name: 'Gamma', amount: 30, createdAt: '2024-03-15' },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /trier montant par ordre croissant/i }))

    const rowsAfterAscendingSort = within(container).getAllByRole('row')
    expect(rowsAfterAscendingSort[2].textContent).toContain('Alpha')

    fireEvent.click(screen.getByRole('button', { name: /trier montant par ordre croissant/i }))

    const rowsAfterDescendingSort = within(container).getAllByRole('row')
    expect(rowsAfterDescendingSort[2].textContent).toContain('Gamma')

    fireEvent.change(screen.getByPlaceholderText('Min'), {
      target: { value: '15' },
    })
    fireEvent.change(screen.getByLabelText('Date à partir du'), {
      target: { value: '2024-02-01' },
    })

    expect(screen.queryByText('Alpha')).toBeNull()
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.getByText('Gamma')).toBeTruthy()
    expect(screen.getByText('10-02-2024')).toBeTruthy()
  })
})
