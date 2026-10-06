import { gameData } from "../content/gameData.js";

const config = gameData.stages.defend;
let playerX;
let hearts;
let enemies;
let apples;
let powerUps;
let doubleShotRemaining;
let tripleShotRemaining;
let eggBombs;
let wavePowerUpSchedule;
let boss;
let bossProjectiles;
let bossCrowClock;
let bossDifficulty = "hard";
let elapsed;
let spawnClock;
let appleClock;
let serial;
let defeated;
let score;
let waveIndex;
let attemptsByWave;

function resetWave({ restoreHealth = false } = {}) {
  if (restoreHealth) hearts = config.farmhouseHearts;
  enemies = [];
  apples = [];
  powerUps = [];
  doubleShotRemaining = 0;
  tripleShotRemaining = 0;
  const wave = config.waves[waveIndex];
  if (wave?.id === 2) {
    const { min, max } = config.powerUps.wave2GlowDropRange;
    const count = min + Math.floor(Math.random() * (max - min + 1));
    wavePowerUpSchedule = Array.from({ length: count }, (_, index) => {
      const segment = wave.duration / (count + 1);
      return { time: segment * (index + 1) + (Math.random() - .5) * segment * .55, type: config.powerUps.glowingApple };
    }).sort((a, b) => a.time - b.time);
  } else if (wave?.id === 3) {
    const { min, max } = config.powerUps.wave3BombDropRange;
    const bombCount = min + Math.floor(Math.random() * (max - min + 1));
    const types = [
      ...Array(config.powerUps.wave3GoldenAppleCount).fill(config.powerUps.goldenApple),
      ...Array(config.powerUps.wave3HeartCount).fill(config.powerUps.heart),
      ...Array(bombCount).fill(config.powerUps.eggBomb)
    ].sort(() => Math.random() - .5);
    wavePowerUpSchedule = types.map((type, index) => {
      const segment = wave.duration / (types.length + 1);
      return { time: segment * (index + 1) + (Math.random() - .5) * segment * .5, type };
    }).sort((a, b) => a.time - b.time);
  } else wavePowerUpSchedule = [];
  elapsed = 0;
  spawnClock = 0;
  appleClock = 0;
}

export function resetDefend() {
  playerX = 50;
  hearts = config.farmhouseHearts;
  serial = 0;
  defeated = 0;
  score = 0;
  eggBombs = 0;
  waveIndex = 0;
  attemptsByWave = {};
  boss = null;
  bossProjectiles = [];
  bossCrowClock = 0;
  resetWave();
}

resetDefend();

export function getDefend() {
  return {
    playerX,
    hearts,
    enemies,
    apples,
    powerUps,
    doubleShotRemaining,
    tripleShotRemaining,
    eggBombs,
    wavePowerUpsRemaining: wavePowerUpSchedule.length,
    boss,
    bossDifficulty,
    bossProjectiles,
    elapsed,
    defeated,
    score,
    waveIndex,
    wave: config.waves[waveIndex],
    waveCount: config.waves.length,
    attemptsByWave,
    config
  };
}

export function setDefendPosition(position) {
  playerX = Math.max(7, Math.min(93, position));
}

export function selectDefendDifficulty(difficulty) {
  bossDifficulty = config.boss.difficulties[difficulty] ? difficulty : "hard";
  resetDefend();
}

export function retryDefendWave() {
  const retryKey = boss ? "boss" : waveIndex;
  attemptsByWave[retryKey] = (attemptsByWave[retryKey] || 0) + 1;
  if (boss) {
    hearts = config.farmhouseHearts;
    startBossFight();
    return;
  }
  resetWave({ restoreHealth: true });
}

export function advanceDefendWave() {
  if (waveIndex >= config.waves.length - 1) return false;
  waveIndex += 1;
  hearts = Math.min(config.farmhouseHearts, hearts + (config.waves[waveIndex].healthBoost || 0));
  resetWave();
  return true;
}

