const SAVE_KEY = "wander-home-progress-v1";
const stages = new Set(["adventure", "catch", "memory", "defend"]);

function readSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    return saved?.version === 1 ? saved : null;
  } catch {
    return null;
  }
}

function numberOr(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function readBossHighScores(value) {
  return ["easy", "medium", "hard"].reduce((scores, level) => {
    scores[level] = Math.max(0, numberOr(value?.[level]));
    return scores;
  }, {});
}

function readStageScores(value) {
  return ["adventure", "catch", "memory", "defend"].reduce((scores, stage) => {
    scores[stage] = Math.max(0, numberOr(value?.[stage]));
    return scores;
  }, {});
}

function readStageAttempts(value) {
  return ["adventure", "catch", "memory", "defend"].reduce((attempts, stage) => {
    attempts[stage] = Math.max(0, numberOr(value?.[stage]));
    return attempts;
  }, {});
}

function readHouse(value) {
  return {
    foundation: Boolean(value?.foundation),
    walls: Boolean(value?.walls),
    roof: Boolean(value?.roof),
    door: Boolean(value?.door),
    windows: Boolean(value?.windows),
    roofSupports: Boolean(value?.roofSupports),
    wallSupports: Boolean(value?.wallSupports),
    reinforcedRoof: Boolean(value?.reinforcedRoof),
    reinforcedDoor: Boolean(value?.reinforcedDoor),
    windowProtection: Boolean(value?.windowProtection),
    foundationReinforcement: Boolean(value?.foundationReinforcement),
    floor: Boolean(value?.floor),
    bed: Boolean(value?.bed),
    table: Boolean(value?.table),
    chairs: Boolean(value?.chairs),
    lamp: Boolean(value?.lamp),
    fireplace: Boolean(value?.fireplace),
    kitchen: Boolean(value?.kitchen),
    curtains: Boolean(value?.curtains),
    garden: Boolean(value?.garden),
    fence: Boolean(value?.fence),
    flowers: Boolean(value?.flowers),
    pathway: Boolean(value?.pathway),
    mailbox: Boolean(value?.mailbox),
    outdoorSeating: Boolean(value?.outdoorSeating),
    trees: Boolean(value?.trees),
    decorations: Boolean(value?.decorations)
  };
}

function initialRun() {
  const saved = readSave();
  return {
    currentScreen: "start",
    currentStage: stages.has(saved?.currentStage) ? saved.currentStage : "adventure",
    avatar: saved?.avatar === "female" || saved?.avatar === "male" ? saved.avatar : null,
    score: Math.max(0, numberOr(saved?.score)),
    buildPoints: Math.max(0, numberOr(saved?.buildPoints, numberOr(saved?.totalScore, numberOr(saved?.lastMemory?.score)))),
    totalScore: Math.max(0, numberOr(saved?.buildPoints, numberOr(saved?.totalScore, numberOr(saved?.lastMemory?.score)))),
    bestScore: Math.max(0, numberOr(saved?.bestScore)),
    lastScore: Math.max(0, numberOr(saved?.lastScore)),
    stageScores: readStageScores(saved?.stageScores),
    stageAttempts: readStageAttempts(saved?.stageAttempts),
    stageRetries: { catch: Math.max(0, numberOr(saved?.stageRetries?.catch)) },
    bossHighScores: readBossHighScores(saved?.bossHighScores),
    defendDifficulty: ["easy", "medium", "hard"].includes(saved?.defendDifficulty) ? saved.defendDifficulty : "hard",
    lives: 3,
    startedAt: null,
    elapsedTime: 0,
    collectedItems: [],
    choices: [],
    completedStages: Array.isArray(saved?.completedStages) ? saved.completedStages.filter((stage) => stages.has(stage)) : [],
    lastMemory: saved?.lastMemory || null,
    house: readHouse(saved?.house),
    chapter: Math.max(1, numberOr(saved?.chapter, 1)),
    updatedAt: saved?.updatedAt || null
  };
}

let run = initialRun();

function persist() {
  const score = Math.max(0, run.score);
  const payload = {
    version: 1,
    avatar: run.avatar,
    score,
    buildPoints: Math.max(0, run.buildPoints),
    totalScore: Math.max(0, run.buildPoints),
    bestScore: Math.max(run.bestScore || 0, score),
    lastScore: run.lastScore || score,
    stageScores: run.stageScores,
    stageAttempts: run.stageAttempts,
    stageRetries: run.stageRetries,
    bossHighScores: run.bossHighScores,
    defendDifficulty: run.defendDifficulty,
    currentStage: run.currentStage,
    completedStages: run.completedStages,
    lastMemory: run.lastMemory,
    house: run.house,
    chapter: run.chapter,
    updatedAt: run.updatedAt
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    // The game remains playable if a browser blocks storage.
  }
}

export function getRun() {
  return run;
}

export function hasSavedProgress() {
  return Boolean(run.avatar && (run.score > 0 || run.completedStages.length || run.lastMemory || Object.values(run.stageAttempts).some((attempts) => attempts > 0)));
}

export function updateRun(changes) {
  const nextScore = Math.max(0, numberOr(changes.score, run.score));
  const nextBuildPoints = Math.max(0, numberOr(changes.buildPoints, numberOr(changes.totalScore, run.buildPoints)));
  run = {
    ...run,
    ...changes,
    score: nextScore,
    buildPoints: nextBuildPoints,
    totalScore: nextBuildPoints,
    bestScore: Math.max(run.bestScore || 0, nextScore),
    lastScore: nextScore,
    updatedAt: new Date().toISOString()
  };
  persist();
  return run;
}

export function resetRun() {
  const bestScore = run.bestScore;
  const buildPoints = run.buildPoints;
  const house = run.house;
  const chapter = run.chapter;
  const bossHighScores = run.bossHighScores;
  run = {
    currentScreen: "start",
    currentStage: "adventure",
    avatar: null,
    score: 0,
    buildPoints,
    totalScore: buildPoints,
    bestScore,
    lastScore: 0,
    stageScores: readStageScores(),
    stageAttempts: readStageAttempts(),
    stageRetries: { catch: 0 },
    bossHighScores,
    defendDifficulty: "hard",
    lives: 3,
    startedAt: null,
    elapsedTime: 0,
    collectedItems: [],
    choices: [],
    completedStages: [],
    lastMemory: null,
    house,
    chapter,
    updatedAt: new Date().toISOString()
  };
  persist();
  return run;
}

export function startRun() {
  return updateRun({
    currentScreen: "adventure",
    currentStage: "adventure",
    stageAttempts: { ...run.stageAttempts, adventure: Math.max(1, run.stageAttempts.adventure) },
    startedAt: performance.now()
  });
}

export function buildHousePart(part, cost) {
  if (run.house?.[part] || run.buildPoints < cost) return { built: false, points: run.buildPoints };
  const house = { ...run.house, [part]: true };
  const buildPoints = run.buildPoints - cost;
  const chapter = part === "windows" ? 2 : part === "foundationReinforcement" ? 3 : part === "curtains" ? 4 : run.chapter;
  updateRun({ house, buildPoints, chapter });
  return { built: true, points: buildPoints };
}
