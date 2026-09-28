"""RPyC server that exposes the MetaTrader5 package. Runs under WINDOWS Python
(inside the MetaTrader 5.app Wine prefix); started by start_mt5_server.sh.

Security: a classic RPyC service executes arbitrary code for any connected
client, so it only ever binds to 127.0.0.1.
"""

import sys

from rpyc.core import SlaveService
from rpyc.utils.server import ThreadedServer

port = int(sys.argv[1]) if len(sys.argv) > 1 else 18813
server = ThreadedServer(SlaveService, hostname="127.0.0.1", port=port, reuse_addr=True)
print(f"MT5 RPyC server listening on 127.0.0.1:{port}", flush=True)
server.start()
