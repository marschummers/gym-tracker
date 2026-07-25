-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen (einmalig).
--
-- Tabelle enthält immer nur EINE Zeile (id = 'latest') mit dem aktuellen Trainings-/
-- Körperdaten-Stand als Text. Der öffentliche ("publishable"/anon) Key, den die Gym-App
-- benutzt, darf diese Zeile laut den Regeln unten NUR schreiben (löschen + neu anlegen) -
-- lesen kann er sie nicht (es gibt bewusst keine SELECT-Regel). Zum Lesen (für die
-- ChatGPT-Action) wird stattdessen der geheime "service_role"-Key verwendet, der nirgendwo im
-- App-Code steht.
--
-- Kein "Upsert" (ON CONFLICT DO UPDATE): Postgres braucht dafür zusätzlich eine
-- Leseberechtigung, um vorab zu prüfen, ob schon eine Zeile existiert - die haben wir bewusst
-- nicht vergeben. Die App löscht die alte Zeile deshalb explizit und legt danach eine neue an.

create table if not exists coach_snapshot (
  id text primary key,
  updated_at timestamptz not null default now(),
  content text not null
);

alter table coach_snapshot enable row level security;

create policy "anon darf snapshot anlegen"
on coach_snapshot
for insert
to public
with check (id = 'latest');

create policy "anon darf snapshot loeschen"
on coach_snapshot
for delete
to public
using (id = 'latest');
