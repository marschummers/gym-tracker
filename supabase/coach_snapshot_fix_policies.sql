-- Einmalig ausführen, um die Regeln aus coach_snapshot.sql zu ersetzen (behebt
-- "new row violates row-level security policy").
drop policy if exists "anon darf snapshot anlegen" on coach_snapshot;
drop policy if exists "anon darf snapshot aktualisieren" on coach_snapshot;

create policy "anon darf snapshot anlegen"
on coach_snapshot
for insert
to public
with check (id = 'latest');

create policy "anon darf snapshot aktualisieren"
on coach_snapshot
for update
to public
using (id = 'latest')
with check (id = 'latest');
