import { usePwaUpdate } from '../lib/pwaUpdate'

export default function UpdateBanner() {
  const { needRefresh, updateNow } = usePwaUpdate()
  if (!needRefresh) return null

  return (
    <div className="update-banner">
      <span>Neue Version verfügbar</span>
      <button onClick={() => updateNow()}>Aktualisieren</button>
    </div>
  )
}
