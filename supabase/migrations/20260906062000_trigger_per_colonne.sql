-- Correzione: il trigger leggeva le colonne per nome.
--
-- `case when to_jsonb(new) ? 'corpo' then new.corpo end` sembra prudente e non
-- lo e: plpgsql risolve new.corpo quando compila la funzione, non quando la
-- esegue, quindi su una tabella senza quella colonna fallisce comunque. E il
-- messaggio d'errore era "record new has no field corpo", non "bestemmia":
-- il filtro bloccava tutto per il motivo sbagliato.
--
-- Si passa dalla riga convertita in jsonb: una chiave che non c'e torna null,
-- e concat_ws salta i null. Cosi la stessa funzione vale anche per le tabelle
-- che verranno dopo, senza doverla riscrivere.

create or replace function blocca_offese()
returns trigger
language plpgsql
as $$
declare
  riga jsonb := to_jsonb(new);
  testo text;
  trovato text;
begin
  testo := concat_ws(' ',
    riga->>'titolo',
    riga->>'testo',
    riga->>'corpo',
    riga->>'messaggio',
    riga->>'nota'
  );

  if testo is null or testo = '' then
    return new;
  end if;

  trovato := contiene_bestemmia(testo);
  if trovato is not null then
    raise exception 'bestemmia'
      using errcode = 'check_violation',
            hint = 'Qui le bestemmie non passano. Riscrivi senza e il messaggio parte.';
  end if;

  trovato := contiene_parolaccia(testo);
  if trovato is not null then
    raise exception 'parolaccia'
      using errcode = 'check_violation',
            hint = 'C''e una parola che qui non passa. Riscrivi e il messaggio parte.';
  end if;

  return new;
end $$;
