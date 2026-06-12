import { useEffect, useState } from 'react'
import type { DvfDepartmentSummary } from '../types/realEstate'

type GeoPoint = [number, number]

type GeoPolygon = GeoPoint[]

type DepartmentFeature = {
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: GeoPoint[][] | GeoPoint[][][]
  }
  properties: {
    code: string
    nom: string
  }
}

type DepartmentFeatureCollection = {
  type: 'FeatureCollection'
  features: DepartmentFeature[]
}

type DepartmentChoroplethProps = {
  departments: DvfDepartmentSummary[]
}

type Bounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type PreparedFeature = {
  code: string
  name: string
  value: number | null
  salesCount: number
  path: string
  centroid: { x: number; y: number }
}

const MAP_URL = '/data/departements.geojson'
const MAINLAND_WIDTH = 760
const MAINLAND_HEIGHT = 660
const INSET_WIDTH = 250
const INSET_HEIGHT = 250
const MAP_PADDING = 18
const IDF_CODES = ['75', '77', '78', '91', '92', '93', '94', '95']
const DEFAULT_FOCUS_CODE = '75'

const formatInteger = (value: number): string =>
  new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(value)

const formatCurrencyPerSquareMeter = (value: number | null): string =>
  value === null ? 'N/A' : `${formatInteger(value)} € / m²`

const extractPolygons = (feature: DepartmentFeature): GeoPolygon[] => {
  if (feature.geometry.type === 'Polygon') {
    return (feature.geometry.coordinates as GeoPoint[][]).map((ring) => [...ring])
  }

  return (feature.geometry.coordinates as GeoPoint[][][]).flatMap((polygon) =>
    polygon.map((ring) => [...ring]),
  )
}

const buildBounds = (features: DepartmentFeature[]): Bounds => {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const feature of features) {
    for (const ring of extractPolygons(feature)) {
      for (const [longitude, latitude] of ring) {
        minX = Math.min(minX, longitude)
        maxX = Math.max(maxX, longitude)
        minY = Math.min(minY, latitude)
        maxY = Math.max(maxY, latitude)
      }
    }
  }

  return { minX, maxX, minY, maxY }
}

const projectPoint = (
  longitude: number,
  latitude: number,
  bounds: Bounds,
  width: number,
  height: number,
): { x: number; y: number } => {
  const spanX = bounds.maxX - bounds.minX
  const spanY = bounds.maxY - bounds.minY
  const scale = Math.min(
    (width - MAP_PADDING * 2) / spanX,
    (height - MAP_PADDING * 2) / spanY,
  )
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2

  return {
    x: offsetX + (longitude - bounds.minX) * scale,
    y: offsetY + (bounds.maxY - latitude) * scale,
  }
}

const buildPath = (
  feature: DepartmentFeature,
  bounds: Bounds,
  width: number,
  height: number,
): string => {
  const segments = extractPolygons(feature).map((ring) => {
    const commands = ring.map(([longitude, latitude], index) => {
      const point = projectPoint(longitude, latitude, bounds, width, height)
      return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    })

    return `${commands.join(' ')} Z`
  })

  return segments.join(' ')
}

const buildCentroid = (
  feature: DepartmentFeature,
  bounds: Bounds,
  width: number,
  height: number,
): { x: number; y: number } => {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const ring of extractPolygons(feature)) {
    for (const [longitude, latitude] of ring) {
      minX = Math.min(minX, longitude)
      maxX = Math.max(maxX, longitude)
      minY = Math.min(minY, latitude)
      maxY = Math.max(maxY, latitude)
    }
  }

  return projectPoint((minX + maxX) / 2, (minY + maxY) / 2, bounds, width, height)
}

const mixChannel = (from: number, to: number, ratio: number): number =>
  Math.round(from + (to - from) * ratio)

const interpolateColor = (
  start: [number, number, number],
  end: [number, number, number],
  ratio: number,
): string => {
  const clamped = Math.max(0, Math.min(1, ratio))
  return `rgb(${mixChannel(start[0], end[0], clamped)} ${mixChannel(start[1], end[1], clamped)} ${mixChannel(start[2], end[2], clamped)})`
}

const getDepartmentColor = (
  value: number | null,
  minValue: number,
  maxValue: number,
): string => {
  if (value === null) {
    return 'rgba(197, 206, 214, 0.68)'
  }

  if (minValue === maxValue) {
    return 'rgb(198 96 55)'
  }

  const normalized = (value - minValue) / (maxValue - minValue)
  if (normalized < 0.5) {
    return interpolateColor([250, 233, 210], [221, 152, 90], normalized * 2)
  }

  return interpolateColor([221, 152, 90], [126, 48, 35], (normalized - 0.5) * 2)
}

