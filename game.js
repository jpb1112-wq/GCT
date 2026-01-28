const timeLabel = document.getElementById("timeLabel");
const scheduleEl = document.getElementById("schedule");
const opsLog = document.getElementById("opsLog");

const emptyPanel = document.getElementById("emptyPanel");
const controlPanel = document.getElementById("controlPanel");
const selTrain = document.getElementById("selTrain");
const selLine = document.getElementById("selLine");
const selTrack = document.getElementById("selTrack");
const selTime = document.getElementById("selTime");
const selConsist = document.getElementById("selConsist");
const selConductor = document.getElementById("selConductor");
const selStrict = document.getElementById("selStrict");
const selReliability = document.getElementById("selReliability");
const selDoors = document.getElementById("selDoors");
const selLate = document.getElementById("selLate");

const btnOpenDoors = document.getElementById("btnOpenDoors");
const btnCloseDoors = document.getElementById("btnCloseDoors");
const btnBuzz = document.getElementById("btnBuzz");

const btnOfficeView = document.getElementById("btnOfficeView");
const btnTrackView = document.getElementById("btnTrackView");
const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

const CONSISTS = [
  {name:"M8", capacity:880, reliability:92},
  {name:"M7A", capacity:760, reliability:88},
  {name:"M3A", capacity:600, reliability:78}
];

const CONDUCTORS = [
  {name:"L. Rivera", strictness:72, reliability:94},
  {name:"A. Gupta", strictness:60, reliability:88},
  {name:"M. Chen", strictness:55, reliability:84},
  {name:"S. Brooks", strictness:80, reliability:76},
  {name:"D. Okafor", strictness:48, reliability:81}
];

const TRACKS = [12, 13, 14, 15, 16, 17, 18, 19];

const LINES = [
  {line:"Hudson", destinations:["Croton-Harmon","Tarrytown","Poughkeepsie"]},
  {line:"Harlem", destinations:["White Plains","North White Plains","Mount Kisco"]},
  {line:"New Haven", destinations:["Stamford","Greenwich","New Haven"]}
];

const START_MINUTES = 6 * 60;
const DEPARTURES = [
  {minute:START_MINUTES + 2, line:"Hudson", destination:"Tarrytown"},
  {minute:START_MINUTES + 5, line:"Harlem", destination:"White Plains"},
  {minute:START_MINUTES + 8, line:"New Haven", destination:"Stamford"},
  {minute:START_MINUTES + 12, line:"Hudson", destination:"Croton-Harmon"},
  {minute:START_MINUTES + 15, line:"Harlem", destination:"North White Plains"},
  {minute:START_MINUTES + 18, line:"New Haven", destination:"Greenwich"}
];

