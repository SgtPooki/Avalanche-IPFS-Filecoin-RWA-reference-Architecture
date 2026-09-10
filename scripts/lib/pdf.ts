/**
 * A small, deterministic PDF writer for the synthetic dataset.
 *
 * The dataset has to regenerate to identical bytes on any machine, or the
 * seeded CIDs stop matching what a fork produces. So: no creation date, no
 * producer string, no object ids that depend on iteration order, and text
 * drawn with the base-14 Type1 fonts every reader already has.
 *
 * Text is written with plain `Tj` operators and no font subsetting, which
 * keeps it extractable. The tamper screen reads the owner line back out of
 * `deed.pdf`, and that only works if the text is really there.
 *
 * This is not a general PDF library. It draws left-aligned lines on
 * US Letter pages, plus an optional raw content-stream fragment for the plat
 * drawing on the survey.
 */

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 72
const TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2

export type PdfFont = 'regular' | 'bold' | 'mono'

const FONT_RESOURCE: Record<PdfFont, string> = { regular: '/F1', bold: '/F2', mono: '/F3' }

/** Average glyph width as a fraction of font size, used only for wrapping. */
const GLYPH_WIDTH: Record<PdfFont, number> = { regular: 0.5, bold: 0.53, mono: 0.6 }

export interface PdfLine {
  text: string
  font?: PdfFont
  size?: number
  /** Extra vertical space above this line, in points. */
  gapBefore?: number
}

export interface PdfPageSpec {
  lines: PdfLine[]
  /** Raw content-stream operators drawn under the text, in PDF user space. */
  vector?: string
}

/**
 * Encode to WinAnsi, one byte per character.
 *
 * The fonts below declare `/WinAnsiEncoding`, which is Latin-1 for the range
 * this dataset uses, so the file bytes have to be Latin-1 too. Writing UTF-8
 * here would turn every middle dot into two garbage glyphs.
 */
function winAnsi(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    bytes[i] = code <= 0xff ? code : 0x3f
  }
  return bytes
}

/** Escape a string for use inside a PDF literal-string operand. */
export function escapeText(text: string): string {
  const escaped = text.replace(/([\\()])/g, '\\$1')
  // Control characters and anything past Latin-1 have no glyph in WinAnsi.
  return escaped.replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
}

function wrap(text: string, font: PdfFont, size: number): string[] {
  const maxChars = Math.max(8, Math.floor(TEXT_WIDTH / (size * GLYPH_WIDTH[font])))
  if (text.length <= maxChars) return [text]

  const lines: string[] = []
  let current = ''
  for (const word of text.split(' ')) {
    if (current === '') {
      current = word
    } else if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current !== '') lines.push(current)
  return lines
}

function contentStream(page: PdfPageSpec): string {
  const ops: string[] = []
  if (page.vector != null) ops.push(page.vector)

  ops.push('BT')
  let y = PAGE_HEIGHT - MARGIN
  for (const line of page.lines) {
    const font = line.font ?? 'regular'
    const size = line.size ?? 10
    y -= line.gapBefore ?? 0
    for (const wrapped of wrap(line.text, font, size)) {
      y -= size * 1.35
      ops.push(`${FONT_RESOURCE[font]} ${size} Tf`, `1 0 0 1 ${MARGIN} ${y.toFixed(2)} Tm`, `(${escapeText(wrapped)}) Tj`)
    }
  }
  ops.push('ET')
  return ops.join('\n')
}

/** Build a PDF. Byte-for-byte reproducible for the same input. */
export function buildPdf(pages: PdfPageSpec[]): Uint8Array {
  const pageCount = pages.length
  const firstPageObj = 6
  const firstContentObj = firstPageObj + pageCount

  const objects: string[] = []
  const kids = pages.map((_, i) => `${firstPageObj + i} 0 R`).join(' ')

  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`)
  for (const baseFont of ['Helvetica', 'Helvetica-Bold', 'Courier']) {
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${baseFont} /Encoding /WinAnsiEncoding >>`)
  }

  for (let i = 0; i < pageCount; i++) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        '/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> ' +
        `/Contents ${firstContentObj + i} 0 R >>`
    )
  }

  for (const stream of pages.map(contentStream)) {
    objects.push(`<< /Length ${winAnsi(stream).length} >>\nstream\n${stream}\nendstream`)
  }

  const chunks: Uint8Array[] = []
  let offset = 0
  const push = (text: string): void => {
    const bytes = winAnsi(text)
    chunks.push(bytes)
    offset += bytes.length
  }

  push('%PDF-1.4\n')
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(offset)
    push(`${index + 1} 0 obj\n${body}\nendobj\n`)
  })

  const xrefOffset = offset
  const xref = [`xref\n0 ${objects.length + 1}\n`, '0000000000 65535 f \n']
  for (const objectOffset of offsets) {
    xref.push(`${objectOffset.toString().padStart(10, '0')} 00000 n \n`)
  }
  push(xref.join(''))
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

  const out = new Uint8Array(offset)
  let cursor = 0
  for (const chunk of chunks) {
    out.set(chunk, cursor)
    cursor += chunk.length
  }
  return out
}
