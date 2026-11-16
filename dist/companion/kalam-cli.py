#!/usr/bin/env python3
"""Kalam CLI — server WebSocket loopback untuk LocalBridge (ws://127.0.0.1:8787).

Whitelist perintah: pandoc, wordcount, open-folder, backup. Token pasangan wajib.
Jalankan: PAIRING_TOKEN=rahasia python3 kalam-cli.py --port 8787 --folder ~/Documents/Kalam
Butuh: pip install websockets
"""
import argparse
import asyncio
import json
import os
import shutil
import subprocess
from pathlib import Path

ALLOWED = {"pandoc", "wordcount", "open-folder", "backup"}


class KalamCli:
    def __init__(self, token, folder):
        self.token = token
        self.folder = Path(folder).expanduser().resolve()
        self.folder.mkdir(parents=True, exist_ok=True)

    def safe(self, name):
        p = (self.folder / Path(str(name)).name).resolve()
        if self.folder not in p.parents:
            raise ValueError("jalur di luar folder naskah")
        return p

    def run(self, cmd, args):
        if cmd not in ALLOWED:
            return {"ok": False, "error": f"perintah di luar whitelist: {cmd}"}
        args = [str(a) for a in (args or [])][:12]
        if cmd == "wordcount":
            target = self.safe(args[-1] if args else "naskah.md")
            if not target.exists():
                return {"ok": False, "error": "berkas tidak ada"}
            text = target.read_text(encoding="utf-8", errors="replace")
            return {"ok": True, "words": len(text.split()), "path": str(target)}
        if cmd == "open-folder":
            opener = "open" if os.uname().sysname == "Darwin" else "xdg-open"
            subprocess.Popen([opener, str(self.folder)])
            return {"ok": True, "path": str(self.folder)}
        if cmd == "backup":
            dest = self.folder / "cadangan"
            dest.mkdir(exist_ok=True)
            name = f"naskah-{len(list(dest.iterdir())) + 1}.zip"
            shutil.make_archive(str(dest / name[:-4]), "zip", str(self.folder))
            return {"ok": True, "path": str(dest / name)}
        if not shutil.which("pandoc"):
            return {"ok": False, "error": "pandoc belum terpasang di komputer ini"}
        src = self.safe(args[args.index("--from") - 1] if "--from" in args and args.index("--from") > 0 else "naskah.md")
        out = self.safe(src.stem + ".docx")
        proc = subprocess.run(["pandoc", str(src), "-o", str(out)], capture_output=True, text=True, timeout=120)
        if proc.returncode:
            return {"ok": False, "error": proc.stderr.strip()[:400]}
        return {"ok": True, "path": str(out)}

    async def handler(self, ws):
        authed = False
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send(json.dumps({"ok": False, "error": "JSON tidak valid"}))
                continue
            if msg.get("op") == "hello":
                authed = msg.get("token") == self.token
                await ws.send(json.dumps({"op": "welcome", "ok": authed, "commands": sorted(ALLOWED),
                                          "folder": str(self.folder)} if authed else {"op": "welcome", "ok": False, "error": "token salah"}))
                continue
            if not authed:
                await ws.send(json.dumps({"id": msg.get("id"), "ok": False, "error": "belum dipasangkan"}))
                continue
            if msg.get("op") != "run":
                await ws.send(json.dumps({"id": msg.get("id"), "ok": False, "error": "operasi tidak dikenal"}))
                continue
            try:
                res = await asyncio.to_thread(self.run, msg.get("command"), msg.get("args"))
            except Exception as err:  # noqa: BLE001
                res = {"ok": False, "error": str(err)}
            await ws.send(json.dumps({"id": msg.get("id"), **res}))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--folder", default="~/Documents/Kalam")
    args = ap.parse_args()
    token = os.environ.get("PAIRING_TOKEN", "")
    if not token:
        raise SystemExit("PAIRING_TOKEN wajib diisi (samakan dengan .env di Kalam).")
    try:
        import websockets
    except ImportError:
        raise SystemExit("Pasang dulu: pip install websockets")
    cli = KalamCli(token, args.folder)
    async with websockets.serve(cli.handler, "127.0.0.1", args.port, max_size=1024 * 1024):
        print(f"Kalam CLI siap di ws://127.0.0.1:{args.port} · folder {cli.folder}")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())