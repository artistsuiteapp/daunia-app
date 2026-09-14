import { Screen } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Documento } from '../components/Documento';
import { privacy } from '../lib/legale';
import { useDati } from '../lib/bundle-remoto';

export default function Privacy() {
  useDati();
  return (
    <Screen testaFissa>
      <BackBar label="Indietro" />
      <Documento titolo="Informativa privacy" blocchi={privacy} />
    </Screen>
  );
}
