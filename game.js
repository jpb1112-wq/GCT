// GCT Departures MVP (no libraries)
// Open index.html in a browser. Drag on canvas to scroll.

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

const timeLabel = document.getElementById("timeLabel");
const trainList = document.getElementById("trainList");

const selectedNone = document.getElementById("selectedNone");
const doorPanel = document.getElementById("doorPanel");
const selName = document.getElementById("selName");
const selLine = document.getElementById("selLine");
const selTrack = document.getElementById("selTrack");
const selDep = document.getElementById("selDep");
const selDoor = document.getElementById("selDoor");
const selBuzz = document.getElementById("selBuzz");
const selConsist = document.getElementById("selConsist");
const selMaint = document.getElementById("selMaint");
const selCond = document.getElementById("selCond");
const selStrict = document.getElementById("selStrict");
const selReli = document.getElementById("selReli");

const btnOpen = document.getElementById("btnOpen");
const btnClose = document.getElementById("btnClose");
const btnBuzz = document.getElementById("btnBuzz");
const btnSwap = document.getElementById("btnSwap");
const opsLog = document.getElementById("opsLog");

// --- Tiny WebAudio helper (no sound files needed) ---
let audioCtx = null;
function ensureAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === "suspended") audioCtx.resume();
}
function beep(freq=880, dur=0.08, type="sine", gain=0.05){
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur);
}
function pattern(trType){
  // Different "door chime vibes" (not real recordings)
  if(trType === "M8"){
    beep(1318, 0.06, "square", 0.035);
    setTimeout(()=>beep(1175,0.08,"square",0.035), 90);
  } else if(trType === "M7A"){
    beep(988, 0.06, "sawtooth", 0.03);
    setTimeout(()=>beep(740,0.08,"sawtooth",0.03), 90);
  } else if(trType === "M3A"){
    beep(784, 0.06, "triangle", 0.03);
    setTimeout(()=>beep(659,0.08,"triangle",0.03), 90);
  } else { // diesel
    beep(440, 0.08, "triangle", 0.035);
    setTimeout(()=>beep(392,0.10,"triangle",0.035), 100);
  }
}

// --- World setup ---
const WORLD = {
  w: 2600,
  h: 640,
  cameraX: 0
};

const TRACKS = [];
const TRACK_COUNT = 14;
const trackY0 = 120;
const trackGap = 34;

for(let i=0;i<TRACK_COUNT;i++){
  const y = trackY0 + i*trackGap;
  TRACKS.push({index:i+1, y});
}

const LINES = [
  {name:"Hudson", destinationPool:["Poughkeepsie","Croton-Harmon","Tarrytown","Yonkers"]},
  {name:"Harlem", destinationPool:["White Plains","North White Plains","Mount Kisco","Southeast"]},
  {name:"New Haven", destinationPool:["Stamford","Greenwich","New Haven","Bridgeport"]}
];

const TRAIN_TYPES = ["M8","M7A","M3A","DIESEL"];
const CONDUCTORS = [
  {name:"S. Alvarez", strictness:82, reliability:91},
  {name:"J. Kim", strictness:64, reliability:76},
  {name:"M. O'Neil", strictness:48, reliability:69},
  {name:"A. Johnson", strictness:72, reliability:58},
  {name:"R. Patel", strictness:55, reliability:83},
  {name:"D. Ruiz", strictness:38, reliability:52}
];

