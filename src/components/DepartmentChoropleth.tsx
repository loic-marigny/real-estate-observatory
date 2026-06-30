import { useEffect, useRef, useState } from 'react'
import type { DvfDepartmentSummary } from '../types/realEstate'
import { getBundledAssetUrl } from '../services/dataAssetConfig'

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
  minProjectedX: number
  maxProjectedX: number
  minProjectedY: number
  maxProjectedY: number
  referenceLatitudeRadians: number
}

type PreparedFeature = {
  code: string
  name: string
  value: number | null
  salesCount: number
  path: string
  centroid: { x: number; y: number }
}

type MapCenter = {
  x: number
  y: number
}

type DragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  startCenter: MapCenter
  moved: boolean
}

const MAP_URL = getBundledAssetUrl('data/departements.geojson')
const MAINLAND_WIDTH = 760
const MAINLAND_HEIGHT = 660
const MAP_PADDING = 18
const DEFAULT_FOCUS_CODE = '75'
const DEFAULT_CENTER = {
  x: MAINLAND_WIDTH / 2,
  y: MAINLAND_HEIGHT / 2,
}
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_FACTOR = 1.35

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const getViewDimensions = (zoomLevel: number) => ({
  width: MAINLAND_WIDTH / zoomLevel,
  height: MAINLAND_HEIGHT / zoomLevel,
})

const clampCenter = (center: MapCenter, zoomLevel: number): MapCenter => {
  const { width, height } = getViewDimensions(zoomLevel)

  return {
    x: clamp(center.x, width / 2, MAINLAND_WIDTH - width / 2),
    y: clamp(center.y, height / 2, MAINLAND_HEIGHT - height / 2),
  }
}

const formatInteger = (value: number): string =>
  new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(value)

const formatCurrencyPerSquareMeter = (value: number | null): string =>
  value === null ? 'N/A' : `${formatInteger(value)} €/m²`

const projectGeoPoint = (
  longitude: number,
  latitude: number,
  referenceLatitudeRadians: number,
): { projectedX: number; projectedY: number } => ({
  projectedX: longitude * Math.cos(referenceLatitudeRadians),
  projectedY: latitude,
})

const extractPolygons = (feature: DepartmentFeature): GeoPolygon[] => {
  if (feature.geometry.type === 'Polygon') {
    return (feature.geometry.coordinates as GeoPoint[][]).map((ring) => [...ring])
  }

  return (feature.geometry.coordinates as GeoPoint[][][]).flatMap((polygon) =>
    polygon.map((ring) => [...ring]),
  )
}

const buildBounds = (features: DepartmentFeature[]): Bounds | null => {
  if (!features.length) {
    return null
  }

  let minLatitude = Number.POSITIVE_INFINITY
  let maxLatitude = Number.NEGATIVE_INFINITY

  for (const feature of features) {
    for (const ring of extractPolygons(feature)) {
      for (const [, latitude] of ring) {
        minLatitude = Math.min(minLatitude, latitude)
        maxLatitude = Math.max(maxLatitude, latitude)
      }
    }
  }

  const referenceLatitudeRadians =
    ((minLatitude + maxLatitude) / 2) * (Math.PI / 180)

  let minProjectedX = Number.POSITIVE_INFINITY
  let maxProjectedX = Number.NEGATIVE_INFINITY
  let minProjectedY = Number.POSITIVE_INFINITY
  let maxProjectedY = Number.NEGATIVE_INFINITY

  for (const feature of features) {
    for (const ring of extractPolygons(feature)) {
      for (const [longitude, latitude] of ring) {
        const { projectedX, projectedY } = projectGeoPoint(
          longitude,
          latitude,
          referenceLatitudeRadians,
        )
        minProjectedX = Math.min(minProjectedX, projectedX)
        maxProjectedX = Math.max(maxProjectedX, projectedX)
        minProjectedY = Math.min(minProjectedY, projectedY)
        maxProjectedY = Math.max(maxProjectedY, projectedY)
      }
    }
  }

  return {
    minProjectedX,
    maxProjectedX,
    minProjectedY,
    maxProjectedY,
    referenceLatitudeRadians,
  }
}

