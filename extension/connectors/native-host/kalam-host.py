#!/usr/bin/env python3
"""Kalam native host — jembatan desktop resmi (stdio 4-byte LE, pesan maks 1 MB).

Hanya tiga operasi: ping, saveFile (ke folder naskah yang diizinkan), openFolder.
Tidak ada eksekusi shell bebas; jalur berkas selalu dinormalisasi dan dibatasi.
"""
import json
import os
import struct
import subprocess
import sys
from pathlib import Path

MAX = 1024 * 1024
ROOT = Path(os.environ.get("KALAM_FOLDER", str(Path.home() / "Documents" / "Kalam"))).expanduser()
CAPS = ["ping", "saveFile", "openFolder"]


def read_msg():
    head = sys.stdin.buffer.read(4)
    if len(head) < 4:
        return None
    (n,) = struct.unpack("<I", head)
    if n > MAX:
        raise ValueError("pesan melebihi 1 MB")
    return json.loads(sys.stdin.buffer.read(n).decode("utf-8"))


def send_msg(obj):
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    if len(data) > MAX:
        data = json.dumps({"ok": False, "error": "respons melebihi 1 MB"}).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(data)) + data)
    sys.stdout.buffer.flush()


def safe_path(name):
    ROOT.mkdir(parents=True, exist_ok=True)
    clean = Path(str(name)).name or "naskah.txt"
    target = (ROOT / clean).resolve()
    if ROOT.resolve() not in target.parents and target != ROOT.resolve():
        raise ValueError("jalur di luar folder naskah")
    return target


def handle(msg):
    op = msg.get("op")
    mid = msg.get("id")
    if op == "hello":
        return {"op": "welcome", "host": "kalam-host 1.0.0", "capabilities": CAPS, "folder": str(ROOT)}
    if op == "ping":
        return {"id": mid, "ok": True, "host": "kalam-host 1.0.0", "folder": str(ROOT)}
    if op == "saveFile":
        path = safe_path(msg.get("name", "naskah.txt"))
        text = str(msg.get("text", ""))
        if len(text.encode("utf-8")) > MAX:
            return {"id": mid, "ok": False, "error": "naskah melebihi 1 MB"}
        path.write_text(text, encoding="utf-8")
        return {"id": mid, "ok": True, "path": str(path), "bytes": path.stat().st_size}
    if op == "openFolder":
        folder = ROOT if not msg.get("path") else Path(str(msg["path"])).expanduser().resolve()
        if not folder.is_dir():
            return {"id": mid, "ok": False, "error": "folder tidak ada"}
        if sys.platform == "darwin":
            subprocess.Popen(["open", str(folder)])
        elif os.name == "nt":
            subprocess.Popen(["explorer", str(folder)])
        else:
            subprocess.Popen(["xdg-open", str(folder)])
        return {"id": mid, "ok": True, "path": str(folder)}
    return {"id": mid, "ok": False, "error": f"operasi tidak diizinkan: {op}"}


def main():
    while True:
        try:
            msg = read_msg()
        except Exception as err:  # noqa: BLE001 - laporkan lalu lanjut
            send_msg({"ok": False, "error": str(err)})
            continue
        if msg is None:
            return
        try:
            send_msg(handle(msg))
        except Exception as err:  # noqa: BLE001
            send_msg({"id": msg.get("id"), "ok": False, "error": str(err)})


if __name__ == "__main__":
    main()