export function startBossFight(difficulty = bossDifficulty) {
  bossDifficulty = config.boss.difficulties[difficulty] ? difficulty : "hard";
  const difficultyConfig = config.boss.difficulties[bossDifficulty];
  boss = {
    active: true,
    difficulty: bossDifficulty,
    reward: difficultyConfig.reward,
    startScore: score,
    hp: difficultyConfig.hp,
    maxHp: difficultyConfig.hp,
    x: 50,
    y: 15,
    direction: 1,
    age: 0,
    attackClock: 0,
    phase: 1,
    hitFlash: 0
  };
  bossProjectiles = [];
  bossCrowClock = 0;
  enemies = [];
  apples = [];
  powerUps = [];
  eggBombs = Math.max(eggBombs, 1);
}

function spawnCrow() {
  const speedMultiplier = config.boss.difficulties[bossDifficulty].enemySpeedMultiplier;
  enemies.push({
    id: `crow-${serial++}`,
    type: "crow",
    x: 8 + Math.random() * 84,
    y: -8,
    age: 0,
    speed: (0.0105 + Math.random() * 0.005) * speedMultiplier
  });
}

function spawnFox() {
  const speedMultiplier = config.boss.difficulties[bossDifficulty].enemySpeedMultiplier;
  enemies.push({
    id: `fox-${serial++}`,
    type: "fox",
    x: 10 + Math.random() * 80,
    y: -10,
    age: 0,
    speed: (0.0062 + Math.random() * 0.002) * speedMultiplier,
    hp: 3,
    maxHp: 3,
    hitFlash: 0
  });
}

function spawnLocustSwarm() {
  const speedMultiplier = config.boss.difficulties[bossDifficulty].enemySpeedMultiplier;
  enemies.push({
    id: `locust-${serial++}`,
    type: "locust",
    x: 18 + Math.random() * 64,
    y: -10,
    age: 0,
    speed: (0.007 + Math.random() * 0.002) * speedMultiplier,
    hp: 3,
    maxHp: 3,
    hitFlash: 0,
    phase: Math.random() * Math.PI * 2
  });
}

function spawnEnemy(wave) {
  const canSpawnFox = wave.enemies.includes("fox");
  const canSpawnLocust = wave.enemies.includes("locust");
  const roll = Math.random();
  if (canSpawnLocust && roll < wave.locustChance) spawnLocustSwarm();
  else if (canSpawnFox && roll < (wave.locustChance || 0) + wave.foxChance) spawnFox();
  else spawnCrow();
}

function throwApple() {
  const offsets = tripleShotRemaining > 0 ? [-5.2, 0, 5.2] : doubleShotRemaining > 0 ? [-3.7, 3.7] : [0];
  for (const offset of offsets) apples.push({ id: `apple-${serial++}`, x: playerX + offset, y: 75, speed: 0.105, drift: offset * 0.007 });
}

function maybeDropPowerUp(enemy, wave, events) {
  if (wave.id < 3 || Math.random() >= config.powerUps.dropChance) return;
  const types = [config.powerUps.goldenApple, config.powerUps.heart, config.powerUps.eggBomb];
  const type = types[Math.floor(Math.random() * types.length)];
  powerUps.push({ id: `power-${serial++}`, type, x: enemy.x, y: enemy.y, speed: 0.018 });
  events.push({ type: "powerup-drop", powerUp: type, x: enemy.x, y: enemy.y });
}

export function useEggBomb() {
  if (eggBombs <= 0) return { used: false, events: [] };
  eggBombs -= 1;
  const events = [];
  for (const enemy of enemies) {
    const points = enemy.type === "crow" ? 1 : enemy.type === "fox" ? 3 : 4;
    defeated += 1;
    score += points;
    events.push({ type: `${enemy.type}-defeated`, x: enemy.x, y: enemy.y, points, bombed: true });
  }
  enemies = [];
  events.push({ type: "egg-bomb", x: 50, y: 54 });
  return { used: true, events };
}

