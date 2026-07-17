const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export default function WeekBarChart({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const todayIndex = (() => {
    const jsDay = new Date().getDay()
    return jsDay === 0 ? 6 : jsDay - 1
  })()

  return (
    <div className="week-bar-chart">
      {values.map((v, i) => (
        <div key={i} className="week-bar-chart-col">
          <div className="week-bar-chart-track">
            <div
              className="week-bar-chart-bar"
              style={{
                height: `${v > 0 ? Math.max(8, (v / max) * 100) : 2}%`,
                background: i === todayIndex ? color : 'var(--border)',
              }}
            />
          </div>
          <span className={`week-bar-chart-label${i === todayIndex ? ' today' : ''}`}>{DAY_LABELS[i]}</span>
        </div>
      ))}
    </div>
  )
}
