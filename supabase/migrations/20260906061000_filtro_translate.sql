-- Correzione: in translate() le due stringhe devono avere la stessa lunghezza.
--
-- Erano '0134578@$' (nove caratteri) e 'oieastbga s' (undici). Postgres allinea
-- posizione per posizione e ignora l'eccesso, quindi la chiocciola finiva
-- mappata su g e il dollaro su a, mentre il 9 non veniva mappato affatto.
-- Un errore silenzioso: la funzione rispondeva, solo con la lettera sbagliata.

create or replace function normalizza_testo(t text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        --            0 1 3 4 5 7 8 9 @ $
        translate(lower(unaccent(coalesce(t, ''))), '01345789@$', 'oieastbgas'),
        '([a-z])\1{2,}', '\1', 'g'
      ),
      '[^a-z]+', ' ', 'g'
    ),
    ' +', ' ', 'g'
  ));
$$;
