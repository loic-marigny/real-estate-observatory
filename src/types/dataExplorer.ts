export type DatasetColumnType = 'text' | 'number' | 'date' | 'boolean'

export type DatasetColumnFilterKind =
  | 'text'
  | 'number-range'
  | 'date-range'
  | 'boolean-select'

export type DatasetColumn = {
  key: string
  label: string
  type: DatasetColumnType
  description?: string | null
  filterKind?: DatasetColumnFilterKind
}
