import { useEffect, useRef } from 'react'

type CustomSelectOption = {
  label: string
  value: string | number
}

type CustomSelectFieldProps = {
  label: string
  value: string | number | null
  options: CustomSelectOption[]
  isOpen: boolean
  placeholder?: string
  onToggle: () => void
  onClose: () => void
  onChange: (value: string | number) => void
}

export function CustomSelectField({
  label,
  value,
  options,
  isOpen,
  placeholder = 'Sélectionner',
  onToggle,
  onClose,
  onChange,
}: CustomSelectFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selectedOption = options.find((option) => option.value === value) ?? null

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current) {
        return
      }

      if (!containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    window.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [onClose])

  return (
    <div className="page-size-selector" ref={containerRef}>
      <span className="search-bar__label">{label}</span>
      <button
        type="button"
        className={`page-size-selector__select page-size-selector__select--custom${
          isOpen ? ' page-size-selector__select--open' : ''
        }`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedOption?.label ?? placeholder}</span>
        <span className="page-size-selector__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {isOpen ? (
        <div className="page-size-selector__menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`page-size-selector__option${
                option.value === value ? ' page-size-selector__option--selected' : ''
              }`}
              onClick={() => {
                onChange(option.value)
                onClose()
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
