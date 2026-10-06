const target = 200;
const duration = 90000;
const values = { apple: 2, heart: 5, badApple: -2, heartbreak: -5 };
let catcherX;
let objects;
let fieldScore;
let timeRemaining;
let spawnProgress;
let serial;

export function resetCatch() {
  catcherX = 50;
  objects = [];
  fieldScore = 0;
  timeRemaining = duration;
  spawnProgress = 0;
  serial = 0;
}

resetCatch();

export function getCatch() {
  return { catcherX, objects, fieldScore, timeRemaining, target };
}

export function moveCatcher(direction) {
  catcherX = Math.max(8, Math.min(92, catcherX + (direction === "left" ? -10 : 10)));
}

export function setCatcherPosition(position) {
  catcherX = Math.max(8, Math.min(92, position));
}

function spawnObject() {
  const roll = Math.random();
  const type = roll < 0.43 ? "apple" : roll < 0.51 ? "heart" : roll < 0.76 ? "badApple" : roll < 0.84 ? "heartbreak" : null;
  if (!type) return;
  const elapsed = duration - timeRemaining;
  const pace = 1 + Math.floor(elapsed / 10000) * 0.15;
  objects.push({ id: serial++, x: 8 + Math.random() * 84, y: -8, type, speed: (0.032 + Math.random() * 0.021) * pace });
}

export function updateCatch(delta) {
  timeRemaining = Math.max(0, timeRemaining - delta);
  let event = null;
  let eventX = 50;
  spawnProgress += delta;
  const interval = Math.max(330, 600 - Math.max(fieldScore, 0) * 5);
  while (spawnProgress >= interval) { spawnProgress -= interval; spawnObject(); }

  const survivors = [];
  for (const object of objects) {
    object.y += object.speed * delta;
    const reachedCatcher = object.y >= 77 && object.y <= 92 && Math.abs(object.x - catcherX) < 11;
    if (reachedCatcher) {
      fieldScore += values[object.type];
      event = object.type;
      eventX = object.x;
      continue;
    }
    if (object.y <= 108) survivors.push(object);
  }
  objects = survivors;
  const outcome = fieldScore >= target ? "won" : timeRemaining <= 0 ? "lost" : null;
  return { outcome, event, eventX, points: event ? values[event] : 0 };
}
