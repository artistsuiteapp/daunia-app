/**
 * Le persone bloccate, con il modo di tornare indietro.
 *
 * Un blocco che non si toglie non e una tutela, e una trappola: uno litiga, in
 * una settimana gli passa, e resta con mezza Curva invisibile senza capire
 * perche. Apple chiede esplicitamente che il blocco sia reversibile, ma il
 * motivo per cui questa schermata esiste viene prima della linea guida.
 *
 * I nomi si leggono da `profiles`, che e pubblica: qui non c'e niente di piu
 * di quello che si vede accanto a un messaggio.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen, LargeTitle, Empty, ListGroup, ListRow, GroupNote, useGutter } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Avatar } from '../components/Avatar';
import { NomeUtente } from '../components/NomeUtente';
import { Premi } from '../components/anima';
import { colors, radius, space, type } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { sblocca, useBloccati } from '../lib/moderazione';

type Persona = { id: string; nome: string };

export default function Bloccati() {
  const gutter = useGutter();
  const ids = useBloccati();
  const [gente, setGente] = useState<Persona[]>([]);

  useEffect(() => {
    let vivo = true;
    async function leggi() {
      if (!supabase || ids.length === 0) { setGente([]); return; }
      const { data } = await supabase.from('profiles').select('id, nome').in('id', ids);
      if (vivo) setGente((data ?? []) as Persona[]);
    }
    void leggi();
    return () => { vivo = false; };
  }, [ids.join(',')]);

  return (
    <Screen>
      <BackBar label="Profilo" />
      <LargeTitle title="Persone bloccate" subtitle="Non vedi più quello che scrivono" />

      {ids.length === 0 ? (
        <Empty text="Non hai bloccato nessuno." />
      ) : (
        <View style={gutter}>
          <ListGroup>
            {gente.map((p) => (
              <ListRow key={p.id}>
                <Avatar uri={null} name={p.nome} size={32} />
                <View style={{ flex: 1 }}>
                  <NomeUtente id={p.id} nome={p.nome} stile={styles.nome} apribile={false} />
                </View>
                <Premi onPress={() => { void sblocca(p.id); }} style={styles.sblocca}>
                  <Text style={styles.sbloccaTesto}>Sblocca</Text>
                </Premi>
              </ListRow>
            ))}
          </ListGroup>
        </View>
      )}

      <GroupNote>
        Bloccare non avvisa nessuno e non toglie niente a chi è bloccato: serve solo a te.
        Se qualcuno ha superato il segno, oltre a bloccarlo segnalalo — quello lo leggiamo noi.
      </GroupNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nome: { ...type.body, color: colors.text },
  sblocca: {
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  sbloccaTesto: { ...type.footnoteBold, color: colors.text },
});
