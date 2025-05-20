
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

function log(type, detail) {
  gameLogs.push({ time: new Date().toISOString(), type, detail });
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
  io.emit("update", { patients, stocks, blockedZones });
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
  io.emit("update", { patients, stocks, blockedZones });
}, 60000);

setTimeout(() => {
  const score = {
    patients_total: patients.length,
    patients_soignes: patients.filter(p => p.status === "Soigné").length,
    mortalité: patients.filter(p => p.status === "Décédé").length,
    ressources: { ...stocks }
  };
  console.log("===== SCORE FINAL =====");
  console.log(score);
  log("FIN", JSON.stringify(score));
}, 600000);

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>COM.U.N.E.</title>
<style>body{font-family:sans-serif;background:#121212;color:#eee;margin:0;display:flex;}
.col{padding:1em;width:33%}.patient{border:1px solid #444;padding:0.5em;margin:0.5em 0}
button{padding:0.3em;margin:0.3em}
.alert{color:red;font-weight:bold}</style></head><body>
<div class="col"><h2>Médecin</h2><div id="patients"></div></div>
<div class="col"><h2>Logistique</h2><div id="stocks"></div></div>
<div class="col"><h2>Événements</h2><div id="event"></div><h2>Journal</h2><ul id="log"></ul></div>
<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
const patientsDiv = document.getElementById("patients");
const stocksDiv = document.getElementById("stocks");
const eventDiv = document.getElementById("event");
const logList = document.getElementById("log");

socket.on("update", data => {
  patientsDiv.innerHTML = data.patients.map(p =>
    \`<div class='patient'>
      <b>\${p.name}</b> [\${p.gravité}] - \${p.status}<br>
      <button onclick="treat('\${p.id}')">Soigner</button>
      <button onclick="move('\${p.id}', 'urgence')">Urgences</button>
      <button onclick="move('\${p.id}', 'réa')">Réa</button>
    </div>\`
  ).join("");
  stocksDiv.innerHTML = Object.entries(data.stocks).map(([k,v]) =>
    \`\${k}: \${v} <button onclick="order('\${k}')">Commander</button>\`
  ).join("<br>");
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
  socket.emit("update", { patients, stocks, blockedZones });

  socket.on("treat", id => {
    patients = patients.map(p => p.id === id ? { ...p, status: "Soigné" } : p);
    log("Soin", id);
    io.emit("update", { patients, stocks, blockedZones });
  });

  socket.on("order", type => {
    stocks[type] = (stocks[type] || 0) + 3;
    log("Commande", type);
    io.emit("update", { patients, stocks, blockedZones });
  });

  socket.on("move", ({id, zone}) => {
    const now = Date.now();
    if (blockedZones[zone] && blockedZones[zone] > now) {
      log("Refus", zone + " bloquée");
      return;
    }
    patients = patients.map(p => p.id === id ? { ...p, zone } : p);
    log("Déplacement", id + " vers " + zone);
    io.emit("update", { patients, stocks, blockedZones });
  });
});

server.listen(3000, () => console.log("COM.U.N.E. en ligne sur http://localhost:3000"));
