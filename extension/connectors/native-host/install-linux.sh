#!/usr/bin/env bash
# Pemasang native host Kalam untuk Linux (Chrome/Chromium/Brave/Edge).
# Pakai: ./install-linux.sh <EXTENSION_ID> [folder-naskah]
set -euo pipefail
ID="${1:-}"
if [[ -z "$ID" ]]; then
  echo "Pakai: ./install-linux.sh <EXTENSION_ID> [folder-naskah]" >&2
  echo "EXTENSION_ID ada di chrome://extensions setelah Load unpacked." >&2
  exit 1
fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="$HERE/kalam-host.py"
chmod +x "$HOST"
FOLDER="${2:-$HOME/Documents/Kalam}"
mkdir -p "$FOLDER"

for DIR in "$HOME/.config/google-chrome/NativeMessagingHosts" \
           "$HOME/.config/chromium/NativeMessagingHosts" \
           "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts" \
           "$HOME/.config/microsoft-edge/NativeMessagingHosts"; do
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

echo "Folder naskah: $FOLDER"
echo "Bila ingin folder lain, set KALAM_FOLDER di lingkungan browser Anda."
echo "Selesai. Nyalakan 'Aplikasi desktop (native)' di tab Koneksi, lalu tekan Uji."