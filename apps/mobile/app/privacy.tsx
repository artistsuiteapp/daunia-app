import { Screen } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Documento } from '../components/Documento';
import { privacy } from '../lib/legale';

export default function Privacy() {
  return (
    <Screen testaFissa>
      <BackBar label="Indietro" />
      <Documento titolo="Informativa privacy" blocchi={privacy} />
    </Screen>
  );
}