function updateBoss(delta) {
  const events = [];
  appleClock += delta;
  while (appleClock >= config.appleInterval) {
    appleClock -= config.appleInterval;
    throwApple();
    events.push({ type: "throw", x: playerX, y: 76 });
  }
  boss.age += delta;
  boss.hitFlash = Math.max(0, boss.hitFlash - delta);
  const speed = boss.phase === 2 ? 0.023 : 0.015;
  boss.x += boss.direction * speed * delta;
  if (boss.x <= 14 || boss.x >= 86) boss.direction *= -1;
  boss.attackClock += delta;
  const difficultyConfig = config.boss.difficulties[boss.difficulty];
  const attackInterval = boss.phase === 2 ? difficultyConfig.phaseTwoAttackInterval : difficultyConfig.attackInterval;
  while (boss.attackClock >= attackInterval) {
    boss.attackClock -= attackInterval;
    bossProjectiles.push({ id: `trash-${serial++}`, x: boss.x + (Math.random() - .5) * 14, y: boss.y + 7, speed: .015 + Math.random() * .004 });
    events.push({ type: "boss-throw", x: boss.x, y: boss.y + 6 });
  }
  if (boss.phase === 2) {
    bossCrowClock += delta;
    if (bossCrowClock >= difficultyConfig.phaseTwoCrowInterval) {
      bossCrowClock = 0;
      spawnCrow();
    }
  }

  for (const apple of apples) {
    apple.y -= apple.speed * delta;
    apple.x = Math.max(2, Math.min(98, apple.x + apple.drift * delta));
  }
  apples = apples.filter((apple) => apple.y > -10);
  const remainingTrash = [];
  for (const trash of bossProjectiles) {
    trash.y += trash.speed * delta;
    const apple = apples.find((item) => Math.abs(item.x - trash.x) < 5.5 && Math.abs(item.y - trash.y) < 6);
    if (apple) {
      apple.y = -20;
      events.push({ type: "trash-deflected", x: trash.x, y: trash.y });
      continue;
    }
    if (trash.y >= 88) {
      hearts -= 1;
      events.push({ type: "farmhouse-hit", x: trash.x, y: 87 });
      continue;
    }
    remainingTrash.push(trash);
  }
  bossProjectiles = remainingTrash;

  for (const apple of apples) {
    if (Math.abs(apple.x - boss.x) < 15 && Math.abs(apple.y - boss.y) < 12) {
      apple.y = -20;
      boss.hp -= 1;
      boss.hitFlash = 140;
      events.push({ type: "boss-hit", x: boss.x, y: boss.y, hp: boss.hp, maxHp: boss.maxHp });
      if (boss.hp <= boss.maxHp / 2 && boss.phase === 1) {
        boss.phase = 2;
        events.push({ type: "boss-phase-two", x: boss.x, y: boss.y });
      }
      break;
    }
  }

  const survivors = [];
  for (const enemy of enemies) {
    enemy.age += delta;
    enemy.y += enemy.speed * delta;
    enemy.x += Math.sin(enemy.age / 210) * .045 * delta;
    const apple = apples.find((item) => Math.abs(item.x - enemy.x) < 6.5 && Math.abs(item.y - enemy.y) < 7);
    if (apple) {
      apple.y = -20;
      defeated += 1;
      score += 1;
      events.push({ type: "crow-defeated", x: enemy.x, y: enemy.y, points: 1 });
      continue;
    }
    if (enemy.y >= 88) {
      hearts -= 1;
      events.push({ type: "farmhouse-hit", x: enemy.x, y: 87 });
      continue;
    }
    survivors.push(enemy);
  }
  enemies = survivors;
  if (boss.hp <= 0) {
    boss.active = false;
    events.push({ type: "boss-defeated", x: boss.x, y: boss.y });
    return { outcome: "boss-won", events };
  }
  if (hearts <= 0) return { outcome: "failed", events };
  return { outcome: null, events };
}

