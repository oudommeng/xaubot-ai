# Running XAUBot AI

Step-by-step guide to run the bot against a **demo account** (recommended before going live).

- [1. Requirements](#1-requirements)
- [2. Install](#2-install)
- [3. Configure `.env`](#3-configure-env)
- [4. macOS: start the MT5 bridge](#4-macos-start-the-mt5-bridge)
- [5. Train the models](#5-train-the-models)
- [6. Run the bot](#6-run-the-bot)
- [7. Telegram bot](#7-telegram-bot)
- [8. Monitor & stop](#8-monitor--stop)
- [Troubleshooting](#troubleshooting)

---

## 1. Requirements

| | Windows | macOS |
|---|---|---|
| Python | 3.11+ | 3.11+ (in a `.venv`) |
| MetaTrader 5 | Desktop terminal | `MetaTrader 5.app` (runs under Wine) |
| MT5 Python package | `pip install MetaTrader5` | Installed in the **Windows** Python inside the MT5 Wine prefix, reached through a bridge (see step 4) |
| Account | Broker demo account (e.g. Exness `...-MT5Trial`) | same |

The `MetaTrader5` Python package only exists for Windows. On macOS the bot talks to it over
[RPyC](https://rpyc.readthedocs.io/) (`src/mt5_bridge.py` ↔ `mt5_server.py`).

In the MT5 terminal:

1. Log in to your **demo** account (File → Login to Trade Account).
2. Turn on **Algo Trading** (toolbar button must be green).
3. Make sure the gold symbol is in Market Watch. Its name depends on the broker:
   `XAUUSD`, `XAUUSDm` (Exness), `GOLD`, ...

## 2. Install

```bash
git clone https://github.com/GifariKemal/xaubot-ai.git
cd xaubot-ai

python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
mkdir -p logs
```

## 3. Configure `.env`

```bash
cp .env.example .env
```

Edit `.env`:

```env
# MetaTrader 5 — demo account credentials
MT5_LOGIN=12345678
MT5_PASSWORD=your_password
MT5_SERVER=Exness-MT5Trial7
MT5_PATH=C:\Program Files\MetaTrader 5\terminal64.exe

# macOS only (leave MT5_HOST empty on Windows)
MT5_HOST=127.0.0.1
MT5_PORT=18813

# Trading
SYMBOL=XAUUSDm        # exact symbol name from your broker's Market Watch
CAPITAL=1500          # set to your REAL account balance

# Telegram (optional, see step 7)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

> **Set `CAPITAL` to your actual balance.** Position sizing and the daily loss limit are
> calculated from `CAPITAL`, not from the account. If it is higher than the real balance, the
> bot risks proportionally more per trade.

## 4. macOS: start the MT5 bridge

*Windows users skip this step.*

### One-time setup: Windows Python inside the MT5 Wine prefix

```bash
export WINE="/Applications/MetaTrader 5.app/Contents/SharedSupport/wine/bin/wine"
export WINEPREFIX="$HOME/Library/Application Support/net.metaquotes.wine.metatrader5"
export WINEDEBUG=-all

# Download the Windows installer (64-bit, 3.11.x)
curl -LO https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
"$WINE" python-3.11.9-amd64.exe /quiet InstallAllUsers=1 TargetDir='C:\Python311' PrependPath=0

# Install MT5 package + RPyC (rpyc version must match the one in requirements.txt)
"$WINE" 'C:\Python311\python.exe' -m pip install MetaTrader5 rpyc==6.0.2
```

Check:

```bash
"$WINE" 'C:\Python311\python.exe' -c "import MetaTrader5, rpyc; print('ok')"
```

### Every time: start the bridge

With `MetaTrader 5.app` open and logged in:

```bash
./start_mt5_server.sh
# MT5 RPyC server listening on 127.0.0.1:18813
```

Leave this terminal open for as long as the bot runs.

> The bridge only binds to `127.0.0.1`. Do not expose that port: an RPyC classic server runs any
> code a client sends.

## 5. Train the models

The bot needs `models/xgboost_model.pkl` and `models/hmm_regime.pkl`. Train them from MT5 history
(~1 minute, needs the bridge running on macOS):

```bash
python train_models.py 2>&1 | tee logs/train.log
```

The end of the log should show `HMM Model: SAVED` and `XGBoost Model: SAVED`. Retrain every
week or two, or when the market changes a lot.

## 6. Run the bot

```bash
python main_live.py 2>&1 | tee logs/live.log
```

A healthy start looks like:

```
Symbol: XAUUSDm
Capital: $1,500.00
Simulation: False
HMM Regime model loaded successfully
ML V2 Model D loaded successfully
Connected to MT5: Exness-MT5Trial7 (Account: 12345678)
Account Balance: $1,500.00
Telegram notifier initialized (enabled=True)
Starting main trading loop...
Price: 4124.17 | Regime: medium_volatility | SMC: SELL | ML: HOLD(50%)
```

Check that the `Connected to MT5` line names your **demo** server before you leave it running.

### Keep it running (macOS)

The bot only trades while the Mac is awake and both terminals are open:

| Terminal | Command |
|---|---|
| 1 | `./start_mt5_server.sh` |
| 2 | `python main_live.py` |
| 3 | `caffeinate -i` (stops the Mac from sleeping) |

`MetaTrader 5.app` must stay open too. Run **only one** copy of the bot per account.

## 7. Telegram bot

Telegram is built into `main_live.py`; there is nothing extra to run. It turns on when both keys
are set in `.env`.

1. In Telegram, open **@BotFather**, send `/newbot`, pick a name and a username ending in `bot`.
   Copy the token (`123456789:AAH...`).
2. Open your new bot and press **Start** (or send it any message).
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and copy the number in
   `"chat":{"id":...}`.
4. Put both in `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:AAH...
   TELEGRAM_CHAT_ID=123456789
   ```
5. Restart the bot. The log must say `Telegram notifier initialized (enabled=True)` and you get
   a startup message.

> If the log says `Telegram notifier disabled - missing BOT_TOKEN or CHAT_ID`, nothing is sent,
> even though later lines still print `Telegram: ... sent`.

Keep the token secret: whoever has it controls the bot. The bot only answers messages from
`TELEGRAM_CHAT_ID`.

**Commands:**

| Command | Shows |
|---|---|
| `/status` | Bot and account status |
| `/market` | Current price, regime, signals |
| `/risk` | Risk settings and daily loss usage |
| `/positions` (`/pos`) | Open positions |
| `/daily` | Today's P/L summary |
| `/filters` | Entry filter states, incl. News Filter (toggle in `data/filter_config.json`) |
| `/help` | Command list |

You also get alerts on trade open/close, an hourly market analysis and a daily summary.

## 8. Monitor & stop

**Monitor**

```bash
tail -f logs/live.log                         # everything
grep -E "Order executed|closed" logs/live.log # trades only
```

Positions also show in the MT5 terminal's **Trade** tab and via Telegram `/positions`.

**Stop**

Press `Ctrl+C` in the bot terminal, then in the bridge terminal. Open positions stay open at the
broker with their broker-side stop-loss; the bot picks them up again on the next start
(`Position guards synced`). To close everything, use the MT5 terminal (Windows:
`python scripts/close_positions.py`).

> Most `scripts/*.py` helpers (`check_positions.py`, `close_positions.py`, ...) import
> `MetaTrader5` directly and only work on Windows.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `MT5 bridge server not reachable at 127.0.0.1:18813` | Open `MetaTrader 5.app`, log in, then run `./start_mt5_server.sh` |
| `ModuleNotFoundError: No module named 'X'` | `pip install -r requirements.txt` inside the `.venv` |
| `No such file or directory: logs/...` | `mkdir -p logs` |
| Model not found at startup | Run `python train_models.py` |
| No data / symbol not found | `SYMBOL` must match Market Watch exactly (e.g. `XAUUSDm`) |
| Orders rejected | Algo Trading must be on (green) in the MT5 toolbar |
| Lot size looks too big | `CAPITAL` in `.env` is higher than the real balance |
| `tests/test_mt5_connection.py` says MetaTrader5 not installed (macOS) | Expected, the test doesn't use the bridge. The bot itself connects fine |
