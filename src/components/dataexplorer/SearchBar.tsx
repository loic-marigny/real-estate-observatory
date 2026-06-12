type SearchBarProps = {
  query: string
  onQueryChange: (query: string) => void
}

export function SearchBar({ query, onQueryChange }: SearchBarProps) {
  return (
    <label className="search-bar">
      <span className="search-bar__label">Recherche globale</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Rechercher dans les colonnes texte"
        className="search-bar__input"
      />
    </label>
  )
}