export function updateDefend(delta) {
  if (boss?.active) return updateBoss(delta);
  const events = [];
  const wave = config.waves[waveIndex];
  elapsed = Math.min(wave.duration, elapsed + delta);
  doubleShotRemaining = Math.max(0, doubleShotRemaining - delta);
  tripleShotRemaining = Math.max(0, tripleShotRemaining - delta);
  while (wavePowerUpSchedule.length && elapsed >= wavePowerUpSchedule[0].time) {
    const powerUp = wavePowerUpSchedule.shift();
    const x = 12 + Math.random() * 76;
    powerUps.push({ id: `power-${serial++}`, type: powerUp.type, x, y: -6, speed: 0.018 });
    events.push({ type: "powerup-drop", powerUp: powerUp.type, x, y: -6 });
  }
  spawnClock += delta;
  appleClock += delta;
  const progress = elapsed / wave.duration;
  const baseSpawnInterval = wave.startingSpawnInterval - (wave.startingSpawnInterval - wave.fastestSpawnInterval) * progress;
  const spawnInterval = baseSpawnInterval * config.boss.difficulties[bossDifficulty].waveSpawnMultiplier;
  while (spawnClock >= spawnInterval) {
    spawnClock -= spawnInterval;
    spawnEnemy(wave);
  }
  while (appleClock >= config.appleInterval) {
    appleClock -= config.appleInterval;
    throwApple();
    events.push({ type: "throw", x: playerX, y: 76 });
  }

  for (const apple of apples) {
    apple.y -= apple.speed * delta;
    apple.x = Math.max(2, Math.min(98, apple.x + apple.drift * delta));
  }
  apples = apples.filter((apple) => apple.y > -10);
  for (const powerUp of powerUps) powerUp.y += powerUp.speed * delta;
  const remainingPowerUps = [];
  for (const powerUp of powerUps) {
    const collected = powerUp.y >= 72 && powerUp.y <= 89 && Math.abs(powerUp.x - playerX) < 11;
    if (!collected) {
      if (powerUp.y <= 106) remainingPowerUps.push(powerUp);
      continue;
    }
    if (powerUp.type === config.powerUps.glowingApple) doubleShotRemaining = config.powerUps.doubleShotDuration;
    if (powerUp.type === config.powerUps.goldenApple) tripleShotRemaining = config.powerUps.tripleShotDuration;
    if (powerUp.type === config.powerUps.heart) hearts = Math.min(config.farmhouseHearts, hearts + 1);
    if (powerUp.type === config.powerUps.eggBomb) eggBombs += 1;
    events.push({ type: "powerup-collected", powerUp: powerUp.type, x: powerUp.x, y: powerUp.y });
  }
  powerUps = remainingPowerUps;
  const survivingEnemies = [];
  for (const enemy of enemies) {
    enemy.age += delta;
    enemy.y += enemy.speed * delta;
    if (enemy.type === "crow") enemy.x += Math.sin(enemy.age / 210) * 0.045 * delta;
    if (enemy.type === "locust") enemy.x += Math.sin(enemy.age / 290 + enemy.phase) * 0.03 * delta;
    enemy.hitFlash = Math.max(0, (enemy.hitFlash || 0) - delta);
    let hit = false;
    for (const apple of apples) {
      if (Math.abs(apple.x - enemy.x) < 6.5 && Math.abs(apple.y - enemy.y) < 7) {
        apple.y = -20;
        if (enemy.type === "fox" || enemy.type === "locust") {
          enemy.hp -= 1;
          enemy.hitFlash = 180;
          enemy.y = Math.max(-8, enemy.y - (enemy.type === "fox" ? 2.3 : 1.6));
          if (enemy.hp > 0) events.push({ type: `${enemy.type}-hit`, x: enemy.x, y: enemy.y, hp: enemy.hp, maxHp: enemy.maxHp });
          else {
            hit = true;
            defeated += 1;
            const points = enemy.type === "fox" ? 3 : 4;
            score += points;
            events.push({ type: `${enemy.type}-defeated`, x: enemy.x, y: enemy.y, points });
            maybeDropPowerUp(enemy, wave, events);
          }
        } else {
          hit = true;
          defeated += 1;
          score += 1;
          events.push({ type: "crow-defeated", x: enemy.x, y: enemy.y, points: 1 });
          maybeDropPowerUp(enemy, wave, events);
        }
        break;
      }
    }
    if (hit) continue;
    if (enemy.y >= 88) {
      hearts -= 1;
      events.push({ type: "farmhouse-hit", x: enemy.x, y: 87 });
      continue;
    }
    survivingEnemies.push(enemy);
  }
  enemies = survivingEnemies;
  if (hearts <= 0) return { outcome: "failed", events };
  if (elapsed >= wave.duration) return { outcome: waveIndex === config.waves.length - 1 ? "stage-won" : "wave-won", events };
  return { outcome: null, events };
}
