import { Screen } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Documento } from '../components/Documento';
import { condizioni } from '../lib/legale';
import { useDati } from '../lib/bundle-remoto';

export default function Condizioni() {
  useDati();
  return (
    <Screen testaFissa>
      <BackBar label="Indietro" />
      <Documento titolo="Condizioni d’uso" blocchi={condizioni} />
    </Screen>
  );
}
