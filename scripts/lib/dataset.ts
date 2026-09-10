/**
 * The synthetic record set the demo runs on.
 *
 * Everything here is invented. There is no 123 Main Street in Fairview County
 * and there is no Example State. Real deeds carry names, signatures, and
 * notary details that have no business in a public template repository.
 *
 * Output is byte-for-byte reproducible, so a fork that regenerates the dataset
 * gets the CIDs already anchored on Fuji. `dataset.test.ts` pins those CIDs.
 */

import { type PdfLine, type PdfPageSpec, buildPdf, escapeText } from './pdf.js'

const ASSET_ID = 'BAL-PROP-001'
const ADDRESS = '123 Main Street'
const CITY = 'Fairview'
const COUNTY = 'Fairview County'
const STATE = 'Example State'
const PARCEL_NUMBER = '07-14-226-0031'
const OWNER = 'Example Property LLC'
const TAMPERED_OWNER = 'Different Property LLC'
const INSTRUMENT = '2019-0041827'

const EASEMENTS = [
  'Utility easement, ten feet along the north boundary, recorded in Book 812, Page 44.',
  'Drainage easement, five feet along the east boundary, recorded in Book 812, Page 45.',
]

const DISCLAIMER = 'Synthetic document. Generated for the anchorline template. Not a record of any real property.'

function heading(text: string): PdfLine {
  return { text, font: 'bold', size: 16, gapBefore: 8 }
}

function subheading(text: string): PdfLine {
  return { text, font: 'bold', size: 11, gapBefore: 14 }
}

function body(text: string): PdfLine {
  return { text, size: 10 }
}

function mono(text: string): PdfLine {
  return { text, font: 'mono', size: 9 }
}

/** A titled block of a document: the heading, then its lines. */
type Section = [title: string, ...lines: PdfLine[]]

/**
 * A one-page county document: title, provenance line, titled sections, and
 * the synthetic-data disclaimer. Every document in the set has this shape.
 */
function countyDocument(
  title: string,
  provenance: string,
  sections: Section[],
  options: { lead?: PdfLine[]; vector?: string } = {}
): PdfPageSpec[] {
  const lines: PdfLine[] = [heading(title), mono(provenance), ...(options.lead ?? [])]
  for (const [title, ...sectionLines] of sections) {
    lines.push(subheading(title), ...sectionLines)
  }
  lines.push({ text: DISCLAIMER, font: 'mono', size: 8, gapBefore: 24 })

  return [options.vector == null ? { lines } : { lines, vector: options.vector }]
}

/**
 * The deed, parameterized by owner.
 *
 * The tampered copy differs from the real one in that one name and nothing
 * else, which is the point: the file looks right and reads right, and the
 * CID still refuses it.
 */
function deed(owner: string): PdfPageSpec[] {
  return countyDocument('General warranty deed', `Instrument ${INSTRUMENT} · ${COUNTY} Recorder · ${STATE}`, [
    ['Grantee of record', { text: `Owner: ${owner}`, font: 'bold', size: 12, gapBefore: 4 }],
    ['Property', body(`${ADDRESS}, ${CITY}, ${STATE}`), body(`Assessor parcel number ${PARCEL_NUMBER}`)],
    [
      'Legal description',
      body(
        'Lot 31, Block 226, of the FAIRVIEW HEIGHTS SUBDIVISION, according to the plat thereof recorded ' +
          `in Plat Book 14, Page 7, of the public records of ${COUNTY}, ${STATE}, together with all ` +
          'tenements, hereditaments, and appurtenances belonging thereto.'
      ),
    ],
    [
      'Covenants',
      body(
        'The grantor covenants that the grantor is lawfully seized of the premises in fee simple, that the ' +
          'premises are free from all encumbrances except those of record, and that the grantor will warrant ' +
          'and defend the title to the premises against the lawful claims of all persons.'
      ),
    ],
    ['Encumbrances of record', ...EASEMENTS.map(body)],
    [
      'Recording',
      mono('Recorded 2019-08-14 · Book 4412 · Pages 118 through 119'),
      mono(`Transfer tax paid: $1,842.00 · ${COUNTY} Recorder`),
    ],
  ])
}

