import type { BusinessDatasetId } from './datasetRegistry'
import type {
  DatasetColumn,
  DatasetColumnFilterKind,
  DatasetColumnType,
} from '../types/dataExplorer'

type ColumnMetadata = Pick<
  DatasetColumn,
  'label' | 'description' | 'type' | 'filterKind'
>

type ColumnScope = BusinessDatasetId | 'filosofi-query'

const textColumn = (
  label: string,
  description: string,
  filterKind: DatasetColumnFilterKind = 'text',
): ColumnMetadata => ({
  label,
  description,
  type: 'text',
  filterKind,
})

const numberColumn = (
  label: string,
  description: string,
  filterKind: DatasetColumnFilterKind = 'number-range',
): ColumnMetadata => ({
  label,
  description,
  type: 'number',
  filterKind,
})

const dateColumn = (label: string, description: string): ColumnMetadata => ({
  label,
  description,
  type: 'date',
  filterKind: 'date-range',
})

const booleanColumn = (label: string, description: string): ColumnMetadata => ({
  label,
  description,
  type: 'boolean',
  filterKind: 'boolean-select',
})

const DVF_COLUMNS: Record<string, ColumnMetadata> = {
  id_mutation: textColumn('Identifiant de mutation', 'Identifiant technique de la mutation immobilière dans la source DVF.'),
  date_mutation: dateColumn('Date de mutation', 'Date de signature ou d’enregistrement de la mutation dans DVF.'),
  numero_disposition: textColumn('Numéro de disposition', 'Repère interne de la disposition au sein de la mutation.'),
  nature_mutation: textColumn('Nature de mutation', 'Type d’opération immobilière enregistré, par exemple vente ou adjudication.'),
  valeur_fonciere: numberColumn('Valeur foncière', 'Montant de la transaction déclaré dans DVF, exprimé en euros.'),
  adresse_numero: textColumn('Numéro de voie', 'Numéro de l’adresse du bien lorsqu’il est renseigné.'),
  adresse_suffixe: textColumn('Suffixe de voie', 'Complément du numéro de voie, par exemple bis ou ter.'),
  adresse_nom_voie: textColumn('Nom de voie', 'Nom de la rue, avenue ou voie associée au bien.'),
  adresse_code_voie: textColumn('Code voie', 'Code de voie fourni dans la source DVF.'),
  code_postal: textColumn('Code postal', 'Code postal associé à l’adresse du bien.'),
  code_commune: textColumn('Code commune', 'Code INSEE de la commune du bien.'),
  nom_commune: textColumn('Commune', 'Nom de la commune du bien.'),
  code_departement: textColumn('Code département', 'Code du département du bien.'),
  ancien_code_commune: textColumn('Ancien code commune', 'Ancien code INSEE de commune lorsque la mutation fait référence à un code historique.'),
  ancien_nom_commune: textColumn('Ancien nom commune', 'Ancien nom de commune lorsqu’un libellé historique est présent dans la source.'),
  id_parcelle: textColumn('Identifiant de parcelle', 'Référence cadastrale de la parcelle concernée.'),
  ancien_id_parcelle: textColumn('Ancien identifiant de parcelle', 'Référence cadastrale historique si la source renseigne une ancienne parcelle.'),
  numero_volume: textColumn('Numéro de volume', 'Repère de volume utilisé pour certains biens en copropriété.'),
  lot1_numero: textColumn('Lot 1', 'Numéro du premier lot associé à la mutation.'),
  lot2_numero: textColumn('Lot 2', 'Numéro du deuxième lot associé à la mutation.'),
  lot3_numero: textColumn('Lot 3', 'Numéro du troisième lot associé à la mutation.'),
  lot4_numero: textColumn('Lot 4', 'Numéro du quatrième lot associé à la mutation.'),
  lot5_numero: textColumn('Lot 5', 'Numéro du cinquième lot associé à la mutation.'),
  lot1_surface_carrez: numberColumn('Surface Carrez lot 1', 'Surface Carrez du premier lot, lorsqu’elle est disponible.'),
  lot2_surface_carrez: numberColumn('Surface Carrez lot 2', 'Surface Carrez du deuxième lot, lorsqu’elle est disponible.'),
  lot3_surface_carrez: numberColumn('Surface Carrez lot 3', 'Surface Carrez du troisième lot, lorsqu’elle est disponible.'),
  lot4_surface_carrez: numberColumn('Surface Carrez lot 4', 'Surface Carrez du quatrième lot, lorsqu’elle est disponible.'),
  lot5_surface_carrez: numberColumn('Surface Carrez lot 5', 'Surface Carrez du cinquième lot, lorsqu’elle est disponible.'),
  nombre_lots: numberColumn('Nombre de lots', 'Nombre de lots enregistrés pour la mutation.'),
  code_type_local: textColumn('Code type de local', 'Code interne DVF décrivant la catégorie du local.'),
  type_local: textColumn('Type de local', 'Catégorie du bien, par exemple maison, appartement ou dépendance.'),
  surface_reelle_bati: numberColumn('Surface bâtie', 'Surface réelle bâtie du bien, exprimée en mètres carrés.'),
  nombre_pieces_principales: numberColumn('Pièces principales', 'Nombre de pièces principales déclaré pour le bien.'),
  code_nature_culture: textColumn('Code nature de culture', 'Code cadastral de la nature de culture de la parcelle.'),
  nature_culture: textColumn('Nature de culture', 'Libellé cadastral de la nature de culture de la parcelle.'),
  code_nature_culture_speciale: textColumn('Code nature spéciale', 'Code cadastral complémentaire de nature de culture spéciale.'),
  nature_culture_speciale: textColumn('Nature spéciale', 'Libellé cadastral complémentaire de nature de culture spéciale.'),
  surface_terrain: numberColumn('Surface terrain', 'Surface de terrain rattachée au bien, exprimée en mètres carrés.'),
  longitude: numberColumn('Longitude', 'Longitude géographique du bien lorsque la géolocalisation est disponible.'),
  latitude: numberColumn('Latitude', 'Latitude géographique du bien lorsque la géolocalisation est disponible.'),
  year: numberColumn('Millésime', 'Année du jeu de données DVF utilisé pour la ligne affichée.'),
  price_m2: numberColumn('Prix au m²', 'Rapport entre la valeur foncière et la surface bâtie retenue pour la ligne.'),
}

