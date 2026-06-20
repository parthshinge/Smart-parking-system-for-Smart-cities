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
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  el.prepend(line);
}

async function fetchJson(url, opts){
  const res = await fetch(url, opts);
  const data = await res.json();
  if(!res.ok || data.ok===false) throw new Error(data.error||'Request failed');
  return data;
}

function vehicleId(){
  const letters = Array.from({length:2},()=>String.fromCharCode(65+Math.floor(Math.random()*26))).join('');
  const digits = Math.floor(1000+Math.random()*9000);
  return `MH${Math.floor(10+Math.random()*89)}${letters}${digits}`;
}

let lastStatus = null;

function renderStatus(data){
  lastStatus = data;
  document.getElementById('val-available-slots').textContent = data.available;
  document.getElementById('val-occupied-slots').textContent = data.occupied;
  document.getElementById('val-total-vehicles').textContent = (data.entry_count||0)+(data.exit_count||0);
  const rate = Math.round((data.occupied/data.total||0)*100);
  document.getElementById('val-occupancy-rate').textContent = `${rate}%`;
  document.getElementById('occupancy-fill').style.width = `${rate}%`;

  // update slots
  for(const s of data.slots){
    const el = document.getElementById(`slot-${s.id}`);
    if(!el) continue;
    el.classList.remove('empty','occupied','booked');
    el.classList.add(s.status);
    const indicator = el.querySelector('.slot-indicator');
    const vehicle = el.querySelector('.car-avatar');
    indicator.textContent = s.status.toUpperCase();
    vehicle.title = s.vehicle_id || 'None';
    const val = el.querySelector('.slot-id');
    // small visual tweak for occupied/booked
    if(s.status==='occupied'){
      indicator.textContent = `OCCUPIED`;
    } else if(s.status==='booked'){
      indicator.textContent = `BOOKED`;
    } else {
      indicator.textContent = `FREE`;
    }
  }
  addLog('Status updated.', 'system');
}

async function refresh(){
  try{
    const data = await fetchJson(api.status);
    renderStatus(data);
  }catch(err){ addLog('Refresh error: '+err.message,'system'); }
}

async function sendDeviceEvent(slot_id, occupied){
  const payload = {
    slot_id,
    occupied,
    vehicle_id: vehicleId(),
    source: 'web-ui',
    timestamp: new Date().toISOString()
  };
  try{
    const data = await fetchJson(api.deviceEvent, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    addLog(`Device event ${occupied?'entry':'exit'} ${slot_id}`);
    return data;
  }catch(err){ addLog(`Device event failed: ${err.message}`,'system'); }
}

async function triggerEntry(){
  // find first available slot
  if(!lastStatus) { await refresh(); }
  const free = lastStatus.slots.find(s=>s.status==='available');
  if(!free){ addLog('No free slot available', 'system'); return; }
  await sendDeviceEvent(free.id, true);
  animateGate('entry');
  await refresh();
}

async function triggerExit(){
  if(!lastStatus){ await refresh(); }
  const occ = lastStatus.slots.find(s=>s.status==='occupied');
  if(!occ){ addLog('No occupied vehicles to exit', 'system'); return; }
  await sendDeviceEvent(occ.id, false);
  animateGate('exit');
  await refresh();
}

function animateGate(which){
  const arm = document.getElementById(which==='entry' ? 'entry-gate-arm' : 'exit-gate-arm');
  arm.classList.add('open');
  setTimeout(()=>arm.classList.remove('open'),1200);
}

async function randomizeOccupancy(){
  if(!lastStatus) await refresh();
  const rnd = Math.floor(Math.random()*lastStatus.slots.length)+1;
  // toggle random slots
  for(let i=0;i<rnd;i++){
    const slot = lastStatus.slots[Math.floor(Math.random()*lastStatus.slots.length)];
    const toOccupy = Math.random()>0.5;
    await sendDeviceEvent(slot.id, toOccupy);
  }
  await refresh();
}

async function clearAll(){
  try{
    const data = await fetchJson(api.reset, {method:'POST'});
    addLog('System reset done.');
    await refresh();
  }catch(err){ addLog('Reset failed: '+err.message,'system'); }
}

async function bookSelected(){
  const slot = document.getElementById('booking-slot-select').value;
  const payload = { slot_id: slot, vehicle_id: vehicleId() };
  try{
    const data = await fetchJson(api.book, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    addLog(`Booked ${slot}`);
    await refresh();
  }catch(err){ addLog('Book failed: '+err.message,'system'); }
}

async function cancelSelected(){
  const slot = document.getElementById('booking-slot-select').value;
  try{
    const data = await fetchJson(api.cancel, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slot_id:slot})});
    addLog(`Cancelled ${slot}`);
    await refresh();
  }catch(err){ addLog('Cancel failed: '+err.message,'system'); }
}

function updateTime(){
  document.getElementById('system-time').textContent = new Date().toLocaleTimeString();
}

// wire buttons
window.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('btn-trigger-entry').addEventListener('click', triggerEntry);
  document.getElementById('btn-trigger-exit').addEventListener('click', triggerExit);
  document.getElementById('btn-random-occupancy').addEventListener('click', randomizeOccupancy);
  document.getElementById('btn-clear-all').addEventListener('click', clearAll);
  document.getElementById('btn-book-slot').addEventListener('click', bookSelected);
  document.getElementById('btn-cancel-slot').addEventListener('click', cancelSelected);
  document.getElementById('btn-clear-logs').addEventListener('click', ()=>{document.getElementById('log-stream').innerHTML=''; addLog('Logs cleared','system')});
  updateTime(); setInterval(updateTime,1000);
  refresh(); setInterval(refresh,5000);
});
