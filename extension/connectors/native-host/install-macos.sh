#!/usr/bin/env bash
# Pemasang native host Kalam untuk macOS. Pakai: ./install-macos.sh <EXTENSION_ID> [folder-naskah]
set -euo pipefail
ID="${1:-}"
if [[ -z "$ID" ]]; then
  echo "Pakai: ./install-macos.sh <EXTENSION_ID> [folder-naskah]" >&2
  exit 1
fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="$HERE/kalam-host.py"
chmod +x "$HOST"
mkdir -p "${2:-$HOME/Documents/Kalam}"

for DIR in "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" \
           "$HOME/Library/Application Support/Chromium/NativeMessagingHosts" \
           "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts" \
           "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"; do
  mkdir -p "$DIR"
  cat > "$DIR/id.aisac.kalam.json" <<JSON
{
  "name": "id.aisac.kalam",
  "description": "Kalam — jembatan desktop penulis buku",
  "path": "$HOST",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$ID/"]
}
JSON
  echo "terpasang: $DIR/id.aisac.kalam.json"
done
echo "Selesai. Nyalakan 'Aplikasi desktop (native)' di tab Koneksi, lalu tekan Uji."