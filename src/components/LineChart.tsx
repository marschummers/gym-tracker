import { useState } from 'react'
import { formatShortDate } from '../lib/date'

interface Point {
  x: number
  y: number
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
  const padX = 8
  const padTop = 20
  const padBottom = 22

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const yRange = maxY - minY || 1
  const yPadded = { min: minY - yRange * 0.15, max: maxY + yRange * 0.15 }

  function toSvgX(x: number) {
    if (maxX === minX) return width / 2
    return padX + ((x - minX) / (maxX - minX)) * (width - padX * 2)
  }
  function toSvgY(y: number) {
    const range = yPadded.max - yPadded.min || 1
    return padTop + (1 - (y - yPadded.min) / range) * (height - padTop - padBottom)
  }

  const coords = points.map((p) => ({ sx: toSvgX(p.x), sy: toSvgY(p.y) }))
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.sx.toFixed(1)},${c.sy.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${coords[coords.length - 1].sx.toFixed(1)},${height - padBottom} L${coords[0].sx.toFixed(1)},${height - padBottom} Z`

  let peakIndex = 0
  points.forEach((p, i) => {
    if (p.y > points[peakIndex].y) peakIndex = i
  })
  const peak = points[peakIndex]
  const peakCoord = coords[peakIndex]

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

  const gridY = toSvgY(yPadded.min + (yPadded.max - yPadded.min) / 2)

  return (
    <div className="line-chart">
      <div className="line-chart-peak">
        <span className="line-chart-peak-value">
          {peak.y}
          {unit}
        </span>
        <span className="line-chart-peak-date">{formatShortDate(peak.x)}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        onPointerMove={handlePointer}
        onPointerLeave={() => setHoverIndex(null)}
        role="img"
        aria-label={`Verlauf von ${peak.y}${unit}`}
      >
        <line x1={padX} y1={gridY} x2={width - padX} y2={gridY} stroke="var(--border)" strokeWidth="1" />
        <path d={areaPath} fill={color} opacity="0.12" stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={peakCoord.sx} cy={peakCoord.sy} r="4" fill={color} />
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
        <text x={padX} y={height - 4} fontSize="9" fill="var(--text-dim)">
          {formatShortDate(minX)}
        </text>
        <text x={width - padX} y={height - 4} fontSize="9" fill="var(--text-dim)" textAnchor="end">
          {formatShortDate(maxX)}
        </text>
      </svg>
      {active !== null && (
        <div className="line-chart-tooltip">
          {formatShortDate(points[active].x)}: {points[active].y}
          {unit}
        </div>
      )}
    </div>
  )
}
