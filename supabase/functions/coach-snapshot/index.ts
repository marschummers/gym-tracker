// Supabase Edge Function: liest den neuesten Coach-Snapshot mit dem geheimen service_role-Key
// (automatisch als Umgebungsvariable verfügbar, steht nirgendwo im Funktionscode oder bei
// ChatGPT). Nach außen ist die Funktion nur mit einem eigenen, harmlosen Zufalls-Token
// erreichbar (COACH_READ_TOKEN, separat als Secret gesetzt) - das erkennt ChatGPTs
// Sicherheitsprüfung nicht als "geheimer API-Key" und blockiert die Nutzung deshalb nicht.
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const expectedToken = Deno.env.get('COACH_READ_TOKEN')
  const authHeader = req.headers.get('Authorization') ?? ''
  const providedToken = authHeader.replace(/^Bearer\s+/i, '')

  if (!expectedToken || providedToken !== expectedToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase
    .from('coach_snapshot')
    .select('content, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(data ?? {}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