function rand(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatClock(minute){
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function logEvent(message){
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = `${formatClock(state.clock)} • ${message}`;
  opsLog.prepend(entry);
  while(opsLog.children.length > 10){
    opsLog.removeChild(opsLog.lastChild);
  }
}

function createRoster(){
  return DEPARTURES.map((slot, index) => {
    const consist = rand(CONSISTS);
    const conductor = rand(CONDUCTORS);
    const track = rand(TRACKS);
    return {
      id: index + 1,
      line: slot.line,
      destination: slot.destination,
      minute: slot.minute,
      track,
      consist,
      conductor,
      doors: "OPEN",
      lateRunners: 0,
      status: "boarding",
      mechanicalIssue: Math.random() < 0.18,
      preTripLogged: false,
      departed: false,
      assignedConsist: consist.name,
      assignedConductor: conductor.name
    };
  });
}

const state = {
  clock: START_MINUTES,
  roster: createRoster(),
  selectedId: null,
  view: "office",
  animation: null,
  lastTick: performance.now()
};

function updateClockLabel(){
  timeLabel.textContent = formatClock(state.clock);
}

function statusLabel(train){
  if(train.departed) return {text:"Departed", className:"departed"};
  if(train.status === "hold") return {text:"Hold", className:"hold"};
  if(train.doors === "CLOSED") return {text:"Doors Closed", className:"ready"};
  return {text:"Boarding", className:"waiting"};
}

function buildSchedule(){
  scheduleEl.innerHTML = "";
  state.roster.forEach(train => {
    const card = document.createElement("div");
    card.className = "schedule-card";
    if(train.id === state.selectedId){
      card.classList.add("active");
    }

    const status = statusLabel(train);
    card.innerHTML = `
      <div class="card-top">
        <div class="card-title">${formatClock(train.minute)} • ${train.line} → ${train.destination}</div>
        <span class="card-status ${status.className}">${status.text}</span>
      </div>
      <div class="card-meta">Track ${train.track} • Consist ${train.assignedConsist} • Conductor ${train.assignedConductor}</div>
      <div class="assignments">
        <label>
          Consist
          <select data-id="${train.id}" data-field="consist">
            ${CONSISTS.map(c => `<option value="${c.name}" ${c.name === train.assignedConsist ? "selected" : ""}>${c.name}</option>`).join("")}
          </select>
        </label>
        <label>
          Conductor
          <select data-id="${train.id}" data-field="conductor">
            ${CONDUCTORS.map(c => `<option value="${c.name}" ${c.name === train.assignedConductor ? "selected" : ""}>${c.name}</option>`).join("")}
          </select>
        </label>
      </div>
    `;

    card.addEventListener("click", (event) => {
      if(event.target.tagName === "SELECT") return;
      selectTrain(train.id);
    });

    scheduleEl.appendChild(card);
  });
}

function selectTrain(id){
  state.selectedId = id;
  const train = getSelected();
  if(!train) return;
  emptyPanel.classList.add("hidden");
  controlPanel.classList.remove("hidden");
  updatePanel(train);
  buildSchedule();
}

function updatePanel(train){
  selTrain.textContent = `${formatClock(train.minute)} ${train.line}`;
  selLine.textContent = train.line;
  selTrack.textContent = `Track ${train.track}`;
  selTime.textContent = formatClock(train.minute);
  selConsist.textContent = train.assignedConsist;
  selConductor.textContent = train.assignedConductor;
  selStrict.textContent = `${train.conductor.strictness}%`;
  selReliability.textContent = `${train.conductor.reliability}%`;
  selDoors.textContent = train.doors;
  selLate.textContent = train.lateRunners;

  btnOpenDoors.disabled = train.departed;
  btnCloseDoors.disabled = train.departed;
  btnBuzz.disabled = train.departed || train.doors !== "CLOSED";
}

function getSelected(){
  return state.roster.find(t => t.id === state.selectedId);
}

function applyAssignments(train){
  train.consist = CONSISTS.find(c => c.name === train.assignedConsist) || train.consist;
  train.conductor = CONDUCTORS.find(c => c.name === train.assignedConductor) || train.conductor;
}

scheduleEl.addEventListener("change", (event) => {
  const target = event.target;
  if(target.tagName !== "SELECT") return;
  const id = Number(target.dataset.id);
  const train = state.roster.find(t => t.id === id);
  if(!train) return;
  if(target.dataset.field === "consist"){
    train.assignedConsist = target.value;
    train.mechanicalIssue = Math.random() < 0.15;
  }
  if(target.dataset.field === "conductor"){
    train.assignedConductor = target.value;
  }
  applyAssignments(train);
  if(train.id === state.selectedId){
    updatePanel(train);
  }
  buildSchedule();
});

btnOpenDoors.addEventListener("click", () => {
  const train = getSelected();
  if(!train || train.departed) return;
  train.doors = "OPEN";
  train.status = "boarding";
  logEvent(`Opened doors for ${train.line} Track ${train.track}.`);
  updatePanel(train);
  buildSchedule();
});

btnCloseDoors.addEventListener("click", () => {
  const train = getSelected();
  if(!train || train.departed) return;
  train.doors = "CLOSED";
  train.status = "ready";
  logEvent(`Doors closed on ${train.line} Track ${train.track}.`);
  updatePanel(train);
  buildSchedule();
});

btnBuzz.addEventListener("click", () => {
  const train = getSelected();
  if(!train || train.departed || train.doors !== "CLOSED") return;
  attemptDeparture(train, true);
  updatePanel(train);
  buildSchedule();
});

btnOfficeView.addEventListener("click", () => {
  state.view = "office";
  btnOfficeView.classList.add("active");
  btnTrackView.classList.remove("active");
});

btnTrackView.addEventListener("click", () => {
  state.view = "track";
  btnTrackView.classList.add("active");
  btnOfficeView.classList.remove("active");
});

function attemptDeparture(train, manual){
  if(train.departed) return;
  const now = state.clock;
  const onTime = now <= train.minute + 1;
  const mechanicalDelay = train.mechanicalIssue && Math.random() < 0.5;
  const crewDelay = !manual && (Math.random() * 100 > train.conductor.reliability);

  if(mechanicalDelay){
    train.status = "hold";
    logEvent(`Mechanical issue on ${train.line} Track ${train.track}. Holding consist.`);
    return;
  }

  if(crewDelay){
    train.status = "hold";
    logEvent(`Crew delay on ${train.line} Track ${train.track}. Awaiting conductor.`);
    return;
  }

  train.departed = true;
  train.status = "departed";
  logEvent(`${train.line} Track ${train.track} departed ${onTime ? "on time" : "late"}.`);
  if(manual){
    startDepartureAnimation(train);
  }
}

function tickClock(){
  const now = performance.now();
  const delta = now - state.lastTick;
  if(delta < 1000) return;
  const minutesToAdd = Math.floor(delta / 1000);
  state.lastTick = now - (delta % 1000);
  state.clock += minutesToAdd;

  state.roster.forEach(train => {
    if(train.departed) return;
    if(!train.preTripLogged && state.clock >= train.minute - 3 && train.mechanicalIssue){
      train.preTripLogged = true;
      logEvent(`Pre-trip inspection flagged on ${train.line} Track ${train.track}.`);
    }
    if(state.clock >= train.minute && train.doors === "CLOSED" && train.status !== "hold"){
      attemptDeparture(train, false);
    }
    if(state.clock >= train.minute && train.doors === "OPEN"){
      train.status = "boarding";
    }
    if(state.clock === train.minute - 1){
      const strictness = train.conductor.strictness;
      const base = strictness > 70 ? 1 : 2;
      train.lateRunners = Math.floor(Math.random() * base);
    }
  });

  updateClockLabel();
  if(state.selectedId){
    updatePanel(getSelected());
  }
  buildSchedule();
}

function startDepartureAnimation(train){
  const duration = 2200;
  const start = performance.now();
  state.animation = {
    line: train.line,
    track: train.track,
    consist: train.assignedConsist,
    destination: train.destination,
    start,
    duration
  };
}

function drawOffice(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "#0b1224";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.fillStyle = "#1f2937";
  ctx.fillRect(40,60,canvas.width-80,200);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(60,80,canvas.width-120,160);

  ctx.fillStyle = "#93c5fd";
  ctx.font = "16px system-ui";
  ctx.fillText("Office Window", 70, 105);
  ctx.fillStyle = "#64748b";
  ctx.font = "12px system-ui";
  ctx.fillText("Switch to Track View to watch departures", 70, 125);

  drawTracks();
}

function drawTracks(){
  ctx.strokeStyle = "rgba(148,163,184,0.35)";
  for(let i = 0; i < 6; i += 1){
    const y = 170 + i * 28;
    ctx.beginPath();
    ctx.moveTo(90, y);
    ctx.lineTo(canvas.width - 90, y);
    ctx.stroke();
  }
}

function drawTrackView(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "#0b172a";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  drawTracks();

  if(state.animation){
    const elapsed = performance.now() - state.animation.start;
    const progress = Math.min(elapsed / state.animation.duration, 1);
    const startX = 120;
    const endX = canvas.width - 140;
    const y = 170 + (state.animation.track % 6) * 28 - 10;

    ctx.fillStyle = "#93c5fd";
    ctx.fillRect(startX + (endX - startX) * progress, y, 140, 16);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui";
    ctx.fillText(`${state.animation.consist} to ${state.animation.destination}`, startX + (endX - startX) * progress, y - 8);

    if(progress >= 1){
      state.animation = null;
    }
  }
}

function render(){
  if(state.view === "track"){
    drawTrackView();
  } else {
    drawOffice();
  }
}

function loop(){
  tickClock();
  render();
  requestAnimationFrame(loop);
}

function init(){
  updateClockLabel();
  buildSchedule();
  logEvent("Morning dispatch initialized.");
  loop();
}

init();