function parcelRecord(): unknown {
  return {
    acreage: 0.28,
    assessorParcelNumber: PARCEL_NUMBER,
    boundary: {
      // Metes and bounds, closing back on the point of beginning.
      calls: [
        { bearing: 'N 89-42-15 E', distanceFeet: 120.04 },
        { bearing: 'S 00-17-45 E', distanceFeet: 101.62 },
        { bearing: 'S 89-42-15 W', distanceFeet: 120.04 },
        { bearing: 'N 00-17-45 W', distanceFeet: 101.62 },
      ],
      pointOfBeginning: 'Northwest corner of Lot 31, Block 226',
      units: 'feet',
    },
    improvements: {
      bathrooms: 2,
      bedrooms: 3,
      livingAreaSquareFeet: 1864,
      stories: 2,
      yearBuilt: 1962,
    },
    jurisdiction: { county: COUNTY, state: STATE },
    legalDescription:
      'Lot 31, Block 226, FAIRVIEW HEIGHTS SUBDIVISION, Plat Book 14, Page 7, ' +
      `public records of ${COUNTY}, ${STATE}`,
    lot: 31,
    plat: { book: 14, name: 'Fairview Heights Subdivision', page: 7 },
    situs: { city: CITY, state: STATE, street: ADDRESS },
    zoning: { code: 'R-1', description: 'Single family residential' },
  }
}

function propertyMetadata(): unknown {
  return {
    address: { city: CITY, state: STATE, street: ADDRESS },
    assetId: ASSET_ID,
    assetType: 'real_estate',
    assessorParcelNumber: PARCEL_NUMBER,
    disclaimer: DISCLAIMER,
    issuer: { name: `${COUNTY} Recorder`, role: 'record_of_authority' },
    ownerOfRecord: OWNER,
    recordedInstrument: INSTRUMENT,
  }
}

function taxAssessment(year: number, landValue: number, improvementValue: number, millage: number): PdfPageSpec[] {
  const total = landValue + improvementValue
  const taxable = Math.round(total * 0.85)
  const levy = Math.round((taxable / 1000) * millage * 100) / 100
  const row = (label: string, value: string): PdfLine => mono(`${label.padEnd(26)} ${value}`)
  const dollars = (value: number): string => `$${value.toLocaleString('en-US')}`

  return countyDocument(
    `Notice of assessed value, ${year}`,
    `${COUNTY} Assessor · ${STATE} · parcel ${PARCEL_NUMBER}`,
    [
      ['Property', body(`${ADDRESS}, ${CITY}, ${STATE}`), body(`Owner of record: ${OWNER}`)],
      [
        'Valuation',
        row('Land', dollars(landValue)),
        row('Improvements', dollars(improvementValue)),
        row('Total market value', dollars(total)),
        row('Assessed value at 85%', dollars(taxable)),
      ],
      ['Levy', row('Millage rate', `${millage.toFixed(4)} per $1,000`), row(`Tax for ${year}`, dollars(levy))],
      [
        'Appeal',
        body(
          `A written appeal of this valuation may be filed with the ${COUNTY} Board of Review within ` +
            '30 days of the notice date. Filing an appeal does not defer the tax.'
        ),
      ],
    ]
  )
}

/**
 * Plat drawing for the survey, in PDF user space.
 *
 * A rectangle scaled from the metes and bounds in `parcel.json`, with the two
 * recorded easements hatched along the north and east boundaries.
 */