function rnd(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

function logEvent(message){
  const item = document.createElement("div");
  item.className = "logItem";
  item.textContent = `${fmtTime(nowSec)} • ${message}`;
  opsLog.prepend(item);
  while(opsLog.children.length > 8){
    opsLog.removeChild(opsLog.lastChild);
  }
}

let startTime = performance.now();
let nowSec = 0;

function fmtTime(s){
  const m = Math.floor(s/60);
  const r = Math.floor(s%60);
  return String(m).padStart(2,"0")+":"+String(r).padStart(2,"0");
}

function fmtCountdown(s){
  if(s <= 0) return "DUE";
  const m = Math.floor(s/60);
  const r = Math.floor(s%60);
  return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
}

let nextTrainId = 100;
const trains = [];
const people = [];

function spawnTrain(){
  const line = rnd(LINES);
  const dest = rnd(line.destinationPool);
  const trType = rnd(TRAIN_TYPES);
  const conductor = rnd(CONDUCTORS);
  const track = rnd(TRACKS);
  const departIn = 40 + Math.floor(Math.random()*70); // 40–110 seconds from now
  const departAt = nowSec + departIn;
  const maintenanceDueAt = departAt + (80 + Math.random()*120);
  const statusRoll = Math.random();
  const consistStatus = statusRoll < 0.07 ? "BROKEN" : (statusRoll < 0.22 ? "MAINT" : "OK");

  const t = {
    id: nextTrainId++,
    name: `${line.name} to ${dest}`,
    line: line.name,
    dest,
    type: trType,
    track: track.index,
    conductor,
    consistStatus,
    maintenanceDueAt,
    swapUntil: null,
    reportedIssue: false,
    x: 120 + Math.floor(Math.random()* (WORLD.w - 240)),
    y: track.y,
    w: 180,
    h: 18,
    doorX: 0, // computed
    doorOpen: true,
    buzzing: false,
    departAt,
    state: "boarding", // boarding, ready, departing, gone
    departStartedAt: null
  };
  t.doorX = t.x + t.w * 0.72;
  trains.push(t);
  logEvent(`Scheduled ${t.line} Track ${t.track} (${t.type}) to ${t.dest}.`);

  // initial crowd
  const crowdSize = 8 + Math.floor(Math.random()*22);
  for(let i=0;i<crowdSize;i++){
    spawnPersonNearTrain(t, false);
  }
}

function spawnPersonNearTrain(train, late=false){
  const speed = late ? (75 + Math.random()*55) : (25 + Math.random()*25);
  const px = train.x + (Math.random()*240 - 120);
  const py = train.y + (Math.random()*60 - 30);
  people.push({
    x: clamp(px, 60, WORLD.w-60),
    y: clamp(py, 70, WORLD.h-30),
    speed,
    targetTrainId: train.id,
    late,
    boarded:false
  });
}

function getTrainById(id){ return trains.find(t=>t.id===id) || null; }

let selectedTrainId = null;

function setSelected(train){
  selectedTrainId = train ? train.id : null;
  if(!train){
    selectedNone.classList.remove("hidden");
    doorPanel.classList.add("hidden");
    return;
  }
  selectedNone.classList.add("hidden");
  doorPanel.classList.remove("hidden");
  updateDoorPanel(train);
}

function updateDoorPanel(t){
  selName.textContent = `${t.type} • ${t.dest}`;
  selLine.textContent = t.line;
  selTrack.textContent = `Track ${t.track}`;
  selDep.textContent = fmtTime(t.departAt);
  selDoor.textContent = t.doorOpen ? "OPEN" : "CLOSED";
  selBuzz.textContent = t.buzzing ? "ON" : "OFF";
  selConsist.textContent = t.consistStatus;
  selMaint.textContent = fmtCountdown(t.maintenanceDueAt - nowSec);
  selCond.textContent = t.conductor.name;
  selStrict.textContent = `${t.conductor.strictness}%`;
  selReli.textContent = `${t.conductor.reliability}%`;
}

btnOpen.addEventListener("click", ()=>{
  const t = getTrainById(selectedTrainId);
  if(!t || t.state!=="boarding") return;
  t.doorOpen = true;
  t.buzzing = false;
  pattern(t.type);
  updateDoorPanel(t);
});

btnClose.addEventListener("click", ()=>{
  const t = getTrainById(selectedTrainId);
  if(!t || t.state!=="boarding") return;
  t.doorOpen = false;
  pattern(t.type);
  updateDoorPanel(t);
});

btnBuzz.addEventListener("click", ()=>{
  const t = getTrainById(selectedTrainId);
  if(!t || t.state!=="boarding") return;
  // Buzz only makes sense if doors are closed, but we'll allow it for fun.
  t.buzzing = true;
  pattern(t.type);

  // spawn late runners
  const strictnessFactor = clamp(100 - t.conductor.strictness, 10, 90) / 100;
  const lateCount = 1 + Math.floor(Math.random()*(6 + strictnessFactor * 10));
  for(let i=0;i<lateCount;i++){
    spawnPersonNearTrain(t, true);
  }
  updateDoorPanel(t);
});

btnSwap.addEventListener("click", ()=>{
  const t = getTrainById(selectedTrainId);
  if(!t || t.state!=="boarding") return;
  if(t.swapUntil && nowSec < t.swapUntil) return;

  const swapDuration = 25 + Math.random()*25;
  t.swapUntil = nowSec + swapDuration;
  t.consistStatus = "OK";
  t.departAt += 20;
  t.buzzing = false;
  t.doorOpen = true;
  t.reportedIssue = false;
  logEvent(`Consist swap in progress on Track ${t.track} (${Math.ceil(swapDuration)}s).`);
  updateDoorPanel(t);
});

// --- Input: drag to scroll ---
let dragging = false;
let dragStartX = 0;
let camStartX = 0;

canvas.addEventListener("pointerdown",(e)=>{
  canvas.setPointerCapture(e.pointerId);
  dragging = true;
  dragStartX = e.clientX;
  camStartX = WORLD.cameraX;
  ensureAudio(); // iOS needs user gesture to enable audio
});

canvas.addEventListener("pointermove",(e)=>{
  if(!dragging) return;
  const dx = e.clientX - dragStartX;
  WORLD.cameraX = clamp(camStartX - dx, 0, WORLD.w - canvas.width);
});

canvas.addEventListener("pointerup",(e)=>{
  dragging = false;

  // treat small movement as a click/tap to select train
  const moved = Math.abs(e.clientX - dragStartX);
  if(moved < 6){
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    const wx = mx + WORLD.cameraX;
    const wy = my;

    const hit = trains
      .filter(t=>t.state!=="gone")
      .find(t=> wx>=t.x && wx<=t.x+t.w && wy>=t.y-10 && wy<=t.y+10);

    if(hit) setSelected(hit);
  }
});

canvas.addEventListener("pointercancel", ()=> dragging=false);

// --- UI list ---
function doorTag(t){
  if(t.buzzing) return ["BUZZ", "buzz"];
  if(t.doorOpen) return ["OPEN", "open"];
  return ["CLOSED", "closed"];
}

function rebuildTrainList(){
  // show next ~10 trains by depart time
  const upcoming = [...trains]
    .filter(t=>t.state!=="gone")
    .sort((a,b)=>a.departAt-b.departAt)
    .slice(0, 12);

  trainList.innerHTML = "";
  for(const t of upcoming){
    const card = document.createElement("div");
    card.className = "trainCard";
    card.addEventListener("click", ()=> setSelected(t));

    const tag = doorTag(t);
    card.innerHTML = `
      <div class="top">
        <div><b>${t.line}</b> → ${t.dest}</div>
        <div class="tag ${tag[1]}">${tag[0]}</div>
      </div>
      <div class="small">Track ${t.track} • ${t.type} • departs ${fmtTime(t.departAt)}</div>
      <div class="small">Consist: ${t.consistStatus} • Conductor: ${t.conductor.name} (${t.conductor.reliability}%)</div>
    `;
    trainList.appendChild(card);
  }
}

// --- Simulation ---
let spawnCooldown = 0;

function update(dt){
  nowSec = (performance.now() - startTime)/1000;
  timeLabel.textContent = fmtTime(nowSec);

  spawnCooldown -= dt;
  if(spawnCooldown <= 0){
    // keep a few trains active
    const active = trains.filter(t=>t.state!=="gone").length;
    if(active < 6) spawnTrain();
    spawnCooldown = 8 + Math.random()*10;
  }

  // Train state logic
  for(const t of trains){
    if(t.state==="gone") continue;

    if(t.consistStatus === "OK" && nowSec >= t.maintenanceDueAt){
      t.consistStatus = "MAINT";
      logEvent(`Maintenance due for ${t.line} Track ${t.track}.`);
    }

    if(t.swapUntil && nowSec < t.swapUntil){
      if(!t.reportedIssue){
        t.reportedIssue = true;
      }
    } else if(t.swapUntil && nowSec >= t.swapUntil){
      t.swapUntil = null;
      t.reportedIssue = false;
      logEvent(`Consist swap complete on Track ${t.track}.`);
    }

    // if time passed and doors closed + buzzing, depart
    const timeToGo = nowSec >= t.departAt;
    const readyToDepart = (t.buzzing && !t.doorOpen);

    if(t.state==="boarding" && timeToGo && readyToDepart){
      if(t.swapUntil){
        if(!t.reportedIssue){
          logEvent(`Holding ${t.line} Track ${t.track} for consist swap.`);
          t.reportedIssue = true;
        }
        continue;
      }

      if(t.consistStatus === "BROKEN"){
        if(!t.reportedIssue){
          logEvent(`Consist fault on Track ${t.track}. Swap required.`);
          t.reportedIssue = true;
        }
        continue;
      }

      if(t.consistStatus === "MAINT" && Math.random() < 0.35){
        t.consistStatus = "BROKEN";
        logEvent(`Maintenance issue: ${t.line} Track ${t.track} failed inspection.`);
        continue;
      }

      const reliabilityCheck = Math.random()*100;
      if(reliabilityCheck > t.conductor.reliability){
        t.departAt += 15 + Math.random()*20;
        logEvent(`Crew delay on Track ${t.track} (${t.conductor.name}).`);
        continue;
      }

      t.state = "departing";
      t.departStartedAt = nowSec;
      // little departure "whoosh"
      beep(220, 0.08, "triangle", 0.03);
      setTimeout(()=>beep(180,0.12,"triangle",0.03), 80);
    }

    if(t.state==="departing"){
      // move train off screen
      t.y -= 120 * dt;
      if(t.y < 40){
        t.state = "gone";
      }
    }
  }

  // People movement
  for(const p of people){
    if(p.boarded) continue;
    const t = getTrainById(p.targetTrainId);
    if(!t || t.state==="gone" || t.state==="departing"){
      // missed it
      continue;
    }

    // target: door gap if open; otherwise stand near door
    const tx = t.doorX;
    const ty = t.y;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx,dy);

    // if door open and close enough, board
    if(t.doorOpen && dist < 10){
      p.boarded = true;
      continue;
    }

    // move toward target
    const step = (p.speed * dt);
    if(dist > 0.001){
      p.x += (dx/dist) * Math.min(step, dist);
      p.y += (dy/dist) * Math.min(step, dist);
    }
  }

  // refresh selected panel
  const sel = getTrainById(selectedTrainId);
  if(sel) updateDoorPanel(sel);
  rebuildTrainList();
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // background
  ctx.fillStyle = "#06101a";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // world offset
  const ox = -WORLD.cameraX;

  // platforms + tracks
  for(let i=0;i<TRACKS.length;i++){
    const y = TRACKS[i].y;

    // track line
    ctx.strokeStyle = "rgba(180,210,255,0.14)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox+0, y);
    ctx.lineTo(ox+WORLD.w, y);
    ctx.stroke();

    // sleepers (tiny)
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for(let x=0; x<WORLD.w; x+=60){
      ctx.beginPath();
      ctx.moveTo(ox+x, y-5);
      ctx.lineTo(ox+x+20, y+5);
      ctx.stroke();
    }

    // track label
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "12px system-ui";
    ctx.fillText("T"+TRACKS[i].index, ox+8, y-10);
  }

  // trains
  for(const t of trains){
    if(t.state==="gone") continue;

    let fill = "rgba(148,163,184,0.85)";
    if(t.buzzing) fill = "rgba(250,204,21,0.85)";
    if(t.doorOpen) fill = "rgba(34,197,94,0.80)";
    if(t.state==="departing") fill = "rgba(96,165,250,0.85)";

    ctx.fillStyle = fill;
    ctx.fillRect(ox+t.x, t.y-9, t.w, t.h);

    // door gap marker
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    const doorW = 10;
    const doorX = ox+t.doorX - doorW/2;
    ctx.fillRect(doorX, t.y-9, doorW, t.h);

    // train label
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "12px system-ui";
    ctx.fillText(`${t.type} • ${t.dest} • dep ${fmtTime(t.departAt)}`, ox+t.x, t.y-14);
  }

  // people
  for(const p of people){
    if(p.boarded) continue;
    const t = getTrainById(p.targetTrainId);
    // fade if missed / departed
    if(!t || t.state==="departing" || t.state==="gone") continue;

    ctx.fillStyle = p.late ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.arc(ox+p.x, p.y, p.late ? 3 : 2.5, 0, Math.PI*2);
    ctx.fill();
  }

  // mini instructions overlay
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "12px system-ui";
  ctx.fillText("Drag left/right to scroll", 12, 22);
  ctx.fillText("Tap a train to select", 12, 38);

  // camera bar
  const ratio = canvas.width / WORLD.w;
  const barW = Math.max(40, canvas.width * ratio);
  const barX = (WORLD.cameraX / (WORLD.w - canvas.width)) * (canvas.width - barW);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(10, canvas.height-18, canvas.width-20, 8);
  ctx.fillStyle = "rgba(96,165,250,0.55)";
  ctx.fillRect(10+barX, canvas.height-18, barW, 8);
}

let last = performance.now();
function loop(){
  const now = performance.now();
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// Start with a few trains
for(let i=0;i<4;i++){
  spawnTrain();
}
rebuildTrainList();
loop();
