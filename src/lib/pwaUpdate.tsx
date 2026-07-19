import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface PwaUpdateContextValue {
  needRefresh: boolean
  updateNow: () => Promise<void>
}

const PwaUpdateContext = createContext<PwaUpdateContextValue | null>(null)

export function PwaUpdateProvider({ children }: { children: ReactNode }) {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration
    },
  })

  // "App aktualisieren": erzwingt einen frischen Check auf eine neue Version (iOS erkennt
  // das manchmal nicht von selbst), aktiviert sie falls gefunden, und lädt in jedem Fall
  // neu - genau das Verhalten eines klassischen "App neu laden"-Buttons.
  async function updateNow() {
    try {
      await registrationRef.current?.update()
    } catch {
      // ignorieren, unten wird trotzdem neu geladen
    }
    try {
      await updateServiceWorker(true)
    } catch {
      // ignorieren
    }
    window.location.reload()
  }

  return (
    <PwaUpdateContext.Provider value={{ needRefresh, updateNow }}>{children}</PwaUpdateContext.Provider>
  )
}

export function usePwaUpdate() {
  const ctx = useContext(PwaUpdateContext)
  if (!ctx) throw new Error('usePwaUpdate must be used within PwaUpdateProvider')
  return ctx
}
