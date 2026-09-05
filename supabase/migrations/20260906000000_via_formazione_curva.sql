-- Via la Formazione della Curva.
--
-- Costruita e tolta lo stesso giorno. Il motivo: dipende dal numero di utenti
-- per avere senso. Con dieci tifosi "l'undici della curva" non e un dato, e
-- dopo aver votato una volta non c'e ragione di tornare fino a domenica.
-- Al suo posto vanno la sala live e le notifiche, che funzionano anche in otto.

-- La tabella si elimina solo se e vuota davvero. E stata creata poche ore fa e
-- non dovrebbe avere righe, ma "non dovrebbe" non e una verifica.
do $$
declare n bigint;
begin
  if to_regclass('public.formazioni_curva') is null then
    return;
  end if;
  execute 'select count(*) from formazioni_curva' into n;
  if n > 0 then
    raise exception 'formazioni_curva ha % righe: non si butta niente senza guardarci dentro', n;
  end if;
end $$;

drop function if exists undici_curva(text);
drop table if exists formazioni_curva;
