from unittest.mock import Mock, patch

import pytest

from simulator.parking_simulator import HttpTransport, build_slot_ids, create_event, scenario_events


def test_build_slot_ids_defaults_to_named_a_slots():
    assert build_slot_ids(4) == ["A1", "A2", "A3", "A4"]


def test_build_slot_ids_rejects_zero():
    with pytest.raises(ValueError):
        build_slot_ids(0)


def test_create_entry_event_uses_expected_gate_and_payload():
    event = create_event("A1", True, "MH12AB1234", timestamp="2026-06-20T10:00:00Z")

    assert event.gate == "entry"
    assert event.to_payload() == {
        "slot_id": "A1",
        "occupied": True,
        "gate": "entry",
        "vehicle_id": "MH12AB1234",
        "source": "python-simulator",
        "timestamp": "2026-06-20T10:00:00Z",
    }


def test_create_exit_event_uses_expected_gate():
    event = create_event("A1", False, "MH12AB1234", timestamp="2026-06-20T10:00:00Z")
    assert event.gate == "exit"


def test_scenario_events_include_entry_and_exit_activity():
    events = scenario_events(build_slot_ids(8))

    assert len(events) == 6
    assert any(event.occupied for event in events)
    assert any(not event.occupied for event in events)


@patch("simulator.parking_simulator.requests.post")
def test_http_transport_posts_to_device_event_endpoint(post: Mock):
    response = Mock()
    response.text = '{"ok": true}'
    response.json.return_value = {"ok": True}
    post.return_value = response
    event = create_event("A1", True, "MH12AB1234", timestamp="2026-06-20T10:00:00Z")

    result = HttpTransport("http://localhost:1880").publish(event)

    post.assert_called_once_with(
        "http://localhost:1880/api/parking/device-event",
        json=event.to_payload(),
        timeout=10.0,
    )
    response.raise_for_status.assert_called_once()
    assert result == {"ok": True}