function platDrawing(): string {
  const left = 156
  const bottom = 300
  const width = 300 // 120.04 ft
  const height = 254 // 101.62 ft
  const easementNorth = 25 // 10 ft
  const easementEast = 12 // 5 ft

  const ops = [
    '0.6 w 0 G',
    `${left} ${bottom} ${width} ${height} re S`,
    '0.4 w [3 3] 0 d 0.5 G',
    `${left} ${bottom + height - easementNorth} m ${left + width} ${bottom + height - easementNorth} l S`,
    `${left + width - easementEast} ${bottom} m ${left + width - easementEast} ${bottom + height} l S`,
    '[] 0 d',
  ]

  const labels = [
    { at: [left + 90, bottom + height + 10], text: 'N 89-42-15 E    120.04 ft' },
    { at: [left + width + 8, bottom + 120], text: 'S 00-17-45 E' },
    { at: [left + width + 8, bottom + 108], text: '101.62 ft' },
    { at: [left + 90, bottom - 18], text: 'S 89-42-15 W    120.04 ft' },
    { at: [left - 4, bottom + height + 24], text: 'POB' },
    { at: [left + 8, bottom + height - 18], text: '10 ft utility easement' },
  ]

  const text = labels
    .map(({ at, text: label }) => `/F3 8 Tf\n1 0 0 1 ${at[0]} ${at[1]} Tm\n(${escapeText(label)}) Tj`)
    .join('\n')

  return `${ops.join('\n')}\nBT\n${text}\nET`
}

function survey(): PdfPageSpec[] {
  return countyDocument(
    'Boundary survey',
    `Lot 31, Block 226 · Fairview Heights Subdivision · parcel ${PARCEL_NUMBER}`,
    [
      [
        'Surveyor statement',
        body(
          'This survey was performed on the ground and shows the boundary of the parcel described in the ' +
            'legal description of record, the improvements located thereon, and the easements of record ' +
            'listed below. Bearings are referenced to the plat of record.'
        ),
      ],
      ['Easements shown', ...EASEMENTS.map(body)],
      ['Closure', mono('Perimeter 443.32 ft · area 0.28 acres · error of closure 1:24,800')],
    ],
    {
      vector: platDrawing(),
      // The plat occupies the middle of the page; the text resumes below it.
      lead: [body(`${ADDRESS}, ${CITY}, ${STATE}`), { text: '', gapBefore: 300 }],
    }
  )
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`)
}

export const ASSET = { assetId: ASSET_ID, address: ADDRESS, city: CITY, state: STATE, owner: OWNER } as const

export interface DatasetFile {
  name: string
  /** Manifest record type. The tampered deed is not a record, so it has none. */
  type?: string
  mimeType: string
  bytes: Uint8Array
}

/** Build every file in the dataset. Pure, so tests can hash it without touching disk. */
export function buildDataset(): DatasetFile[] {
  const pdf = 'application/pdf'
  const json = 'application/json'
  return [
    { name: 'property.json', type: 'property_metadata', mimeType: json, bytes: jsonBytes(propertyMetadata()) },
    { name: 'deed.pdf', type: 'deed', mimeType: pdf, bytes: buildPdf(deed(OWNER)) },
    { name: 'parcel.json', type: 'parcel_record', mimeType: json, bytes: jsonBytes(parcelRecord()) },
    {
      name: 'tax-assessment-2025.pdf',
      type: 'tax_assessment',
      mimeType: pdf,
      bytes: buildPdf(taxAssessment(2025, 84_000, 241_500, 18.412)),
    },
    {
      name: 'tax-assessment-2026.pdf',
      type: 'tax_assessment',
      mimeType: pdf,
      bytes: buildPdf(taxAssessment(2026, 91_500, 258_000, 18.974)),
    },
    { name: 'survey.pdf', type: 'survey', mimeType: pdf, bytes: buildPdf(survey()) },
    // Never uploaded and never in a manifest. It exists so the tamper screen
    // has a file that looks right and fails.
    { name: 'deed-tampered.pdf', mimeType: pdf, bytes: buildPdf(deed(TAMPERED_OWNER)) },
  ]
}
