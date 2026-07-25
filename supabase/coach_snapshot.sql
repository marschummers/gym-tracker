-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen (einmalig).
--
-- Löschen/Aktualisieren einer bestehenden Zeile über den öffentlichen Key schlägt an einer
-- Supabase-/Postgres-Eigenheit fehl (eine dem Anschein nach korrekte DELETE/UPDATE-Regel greift
-- nicht) - ähnliches Verhalten wie das frühere RLS-Problem im Stallmanager ("Horses"-Tabelle).
-- Deshalb hier ein Ansatz, der nie eine bestehende Zeile anfasst: Jeder Upload legt einfach eine
-- neue Zeile an (reines INSERT, das zuverlässig funktioniert). Gelesen wird später - über den
-- geheimen "service_role"-Key, der nirgendwo im App-Code steht - einfach die neueste Zeile
-- (order by created_at desc limit 1). Alte Zeilen sammeln sich harmlos an; bei Bedarf später per
-- service_role aufräumbar.
--
-- Der öffentliche ("publishable"/anon) Key, den die Gym-App benutzt, darf laut der Regel unten
-- NUR neue Zeilen anlegen - lesen kann er nichts (es gibt bewusst keine SELECT-Regel).

drop table if exists coach_snapshot;

create table coach_snapshot (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content text not null
);

alter table coach_snapshot enable row level security;

create policy "anon darf snapshot anlegen"
on coach_snapshot
for insert
to public
with check (true);
