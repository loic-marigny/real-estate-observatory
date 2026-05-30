import type { DvfDepartmentSummary, DvfSummary } from '../types/realEstate'

const DVF_SUMMARY_URL = '/data/dvf_summary.json'

const asNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return null
}

const normalizeDepartment = (
  departmentCode: string,
  salesCountByDepartment: Record<string, number>,
  medianPricePerSquareMeterByDepartment: Record<string, number | null>,
): DvfDepartmentSummary => ({
  departmentCode,
  salesCount: salesCountByDepartment[departmentCode] ?? 0,
  medianPricePerSquareMeter:
    medianPricePerSquareMeterByDepartment[departmentCode] ?? null,
})

const normalizeDvfSummary = (data: unknown): DvfSummary => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid DVF summary payload')
  }

  const record = data as Record<string, unknown>
  const filtersRecord =
    typeof record.filters === 'object' && record.filters !== null
      ? (record.filters as Record<string, unknown>)
      : {}
  const salesCountByDepartment =
    typeof (record.salesCountByDepartment ?? record.sales_count_by_department) ===
      'object' &&
    (record.salesCountByDepartment ?? record.sales_count_by_department) !== null
      ? Object.fromEntries(
          Object.entries(
            (record.salesCountByDepartment ??
              record.sales_count_by_department) as Record<string, unknown>,
          ).map(([key, value]) => [key, typeof value === 'number' ? value : 0]),
        )
      : {}

  const medianPricePerSquareMeterByDepartment =
    typeof (
      record.medianPricePerSquareMeterByDepartment ??
      record.median_price_m2_by_department
    ) === 'object' &&
    (record.medianPricePerSquareMeterByDepartment ??
      record.median_price_m2_by_department) !== null
      ? Object.fromEntries(
          Object.entries(
            (record.medianPricePerSquareMeterByDepartment ??
              record.median_price_m2_by_department) as Record<string, unknown>,
          ).map(
            ([key, value]) => [key, asNumberOrNull(value)],
          ),
        )
      : {}

  const medianPricePerSquareMeterByPropertyType =
    typeof (
      record.medianPricePerSquareMeterByPropertyType ??
      record.median_price_m2_by_property_type
    ) === 'object' &&
    (record.medianPricePerSquareMeterByPropertyType ??
      record.median_price_m2_by_property_type) !== null
      ? Object.fromEntries(
          Object.entries(
            (record.medianPricePerSquareMeterByPropertyType ??
              record.median_price_m2_by_property_type) as Record<
              string,
              unknown
            >,
          ).map(([key, value]) => [key, asNumberOrNull(value)]),
        )
      : {}

  const departmentCodes = Array.from(
    new Set([
      ...Object.keys(salesCountByDepartment),
      ...Object.keys(medianPricePerSquareMeterByDepartment),
    ]),
  ).sort()

  return {
    generatedAt:
      typeof (record.generatedAt ?? record.generated_at) === 'string'
        ? ((record.generatedAt ?? record.generated_at) as string)
        : '',
    sourceFile:
      typeof (record.sourceFile ?? record.source_file) === 'string'
        ? ((record.sourceFile ?? record.source_file) as string)
        : '',
    filters: {
      mutationTypes: Array.isArray(filtersRecord.mutationTypes)
        ? (filtersRecord.mutationTypes as string[])
        : typeof filtersRecord.nature_mutation === 'string'
          ? [filtersRecord.nature_mutation]
          : [],
      residentialTypes: Array.isArray(filtersRecord.residentialTypes)
        ? (filtersRecord.residentialTypes as string[])
        : Array.isArray(filtersRecord.property_types)
          ? (filtersRecord.property_types as string[])
          : [],
    },
    totalSalesCount:
      typeof (record.totalSalesCount ?? record.total_sales_count) === 'number'
        ? ((record.totalSalesCount ?? record.total_sales_count) as number)
        : 0,
    medianPricePerSquareMeter: asNumberOrNull(
      record.medianPricePerSquareMeter ?? record.median_price_m2,
    ),
    medianSurface: asNumberOrNull(record.medianSurface ?? record.median_surface),
    salesCountByDepartment,
    medianPricePerSquareMeterByDepartment,
    medianPricePerSquareMeterByPropertyType,
    departments: departmentCodes.map((departmentCode) =>
      normalizeDepartment(
        departmentCode,
        salesCountByDepartment,
        medianPricePerSquareMeterByDepartment,
      ),
    ),
  }
}

export async function getDvfSummary(): Promise<DvfSummary> {
  const response = await fetch(DVF_SUMMARY_URL)

  if (!response.ok) {
    throw new Error(`Failed to load DVF summary: ${response.status}`)
  }

  const data = (await response.json()) as unknown
  return normalizeDvfSummary(data)
}
