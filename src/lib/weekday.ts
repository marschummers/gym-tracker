// JS-Konvention: 0 = Sonntag ... 6 = Samstag (passend zu Date.getDay())
export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Montag', short: 'Mo' },
  { value: 2, label: 'Dienstag', short: 'Di' },
  { value: 3, label: 'Mittwoch', short: 'Mi' },
  { value: 4, label: 'Donnerstag', short: 'Do' },
  { value: 5, label: 'Freitag', short: 'Fr' },
  { value: 6, label: 'Samstag', short: 'Sa' },
  { value: 0, label: 'Sonntag', short: 'So' },
]

export function getTodayWeekday(): number {
  return new Date().getDay()
}

export function weekdayShortLabel(value: number): string {
  return WEEKDAYS.find((w) => w.value === value)?.short ?? '–'
}

// Findet unter den Tagen mit festem Wochentag denjenigen, der zuletzt "dran" gewesen wäre
// (heute selbst zählt mit) – geht rückwärts durch die Woche, bis ein zugeordneter Tag gefunden wird.
export function findMostRecentScheduledDay<T extends { weekday?: number }>(
  days: T[],
  todayWeekday: number,
): T | undefined {
  for (let offset = 0; offset < 7; offset++) {
    const candidate = (todayWeekday - offset + 7) % 7
    const match = days.find((d) => d.weekday === candidate)
    if (match) return match
  }
  return undefined
}
