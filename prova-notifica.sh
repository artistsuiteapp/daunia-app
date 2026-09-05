#!/usr/bin/env bash
# Manda una notifica di prova a tutti i telefoni iscritti.
#
# Serve a rispondere all'unica domanda che conta prima di una partita vera:
# la notifica arriva a schermo bloccato, si' o no? Il segreto lo prende da
# Vault, quindi non sta scritto da nessuna parte nel repository.
#
#   ./prova-notifica.sh
set -euo pipefail
cd "$(dirname "$0")"

SEGRETO=$(npx --yes supabase db query --linked \
  "select decrypted_secret as s from vault.decrypted_secrets where name='guardiano_segreto'" \
  | python3 -c "import sys,json;raw=sys.stdin.read();print(json.loads(raw[raw.find('{'):])['rows'][0]['s'])")

curl -s -X POST "https://idofdpaftnaoyvuplksq.supabase.co/functions/v1/guardiano-partita" \
  -H "x-guardiano: $SEGRETO" \
  -H "Content-Type: application/json" \
  -d '{"prova":true}'
echo
