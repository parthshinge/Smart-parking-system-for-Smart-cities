"""Python simulator for the Smart Parking System for Smart Cities project."""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Iterable, Sequence

import requests


DEFAULT_TARGET = "http://127.0.0.1:1880"
DEFAULT_SLOT_COUNT = 8


@dataclass(frozen=True)
class ParkingEvent:
    slot_id: str
    occupied: bool
    gate: str
    vehicle_id: str
    source: str
    timestamp: str

    def to_payload(self) -> dict[str, object]:
        return asdict(self)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build_slot_ids(slot_count: int = DEFAULT_SLOT_COUNT) -> list[str]:
    if slot_count < 1:
        raise ValueError("slot_count must be at least 1")
    return [f"A{index}" for index in range(1, slot_count + 1)]


def random_vehicle_id() -> str:
    letters = "".join(random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(2))
    digits = random.randint(1000, 9999)
    return f"MH{random.randint(10, 99)}{letters}{digits}"


def create_event(
    slot_id: str,
    occupied: bool,
    vehicle_id: str | None = None,
    source: str = "python-simulator",
    timestamp: str | None = None,
) -> ParkingEvent:
    return ParkingEvent(
        slot_id=slot_id,
        occupied=occupied,
        gate="entry" if occupied else "exit",
        vehicle_id=vehicle_id or random_vehicle_id(),
        source=source,
        timestamp=timestamp or utc_now(),
    )


def scenario_events(slot_ids: Sequence[str]) -> list[ParkingEvent]:
    if len(slot_ids) < 4:
        raise ValueError("scenario mode needs at least 4 slots")
    return [
        create_event(slot_ids[0], True, "MH12AB1234"),
        create_event(slot_ids[1], True, "MH14CD5678"),
        create_event(slot_ids[2], True, "MH20EF9012"),
        create_event(slot_ids[0], False, "MH12AB1234"),
        create_event(slot_ids[3], True, "MH31GH3456"),
        create_event(slot_ids[1], False, "MH14CD5678"),
    ]


class HttpTransport:
    def __init__(self, target: str, timeout: float = 10.0) -> None:
        self.endpoint = target.rstrip("/") + "/api/parking/device-event"
        self.timeout = timeout

    def publish(self, event: ParkingEvent) -> dict[str, object]:
        response = requests.post(self.endpoint, json=event.to_payload(), timeout=self.timeout)
        response.raise_for_status()
        if response.text:
            return response.json()
        return {}


class WatsonTransport:
    def __init__(self) -> None:
        try:
            import wiotp.sdk.device as wiotp_device
        except ImportError as exc:
            raise RuntimeError(
                "Watson transport requires wiotp-sdk. Install it with: "
                "pip install -r requirements-ibm.txt"
            ) from exc

        options = {
            "identity": {
                "orgId": require_env("IBM_ORG_ID"),
                "typeId": require_env("IBM_DEVICE_TYPE"),
                "deviceId": require_env("IBM_DEVICE_ID"),
            },
            "auth": {"token": require_env("IBM_AUTH_TOKEN")},
        }
        self.event_id = os.getenv("IBM_EVENT_ID", "parkingStatus")
        self.client = wiotp_device.DeviceClient(config=options)
        self.client.connect()

    def publish(self, event: ParkingEvent) -> dict[str, object]:
        ok = self.client.publishEvent(self.event_id, "json", event.to_payload(), qos=0)
        if not ok:
            raise RuntimeError("Watson IoT publish failed")
        return {"ok": True, "transport": "watson"}


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def run_events(events: Iterable[ParkingEvent], transport: HttpTransport | WatsonTransport, delay: float) -> None:
    for event in events:
        result = transport.publish(event)
        print(json.dumps({"sent": event.to_payload(), "response": result}, indent=2))
        if delay > 0:
            time.sleep(delay)


def run_random(slot_ids: Sequence[str], transport: HttpTransport | WatsonTransport, delay: float) -> None:
    occupied: dict[str, str] = {}
    while True:
        slot_id = random.choice(list(slot_ids))
        if slot_id in occupied and random.random() < 0.55:
            vehicle_id = occupied.pop(slot_id)
            event = create_event(slot_id, False, vehicle_id)
        else:
            vehicle_id = random_vehicle_id()
            occupied[slot_id] = vehicle_id
            event = create_event(slot_id, True, vehicle_id)
        run_events([event], transport, delay)


def run_interactive(slot_ids: Sequence[str], transport: HttpTransport | WatsonTransport, delay: float) -> None:
    print("Interactive smart parking simulator")
    print("Commands: entry <slot> <vehicle>, exit <slot> <vehicle>, quit")
    while True:
        raw = input("> ").strip()
        if raw.lower() in {"q", "quit", "exit"}:
            return
        parts = raw.split()
        if len(parts) != 3 or parts[0] not in {"entry", "exit"}:
            print("Use: entry A1 MH12AB1234 or exit A1 MH12AB1234")
            continue
        action, slot_id, vehicle_id = parts
        if slot_id not in slot_ids:
            print(f"Unknown slot {slot_id}. Valid slots: {', '.join(slot_ids)}")
            continue
        run_events([create_event(slot_id, action == "entry", vehicle_id)], transport, delay)


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Simulate smart parking sensor and gate events.")
    parser.add_argument("--mode", choices=["scenario", "random", "interactive"], default="scenario")
    parser.add_argument("--transport", choices=["http", "watson"], default="http")
    parser.add_argument("--target", default=DEFAULT_TARGET, help="Node-RED base URL for HTTP transport")
    parser.add_argument("--slots", type=int, default=DEFAULT_SLOT_COUNT, help="Number of parking slots")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between events in seconds")
    return parser.parse_args(argv)


def build_transport(name: str, target: str) -> HttpTransport | WatsonTransport:
    if name == "http":
        return HttpTransport(target)
    return WatsonTransport()


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    slot_ids = build_slot_ids(args.slots)
    transport = build_transport(args.transport, args.target)

    if args.mode == "scenario":
        run_events(scenario_events(slot_ids), transport, args.delay)
    elif args.mode == "random":
        run_random(slot_ids, transport, args.delay)
    else:
        run_interactive(slot_ids, transport, args.delay)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

