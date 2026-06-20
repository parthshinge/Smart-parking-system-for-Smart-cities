# Smart Parking System for Smart Cities

An end-to-end smart parking demo built from the project brief. It uses Node-RED as the web app and API layer, plus a Python simulator that publishes parking slot and gate events.

The core demo works locally without IBM Cloud credentials. Optional IBM Watson IoT publishing is included for users who want to connect the simulator to IBM services later.

## Features

- Real-time parking slot status for 8 default slots.
- Entry and exit gate event processing.
- Filled, empty, and booked slot counts.
- Browser UI at `/smart-parking`.
- Booking and cancellation actions from the UI.
- Python simulator with scenario, random, and interactive modes.
- Local JSON Lines event log at `data/parking_events.jsonl`.
- Optional Watson IoT transport using `wiotp-sdk`.

## Project Structure

```text
node-red/flows.json              Node-RED API and web UI flow
simulator/parking_simulator.py   Python sensor and gate simulator
tests/test_simulator.py          Python unit tests
data/sample_events.jsonl         Example event log records
.env.example                     Optional IBM Watson IoT settings
```

## Prerequisites

- Node.js 20 or newer
- Python 3.10 or newer

## Run the Local Demo

Install Node dependencies:

```bash
npm install
```

Start Node-RED:

```bash
npm start
```

Open the built-in Node-RED UI:

```text
http://127.0.0.1:1880/smart-parking
```

Start the standalone browser dashboard:

```bash
npm run start:web
```

Then open:

```text
http://127.0.0.1:3000
```

In a second terminal, install Python dependencies and run the scenario simulator:

```bash
python -m pip install -r requirements.txt
python -m simulator.parking_simulator --mode scenario --delay 1
```

The UI will update as the simulator sends entry and exit events.

## Simulator Modes

Run a deterministic project demo:

```bash
python -m simulator.parking_simulator --mode scenario
```

Run continuous random sensor activity:

```bash
python -m simulator.parking_simulator --mode random --delay 2
```

Run manual input mode:

```bash
python -m simulator.parking_simulator --mode interactive
```

Example interactive commands:

```text
entry A1 MH12AB1234
exit A1 MH12AB1234
quit
```

## API

### `GET /api/parking/status`

Returns current totals and slot state.

### `POST /api/parking/device-event`

Accepts sensor and gate events from the simulator.

```json
{
  "slot_id": "A1",
  "occupied": true,
  "gate": "entry",
  "vehicle_id": "MH12AB1234",
  "source": "python-simulator",
  "timestamp": "2026-06-20T10:00:00Z"
}
```

### `POST /api/parking/book`

Books an available slot.

```json
{
  "slot_id": "A3",
  "vehicle_id": "MH15XY7890"
}
```

### `POST /api/parking/cancel`

Cancels a booked slot.

```json
{
  "slot_id": "A3"
}
```

### `POST /api/parking/reset`

Resets all slots to available and clears counters.

## Optional IBM Watson IoT Transport

Copy the example environment file and fill in real device credentials:

```bash
copy .env.example .env
```

Install the optional IBM SDK:

```bash
python -m pip install -r requirements-ibm.txt
```

Set the environment variables from `.env`, then publish to Watson IoT:

```bash
python -m simulator.parking_simulator --transport watson --mode scenario
```

The same event schema is used for both local HTTP and Watson IoT publishing.

## Validate and Test

Validate the Node-RED flow JSON:

```bash
npm run validate:flows
```

Run Python tests:

```bash
pytest
```

## Notes

- The project uses standard Node-RED HTTP, template, function, file, and response nodes.
- It does not use the deprecated `node-red-dashboard` package.
- Event logs are kept out of Git by default, except for `data/sample_events.jsonl`.

