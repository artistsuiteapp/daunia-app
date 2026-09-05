import { Screen } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Documento } from '../components/Documento';
import { condizioni } from '../lib/legale';

export default function Condizioni() {
  return (
    <Screen>
      <BackBar label="Indietro" />
      <Documento titolo="Condizioni d’uso" blocchi={condizioni} />
    </Screen>
  );
}
