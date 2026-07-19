// Ersatz für <input type="date">: iOS rendert das native Datumsfeld teils breiter, als der
// Container erlaubt, unabhängig von width/max-width - ein bekanntes, hartnäckiges Problem.
// Drei normale <select>-Felder (Tag/Monat/Jahr) umgehen das komplett und verhalten sich wie
// jedes andere Auswahlfeld in der App.
const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function toDateStr(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function DateSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [year, month, day] = value.split('-').map(Number)
  const maxDay = daysInMonth(year, month)
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y)

  return (
    <div className="date-select-row">
      <select
        value={day}
        onChange={(e) => onChange(toDateStr(year, month, Number(e.target.value)))}
        aria-label="Tag"
      >
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => {
          const newMonth = Number(e.target.value)
          onChange(toDateStr(year, newMonth, Math.min(day, daysInMonth(year, newMonth))))
        }}
        aria-label="Monat"
      >
        {MONTHS.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => {
          const newYear = Number(e.target.value)
          onChange(toDateStr(newYear, month, Math.min(day, daysInMonth(newYear, month))))
        }}
        aria-label="Jahr"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
