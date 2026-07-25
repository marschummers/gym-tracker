-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen (einmalig).
--
-- Tabelle enthält immer nur EINE Zeile (id = 'latest') mit dem aktuellen Trainings-/
-- Körperdaten-Stand als Text. Der öffentliche ("publishable"/anon) Key, den die Gym-App
-- benutzt, darf diese Zeile laut den Regeln unten NUR schreiben/überschreiben - lesen kann
-- er sie nicht (es gibt bewusst keine SELECT-Regel für die Rolle "anon"). Zum Lesen (für die
-- ChatGPT-Action) wird stattdessen der geheime "service_role"-Key verwendet, der nirgendwo im
-- App-Code steht.

create table if not exists coach_snapshot (
  id text primary key,
  updated_at timestamptz not null default now(),
  content text not null
);

alter table coach_snapshot enable row level security;

create policy "anon darf snapshot anlegen"
on coach_snapshot
for insert
to anon
with check (id = 'latest');

create policy "anon darf snapshot aktualisieren"
on coach_snapshot
for update
to anon
using (id = 'latest')
with check (id = 'latest');
