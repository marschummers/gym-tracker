import { createClient } from '@supabase/supabase-js'

// Eigenes, von allen anderen Projekten (z.B. Stallmanager) getrenntes Supabase-Projekt, nur
// für den "Für Coach hochladen"-Snapshot. Der Key hier ist bewusst der öffentliche Key - er
// darf laut den Row-Level-Security-Regeln in Supabase ausschließlich die eine Snapshot-Zeile
// überschreiben, nicht lesen. Siehe supabase/coach_snapshot.sql für die Regeln.
const SUPABASE_URL = 'https://ielieyybudoyicedztct.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2IM4Ky5uRXMl8Cd5gCb2RA_tozBq3Oe'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
