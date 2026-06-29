import type { ReactNode } from 'react'

type SelectFieldProps = {
  label: string
  value: string | number
  disabled?: boolean
  onChange: (value: string) => void
  children: ReactNode
}

export function SelectField({
  label,
  value,
  disabled = false,
  onChange,
  children,
}: SelectFieldProps) {
  return (
    <label className="page-size-selector">
      <span className="search-bar__label">{label}</span>
      <select
        className="page-size-selector__select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  )
}