const projectPoint = (
  longitude: number,
  latitude: number,
  bounds: Bounds,
  width: number,
  height: number,
): { x: number; y: number } => {
  const { projectedX, projectedY } = projectGeoPoint(
    longitude,
    latitude,
    bounds.referenceLatitudeRadians,
  )
  const spanX = Math.max(bounds.maxProjectedX - bounds.minProjectedX, 0.0001)
  const spanY = Math.max(bounds.maxProjectedY - bounds.minProjectedY, 0.0001)
  const scale = Math.min(
    (width - MAP_PADDING * 2) / spanX,
    (height - MAP_PADDING * 2) / spanY,
  )
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2

  return {
    x: offsetX + (projectedX - bounds.minProjectedX) * scale,
    y: offsetY + (bounds.maxProjectedY - projectedY) * scale,
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

const buildViewBox = (center: MapCenter, zoomLevel: number): string => {
  const clampedCenter = clampCenter(center, zoomLevel)
  const { width, height } = getViewDimensions(zoomLevel)
  const x = clampedCenter.x - width / 2
  const y = clampedCenter.y - height / 2

  return `${x} ${y} ${width} ${height}`
}

export function DepartmentChoropleth({
  departments,
}: DepartmentChoroplethProps) {
  const mapWrapRef = useRef<HTMLDivElement | null>(null)
  const [featureCollection, setFeatureCollection] =
    useState<DepartmentFeatureCollection | null>(null)
  const [hoveredCode, setHoveredCode] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState<number>(MIN_ZOOM)
  const [mapCenter, setMapCenter] = useState<MapCenter>(DEFAULT_CENTER)
  const [isDragging, setIsDragging] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)

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

  useEffect(() => {
    const mapWrap = mapWrapRef.current
    const svg = svgRef.current
    if (!mapWrap || !svg) {
      return
    }

    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault()
    }

    const options: AddEventListenerOptions = { passive: false, capture: true }

    mapWrap.addEventListener('wheel', handleNativeWheel, options)
    svg.addEventListener('wheel', handleNativeWheel, options)

    return () => {
      mapWrap.removeEventListener('wheel', handleNativeWheel, options)
      svg.removeEventListener('wheel', handleNativeWheel, options)
    }
  }, [featureCollection])

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
        <p className="choropleth-card__status">
          Chargement du fond de carte départemental...
        </p>
      </div>
    )
  }

  const byCode = new Map(
    departments.map((department) => [department.departmentCode, department] as const),
  )
  const visibleFeatures = featureCollection.features

  if (!visibleFeatures.length) {
    return (
      <div className="choropleth-card choropleth-card--empty">
        <p className="choropleth-card__status">
          Les données DVF chargées ne correspondent à aucun département du fond de
          carte.
        </p>
        <p className="choropleth-card__substatus">
          Vérifier les codes département et le GeoJSON public.
        </p>
      </div>
    )
  }

  const values = visibleFeatures
    .map((feature) => byCode.get(feature.properties.code)?.medianPricePerSquareMeter ?? null)
    .filter((value): value is number => value !== null)

  const minValue = values.length ? Math.min(...values) : 0
  const maxValue = values.length ? Math.max(...values) : 0

  const mainlandBounds = buildBounds(visibleFeatures)
  if (!mainlandBounds) {
    return null
  }

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

  const focusDepartment = getFocusDepartment(departments, hoveredCode)
  const fallbackFeature =
    mainlandPrepared.find((feature) => feature.code === focusDepartment?.departmentCode) ??
    mainlandPrepared[0]
  const focusFeature =
    mainlandPrepared.find((feature) => feature.code === hoveredCode) ?? fallbackFeature
  const focusDepartmentSummary =
    (focusFeature ? byCode.get(focusFeature.code) : null) ?? focusDepartment

  const handleZoomIn = () => {
    setZoomLevel((current) => clamp(current * ZOOM_FACTOR, MIN_ZOOM, MAX_ZOOM))
  }

  const handleZoomOut = () => {
    setZoomLevel((current) => {
      const nextZoom = clamp(current / ZOOM_FACTOR, MIN_ZOOM, MAX_ZOOM)
      if (nextZoom === MIN_ZOOM) {
        setMapCenter(DEFAULT_CENTER)
      } else {
        setMapCenter((currentCenter) => clampCenter(currentCenter, nextZoom))
      }
      return nextZoom
    })
  }

  const handleResetZoom = () => {
    setZoomLevel(MIN_ZOOM)
    setMapCenter(DEFAULT_CENTER)
  }

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()

    if (!svgRef.current) {
      return
    }

    const rect = svgRef.current.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return
    }

    const zoomDirection = event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
    const nextZoom = clamp(zoomLevel * zoomDirection, MIN_ZOOM, MAX_ZOOM)

    if (nextZoom === zoomLevel) {
      return
    }

    const pointerRatioX = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const pointerRatioY = clamp((event.clientY - rect.top) / rect.height, 0, 1)
    const { width: currentViewWidth, height: currentViewHeight } =
      getViewDimensions(zoomLevel)
    const currentCenter = clampCenter(mapCenter, zoomLevel)
    const currentLeft = currentCenter.x - currentViewWidth / 2
    const currentTop = currentCenter.y - currentViewHeight / 2
    const anchorX = currentLeft + pointerRatioX * currentViewWidth
    const anchorY = currentTop + pointerRatioY * currentViewHeight
    const { width: nextViewWidth, height: nextViewHeight } = getViewDimensions(nextZoom)

    const nextCenter = clampCenter(
      {
        x: anchorX - pointerRatioX * nextViewWidth + nextViewWidth / 2,
        y: anchorY - pointerRatioY * nextViewHeight + nextViewHeight / 2,
      },
      nextZoom,
    )

    setZoomLevel(nextZoom)
    setMapCenter(nextCenter)
  }

  const handleDepartmentClick = (feature: PreparedFeature) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    setHoveredCode(feature.code)
    setMapCenter(feature.centroid)
    setZoomLevel((current) => clamp(Math.max(current, ZOOM_FACTOR * 1.2), MIN_ZOOM, MAX_ZOOM))
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (zoomLevel <= MIN_ZOOM) {
      return
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCenter: mapCenter,
      moved: false,
    }
    suppressClickRef.current = false
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId || !svgRef.current) {
      return
    }

    const rect = svgRef.current.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return
    }

    const deltaX = event.clientX - dragState.startClientX
    const deltaY = event.clientY - dragState.startClientY

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      dragState.moved = true
    }

    const { width: viewWidth, height: viewHeight } = getViewDimensions(zoomLevel)
    const centerX =
      dragState.startCenter.x - (deltaX / rect.width) * viewWidth
    const centerY =
      dragState.startCenter.y - (deltaY / rect.height) * viewHeight

    setMapCenter(clampCenter({ x: centerX, y: centerY }, zoomLevel))
  }

  const endDrag = (pointerId: number) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== pointerId) {
      return
    }

    suppressClickRef.current = dragState.moved
    dragStateRef.current = null
    setIsDragging(false)
  }

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    endDrag(event.pointerId)
  }

  const handlePointerCancel = (event: React.PointerEvent<SVGSVGElement>) => {
    endDrag(event.pointerId)
  }

  const mapViewBox = buildViewBox(mapCenter, zoomLevel)

  return (
    <div className="choropleth-card">
      <div className="choropleth-shell">
        <div className="choropleth-stage">
          <div
            ref={mapWrapRef}
            className={`choropleth-map-wrap${
              zoomLevel > MIN_ZOOM ? ' choropleth-map-wrap--zoomed' : ''
            }${isDragging ? ' choropleth-map-wrap--dragging' : ''}`}
            onWheelCapture={(event) => event.preventDefault()}
          >
            <div className="choropleth-controls" aria-label="Contrôle du zoom">
              <button
                type="button"
                className="choropleth-controls__button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= MIN_ZOOM}
                aria-label="Zoomer en arrière"
              >
                -
              </button>
              <button
                type="button"
                className="choropleth-controls__button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= MAX_ZOOM}
                aria-label="Zoomer"
              >
                +
              </button>
              <button
                type="button"
                className="choropleth-controls__button choropleth-controls__button--reset"
                onClick={handleResetZoom}
                disabled={zoomLevel === MIN_ZOOM}
              >
                Recentrer
              </button>
            </div>

            <svg
              ref={svgRef}
              className="choropleth-map"
              viewBox={mapViewBox}
              role="img"
              aria-label="Carte choroplèthe des départements par prix médian au mètre carré"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onWheel={handleWheel}
              onWheelCapture={(event) => event.preventDefault()}
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
                  onClick={() => handleDepartmentClick(feature)}
                />
              ))}
            </svg>
          </div>

          <div className="choropleth-callout">
            <p className="choropleth-callout__eyebrow">
              {hoveredCode ? 'Département survolé' : 'Repère'}
            </p>
            <h3>
              {focusFeature?.code ?? '--'} · {focusFeature?.name ?? 'France'}
            </h3>
            <p className="choropleth-callout__value">
              {formatCurrencyPerSquareMeter(
                focusDepartmentSummary?.medianPricePerSquareMeter ?? null,
              )}
            </p>
            <p className="choropleth-callout__meta">
              {focusDepartmentSummary
                ? `${formatInteger(focusDepartmentSummary.salesCount)} ventes résidentielles retenues`
                : 'Aucune donnée disponible'}
            </p>
          </div>

          <p className="choropleth-footnote">
            Carte hexagonale et Corse. Les DVF n'incluent pas le Bas-Rhin, le
            Haut-Rhin ni la Moselle, qui relèvent du droit local du livre foncier.
          </p>
        </div>
      </div>
    </div>
  )
}
