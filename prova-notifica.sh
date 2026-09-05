#!/usr/bin/env bash
# Manda una notifica di prova a tutti i telefoni iscritti.
#
# Tutto il lavoro lo fa il database: legge il segreto da Vault e chiama il
# guardiano. Qui non si interpreta niente, si stampa e basta. La versione
# precedente sminuzzava l'output della CLI e si rompeva su un'altra macchina.
#
#   ./prova-notifica.sh
cd "$(dirname "$0")"

echo "Mando la prova..."
npx --yes supabase db query --linked "select manda_prova()"

echo
echo "Aspetto la risposta..."
sleep 5
npx --yes supabase db query --linked "select * from esito_prova()"
