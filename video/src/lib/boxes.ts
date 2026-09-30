/** A rectangle in page coordinates of the 1920×1080 canvas a `Stage` films. */
export type Box = [x: number, y: number, w: number, h: number]

export const pad = ([x, y, w, h]: Box, px: number, py = px): Box => [x - px, y - py, w + px * 2, h + py * 2]

export const union = (...boxes: Box[]): Box => {
  const x0 = Math.min(...boxes.map(b => b[0]))
  const y0 = Math.min(...boxes.map(b => b[1]))
  const x1 = Math.max(...boxes.map(b => b[0] + b[2]))
  const y1 = Math.max(...boxes.map(b => b[1] + b[3]))
  return [x0, y0, x1 - x0, y1 - y0]
}

/** Absolute-position style for a box. */
export const place = ([x, y, w, h]: Box) => ({ position: 'absolute' as const, left: x, top: y, width: w, height: h })
