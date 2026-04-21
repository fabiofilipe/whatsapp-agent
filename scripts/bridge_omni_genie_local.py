#!/usr/bin/env python3
import json
import os
import socket
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / ".env"


def load_dotenv(path: Path) -> None:
    if not path.exists():
      return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def log(message: str) -> None:
    print(f"[bridge-omni-genie] {message}", flush=True)


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"variavel obrigatoria ausente: {name}")
    return value


def http_json(method: str, url: str, api_key: str, body: dict | None = None) -> dict:
    data = None
    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = resp.read()
    return json.loads(raw.decode("utf-8")) if raw else {}


def nats_publish(server: tuple[str, int], subject: str, payload: dict) -> None:
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    msg = f"PUB {subject} {len(raw)}\r\n".encode("utf-8") + raw + b"\r\n"
    with socket.create_connection(server, timeout=5) as sock:
        sock.settimeout(5)
        try:
            sock.recv(4096)
        except OSError:
            pass
        sock.sendall(msg)


class NatsSubscriber:
    def __init__(self, host: str, port: int, subject: str, on_message):
        self.host = host
        self.port = port
        self.subject = subject
        self.on_message = on_message
        self._stop = False

    def stop(self) -> None:
        self._stop = True

    def run_forever(self) -> None:
        while not self._stop:
            try:
                self._run_once()
            except Exception as exc:
                log(f"subscriber reconnect after error: {exc}")
                time.sleep(2)

    def _run_once(self) -> None:
        with socket.create_connection((self.host, self.port), timeout=5) as sock:
            sock.settimeout(None)
            file = sock.makefile("rwb", buffering=0)
            sid = "1"
            file.write(f"SUB {self.subject} {sid}\r\n".encode("utf-8"))
            file.write(b"PING\r\n")
            file.flush()

            while not self._stop:
                line = file.readline()
                if not line:
                    raise RuntimeError("NATS socket closed")
                text = line.decode("utf-8", errors="replace").strip()
                if not text:
                    continue
                if text.startswith("INFO"):
                    continue
                if text == "PING":
                    file.write(b"PONG\r\n")
                    file.flush()
                    continue
                if text in {"PONG", "+OK"}:
                    continue
                if text.startswith("-ERR"):
                    raise RuntimeError(text)
                if text.startswith("MSG "):
                    parts = text.split()
                    if len(parts) < 4:
                        continue
                    subject = parts[1]
                    size = int(parts[3])
                    payload = file.read(size)
                    file.read(2)  # trailing CRLF
                    self.on_message(subject, payload.decode("utf-8", errors="replace"))


def main() -> int:
    load_dotenv(ENV_PATH)

    omni_api_url = os.environ.get("OMNI_API_URL", "http://localhost:8882").rstrip("/")
    omni_api_key = require_env("OMNI_API_KEY")
    instance_id = require_env("OMNI_INSTANCE_ID")
    agent_name = os.environ.get("AGENT_NAME", "assistente").strip() or "assistente"
    poll_interval = float(os.environ.get("BRIDGE_POLL_INTERVAL_SECONDS", "1.0"))

    nats_url = os.environ.get("GENIE_NATS_URL", "localhost:4222").strip()
    if "://" in nats_url:
        parsed = urllib.parse.urlparse(nats_url)
        nats_host = parsed.hostname or "localhost"
        nats_port = parsed.port or 4222
    else:
        host, _, port = nats_url.partition(":")
        nats_host = host or "localhost"
        nats_port = int(port or "4222")

    nats_server = (nats_host, nats_port)
    seen_ids: set[str] = set()

    # Seed with recent messages to avoid replay on startup.
    seed = http_json(
        "GET",
        f"{omni_api_url}/api/v2/messages?instanceId={urllib.parse.quote(instance_id)}&limit=20",
        omni_api_key,
    )
    for item in seed.get("items", []):
        external_id = item.get("externalId")
        if external_id:
            seen_ids.add(str(external_id))

    def handle_reply(subject: str, raw_payload: str) -> None:
        try:
            payload = json.loads(raw_payload)
        except json.JSONDecodeError:
            log(f"reply ignored (invalid json): {subject}")
            return

        content = str(payload.get("content") or "").strip()
        if not content:
            return

        chat_id = str(payload.get("chat_id") or "")
        if not chat_id and subject.startswith(f"omni.reply.{instance_id}."):
            chat_id = subject.split(f"omni.reply.{instance_id}.", 1)[1]
        if not chat_id:
            log(f"reply ignored (missing chat): {subject}")
            return

        body = {
            "instanceId": instance_id,
            "to": chat_id,
            "text": content,
        }
        try:
            http_json("POST", f"{omni_api_url}/api/v2/messages/send", omni_api_key, body)
            log(f"reply delivered to {chat_id}")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            log(f"reply delivery failed ({chat_id}): {exc.code} {detail}")
        except Exception as exc:
            log(f"reply delivery failed ({chat_id}): {exc}")

    subscriber = NatsSubscriber(nats_host, nats_port, f"omni.reply.{instance_id}.>", handle_reply)
    thread = threading.Thread(target=subscriber.run_forever, daemon=True)
    thread.start()
    log(f"reply subscriber started on omni.reply.{instance_id}.>")

    while True:
        try:
            response = http_json(
                "GET",
                f"{omni_api_url}/api/v2/messages?instanceId={urllib.parse.quote(instance_id)}&limit=10",
                omni_api_key,
            )
            items = response.get("items", [])
            items.reverse()

            for item in items:
                external_id = str(item.get("externalId") or "")
                if not external_id or external_id in seen_ids:
                    continue
                seen_ids.add(external_id)

                if item.get("isFromMe") is True:
                    continue

                raw_payload = item.get("rawPayload") or {}
                chat_id = (
                    raw_payload.get("resolvedPhoneJid")
                    or raw_payload.get("resolvedPhone")
                    or raw_payload.get("chatId")
                    or item.get("senderPlatformUserId")
                    or ""
                )
                if isinstance(chat_id, str) and chat_id.isdigit():
                    chat_id = f"{chat_id}@s.whatsapp.net"
                chat_id = str(chat_id).strip()
                if not chat_id:
                    continue

                content = (
                    item.get("textContent")
                    or item.get("transcription")
                    or item.get("imageDescription")
                    or item.get("videoDescription")
                    or item.get("documentExtraction")
                    or "[Media message]"
                )

                sender = (
                    item.get("senderDisplayName")
                    or item.get("senderPlatformUserId")
                    or "whatsapp-user"
                )

                payload = {
                    "content": str(content),
                    "sender": str(sender),
                    "instanceId": instance_id,
                    "chatId": chat_id,
                    "agent": agent_name,
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "traceId": f"bridge-{uuid.uuid4()}",
                    "messageId": external_id,
                    "env": {
                        "OMNI_INSTANCE": instance_id,
                        "OMNI_CHAT": chat_id,
                        "OMNI_MESSAGE": external_id,
                    },
                }

                subject = f"omni.message.{instance_id}.{chat_id}"
                nats_publish(nats_server, subject, payload)
                log(f"published inbound message {external_id} to {subject}")
        except KeyboardInterrupt:
            subscriber.stop()
            return 0
        except Exception as exc:
            log(f"poll error: {exc}")

        time.sleep(poll_interval)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        log(str(exc))
        raise SystemExit(1)
