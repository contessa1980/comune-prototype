const zones = document.querySelectorAll('.zone');
const pions = document.querySelectorAll('.pion');

pions.forEach(pion => {
    pion.addEventListener('dragstart', dragStart);
});

zones.forEach(zone => {
    zone.addEventListener('dragover', dragOver);
    zone.addEventListener('drop', drop);
});

function dragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.className);
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.target.remove();
}

function dragOver(e) {
    e.preventDefault();
}

function drop(e) {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/html');
    e.target.innerHTML += data;
}

function tirerEvenement() {
    const evenements = [
        "Rupture de stock de respirateurs",
        "Afflux massif suite à un accident de bus",
        "Panne de courant dans le bloc opératoire",
        "Grève d'une partie du personnel",
        "Demande urgente de l'ARS",
        "Scandale médiatique en cours"
    ];
    const tirage = evenements[Math.floor(Math.random() * evenements.length)];
    document.getElementById("evenement").innerText = "Événement : " + tirage;
}