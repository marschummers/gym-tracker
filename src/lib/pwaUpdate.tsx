import { createContext, useContext, type ReactNode } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface PwaUpdateContextValue {
  needRefresh: boolean
  updateNow: () => Promise<void>
}

const PwaUpdateContext = createContext<PwaUpdateContextValue | null>(null)

export function PwaUpdateProvider({ children }: { children: ReactNode }) {
  const {
    needRefresh: [needRefresh],
  } = useRegisterSW()

  // "App aktualisieren": ein sanftes "Update aktivieren" verlässt sich darauf, dass der
  // ALTE Service Worker den Reload rechtzeitig freigibt - genau das war der Grund, warum
  // ein Klick nichts bewirkt hat (der alte Worker hat den Reload einfach wieder aus seinem
  // eigenen Cache bedient). Deshalb hier der garantierte Weg: Service Worker abmelden und
  // seinen kompletten Cache-Speicher löschen, dann neu laden - danach lädt der Browser
  // alles ganz normal frisch vom Server statt aus dem (dann nicht mehr vorhandenen) Cache.
  //
  // WICHTIG: navigator.serviceWorker.getRegistrations() und caches.keys() liefern ALLE
  // Registrierungen/Caches der gesamten Domain zurück, nicht nur die dieser App - andere
  // Apps auf derselben Domain (z.B. unter einem anderen Unterpfad) dürfen davon NICHT
  // betroffen sein. Deshalb wird hier gezielt nur auf den eigenen Scope/Cache-Namen gefiltert.
  async function updateNow() {
    const basePath = import.meta.env.BASE_URL
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        const ownRegistrations = registrations.filter((r) => new URL(r.scope).pathname.startsWith(basePath))
        await Promise.all(ownRegistrations.map((r) => r.unregister()))
      }
    } catch {
      // ignorieren, unten wird trotzdem neu geladen
    }
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        const ownKeys = keys.filter((key) => key.startsWith('gym-tracker'))
        await Promise.all(ownKeys.map((key) => caches.delete(key)))
      }
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
