/* Client-side app for Smart Parking Dashboard */
const api = {
  status: '/api/parking/status',
  book: '/api/parking/book',
  cancel: '/api/parking/cancel',
  reset: '/api/parking/reset',
  deviceEvent: '/api/parking/device-event'
};

function addLog(text, cls=''){
  const el = document.getElementById('log-stream');
  const line = document.createElement('div');
  line.className = `log-line ${cls}`.trim();
  /**
   * Smart Parking System - Frontend Controller
   * Handles local simulation, visualizer animations, analytics, and activity logging.
   */

  document.addEventListener('DOMContentLoaded', () => {
      // State Variables
      const slots = {
          A1: 0,
          A2: 0,
          A3: 0,
          A4: 0,
          A5: 0,
          A6: 0
      };
      let totalVehiclesLogged = 0;
      let entryGateOpen = false;
      let exitGateOpen = false;

      // DOM Elements
      const elements = {
          timeDisplay: document.getElementById('system-time'),
          btnTriggerEntry: document.getElementById('btn-trigger-entry'),
          btnTriggerExit: document.getElementById('btn-trigger-exit'),
          chkEntryGate: document.getElementById('chk-entry-gate'),
          chkExitGate: document.getElementById('chk-exit-gate'),
          btnRandomOccupancy: document.getElementById('btn-random-occupancy'),
          btnClearAll: document.getElementById('btn-clear-all'),
          entryGateArm: document.getElementById('entry-gate-arm'),
          exitGateArm: document.getElementById('exit-gate-arm'),
          valAvailableSlots: document.getElementById('val-available-slots'),
          valOccupiedSlots: document.getElementById('val-occupied-slots'),
          valOccupancyRate: document.getElementById('val-occupancy-rate'),
          occupancyFill: document.getElementById('occupancy-fill'),
          valTotalVehicles: document.getElementById('val-total-vehicles'),
          bookingSlotSelect: document.getElementById('booking-slot-select'),
          btnBookSlot: document.getElementById('btn-book-slot'),
          btnCancelSlot: document.getElementById('btn-cancel-slot'),
          logStream: document.getElementById('log-stream'),
          btnClearLogs: document.getElementById('btn-clear-logs'),
          slotElements: document.querySelectorAll('.slot-item')
      };

      // Initialize clock
      function updateClock() {
          const now = new Date();
          elements.timeDisplay.textContent = now.toLocaleTimeString();
      }
      setInterval(updateClock, 1000);
      updateClock();

      // Logger Utility
      function logEvent(message, type = 'system') {
          const line = document.createElement('div');
          line.className = `log-line ${type}`;
        
          const timestamp = new Date().toLocaleTimeString();
          line.textContent = `[${timestamp}] ${message}`;
        
          elements.logStream.appendChild(line);
          elements.logStream.scrollTop = elements.logStream.scrollHeight;
      }

      // Update Analytics Panel
      function updateAnalytics() {
          const total = Object.keys(slots).length;
          const occupied = Object.values(slots).filter(status => status === 1).length;
          const available = total - occupied;
          const occupancyRate = Math.round((occupied / total) * 100);

          elements.valAvailableSlots.textContent = available;
          elements.valOccupiedSlots.textContent = occupied;
          elements.valTotalVehicles.textContent = totalVehiclesLogged;
          elements.valOccupancyRate.textContent = `${occupancyRate}%`;
          elements.occupancyFill.style.width = `${occupancyRate}%`;

          // Update colors depending on occupancy
          if (occupancyRate >= 80) {
              elements.occupancyFill.style.background = 'linear-gradient(to right, #f39c12, #e74c3c)';
              elements.occupancyFill.style.boxShadow = '0 0 10px rgba(231, 76, 60, 0.6)';
          } else {
              elements.occupancyFill.style.background = 'linear-gradient(to right, #00f2fe, #4d6cfa)';
              elements.occupancyFill.style.boxShadow = '0 0 10px rgba(0, 242, 254, 0.6)';
          }
      }

      // Update Slot Visual State
      function updateSlotVisual(slotId) {
          const slotEl = document.getElementById(`slot-${slotId}`);
          if (!slotEl) return;

          const status = slots[slotId];
          const indicatorEl = slotEl.querySelector('.slot-indicator');

          if (status === 1) {
              slotEl.classList.remove('empty');
              slotEl.classList.add('filled');
              indicatorEl.textContent = 'OCCUPIED';
          } else {
              slotEl.classList.remove('filled');
              slotEl.classList.add('empty');
              indicatorEl.textContent = 'FREE';
          }
      }

      // Set Slot Status
      function setSlotStatus(slotId, isOccupied, source = 'local') {
          if (slots[slotId] === isOccupied) return;

          slots[slotId] = isOccupied;
          updateSlotVisual(slotId);
        
          if (isOccupied === 1) {
              totalVehiclesLogged++;
              logEvent(`[SENSOR] Vehicle detected in Slot ${slotId} (${source.toUpperCase()}).`, 'event');
          } else {
              logEvent(`[SENSOR] Slot ${slotId} vacated (${source.toUpperCase()}).`, 'event');
          }

          updateAnalytics();
          publishTelemetryMock(slotId, isOccupied ? 'park' : 'vacate');
      }

      // Publish Telemetry Mock (Logs Watson IoT simulator activities)
      function publishTelemetryMock(slotId, action) {
          const payload = {
              slots: slots,
              filledSlots: Object.values(slots).filter(s => s === 1).length,
              emptySlots: Object.values(slots).filter(s => s === 0).length,
              vehicleCount: totalVehiclesLogged,
              timestamp: Date.now()
          };
          logEvent(`[IoT CLOUD] Published status update. Event: ${action.toUpperCase()} Slot ${slotId}.`, 'system');
          logEvent(`[CLOUDANT DB] Storing transaction event: slot=${slotId}, action=${action}`, 'system');
      }

      // Gate Operations
      function animateGate(gate, open) {
          const arm = gate === 'entry' ? elements.entryGateArm : elements.exitGateArm;
          const checkbox = gate === 'entry' ? elements.chkEntryGate : elements.chkExitGate;

          if (open) {
              arm.classList.remove('closed');
              arm.classList.add('open');
              checkbox.checked = true;
              logEvent(`[GATE] Automated ${gate.toUpperCase()} gate opening. Barrier UP.`, 'system');
          } else {
              arm.classList.remove('open');
              arm.classList.add('closed');
              checkbox.checked = false;
              logEvent(`[GATE] Automated ${gate.toUpperCase()} gate closing. Barrier DOWN.`, 'system');
          }
      }

      // Trigger Entry Lane Flow
      function triggerEntry() {
          const availableSlots = Object.keys(slots).filter(s => slots[s] === 0);
          if (availableSlots.length === 0) {
              logEvent('[ENTRY DENIED] Parking lot full! Visual sign displaying: "FULL".', 'error');
              alert('Parking Lot is Full!');
              return;
          }

          elements.btnTriggerEntry.disabled = true;
          logEvent('[SENSOR] Vehicle detected at Entry Gate loop sensor.', 'event');
        
          // Open Gate
          animateGate('entry', true);

          // Vehicle enters and parks
          setTimeout(() => {
              const assignedSlot = availableSlots[0];
              setSlotStatus(assignedSlot, 1, 'sensor');
          }, 1200);

          // Close Gate
          setTimeout(() => {
              animateGate('entry', false);
              elements.btnTriggerEntry.disabled = false;
          }, 3200);
      }

      // Trigger Exit Lane Flow
      function triggerExit() {
          const occupiedSlots = Object.keys(slots).filter(s => slots[s] === 1);
          if (occupiedSlots.length === 0) {
              logEvent('[EXIT WARNING] Loop sensor detected movement but no vehicles are recorded inside.', 'warning');
              return;
          }

          elements.btnTriggerExit.disabled = true;
          logEvent('[SENSOR] Vehicle approaching Exit Gate loop sensor.', 'event');
        
          // Open Gate
          animateGate('exit', true);

          // Vehicle leaves and frees slot
          setTimeout(() => {
              // Free the first occupied slot
              const freedSlot = occupiedSlots[0];
              setSlotStatus(freedSlot, 0, 'sensor');
          }, 1200);

          // Close Gate
          setTimeout(() => {
              animateGate('exit', false);
              elements.btnTriggerExit.disabled = false;
          }, 3200);
      }

      // Event Listeners for Sensors
      elements.btnTriggerEntry.addEventListener('click', triggerEntry);
      elements.btnTriggerExit.addEventListener('click', triggerExit);

      // Manual Gate Overrides
      elements.chkEntryGate.addEventListener('change', (e) => {
          animateGate('entry', e.target.checked);
      });
      elements.chkExitGate.addEventListener('change', (e) => {
          animateGate('exit', e.target.checked);
      });

      // Remote Booking Panel Actions
      elements.btnBookSlot.addEventListener('click', () => {
          const selectedSlot = elements.bookingSlotSelect.value;
          logEvent(`[WEB COMMAND] Sent Booking request for Slot ${selectedSlot} to Cloud.`, 'command');
        
          if (slots[selectedSlot] === 1) {
              logEvent(`[IoT COMMAND FAIL] Cannot book. Slot ${selectedSlot} already occupied.`, 'error');
              alert(`Slot ${selectedSlot} is already occupied!`);
          } else {
              setSlotStatus(selectedSlot, 1, 'web UI');
              logEvent(`[IoT CLOUD] Device processed remote command 'book' for Slot ${selectedSlot}.`, 'command');
          }
      });

      elements.btnCancelSlot.addEventListener('click', () => {
          const selectedSlot = elements.bookingSlotSelect.value;
          logEvent(`[WEB COMMAND] Sent Cancellation request for Slot ${selectedSlot} to Cloud.`, 'command');
        
          if (slots[selectedSlot] === 0) {
              logEvent(`[IoT COMMAND FAIL] Cannot cancel. Slot ${selectedSlot} is already empty.`, 'error');
              alert(`Slot ${selectedSlot} is already empty!`);
          } else {
              setSlotStatus(selectedSlot, 0, 'web UI');
              logEvent(`[IoT CLOUD] Device processed remote command 'cancel' for Slot ${selectedSlot}.`, 'command');
          }
      });

      // Demo actions
      elements.btnRandomOccupancy.addEventListener('click', () => {
          logEvent('[DEMO] Randomizing parking slots occupancy...', 'system');
          Object.keys(slots).forEach(slotId => {
              const isOccupied = Math.random() > 0.5 ? 1 : 0;
              setSlotStatus(slotId, isOccupied, 'demo');
          });
      });

      elements.btnClearAll.addEventListener('click', () => {
          logEvent('[DEMO] Clearing all parking slots...', 'system');
          Object.keys(slots).forEach(slotId => {
              setSlotStatus(slotId, 0, 'demo');
          });
      });

      // Directly click slot to toggle status
      elements.slotElements.forEach(slotEl => {
          slotEl.addEventListener('click', () => {
              const slotId = slotEl.getAttribute('data-slot');
              const currentStatus = slots[slotId];
              setSlotStatus(slotId, currentStatus === 1 ? 0 : 1, 'direct click');
          });
      });

      // Clear logs
      elements.btnClearLogs.addEventListener('click', () => {
          elements.logStream.innerHTML = '';
          logEvent('Activity logs cleared.', 'system');
      });

      // Initialize visual state
      Object.keys(slots).forEach(slotId => {
          updateSlotVisual(slotId);
      });
      updateAnalytics();
  });
