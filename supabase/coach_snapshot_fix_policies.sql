-- Einmalig ausführen. Ersetzt die UPDATE-Regel durch eine DELETE-Regel: ein "Upsert"
-- (Postgres ON CONFLICT DO UPDATE) braucht laut Postgres zusätzlich eine Leseberechtigung, um
-- vorab zu prüfen, ob schon eine Zeile existiert - die haben wir bewusst nicht vergeben, daher
-- schlug der Upload fehl ("new row violates row-level security policy"). Die App löscht die
-- alte Zeile jetzt stattdessen explizit und fügt danach eine neue ein (zwei einzelne Schritte,
-- kein Upsert) - das kommt ohne Leserecht aus.
drop policy if exists "anon darf snapshot aktualisieren" on coach_snapshot;

create policy "anon darf snapshot loeschen"
on coach_snapshot
for delete
to public
using (id = 'latest');