const FILOSOFI_PREVIEW_COLUMNS: Record<string, ColumnMetadata> = {
  year: numberColumn('Millésime', 'Année du millésime FiLoSoFi.'),
  geography_level: textColumn('Maille', 'Niveau géographique de la ligne, par exemple commune ou département.'),
  commune_code: textColumn('Code commune', 'Code INSEE de la commune lorsque la ligne est communale.'),
  department_code: textColumn('Code département', 'Code du département associé à la ligne.'),
  commune_name: textColumn('Commune', 'Nom de la commune lorsque la ligne est communale.'),
  source_generation: textColumn('Génération source', 'Version de préparation interne utilisée pour produire le fichier publié.'),
  dispositif: textColumn('Dispositif', 'Version de la chaîne FiLoSoFi mobilisée pour produire la donnée.'),
  source_type: textColumn('Type de source', 'Nature du fichier source exploité pour constituer la ligne.'),
  source_file: textColumn('Fichier source', 'Nom du fichier source d’origine ayant alimenté la ligne.'),
  extracted_file: textColumn('Fichier extrait', 'Nom du fichier intermédiaire extrait ou préparé pour le pipeline.'),
  geo_object: textColumn('Objet géographique', 'Identifiant ou libellé géographique utilisé dans la préparation des données.'),
  median_income: numberColumn('Revenu médian', 'Niveau de vie médian publié dans FiLoSoFi.'),
  d1_income: numberColumn('Décile D1', 'Seuil en dessous duquel se situent 10 % des niveaux de vie.'),
  d2_income: numberColumn('Décile D2', 'Deuxième décile des niveaux de vie.'),
  d3_income: numberColumn('Décile D3', 'Troisième décile des niveaux de vie.'),
  d4_income: numberColumn('Décile D4', 'Quatrième décile des niveaux de vie.'),
  d5_income: numberColumn('Médiane', 'Cinquième décile, équivalent de la médiane lorsqu’il est publié.'),
  d6_income: numberColumn('Décile D6', 'Sixième décile des niveaux de vie.'),
  d7_income: numberColumn('Décile D7', 'Septième décile des niveaux de vie.'),
  d8_income: numberColumn('Décile D8', 'Huitième décile des niveaux de vie.'),
  d9_income: numberColumn('Décile D9', 'Seuil au-dessus duquel se situent les 10 % des niveaux de vie les plus élevés.'),
  poverty_rate: numberColumn('Taux de pauvreté', 'Part de la population vivant sous le seuil de pauvreté monétaire.'),
  tax_households: numberColumn('Ménages fiscaux', 'Nombre de ménages fiscaux pris en compte dans la source.'),
  population: numberColumn('Population', 'Population couverte par la ligne publiée.'),
}

const FILOSOFI_QUERY_COLUMNS: Record<string, ColumnMetadata> = {
  geographyCode: textColumn('Code', 'Code géographique INSEE correspondant à la ligne affichée.'),
  geographyName: textColumn('Libellé', 'Nom de la commune ou du département correspondant à la ligne affichée.'),
  indicatorValue: numberColumn('Valeur', 'Valeur de l’indicateur FiLoSoFi sélectionné pour cette ligne.'),
  indicatorSource: textColumn('Source', 'Origine de l’indicateur, par exemple officielle ou dérivée.'),
  isOfficial: booleanColumn('Officiel', 'Indique si la valeur provient d’une série officielle publiée telle quelle.'),
  methodologyVersion: textColumn('Version méthodologique', 'Version de méthode utilisée pour produire la valeur.'),
  comparableWithPreviousYears: booleanColumn('Comparable aux années précédentes', 'Indique si la valeur est comparable avec les millésimes précédents sans rupture méthodologique.'),
}

const COLUMN_METADATA_BY_SCOPE: Record<ColumnScope, Record<string, ColumnMetadata>> = {
  dvf: DVF_COLUMNS,
  filosofi: FILOSOFI_PREVIEW_COLUMNS,
  'filosofi-query': FILOSOFI_QUERY_COLUMNS,
}

export const getColumnMetadata = (
  scope: ColumnScope,
  key: string,
): ColumnMetadata | null => COLUMN_METADATA_BY_SCOPE[scope][key] ?? null

export const resolveColumnDefinition = ({
  fallbackDescription = null,
  fallbackFilterKind,
  fallbackLabel,
  fallbackType,
  key,
  scope,
}: {
  scope: ColumnScope
  key: string
  fallbackLabel: string
  fallbackDescription?: string | null
  fallbackType: DatasetColumnType
  fallbackFilterKind?: DatasetColumnFilterKind
}): DatasetColumn => {
  const metadata = getColumnMetadata(scope, key)

  return {
    key,
    label: metadata?.label ?? fallbackLabel,
    description: metadata?.description ?? fallbackDescription,
    type: metadata?.type ?? fallbackType,
    filterKind: metadata?.filterKind ?? fallbackFilterKind,
  }
}
