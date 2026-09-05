-- Profilo utente e immagine.
--
-- L'immagine non finisce nel database ma nell'archivio file di Supabase: nella
-- tabella resta solo il percorso. Mettere i byte in una colonna gonfia i
-- backup e rallenta ogni lettura del profilo.

alter table profiles add column if not exists avatar text;
alter table profiles add column if not exists bio text
  check (bio is null or char_length(bio) <= 200);
-- il settore in cui si va di solito: comodo per "Ci sono anch'io"
alter table profiles add column if not exists settore text;

-- Il profilo nasce da solo alla registrazione. Senza questo, chi si iscrive
-- resta senza riga in profiles e ogni scrittura fallisce per chiave esterna,
-- con un errore che non dice niente a chi lo legge.
create or replace function crea_profilo() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome)
  values (
    new.id,
    -- il nome scelto in fase di registrazione, o la parte prima della chiocciola
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists utente_crea_profilo on auth.users;
create trigger utente_crea_profilo
  after insert on auth.users
  for each row execute function crea_profilo();

-- ------------------------------------------------------------- archivio file

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatar', 'avatar', true, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Le immagini si vedono tutte, ma ognuno scrive solo dentro la cartella che
-- porta il suo identificativo: "<uid>/qualcosa.jpg". Senza questo vincolo uno
-- potrebbe sovrascrivere l'immagine di un altro.
drop policy if exists "avatar leggibili da tutti" on storage.objects;
create policy "avatar leggibili da tutti"
  on storage.objects for select
  using (bucket_id = 'avatar');

drop policy if exists "ognuno carica nella propria cartella" on storage.objects;
create policy "ognuno carica nella propria cartella"
  on storage.objects for insert
  with check (
    bucket_id = 'avatar'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ognuno sostituisce la propria immagine" on storage.objects;
create policy "ognuno sostituisce la propria immagine"
  on storage.objects for update
  using (bucket_id = 'avatar' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ognuno cancella la propria immagine" on storage.objects;
create policy "ognuno cancella la propria immagine"
  on storage.objects for delete
  using (bucket_id = 'avatar' and (storage.foldername(name))[1] = auth.uid()::text);
