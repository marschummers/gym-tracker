export default function BarSparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className="bar-sparkline">
      {values.map((v, i) => (
        <div
          key={i}
          className="bar-sparkline-bar"
          style={{ height: `${Math.max(6, (v / max) * 100)}%`, background: color }}
        />
      ))}
    </div>
  )
}
