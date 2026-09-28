#!/usr/bin/env bash
# macOS: start the MT5 RPyC bridge server (mt5_server.py) with the Windows Python that
# lives inside the MetaTrader 5.app Wine prefix. Keep this running while the bot runs.
# Uses its own port (default 18813) so it doesn't share an MT5 session with other bots.
set -euo pipefail
cd "$(dirname "$0")"
export WINE="/Applications/MetaTrader 5.app/Contents/SharedSupport/wine/bin/wine"
export WINEPREFIX="$HOME/Library/Application Support/net.metaquotes.wine.metatrader5"
export WINEDEBUG=-all MVK_CONFIG_LOG_LEVEL=0
PORT="${MT5_PORT:-18813}"
SCRIPT="Z:$(pwd | tr '/' '\\')\\mt5_server.py"
exec "$WINE" 'C:\Python311\python.exe' "$SCRIPT" "$PORT"
