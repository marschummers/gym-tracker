import { useState } from 'react'
import { formatShortDate } from '../lib/date'

interface Point {
  x: number
  y: number
}

// Rundet auf max. 2 Nachkommastellen (Divisionen wie beim Wochendurchschnitt erzeugen sonst
// Fließkomma-Artefakte wie 84.10000000000001).
function formatValue(value: number): string {
  return (Math.round(value * 100) / 100).toString()
}

export default function LineChart({
  points,
  color,
  unit,
  height = 140,
}: {
  points: Point[]
  color: string
  unit: string
  height?: number
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (points.length === 0) {
    return <p className="chart-empty">Noch keine Daten in diesem Zeitraum.</p>
  }

  const width = 300
  const padLeft = 28
  const padRight = 8
  const padTop = 14
  const padBottom = 20

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)

  // Y-Achse: kleinstem/größtem Wert jeweils 1 Einheit Puffer geben, auf ganze Zahlen gerundet
  // (z.B. Werte zwischen 81 und 84 -> Achse von 80 bis 85), statt eines einzelnen "Spitzenwert"-
  // Textes über dem Chart, der bei fallendem Verlauf irreführend immer den ältesten Wert zeigte.
  const yAxisMin = Math.floor(Math.min(...ys)) - 1
  const yAxisMax = Math.ceil(Math.max(...ys)) + 1
  const yAxisMid = (yAxisMin + yAxisMax) / 2

  function toSvgX(x: number) {
    if (maxX === minX) return (padLeft + (width - padRight)) / 2
    return padLeft + ((x - minX) / (maxX - minX)) * (width - padLeft - padRight)
  }
  function toSvgY(y: number) {
    const range = yAxisMax - yAxisMin || 1
    return padTop + (1 - (y - yAxisMin) / range) * (height - padTop - padBottom)
  }

  const coords = points.map((p) => ({ sx: toSvgX(p.x), sy: toSvgY(p.y) }))
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.sx.toFixed(1)},${c.sy.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${coords[coords.length - 1].sx.toFixed(1)},${height - padBottom} L${coords[0].sx.toFixed(1)},${height - padBottom} Z`

  const active = hoverIndex !== null ? hoverIndex : null

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * width
    let nearest = 0
    let nearestDist = Infinity
    coords.forEach((c, i) => {
      const dist = Math.abs(c.sx - relX)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = i
      }
    })
    setHoverIndex(nearest)
  }

  const gridY = toSvgY(yAxisMid)

  return (
    <div className="line-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        onPointerMove={handlePointer}
        onPointerLeave={() => setHoverIndex(null)}
        role="img"
        aria-label={`Verlauf von ${yAxisMin} bis ${yAxisMax}${unit}`}
      >
        <line x1={padLeft} y1={gridY} x2={width - padRight} y2={gridY} stroke="var(--border)" strokeWidth="1" />
        <path d={areaPath} fill={color} opacity="0.12" stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {active !== null && (
          <>
            <line
              x1={coords[active].sx}
              y1={padTop}
              x2={coords[active].sx}
              y2={height - padBottom}
              stroke="var(--text-dim)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            <circle cx={coords[active].sx} cy={coords[active].sy} r="4" fill="var(--bg)" stroke={color} strokeWidth="2" />
          </>
        )}
        <text x={padLeft - 4} y={padTop + 3} fontSize="9" fill="var(--text-dim)" textAnchor="end">
          {yAxisMax}
          {unit}
        </text>
        <text x={padLeft - 4} y={gridY + 3} fontSize="9" fill="var(--text-dim)" textAnchor="end">
          {yAxisMid}
          {unit}
        </text>
        <text x={padLeft - 4} y={height - padBottom + 3} fontSize="9" fill="var(--text-dim)" textAnchor="end">
          {yAxisMin}
          {unit}
        </text>
        <text x={padLeft} y={height - 4} fontSize="9" fill="var(--text-dim)">
          {formatShortDate(minX)}
        </text>
        <text x={width - padRight} y={height - 4} fontSize="9" fill="var(--text-dim)" textAnchor="end">
          {formatShortDate(maxX)}
        </text>
      </svg>
      {active !== null && (
        <div className="line-chart-tooltip">
          {formatShortDate(points[active].x)}: {formatValue(points[active].y)}
          {unit}
        </div>
      )}
    </div>
  )
}