const getFocusDepartment = (
  departments: DvfDepartmentSummary[],
  hoveredCode: string | null,
): DvfDepartmentSummary | null => {
  if (!departments.length) {
    return null
  }

  return (
    departments.find((department) => department.departmentCode === hoveredCode) ??
    departments.find((department) => department.departmentCode === DEFAULT_FOCUS_CODE) ??
    [...departments].sort((left, right) => right.salesCount - left.salesCount)[0]
  )
}

export function DepartmentChoropleth({
  departments,
}: DepartmentChoroplethProps) {
  const [featureCollection, setFeatureCollection] =
    useState<DepartmentFeatureCollection | null>(null)
  const [hoveredCode, setHoveredCode] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadMap = async () => {
      try {
        const response = await fetch(MAP_URL, { signal: controller.signal })

        if (!response.ok) {
          throw new Error(`Map request failed with status ${response.status}`)
        }

        const geojson = (await response.json()) as DepartmentFeatureCollection
        setFeatureCollection(geojson)
        setMapError(null)
      } catch (error) {
        if (!controller.signal.aborted) {
          setMapError(error instanceof Error ? error.message : 'Unable to load map')
        }
      }
    }

    void loadMap()

    return () => {
      controller.abort()
    }
  }, [])

  if (!departments.length) {
    return (
      <div className="choropleth-card choropleth-card--empty">
        <p className="choropleth-card__status">
          Le résumé DVF est en cours de chargement pour alimenter la carte.
        </p>
      </div>
    )
  }

  if (mapError) {
    return (
      <div className="choropleth-card choropleth-card--empty">
        <p className="choropleth-card__status">
          Impossible de charger le fond de carte départemental.
        </p>
        <p className="choropleth-card__substatus">{mapError}</p>
      </div>
    )
  }

  if (!featureCollection) {
    return (
      <div className="choropleth-card choropleth-card--empty">
        <p className="choropleth-card__status">Chargement du fond de carte départemental…</p>
      </div>
    )
  }

  const byCode = new Map(
    departments.map((department) => [department.departmentCode, department] as const),
  )
  const visibleFeatures = featureCollection.features.filter((feature) =>
    byCode.has(feature.properties.code),
  )

  const values = visibleFeatures
    .map((feature) => byCode.get(feature.properties.code)?.medianPricePerSquareMeter ?? null)
    .filter((value): value is number => value !== null)

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)

  const mainlandBounds = buildBounds(visibleFeatures)
  const mainlandPrepared: PreparedFeature[] = visibleFeatures.map((feature) => {
    const department = byCode.get(feature.properties.code) ?? null

    return {
      code: feature.properties.code,
      name: feature.properties.nom,
      value: department?.medianPricePerSquareMeter ?? null,
      salesCount: department?.salesCount ?? 0,
      path: buildPath(feature, mainlandBounds, MAINLAND_WIDTH, MAINLAND_HEIGHT),
      centroid: buildCentroid(feature, mainlandBounds, MAINLAND_WIDTH, MAINLAND_HEIGHT),
    }
  })

  const idfFeatures = visibleFeatures.filter((feature) =>
    IDF_CODES.includes(feature.properties.code),
  )
  const idfBounds = buildBounds(idfFeatures)
  const idfPrepared: PreparedFeature[] = idfFeatures.map((feature) => {
    const department = byCode.get(feature.properties.code) ?? null

    return {
      code: feature.properties.code,
      name: feature.properties.nom,
      value: department?.medianPricePerSquareMeter ?? null,
      salesCount: department?.salesCount ?? 0,
      path: buildPath(feature, idfBounds, INSET_WIDTH, INSET_HEIGHT),
      centroid: buildCentroid(feature, idfBounds, INSET_WIDTH, INSET_HEIGHT),
    }
  })

  const focusDepartment = getFocusDepartment(departments, hoveredCode)
  const highestDepartments = [...departments]
    .filter((department) => department.medianPricePerSquareMeter !== null)
    .sort(
      (left, right) =>
        (right.medianPricePerSquareMeter ?? 0) - (left.medianPricePerSquareMeter ?? 0),
    )
    .slice(0, 4)

  return (
    <div className="choropleth-card">
      <div className="choropleth-shell">
        <div className="choropleth-stage">
          <div className="choropleth-map-wrap">
            <svg
              className="choropleth-map"
              viewBox={`0 0 ${MAINLAND_WIDTH} ${MAINLAND_HEIGHT}`}
              role="img"
              aria-label="Carte choroplèthe des départements par prix médian au mètre carré"
            >
              {mainlandPrepared.map((feature) => (
                <path
                  key={feature.code}
                  d={feature.path}
                  className={
                    hoveredCode === feature.code
                      ? 'choropleth-map__department choropleth-map__department--active'
                      : 'choropleth-map__department'
                  }
                  fill={getDepartmentColor(feature.value, minValue, maxValue)}
                  onMouseEnter={() => setHoveredCode(feature.code)}
                  onMouseLeave={() => setHoveredCode(null)}
                />
              ))}
            </svg>

            <div className="choropleth-inset">
              <div className="choropleth-inset__header">
                <span className="choropleth-inset__eyebrow">Zoom</span>
                <strong>Île-de-France</strong>
              </div>
              <svg
                className="choropleth-map choropleth-map--inset"
                viewBox={`0 0 ${INSET_WIDTH} ${INSET_HEIGHT}`}
                role="img"
                aria-label="Zoom sur les départements d'Île-de-France"
              >
                {idfPrepared.map((feature) => (
                  <g key={feature.code}>
                    <path
                      d={feature.path}
                      className={
                        hoveredCode === feature.code
                          ? 'choropleth-map__department choropleth-map__department--active'
                          : 'choropleth-map__department'
                      }
                      fill={getDepartmentColor(feature.value, minValue, maxValue)}
                      onMouseEnter={() => setHoveredCode(feature.code)}
                      onMouseLeave={() => setHoveredCode(null)}
                    />
                    <text
                      x={feature.centroid.x}
                      y={feature.centroid.y}
                      className="choropleth-map__label"
                    >
                      {feature.code}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <div className="choropleth-legend">
            <div>
              <span className="choropleth-legend__label">Prix médian bas</span>
              <strong>{formatCurrencyPerSquareMeter(minValue)}</strong>
            </div>
            <div className="choropleth-legend__gradient" aria-hidden="true" />
            <div className="choropleth-legend__end">
              <span className="choropleth-legend__label">Prix médian haut</span>
              <strong>{formatCurrencyPerSquareMeter(maxValue)}</strong>
            </div>
          </div>
        </div>

        <aside className="choropleth-sidebar">
          <div className="choropleth-callout">
            <p className="choropleth-callout__eyebrow">
              {hoveredCode ? 'Département survolé' : 'Repère'}
            </p>
            <h3>
              {focusDepartment?.departmentCode ?? '--'} ·{' '}
              {mainlandPrepared.find(
                (feature) => feature.code === focusDepartment?.departmentCode,
              )?.name ?? 'France'}
            </h3>
            <p className="choropleth-callout__value">
              {formatCurrencyPerSquareMeter(
                focusDepartment?.medianPricePerSquareMeter ?? null,
              )}
            </p>
            <p className="choropleth-callout__meta">
              {focusDepartment
                ? `${formatInteger(focusDepartment.salesCount)} ventes résidentielles retenues`
                : 'Aucune donnée disponible'}
            </p>
          </div>

          <div className="choropleth-ranking">
            <div className="section-heading">
              <p className="eyebrow">Lecture rapide</p>
              <h3>Départements les plus chers</h3>
            </div>
            <div className="choropleth-ranking__list">
              {highestDepartments.map((department) => (
                <button
                  key={department.departmentCode}
                  type="button"
                  className="choropleth-ranking__item"
                  onMouseEnter={() => setHoveredCode(department.departmentCode)}
                  onMouseLeave={() => setHoveredCode(null)}
                >
                  <span className="choropleth-ranking__code">
                    {department.departmentCode}
                  </span>
                  <span className="choropleth-ranking__body">
                    <strong>
                      {mainlandPrepared.find(
                        (feature) => feature.code === department.departmentCode,
                      )?.name ?? department.departmentCode}
                    </strong>
                    <small>
                      {formatCurrencyPerSquareMeter(
                        department.medianPricePerSquareMeter,
                      )}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="choropleth-footnote">
            Carte métropolitaine et Corse. Le zoom Île-de-France améliore la lecture
            des départements les plus compacts.
          </p>
        </aside>
      </div>
    </div>
  )
}
