// === comune_all_in_one_server.js ===
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let patients = [];
let stocks = { sang: 5, oxygene: 5, antibiotiques: 5 };
let blockedZones = {};
let gameLogs = [];
let startTime = Date.now();
const GAME_DURATION = 10 * 60 * 1000; // 10 min

function log(type, detail) {
  const entry = { time: new Date().toISOString(), type, detail };
  gameLogs.push(entry);
  io.emit("log", `[${type}] ${detail}`);
}

function generatePatient() {
  const gravités = ["faible", "moyenne", "critique"];
  return {
    id: uuidv4(),
    name: "Patient_" + Math.random().toString(36).substring(6),
    gravité: gravités[Math.floor(Math.random() * gravités.length)],
    status: "En attente",
    zone: "triage"
  };
}

setInterval(() => {
  const p = generatePatient();
  patients.push(p);
  log("Nouveau patient", p.name + " (" + p.gravité + ")");
  io.emit("update", getGameState());
}, 15000);

const events = [
  { type: "vague", message: "Vague de patients en approche", action: () => {
    for (let i = 0; i < 10; i++) patients.push(generatePatient());
    log("Événement", "Vague de patients");
  }},
  { type: "feu", message: "Incendie en urgences !", action: () => {
    blockedZones["urgence"] = Date.now() + 60000;
    log("Événement", "Feu en urgences");
  }},
  { type: "panne", message: "Panne en réanimation !", action: () => {
    blockedZones["réa"] = Date.now() + 60000;
    log("Événement", "Panne en réa");
  }},
];

setInterval(() => {
  const e = events[Math.floor(Math.random() * events.length)];
  e.action();
  io.emit("event", { message: e.message });
  io.emit("update", getGameState());
}, 60000);

function getScore() {
  return {
    total: patients.length,
    soignes: patients.filter(p => p.status === "Soigné").length,
    decedes: patients.filter(p => p.status === "Décédé").length,
    stocks: { ...stocks }
  };
}

function getGameState() {
  return {
    patients, stocks, blockedZones, score: getScore(),
    timeLeft: Math.max(0, GAME_DURATION - (Date.now() - startTime))
  };
}

setTimeout(() => {
  const score = getScore();
  console.log("===== SCORE FINAL =====");
  console.log(score);
  log("FIN", JSON.stringify(score));
}, GAME_DURATION);

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>COM.U.N.E.</title>
<style>
body { font-family: sans-serif; background: #121212; color: #eee; margin: 0; display: flex; flex-direction: column; height: 100vh; }
header { background: #222; padding: 1em; display: flex; justify-content: space-between; align-items: center; }
main { display: flex; flex: 1; }
.col { padding: 1em; width: 33%; overflow-y: auto; }
.patient { border: 1px solid #444; padding: 0.5em; margin: 0.5em 0; }
button { padding: 0.3em; margin: 0.3em; }
.alert { color: red; font-weight: bold; }
</style></head><body>
<header>
  <h1>COM.U.N.E.</h1>
  <div id="score">Score: 0 | Soignés: 0 | Décès: 0</div>
  <div id="timer">10:00</div>
</header>
<main>
  <div class="col"><h2>Médecin</h2><div id="patients"></div></div>
  <div class="col"><h2>Logistique</h2><div id="stocks"></div></div>
  <div class="col"><h2>Événements</h2><div id="event"></div><h2>Journal</h2><ul id="log"></ul></div>
</main>
<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
const patientsDiv = document.getElementById("patients");
const stocksDiv = document.getElementById("stocks");
const eventDiv = document.getElementById("event");
const logList = document.getElementById("log");
const scoreDiv = document.getElementById("score");
const timerDiv = document.getElementById("timer");

socket.on("update", data => {
  // Affichage patients par zone
  const grouped = data.patients.reduce((acc, p) => {
    if (!acc[p.zone]) acc[p.zone] = [];
    acc[p.zone].push(p);
    return acc;
  }, {});
  patientsDiv.innerHTML = Object.entries(grouped).map(([zone, patients]) =>
    \`<h3>Zone: \${zone}</h3>\` +
    patients.map(p =>
      \`<div class='patient'>
        <b>\${p.name}</b> [\${p.gravité}] - \${p.status}<br>
        <button onclick="treat('\${p.id}')">Soigner</button>
        <button onclick="move('\${p.id}', 'urgence')">Urgences</button>
        <button onclick="move('\${p.id}', 'réa')">Réa</button>
      </div>\`
    ).join("")
  ).join("<hr>");

  stocksDiv.innerHTML = Object.entries(data.stocks).map(([k,v]) =>
    \`\${k}: \${v} <button onclick="order('\${k}')">Commander</button>\`
  ).join("<br>");

  scoreDiv.innerHTML = \`Score: \${data.score.total} | Soignés: \${data.score.soignes} | Décès: \${data.score.decedes}\`;

  const mins = Math.floor(data.timeLeft / 60000);
  const secs = Math.floor((data.timeLeft % 60000) / 1000);
  timerDiv.innerText = \`\${String(mins).padStart(2, '0')}:\${String(secs).padStart(2, '0')}\`;
});

socket.on("event", e => {
  eventDiv.innerHTML = '<div class="alert">'+e.message+'</div>';
  setTimeout(()=>eventDiv.innerHTML='',10000);
});

socket.on("log", l => {
  const li = document.createElement("li");
  li.textContent = l;
  logList.appendChild(li);
});

function treat(id){ socket.emit("treat", id); }
function order(type){ socket.emit("order", type); }
function move(id, zone){ socket.emit("move", {id, zone}); }
</script></body></html>`);
});

io.on("connection", socket => {
  socket.emit("update", getGameState());

  socket.on("treat", id => {
    patients = patients.map(p => p.id === id ? { ...p, status: "Soigné" } : p);
    log("Soin", id);
    io.emit("update", getGameState());
  });

  socket.on("order", type => {
    stocks[type] = (stocks[type] || 0) + 3;
    log("Commande", type);
    io.emit("update", getGameState());
  });

  socket.on("move", ({id, zone}) => {
    const now = Date.now();
    if (blockedZones[zone] && blockedZones[zone] > now) {
      log("Refus", zone + " bloquée");
      return;
    }
    patients = patients.map(p => p.id === id ? { ...p, zone } : p);
    log("Déplacement", id + " vers " + zone);
    io.emit("update", getGameState());
  });
});

server.listen(3000, () => console.log("COM.U.N.E. en ligne sur http://localhost:3000"));
