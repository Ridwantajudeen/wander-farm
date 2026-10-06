const columns = 8;
const rows = 8;

const walls = new Set([
  "3,0", "1,1", "3,1", "6,1", "1,2", "6,2", "2,3", "3,3", "4,3",
  "1,4", "5,4", "6,4", "1,5", "3,5", "2,6", "5,6", "1,7", "5,7"
]);

const hazards = new Set(["0,5", "4,1", "4,5", "7,4", "3,7"]);
const start = { x: 0, y: 7 };
const exit = { x: 7, y: 0 };
const requiredApples = 4;
const appleCandidates = ["0,0", "2,0", "4,0", "5,0", "7,1", "0,2", "2,2", "3,2", "4,2", "5,2", "7,2", "0,3", "1,3", "5,3", "6,3", "7,3", "0,4", "2,4", "3,4", "4,4", "7,5", "0,6", "1,6", "3,6", "4,6", "6,6", "7,6"];

let player;
let fragments;
let applesCollected;
let hazardsHit;

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export function resetAdventure() {
  player = { ...start };
  fragments = new Set(shuffle([...appleCandidates]).slice(0, 6));
  applesCollected = 0;
  hazardsHit = 0;
}

resetAdventure();

export function getAdventure() {
  return { columns, rows, walls, hazards, player, fragments, exit, applesCollected, hazardsHit, requiredApples };
}

export function moveAdventure(direction) {
  const directions = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0]
  };
  const [deltaX, deltaY] = directions[direction] || [0, 0];
  const next = { x: player.x + deltaX, y: player.y + deltaY };
  const key = `${next.x},${next.y}`;

  if (next.x < 0 || next.x >= columns || next.y < 0 || next.y >= rows || walls.has(key)) {
    return { moved: false, collected: false, complete: false, player: { ...player } };
  }

  player = next;
  const collected = fragments.delete(key);
  if (collected) applesCollected += 1;
  const hitHazard = hazards.has(key);
  if (hitHazard) hazardsHit += 1;
  const complete = player.x === exit.x && player.y === exit.y && applesCollected >= requiredApples;
  return { moved: true, collected, hitHazard, complete, player: { ...player } };
}

export function jumpAdventure(direction) {
  const directions = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0]
  };
  const [deltaX, deltaY] = directions[direction] || [0, 0];
  const over = { x: player.x + deltaX, y: player.y + deltaY };
  const landing = { x: player.x + deltaX * 2, y: player.y + deltaY * 2 };
  const overKey = `${over.x},${over.y}`;
  const landingKey = `${landing.x},${landing.y}`;

  if (!directions[direction] || !hazards.has(overKey) || landing.x < 0 || landing.x >= columns || landing.y < 0 || landing.y >= rows || walls.has(landingKey) || hazards.has(landingKey)) {
    return { moved: false, jumped: false, collected: false, complete: false, player: { ...player } };
  }

  player = landing;
  const collected = fragments.delete(landingKey);
  if (collected) applesCollected += 1;
  const complete = player.x === exit.x && player.y === exit.y && applesCollected >= requiredApples;
  return { moved: true, jumped: true, collected, complete, player: { ...player } };
}
