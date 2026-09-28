"""
MetaTrader 5 Bridge
===================
Returns an object that behaves like the `MetaTrader5` module on every platform.

- Windows: the official `MetaTrader5` package, imported directly.
- macOS / Linux (MT5_HOST set): the package runs under Windows Python inside the
  MetaTrader 5.app Wine prefix and is exposed over RPyC by `mt5_server.py`
  (started with `./start_mt5_server.sh`). Calls are evaluated on the server and
  results are copied back as plain local objects.

Environment:
    MT5_HOST=127.0.0.1   enable the RPyC bridge (leave empty on Windows)
    MT5_PORT=18813       port of start_mt5_server.sh
"""

import datetime as _dt
import os
from types import SimpleNamespace
from typing import Any, Optional

from dotenv import load_dotenv
from loguru import logger

load_dotenv()


class MT5Record(SimpleNamespace):
    """Local copy of an MT5 result struct (AccountInfo, TradePosition, ...)."""

    def _asdict(self) -> dict:
        return dict(self.__dict__)


def _plain(value: Any) -> Any:
    """Normalize an argument so its repr() evaluates identically on the server."""
    if isinstance(value, (str, bool, type(None), _dt.datetime, _dt.date)):
        return value
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return type(value)(_plain(v) for v in value)
    if hasattr(value, "item"):  # numpy scalar
        value = value.item()
    if isinstance(value, int):
        return int(value)
    if isinstance(value, float):
        return float(value)
    raise TypeError(f"Unsupported MT5 bridge argument type: {type(value).__name__}")


def _local(obj: Any) -> Any:
    """Copy an RPyC remote object into this process."""
    from rpyc.core.netref import BaseNetref
    from rpyc.utils.classic import obtain

    if not isinstance(obj, BaseNetref):
        return obj
    # MT5 structs are C structseqs that can't be pickled: copy field by field.
    if hasattr(obj, "_asdict"):
        return MT5Record(**{k: _local(v) for k, v in obj._asdict().items()})
    if isinstance(obj, tuple):
        return tuple(_local(v) for v in obj)
    return obtain(obj)  # numpy arrays (rates, ticks), scalars


class RemoteMT5:
    """`MetaTrader5` module proxy over an RPyC classic connection."""

    def __init__(self, host: str, port: int):
        import rpyc

        try:
            self._conn = rpyc.classic.connect(host, port, keepalive=True)
        except ConnectionRefusedError as e:
            raise ConnectionError(
                f"MT5 bridge server not reachable at {host}:{port}. Open MetaTrader 5.app "
                "(logged in, Algo Trading on) and run ./start_mt5_server.sh, then retry."
            ) from e
        # Terminal start + login can exceed the 30 s default
        self._conn._config["sync_request_timeout"] = 180
        self._conn.execute("import MetaTrader5 as _mt5, datetime")
        self._module = self._conn.modules.MetaTrader5
        self._constants: dict = {}

    def __getattr__(self, name: str) -> Any:
        if name.startswith("_"):
            raise AttributeError(name)
        if name in self._constants:
            return self._constants[name]
        attr = getattr(self._module, name)
        if not callable(attr):
            value = _local(attr)
            self._constants[name] = value
            return value
        return lambda *args, **kwargs: self._call(name, args, kwargs)

    def _call(self, fn: str, args: tuple, kwargs: dict) -> Any:
        # The MT5 C functions reject dicts / datetimes passed as RPyC proxies
        # ("Unnamed arguments not allowed"), so the call is evaluated on the server
        # from repr(). Arguments are plain str/int/float/datetime, so repr is exact.
        parts = [repr(_plain(a)) for a in args]
        parts += [f"{k}={_plain(v)!r}" for k, v in kwargs.items()]
        return _local(self._conn.eval(f"_mt5.{fn}({', '.join(parts)})"))


_remote: Optional[RemoteMT5] = None


def load_mt5() -> Optional[Any]:
    """Return the MetaTrader5 module (native or remote), or None if unavailable.
    The remote connection is shared by every caller in this process."""
    global _remote
    host = os.getenv("MT5_HOST")
    if host:
        if _remote is not None:
            return _remote
        port = int(os.getenv("MT5_PORT", "18813"))
        try:
            _remote = RemoteMT5(host, port)
            logger.info(f"MT5 bridge connected: {host}:{port} (Wine RPyC)")
            return _remote
        except (ConnectionError, ImportError) as e:
            logger.warning(f"MT5 bridge unavailable: {e}")
            return None
    try:
        import MetaTrader5 as mt5

        return mt5
    except ImportError:
        logger.warning("MetaTrader5 not installed and MT5_HOST not set. Running in simulation mode.")
        return None
