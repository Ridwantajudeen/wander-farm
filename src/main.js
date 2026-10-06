import "./styles/main.css";
import { gameData } from "./content/gameData.js";
import { characterMarkup, rewardBurstMarkup } from "./game/animation.js";
import { audio } from "./game/audio.js";
import { buildHousePart, getRun, hasSavedProgress, resetRun, startRun, updateRun } from "./game/state.js";
import { getAdventure, jumpAdventure, moveAdventure, resetAdventure } from "./stages/adventure.js";
import { getCatch, moveCatcher, resetCatch, setCatcherPosition, updateCatch } from "./stages/catch.js";
import { flipMemoryCard, getMemory, resetMemory, resetOpenPair, updateMemoryTimer } from "./stages/memory.js";
import { advanceDefendWave, getDefend, resetDefend, retryDefendWave, selectDefendDifficulty, setDefendPosition, startBossFight, updateDefend, useEggBomb } from "./stages/defend.js";

const app = document.querySelector("#app");
let animationFrame;
let lastFrame;
let message = "";
let facing = "right";
let characterAction = "idle";
let effectCell = null;
let transitionTimer;
let transitionTarget = "catch";
let memoryTimer;
let memoryFrame;
let memoryLastFrame;
let defendTimer;
let deferredInstallPrompt;
let installBanner;
let isPaused = false;
let audioControls;
let adventureTouchStart;
let adventureLastDirection = "up";
let adventureLastTap = 0;
let catchTouchStart;
let homeConstructionPart = null;

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIOSBrowser() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function renderInstallBanner(kind) {
  if (isStandaloneApp()) return;
  if (!installBanner) {
    installBanner = document.createElement("aside");
    installBanner.className = "install-banner";
    installBanner.setAttribute("aria-live", "polite");
    document.body.append(installBanner);
  }
  const isIOS = kind === "ios";
  installBanner.innerHTML = `<div class="install-banner__icon" aria-hidden="true">&#127822;</div><div class="install-banner__copy"><strong>Add Wander Farm</strong><span>${isIOS ? "Keep the farm one tap away." : "Install the farm on your home screen for quick play."}</span>${isIOS ? '<small data-install-instructions hidden>Tap the Share button in Safari, then choose <b>Add to Home Screen</b>.</small>' : ""}</div><div class="install-banner__actions"><button class="install-banner__button" type="button" data-install-action="${isIOS ? "show-ios-steps" : "install"}">${isIOS ? "How to add" : "Add app"}</button><button class="install-banner__dismiss" type="button" data-install-action="dismiss" aria-label="Dismiss install prompt">&times;</button></div>`;
  installBanner.hidden = false;
}

function hideInstallBanner() {
  if (installBanner) installBanner.hidden = true;
}

function setupInstallPrompt() {
  if (isStandaloneApp()) return;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    renderInstallBanner("browser");
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    hideInstallBanner();
  });
  if (isIOSBrowser()) renderInstallBanner("ios");
}

function renderAudioControls() {
  const settings = audio.getSettings();
  if (!audioControls) {
    audioControls = document.createElement("div");
    audioControls.className = "audio-controls";
    document.body.append(audioControls);
  }
  const playlistStatus = settings.customTrackCount ? `${settings.customTrackCount} of 5 songs ready` : "No songs added yet";
  audioControls.innerHTML = `<button class="audio-toggle" type="button" data-audio-action="open" aria-label="Open sound settings" aria-expanded="false">${settings.enabled ? "&#9835;" : "&#9835;&#10005;"}</button><div class="audio-panel" hidden><header class="audio-panel__header"><span aria-hidden="true">&#9835;</span><div><strong>Sound & music</strong><small>Personalize your farm</small></div><button type="button" data-audio-action="toggle">${settings.enabled ? "On" : "Off"}</button></header><section class="audio-panel__section audio-volume"><div><span>Volume</span><output>${Math.round(settings.volume * 100)}%</output></div><input type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}" data-audio-volume ${settings.enabled ? "" : "disabled"}></section><section class="audio-panel__section audio-library"><label for="audio-source">Now playing</label><select id="audio-source" data-audio-source ${settings.enabled ? "" : "disabled"}><option value="default" ${settings.musicSource === "default" ? "selected" : ""}>Wander Farm Radio</option><option value="custom" ${settings.musicSource === "custom" ? "selected" : ""} ${settings.customTrackCount ? "" : "disabled"}>My Playlist</option></select><div class="audio-playlist-status"><span>My Playlist</span><b>${playlistStatus}</b></div><label class="audio-add">Add music <span>Up to 5 songs</span><input type="file" accept="audio/*" multiple data-audio-files ${settings.enabled ? "" : "disabled"}></label><small class="audio-panel__help">New selections replace the current playlist and play in order.</small></section></div>`;
}

function toggleAudioPanel() {
  const panel = audioControls?.querySelector(".audio-panel");
  const button = audioControls?.querySelector(".audio-toggle");
  if (panel) {
    panel.hidden = !panel.hidden;
    button?.setAttribute("aria-expanded", String(!panel.hidden));
  }
}

function screenFrame(content, screenName) {
  return `<section class="screen screen--${screenName}"><div class="ambient ambient--one"></div><div class="ambient ambient--two"></div>${content}</section>`;
}

function farmBackdropMarkup() {
  return `<div class="farm-backdrop" aria-hidden="true"><i class="farm-cloud farm-cloud--one"></i><i class="farm-cloud farm-cloud--two"></i><i class="farm-bird farm-bird--one">&#8764;</i><i class="farm-bird farm-bird--two">&#8764;</i><span class="farm-house"><i class="farm-house__roof"></i><i class="farm-house__window farm-house__window--one"></i><i class="farm-house__window farm-house__window--two"></i><i class="farm-house__door"></i></span><i class="farm-tree farm-tree--one"></i><i class="farm-tree farm-tree--two"></i><i class="farm-chicken"></i><i class="farm-butterfly">&#10022;</i></div>`;
}

function pauseButtonMarkup() {
  return `<button class="pause-button" type="button" data-action="pause" aria-label="Open game menu"><span aria-hidden="true">&#9776;</span> Menu</button>`;
}

function pauseGame() {
  if (isPaused || !["adventure", "catch", "memory", "defend"].includes(getRun().currentScreen)) return;
  isPaused = true;
  audio.pauseMusic();
  cancelAnimationFrame(animationFrame);
  cancelAnimationFrame(memoryFrame);
  app.insertAdjacentHTML("beforeend", `<div class="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title"><div class="pause-card"><p class="eyebrow">Wander Farm</p><h2 id="pause-title">Farm menu</h2><p>Your timer, score, and farm are waiting right here.</p><div class="pause-card__actions"><button class="button button--primary" type="button" data-action="resume-game">Resume <span aria-hidden="true">&#8594;</span></button><button class="menu-button" type="button" data-action="start-over-story">Start over story</button><button class="menu-button menu-button--quiet" type="button" data-action="exit-to-home">Exit to home</button></div></div></div>`);
}

function resumeGame() {
  if (!isPaused) return;
  isPaused = false;
  audio.resumeMusic();
  app.querySelector(".pause-overlay")?.remove();
  render();
}

function startOverStory() {
  window.clearTimeout(transitionTimer);
  window.clearTimeout(memoryTimer);
  window.clearTimeout(defendTimer);
  isPaused = false;
  resetRun();
  resetAdventure();
  resetCatch();
  resetMemory();
  resetDefend();
  message = "";
  effectCell = null;
  characterAction = "idle";
  updateRun({ currentScreen: "choose" });
  render();
}

function exitToHome() {
  window.clearTimeout(transitionTimer);
  window.clearTimeout(memoryTimer);
  window.clearTimeout(defendTimer);
  isPaused = false;
  updateRun({ currentScreen: "start" });
  render();
}

function runWhenUnpaused(callback, delay = 0) {
  const run = () => {
    if (isPaused) {
      window.setTimeout(run, 120);
      return;
    }
    callback();
  };
  return window.setTimeout(run, delay);
}

const stageOrder = ["adventure", "catch", "memory", "defend"];

function attemptMultiplier(attempts) {
  return [1, .75, .5, .25][Math.min(Math.max(attempts - 1, 0), 3)];
}

function sumStageScores(scores) {
  return Object.values(scores).reduce((total, score) => total + score, 0);
}

function updateStageScores(changes) {
  const stageScores = { ...getRun().stageScores, ...changes };
  updateRun({ stageScores, score: sumStageScores(stageScores) });
  return stageScores;
}

function recordStageAttempt(stage) {
  const stageAttempts = { ...getRun().stageAttempts, [stage]: getRun().stageAttempts[stage] + 1 };
  updateRun({ stageAttempts });
  return stageAttempts[stage];
}

function clearScoresFrom(stage) {
  const index = stageOrder.indexOf(stage);
  const cleared = stageOrder.slice(index).reduce((scores, stageName) => ({ ...scores, [stageName]: 0 }), {});
  updateStageScores(cleared);
}

function finishStage(stage, baseScore) {
  const awarded = Math.round(baseScore * attemptMultiplier(getRun().stageAttempts[stage] || 1));
  updateStageScores({ [stage]: awarded });
  return awarded;
}

function startCatchRound({ resetRetries = true } = {}) {
  resetCatch();
  clearScoresFrom("catch");
  const attempt = recordStageAttempt("catch");
  updateRun({
    currentScreen: "catch",
    currentStage: "catch",
    stageRetries: { ...getRun().stageRetries, catch: resetRetries ? 0 : getRun().stageRetries.catch },
    lastScore: getRun().score
  });
  return attempt;
}

function restartAdventureFromStageTwo() {
  resetAdventure();
  clearScoresFrom("adventure");
  recordStageAttempt("adventure");
  updateRun({ currentScreen: "adventure", currentStage: "adventure", stageRetries: { ...getRun().stageRetries, catch: 0 } });
  message = "The orchard sent you back to the path. Gather apples and try again.";
  render();
}

const homeProjects = [
  { part: "foundation", label: "Foundation", cost: 800 },
  { part: "walls", label: "Walls", cost: 1000 },
  { part: "roof", label: "Roof", cost: 1500 },
  { part: "door", label: "Door", cost: 700 },
  { part: "windows", label: "Windows", cost: 900 },
  { part: "roofSupports", label: "Roof supports", cost: 1800 },
  { part: "wallSupports", label: "Wall supports", cost: 1800 },
  { part: "reinforcedRoof", label: "Stronger roof", cost: 2200 },
  { part: "reinforcedDoor", label: "Reinforced door", cost: 1400 },
  { part: "windowProtection", label: "Window protection", cost: 1600 },
  { part: "foundationReinforcement", label: "Foundation reinforcement", cost: 1800 },
  { part: "floor", label: "Wooden floor", cost: 1200 },
  { part: "bed", label: "Bed", cost: 2000 },
  { part: "table", label: "Table", cost: 1000 },
  { part: "chairs", label: "Chairs", cost: 900 },
  { part: "lamp", label: "Lamp", cost: 1500 },
  { part: "fireplace", label: "Fireplace", cost: 1800 },
  { part: "kitchen", label: "Kitchen", cost: 3000 },
  { part: "curtains", label: "Curtains", cost: 800 },
  { part: "garden", label: "Garden", cost: 2200 },
  { part: "fence", label: "Fence", cost: 1700 },
  { part: "flowers", label: "Flowers", cost: 700 },
  { part: "pathway", label: "Pathway", cost: 900 },
  { part: "mailbox", label: "Mailbox", cost: 600 },
  { part: "outdoorSeating", label: "Outdoor seating", cost: 1800 },
  { part: "trees", label: "Trees", cost: 1400 },
  { part: "decorations", label: "Decorations", cost: 1200 }
];

function homeHouseMarkup(house) {
  const constructionClass = homeConstructionPart ? `is-building-${homeConstructionPart}` : "";
  return `<div class="home-house ${house.foundation ? "is-founded" : "is-empty"} ${house.walls ? "has-walls" : ""} ${house.roof ? "has-roof" : ""} ${house.door ? "has-door" : ""} ${house.windows ? "has-windows" : ""} ${house.roofSupports ? "has-roof-supports" : ""} ${house.wallSupports ? "has-wall-supports" : ""} ${house.reinforcedRoof ? "has-reinforced-roof" : ""} ${house.reinforcedDoor ? "has-reinforced-door" : ""} ${house.windowProtection ? "has-window-protection" : ""} ${house.foundationReinforcement ? "has-foundation-reinforcement" : ""} ${house.floor ? "has-floor" : ""} ${house.bed ? "has-bed" : ""} ${house.table ? "has-table" : ""} ${house.chairs ? "has-chairs" : ""} ${house.lamp ? "has-lamp" : ""} ${house.fireplace ? "has-fireplace" : ""} ${house.kitchen ? "has-kitchen" : ""} ${house.curtains ? "has-curtains" : ""} ${house.garden ? "has-garden" : ""} ${house.fence ? "has-fence" : ""} ${house.flowers ? "has-flowers" : ""} ${house.pathway ? "has-pathway" : ""} ${house.mailbox ? "has-mailbox" : ""} ${house.outdoorSeating ? "has-outdoor-seating" : ""} ${house.trees ? "has-trees" : ""} ${house.decorations ? "has-decorations" : ""} ${constructionClass}" aria-label="${house.foundation ? "Your unfinished farmhouse" : "An empty house plot"}"><i class="home-house__foundation"></i><i class="home-house__walls"></i><i class="home-house__roof"></i><i class="home-house__door"></i><i class="home-house__window home-house__window--one"></i><i class="home-house__window home-house__window--two"></i><i class="home-house__support home-house__support--roof"></i><i class="home-house__support home-house__support--wall"></i><i class="home-house__reinforced-roof"></i><i class="home-house__reinforced-door"></i><i class="home-house__window-shield home-house__window-shield--one"></i><i class="home-house__window-shield home-house__window-shield--two"></i><i class="home-house__floor"></i><i class="home-house__bed"></i><i class="home-house__table"></i><i class="home-house__chairs"></i><i class="home-house__lamp"></i><i class="home-house__fireplace"></i><i class="home-house__kitchen"></i><i class="home-house__curtain home-house__curtain--one"></i><i class="home-house__curtain home-house__curtain--two"></i><i class="home-house__yard-home-house"></i><i class="home-house__garden"></i><i class="home-house__fence"></i><i class="home-house__flowers"></i><i class="home-house__pathway"></i><i class="home-house__mailbox"></i><i class="home-house__seating"></i><i class="home-house__tree home-house__tree--one"></i><i class="home-house__tree home-house__tree--two"></i><i class="home-house__decorations"></i><i class="home-house__warmth"></i></div>`;
}

function homeRainMarkup() {
  return `<div class="home-rain" aria-hidden="true">${Array.from({ length: 22 }, (_, index) => `<i style="--rain-x:${(index * 47) % 100}%;--rain-delay:${(index % 7) * -.23}s"></i>`).join("")}</div>`;
}

function renderStart() {
  const run = getRun();
  const nextProject = homeProjects.find((project) => !run.house[project.part]);
  const scoreSummary = `<div class="home-score"><span>Build Points</span><strong>${run.buildPoints}</strong><small>Saved for your home</small></div>`;
  const savedProgress = hasSavedProgress()
    ? `<button class="button button--primary" type="button" data-action="resume">${run.lastMemory ? "View last memory" : "Continue adventure"} <span aria-hidden="true">&#8594;</span></button><button class="text-button" type="button" data-action="new-game">Start a new story</button>`
    : `<button class="button button--primary" type="button" data-action="start">Start adventure <span aria-hidden="true">&#8594;</span></button>`;
  const partner = characterMarkup({ state: run.house.foundation ? "idle" : "hurt", avatar: run.avatar || "female" });
  const houseAction = nextProject && run.buildPoints >= nextProject.cost ? `<button class="home-build-button" type="button" data-action="build-house-part" data-house-part="${nextProject.part}">Build ${nextProject.label.toLowerCase()}</button>` : "";
  const homeMessage = message && getRun().currentScreen === "start" ? `<p class="home-message">${message}</p>` : "";
  app.innerHTML = screenFrame(`${scoreSummary}<div class="home-layout"><div class="home-scene ${run.house.foundation ? "home-scene--built" : "home-scene--rain"}">${homeRainMarkup()}${homeHouseMarkup(run.house)}<div class="home-partner">${partner}</div><p class="home-scene__caption">${run.house.foundation ? "A beginning worth protecting." : "Someone you love is out in the rain."}</p>${houseAction}</div><div class="start-card"><p class="eyebrow">A small farm adventure</p><h1>${gameData.title}</h1><p class="lede">${run.house.foundation ? "Your home is growing one good day at a time." : "Let’s build them somewhere warm."}</p>${homeMessage}${savedProgress}<p class="hint">Keyboard and touch controls supported.</p></div></div>`, "start");
}

function renderBuildHome() {
  const run = getRun();
  const nextProject = homeProjects.find((project) => !run.house[project.part]);
  const projects = homeProjects.map((project, index) => {
    const complete = Boolean(run.house[project.part]);
    const previousComplete = index === 0 || Boolean(run.house[homeProjects[index - 1].part]);
    const affordable = run.buildPoints >= project.cost;
    const locked = !complete && !previousComplete;
    const status = complete ? "Built" : locked ? "Locked" : `${project.cost} Build Points`;
    const action = !complete && !locked && affordable ? `<button class="build-project__button" type="button" data-action="build-house-part" data-house-part="${project.part}">Build</button>` : "";
    return `<div class="build-project ${complete ? "is-complete" : locked ? "is-locked" : ""}"><span class="build-project__icon">${complete ? "&#10003;" : index + 1}</span><div><strong>${project.label}</strong><small>${status}</small></div>${action}</div>`;
  }).join("");
  app.innerHTML = screenFrame(`<div class="build-home-card"><button class="build-home-back" type="button" data-action="exit-to-home">&#8592; Home</button><p class="eyebrow">Your home</p><h1>Build the farmhouse</h1><p class="lede">Spend Build Points to bring each part to life.</p><div class="build-home-scene home-scene ${run.house.foundation ? "home-scene--built" : "home-scene--rain"}">${homeRainMarkup()}${homeHouseMarkup(run.house)}<div class="home-partner">${characterMarkup({ state: "idle", avatar: run.avatar || "female" })}</div></div><div class="build-points-total"><span>Build Points</span><strong>${run.buildPoints}</strong></div><div class="build-project-list">${projects}</div>${nextProject ? `<p class="build-home-next">Next: ${nextProject.label}</p>` : `<p class="build-home-next">Your first shelter is complete.</p>`}</div>`, "build-home");
}

function renderCharacterSelect() {
  app.innerHTML = screenFrame(`<button class="choose-back" type="button" data-action="exit-to-home"><span aria-hidden="true">&#8592;</span> Back</button><div class="choose-card">${farmBackdropMarkup()}<p class="eyebrow">Choose your farmer</p><h1>Who is heading home?</h1><p class="lede">Pick your character, then make the farm proud.</p><div class="avatar-options"><button class="avatar-choice" type="button" data-avatar="female"><span class="avatar-preview">${characterMarkup({ state: "idle", avatar: "female" })}</span><strong>Farm girl</strong><small>Quick feet, big energy</small></button><button class="avatar-choice" type="button" data-avatar="male"><span class="avatar-preview">${characterMarkup({ state: "idle", avatar: "male" })}</span><strong>Farm boy</strong><small>Ready for the fields</small></button></div></div>`, "choose");
}

function adventureCell(x, y, stage) {
  const key = `${x},${y}`;
  const isPlayer = stage.player.x === x && stage.player.y === y;
  const isExit = stage.exit.x === x && stage.exit.y === y;
  const isFragment = stage.fragments.has(key);
  const locked = isExit && stage.applesCollected < stage.requiredApples;
  const classes = ["map-cell"];
  if (stage.walls.has(key)) classes.push("map-cell--wall");
  if (isExit) classes.push("map-cell--exit", locked ? "is-locked" : "is-open");
  if (isPlayer) classes.push("map-cell--player");
  if (isFragment) classes.push("map-cell--fragment");
  const isHazard = stage.hazards.has(key);
  if (isHazard) classes.push("map-cell--hazard");
  const burst = effectCell?.x === x && effectCell?.y === y ? `${rewardBurstMarkup()}<b class="point-float point-float--${effectCell.kind}">${effectCell.label}</b>` : "";
  const content = isPlayer ? characterMarkup({ state: characterAction, direction: facing, avatar: getRun().avatar || "male" }) : isFragment ? "&#127822;" : isExit ? "&#8962;" : isHazard ? "&#10048;" : "";
  return `<span class="${classes.join(" ")}" aria-hidden="true">${content}${burst}</span>`;
}

function renderAdventure() {
  const stage = getAdventure();
  const cells = [];
  for (let y = 0; y < stage.rows; y += 1) for (let x = 0; x < stage.columns; x += 1) cells.push(adventureCell(x, y, stage));
  app.innerHTML = screenFrame(`<div class="game-card adventure-card">${farmBackdropMarkup()}<div class="stage-heading"><div><p class="eyebrow">Stage 1 of 4</p><h1>${gameData.stages.adventure.name}</h1></div><div class="stage-heading__actions"><span class="counter">${stage.applesCollected}/${stage.requiredApples} <small>apples</small></span>${pauseButtonMarkup()}</div></div><p class="objective">Gather 4 apples from the field. Swipe to move and double-tap to jump thorn patches.</p><div class="adventure-map" data-adventure-board role="application" aria-label="Swipe to move through the farm. Double-tap to jump over a thorn patch.">${cells.join("")}</div><p class="adventure-gesture-hint"><span>Swipe to move</span><span>Double-tap to jump</span></p><p class="game-message">${message || (stage.applesCollected < stage.requiredApples ? "Six apples are hidden in safe, changing places. Thorn patches can be jumped over." : "The farmhouse is glowing. Head home!")}</p></div>`, "game");
}

function fallingMarkup(objects) {
  const icons = { apple: "&#127822;", heart: "&#9829;", badApple: "&#127822;", heartbreak: "&#128148;" };
  return objects.map((object) => `<div class="falling falling--${object.type}" style="left:${object.x}%; top:${object.y}%">${icons[object.type]}</div>`).join("");
}

function renderCatch() {
  const stage = getCatch();
  app.innerHTML = screenFrame(`<div class="game-card catch-card">${farmBackdropMarkup()}<div class="stage-heading"><div><p class="eyebrow">Stage 2 of 4 · Attempt ${getRun().stageRetries.catch + 1}/4</p><h1>Orchard Rush</h1></div><div class="stage-heading__actions"><span class="timer"><strong data-time>${Math.ceil(stage.timeRemaining / 1000)}</strong>s</span>${pauseButtonMarkup()}</div></div><p class="objective">Reach ${stage.target} field points in 90 seconds. Apple +2, Heart +5, Rotten apple -2, Heartbreak -5.</p><div class="catch-stats"><span><b data-caught>${stage.fieldScore}</b> / ${stage.target} field points</span><span class="total-score">Story <strong data-total>${getRun().score}</strong></span></div><div class="catch-board" data-catch-board role="application" aria-label="Swipe left and right to catch apples and hearts while avoiding rotten apples and heartbreaks."><div class="field-grass"></div><div class="falling-layer">${fallingMarkup(stage.objects)}</div><div class="catcher" style="left:${stage.catcherX}%">${characterMarkup({ state: "idle", direction: facing, avatar: getRun().avatar || "male" })}<span class="catcher__basket"></span></div></div><p class="adventure-gesture-hint"><span>Swipe left or right to catch</span></p><p class="game-message">${message || "The orchard is fast. Choose what you catch."}</p></div>`, "game");
}

function updateCatchFrame() {
  const stage = getCatch();
  const catcher = app.querySelector(".catcher");
  const layer = app.querySelector(".falling-layer");
  if (!catcher || !layer) return;
  catcher.style.left = `${stage.catcherX}%`;
  layer.innerHTML = fallingMarkup(stage.objects);
  app.querySelector("[data-time]").textContent = Math.ceil(stage.timeRemaining / 1000);
  app.querySelector("[data-caught]").textContent = stage.fieldScore;
  app.querySelector("[data-total]").textContent = getRun().score;
}

function renderTransition() {
  const praise = getRun().avatar === "female" ? "I knew you were a farm baddie." : "The farm knew you had it in you.";
  const toBarn = transitionTarget === "memory";
  const toDefend = transitionTarget === "defend";
  const eyebrow = toBarn ? "Orchard cleared" : toDefend ? "Barn mastered" : "Path complete";
  const title = toBarn ? "The barn doors open." : toDefend ? "Something is coming." : "The farm wakes up.";
  const copy = toBarn ? "A lantern flickers inside. Can you remember the farm's treasures?" : toDefend ? "Protect the farmhouse. Drag your farmer and let the apples fly." : praise;
  app.innerHTML = screenFrame(`<div class="transition-card">${farmBackdropMarkup()}<p class="eyebrow">${eyebrow}</p><div class="transition-character">${characterMarkup({ state: "victory", direction: facing, avatar: getRun().avatar || "male" })}${rewardBurstMarkup()}</div><h1>${title}</h1><p class="lede">${copy}</p></div>`, "transition");
}

function renderMemory() {
  const stage = getMemory();
  const cards = stage.cards.map((card) => `<button class="memory-card ${card.flipped || card.matched ? "is-flipped" : ""} ${card.matched ? "is-matched" : ""}" type="button" data-card-id="${card.id}" aria-label="Memory card" ${stage.locked || card.matched ? "disabled" : ""}><span class="memory-card__inner"><span class="memory-card__face memory-card__front">?</span><span class="memory-card__face memory-card__back">${card.icon}</span></span></button>`).join("");
  app.innerHTML = screenFrame(`<div class="memory-card-screen">${farmBackdropMarkup()}<div class="stage-heading"><div><p class="eyebrow">Stage 3 of 4</p><h1>${gameData.stages.memory.name}</h1></div><div class="stage-heading__actions"><span class="counter" data-memory-score>${getRun().score}<small>points</small></span>${pauseButtonMarkup()}</div></div><p class="objective">Match ${stage.pairCount} farm pairs before the 90-second timer ends.</p><div class="memory-stats"><span><b data-memory-pairs>${stage.matchedPairs}</b>/${stage.pairCount} pairs</span><span><b data-memory-time>${Math.ceil(stage.timeRemaining / 1000)}</b>s <small>left</small></span><span><b data-memory-moves>${stage.moves}</b> moves</span></div><div class="barn-room"><div class="barn-lantern"></div><div class="memory-grid">${cards}</div><div class="memory-farmer">${characterMarkup({ state: characterAction, direction: facing, avatar: getRun().avatar || "male" })}</div></div><p class="game-message" data-memory-message>${message || "Every farm night tells a different story."}</p></div>`, "memory");
}

function heartsMarkup(hearts) {
  return Array.from({ length: gameData.stages.defend.farmhouseHearts }, (_, index) => `<i class="farmhouse-heart ${index < hearts ? "is-full" : ""}"></i>`).join("");
}

function defendEnemyMarkup(enemies) {
  return enemies.map((enemy) => enemy.type === "fox"
    ? `<span class="defend-enemy defend-enemy--fox ${enemy.hitFlash > 0 ? "is-hit" : ""}" style="left:${enemy.x}%;top:${enemy.y}%" data-enemy="${enemy.id}"><i class="fox-ear fox-ear--left"></i><i class="fox-ear fox-ear--right"></i><b class="fox-face"></b><em class="fox-hp">${enemy.hp}</em></span>`
    : enemy.type === "locust"
      ? `<span class="defend-enemy defend-enemy--locust ${enemy.hitFlash > 0 ? "is-hit" : ""}" style="left:${enemy.x}%;top:${enemy.y}%" data-enemy="${enemy.id}"><i></i><i></i><i></i><i></i><i></i><i></i><em class="locust-hp">${enemy.hp}</em></span>`
    : `<span class="defend-enemy defend-enemy--crow" style="left:${enemy.x}%;top:${enemy.y}%" data-enemy="${enemy.id}"><i></i><b></b></span>`).join("");
}

function defendAppleMarkup(apples) {
  return apples.map((apple) => `<span class="defend-apple" style="left:${apple.x}%;top:${apple.y}%" data-apple="${apple.id}"><i></i></span>`).join("");
}

function defendPowerUpMarkup(powerUps) {
  return powerUps.map((powerUp) => `<span class="defend-powerup defend-powerup--${powerUp.type}" style="left:${powerUp.x}%;top:${powerUp.y}%" data-powerup="${powerUp.id}"><i></i></span>`).join("");
}

function bossMarkup(boss) {
  if (!boss?.active) return "";
  return `<span class="raccoon-king ${boss.hitFlash > 0 ? "is-hit" : ""} ${boss.phase === 2 ? "is-raging" : ""}" style="left:${boss.x}%;top:${boss.y}%"><i class="raccoon-crown"></i><i class="raccoon-ear raccoon-ear--left"></i><i class="raccoon-ear raccoon-ear--right"></i><b class="raccoon-face"></b><em class="raccoon-tail"></em></span>`;
}

function trashMarkup(projectiles) {
  return projectiles.map((item) => `<span class="boss-trash" style="left:${item.x}%;top:${item.y}%"><i></i></span>`).join("");
}

function renderDefend() {
  const stage = getDefend();
  const seconds = Math.ceil((stage.wave.duration - stage.elapsed) / 1000);
  const tripleSeconds = Math.ceil(stage.tripleShotRemaining / 1000);
  const doubleSeconds = Math.ceil(stage.doubleShotRemaining / 1000);
  const shotStatus = tripleSeconds ? `Triple shot ${tripleSeconds}s` : doubleSeconds ? `Double shot ${doubleSeconds}s` : "";
  const bossBar = stage.boss ? `<div class="boss-hud"><span>${gameData.stages.defend.boss.name}</span><div><i style="width:${Math.max(0, stage.boss.hp / stage.boss.maxHp * 100)}%" data-boss-bar></i></div></div>` : "";
  const label = stage.boss ? `${gameData.stages.defend.boss.difficulties[stage.boss.difficulty].label} Boss · Phase ${stage.boss.phase}` : `Wave ${stage.wave.id} / ${stage.waveCount}`;
  const timeLabel = stage.boss ? "!" : `${seconds}s`;
  app.innerHTML = screenFrame(`<div class="defend-screen ${stage.boss ? "is-boss-fight" : ""}"><div class="defend-hud"><div><span class="defend-label">${label}</span><strong data-defend-time>${timeLabel}</strong></div><div class="defend-score">Defeated <strong data-defend-kills>${stage.defeated}</strong><small data-defend-shot>${shotStatus}</small></div><div class="defend-hud-actions">${pauseButtonMarkup()}<button class="egg-bomb-button ${stage.eggBombs ? "has-bomb" : ""}" type="button" data-action="use-egg-bomb" aria-label="Use Egg Bomb" ${stage.eggBombs ? "" : "disabled"}><i></i><b data-defend-bombs>${stage.eggBombs}</b></button><div class="defend-health" aria-label="Farmhouse health" data-defend-hearts>${heartsMarkup(stage.hearts)}</div></div></div>${bossBar}<div class="defend-board" data-defend-board role="application" aria-label="Defend the farmhouse. Drag the farmer left and right; apples throw automatically."><div class="defend-sky"><i></i><i></i></div><div class="defend-hills"></div><div class="defend-orchard"></div><div class="defend-entities" data-defend-entities>${bossMarkup(stage.boss)}${trashMarkup(stage.bossProjectiles)}${defendEnemyMarkup(stage.enemies)}${defendAppleMarkup(stage.apples)}${defendPowerUpMarkup(stage.powerUps)}</div><div class="defend-farmer" data-defend-farmer style="left:${stage.playerX}%">${characterMarkup({ state: "idle", direction: facing, avatar: getRun().avatar || "male" })}</div><div class="defend-house" data-defend-house><i class="defend-house__roof"></i><i class="defend-house__window defend-house__window--one"></i><i class="defend-house__window defend-house__window--two"></i><i class="defend-house__door"></i></div><div class="defend-drag-hint">Drag to move your farmer</div></div><p class="game-message" data-defend-message>${message || (stage.boss ? "The Raccoon King throws trash. Keep firing and protect the farmhouse." : stage.wave.id === 3 ? `${stage.wavePowerUpsRemaining} supply drop${stage.wavePowerUpsRemaining === 1 ? "" : "s"} remain: hearts, Golden Apples, and Egg Bombs.` : stage.wave.id === 2 ? `Glowing apples will drop ${stage.wavePowerUpsRemaining} more time${stage.wavePowerUpsRemaining === 1 ? "" : "s"}.` : "The farmhouse has 6 hearts. Keep the crows out.")}</p></div>`, "defend");
}

function renderDefendFailure() {
  const stage = getDefend();
  const retryKey = stage.boss ? "boss" : stage.waveIndex;
  const retriesUsed = stage.attemptsByWave[retryKey] || 0;
  const retriesLeft = 3 - retriesUsed;
  const name = stage.boss ? "the Raccoon King" : `Wave ${stage.wave.id}`;
  app.innerHTML = screenFrame(`<div class="result-card defend-result"><p class="eyebrow">Farmhouse fallen</p><div class="transition-character">${characterMarkup({ state: "hurt", direction: facing, avatar: getRun().avatar || "male" })}</div><h1>Take a breath.</h1><p class="lede">You defended the farm from ${stage.defeated} invaders. ${name} is ready when you are.</p><p class="retry-counter">${retriesLeft} ${retriesLeft === 1 ? "retry" : "retries"} left for this fight</p><button class="button button--primary" type="button" data-action="retry-defend">Try ${name} <span aria-hidden="true">&#8594;</span></button></div>`, "failure");
}

function renderWaveTransition() {
  const stage = getDefend();
  const nextWave = stage.wave.id + 1;
  const nextThreat = nextWave === 2 ? "A fox joins the raid." : "Locust clouds roll in.";
  const nextCopy = nextWave === 2 ? "Wave 2 is faster. Foxes need three apple hits. Hold the line." : "Wave 3 is chaos. Locust swarms cover more ground, so keep moving.";
  app.innerHTML = screenFrame(`<div class="transition-card defend-victory">${farmBackdropMarkup()}<p class="eyebrow">Wave ${stage.wave.id} complete</p><div class="transition-character">${characterMarkup({ state: "excited", direction: facing, avatar: getRun().avatar || "male" })}${rewardBurstMarkup()}</div><h1>${nextThreat}</h1><p class="lede">${nextCopy}</p></div>`, "transition");
}

function renderLastMemory() {
  const run = getRun();
  const praise = run.avatar === "female" ? gameData.ending.femaleMessage : gameData.ending.maleMessage;
  const bossResult = run.lastMemory?.difficulty ? `<p class="boss-result">${gameData.stages.defend.boss.difficulties[run.lastMemory.difficulty].label} Stage 4 score <b>${run.lastMemory.bossScore}</b></p>` : "";
  app.innerHTML = screenFrame(`<div class="last-memory-card">${farmBackdropMarkup()}<p class="eyebrow">${gameData.ending.title}</p><div class="transition-character">${characterMarkup({ state: "victory", direction: facing, avatar: run.avatar || "male" })}${rewardBurstMarkup()}</div><h1>The farmhouse is safe.</h1><p class="lede">${gameData.ending.copy}</p><p class="last-memory-card__praise">${praise}</p>${bossResult}<div class="story-deposit"><span>Story points added</span><strong>+${run.score}</strong></div><div class="score-row"><span>Farm Points balance</span><strong>${run.totalScore}</strong></div><button class="button button--primary" type="button" data-action="view-result">Keep this memory <span aria-hidden="true">&#8594;</span></button><button class="button button--secondary" type="button" data-action="exit-to-home">Return home</button></div>`, "transition");
}

function difficultyCardsMarkup() {
  const run = getRun();
  return Object.entries(gameData.stages.defend.boss.difficulties).map(([key, level]) => `<button class="boss-level boss-level--${key}" type="button" data-defend-level="${key}"><span>${level.label}</span><strong>Up to ${level.stagePoints} stage points</strong><small>${level.description}</small><em>Stage best ${run.bossHighScores[key]}</em></button>`).join("");
}

function renderDefendDifficulty() {
  app.innerHTML = screenFrame(`<div class="boss-intro">${farmBackdropMarkup()}<p class="eyebrow">Stage 4 of 4</p><div class="boss-intro__king">${characterMarkup({ state: "excited", direction: facing, avatar: getRun().avatar || "male" })}</div><h1>Defend the Farmhouse</h1><p class="lede">Choose your farm-defense level. It sets every wave and the final Raccoon King fight.</p><div class="boss-levels" aria-label="Stage 4 difficulty">${difficultyCardsMarkup()}</div></div>`, "transition");
}

function renderBossIntro() {
  const difficulty = gameData.stages.defend.boss.difficulties[getDefend().bossDifficulty];
  app.innerHTML = screenFrame(`<div class="boss-intro">${farmBackdropMarkup()}<p class="eyebrow">${difficulty.label} level</p><div class="boss-intro__king">${bossMarkup({ active: true, x: 50, y: 40, phase: 1, hitFlash: 0 })}</div><h1>THE RACCOON KING</h1><p class="lede">He has arrived with a crown, a grudge, and a bag full of trash.</p><p class="boss-intro__hint">A free Egg Bomb is ready for you.</p></div>`, "transition");
}

function renderResult() {
  const run = getRun();
  const praise = run.avatar === "female" ? "I knew you were a farm baddie." : "You made the farm proud.";
  const labels = { adventure: "Stage 1", catch: "Stage 2", memory: "Stage 3", defend: "Stage 4" };
  const scoreBreakdown = stageOrder.map((stage) => `<span><small>${labels[stage]}</small><b>${run.stageScores[stage]}</b></span>`).join("");
  app.innerHTML = screenFrame(`<div class="result-card"><p class="eyebrow">First quest complete</p><div class="medallion" aria-hidden="true">&#10022;</div><h1>You made it.</h1><p class="lede">${praise}</p><div class="score-row"><span>Quest score</span><strong>${run.score}</strong></div><div class="score-breakdown" aria-label="Score by stage">${scoreBreakdown}</div><div class="best-score">Best saved score <b>${run.bestScore}</b></div><button class="button button--primary" type="button" data-action="restart">Play again <span aria-hidden="true">&#8594;</span></button></div>`, "result");
}

function renderFailure() {
  const stage = getCatch();
  const retriesLeft = 3 - getRun().stageRetries.catch;
  app.innerHTML = screenFrame(`<div class="result-card"><p class="eyebrow">The orchard got wild</p><div class="medallion medallion--dim" aria-hidden="true">&#127822;</div><h1>Run the field again.</h1><p class="lede">You earned ${stage.fieldScore} of ${stage.target} field points in 90 seconds.</p><p class="retry-counter">${retriesLeft} ${retriesLeft === 1 ? "retry" : "retries"} left before returning to Stage 1</p><button class="button button--primary" type="button" data-action="retry-catch">Try again <span aria-hidden="true">&#8594;</span></button></div>`, "failure");
}

function renderMemoryFailure() {
  app.innerHTML = screenFrame(`<div class="result-card"><p class="eyebrow">The lantern faded</p><div class="medallion medallion--dim" aria-hidden="true">&#127802;</div><h1>Back to the orchard.</h1><p class="lede">The barn needs every pair matched before the 90-second timer ends.</p><button class="button button--primary" type="button" data-action="return-to-catch">Return to Stage 2 <span aria-hidden="true">&#8594;</span></button></div>`, "failure");
}

function render() {
  cancelAnimationFrame(animationFrame);
  cancelAnimationFrame(memoryFrame);
  switch (getRun().currentScreen) {
    case "choose": renderCharacterSelect(); break;
    case "adventure": renderAdventure(); break;
    case "catch": renderCatch(); startCatchLoop(); break;
    case "memory": renderMemory(); startMemoryLoop(); break;
    case "defend": renderDefend(); startDefendLoop(); break;
    case "defend-select": renderDefendDifficulty(); break;
    case "defend-wave-transition": renderWaveTransition(); break;
    case "defend-failure": renderDefendFailure(); break;
    case "last-memory": renderLastMemory(); break;
    case "boss-intro": renderBossIntro(); break;
    case "transition": renderTransition(); break;
    case "result": renderResult(); break;
    case "failure": renderFailure(); break;
    case "memory-failure": renderMemoryFailure(); break;
    case "build-home": renderBuildHome(); break;
    default: renderStart();
  }
}

function startMemoryLoop() {
  memoryLastFrame = performance.now();
  const tick = (now) => {
    if (isPaused || getRun().currentScreen !== "memory") return;
    const timer = updateMemoryTimer(Math.min(80, now - memoryLastFrame));
    memoryLastFrame = now;
    const stage = getMemory();
    if (timer.timedOut) {
      updateRun({ currentScreen: "memory-failure" });
      render();
      return;
    }
    const score = app.querySelector("[data-memory-score]");
    const pairCount = app.querySelector("[data-memory-pairs]");
    const time = app.querySelector("[data-memory-time]");
    const moves = app.querySelector("[data-memory-moves]");
    const status = app.querySelector("[data-memory-message]");
    if (score) score.firstChild.textContent = getRun().score;
    if (pairCount) pairCount.textContent = stage.matchedPairs;
    if (time) time.textContent = Math.ceil(stage.timeRemaining / 1000);
    if (moves) moves.textContent = stage.moves;
    memoryFrame = requestAnimationFrame(tick);
  };
  memoryFrame = requestAnimationFrame(tick);
}

function updateDefendFrame() {
  const stage = getDefend();
  const entities = app.querySelector("[data-defend-entities]");
  const farmer = app.querySelector("[data-defend-farmer]");
  const timer = app.querySelector("[data-defend-time]");
  const kills = app.querySelector("[data-defend-kills]");
  const hearts = app.querySelector("[data-defend-hearts]");
  if (!entities || !farmer) return;
  entities.innerHTML = `${bossMarkup(stage.boss)}${trashMarkup(stage.bossProjectiles)}${defendEnemyMarkup(stage.enemies)}${defendAppleMarkup(stage.apples)}${defendPowerUpMarkup(stage.powerUps)}`;
  farmer.style.left = `${stage.playerX}%`;
  timer.textContent = stage.boss ? "!" : `${Math.ceil((stage.wave.duration - stage.elapsed) / 1000)}s`;
  kills.textContent = stage.defeated;
  hearts.innerHTML = heartsMarkup(stage.hearts);
  const shot = app.querySelector("[data-defend-shot]");
  if (shot) shot.textContent = stage.tripleShotRemaining ? `Triple shot ${Math.ceil(stage.tripleShotRemaining / 1000)}s` : stage.doubleShotRemaining ? `Double shot ${Math.ceil(stage.doubleShotRemaining / 1000)}s` : "";
  const bombs = app.querySelector("[data-defend-bombs]");
  const bombButton = app.querySelector("[data-action='use-egg-bomb']");
  if (bombs) bombs.textContent = stage.eggBombs;
  if (bombButton) { bombButton.disabled = stage.eggBombs === 0; bombButton.classList.toggle("has-bomb", stage.eggBombs > 0); }
  const bossBar = app.querySelector("[data-boss-bar]");
  if (bossBar && stage.boss) bossBar.style.width = `${Math.max(0, stage.boss.hp / stage.boss.maxHp * 100)}%`;
}

function showDefendEffect(event) {
  const board = app.querySelector("[data-defend-board]");
  if (!board) return;
  const effect = document.createElement("span");
  effect.className = `defend-effect defend-effect--${event.type}`;
  effect.style.left = `${event.x}%`;
  effect.style.top = `${event.y}%`;
  const label = event.powerUp === "glowing-apple" ? "DOUBLE SHOT" : event.powerUp === "golden-apple" ? "TRIPLE SHOT" : event.powerUp === "heart" ? "+1 HEART" : event.powerUp === "egg-bomb" ? "EGG BOMB" : "";
  effect.innerHTML = ["crow-defeated", "fox-defeated", "locust-defeated"].includes(event.type) ? `<b>+${event.points}</b><i></i><i></i><i></i>` : ["fox-hit", "locust-hit"].includes(event.type) ? `<b class="fox-hit-label">${event.hp} hits left</b><i></i><i></i>` : event.type === "powerup-collected" ? `<b class="powerup-label">${label}</b><i></i><i></i><i></i>` : event.type === "egg-bomb" ? `<b class="powerup-label">BOOM!</b><i></i><i></i><i></i>` : `<i></i><i></i><i></i>`;
  board.append(effect);
  window.setTimeout(() => effect.remove(), 520);
}

function reactDefender(action) {
  const farmer = app.querySelector(".defend-farmer .farmer");
  if (!farmer) return;
  const avatar = getRun().avatar || "male";
  farmer.className = `farmer farmer--${avatar} farmer--${action} farmer--facing-${facing}`;
  window.setTimeout(() => { if (farmer.isConnected) farmer.className = `farmer farmer--${avatar} farmer--idle farmer--facing-${facing}`; }, action === "throw" ? 180 : 360);
}

function startDefendLoop() {
  lastFrame = performance.now();
  const tick = (now) => {
    if (isPaused || getRun().currentScreen !== "defend") return;
    const result = updateDefend(Math.min(45, now - lastFrame));
    lastFrame = now;
    for (const event of result.events) {
      if (event.type === "throw") {
        reactDefender("throw");
      }
      if (["crow-defeated", "fox-defeated", "locust-defeated"].includes(event.type)) {
        reactDefender("excited");
        showDefendEffect(event);
        audio.playSfx(event.type === "crow-defeated" ? "crowDefeat" : event.type === "fox-defeated" ? "foxDefeat" : "locustDefeat", { cooldown: event.type === "locust-defeated" ? 360 : 130 });
      }
      if (event.type === "fox-hit" || event.type === "locust-hit") {
        reactDefender("throw");
        showDefendEffect(event);
        audio.playSfx(event.type === "fox-hit" ? "foxHit" : "locustHit", { cooldown: 180 });
      }
      if (event.type === "powerup-collected") {
        reactDefender("excited");
        showDefendEffect(event);
        audio.playSfx("powerup", { cooldown: 180 });
      }
      if (event.type === "boss-hit") {
        reactDefender("excited");
        showDefendEffect({ ...event, type: "fox-hit" });
        audio.playSfx("bossHit", { cooldown: 180 });
      }
      if (event.type === "boss-phase-two") {
        message = "THE RACCOON KING IS RAGING!";
        audio.playSfx("bossPhaseTwo", { cooldown: 600 });
        const board = app.querySelector("[data-defend-board]");
        board?.classList.add("is-bombed");
        window.setTimeout(() => board?.classList.remove("is-bombed"), 430);
      }
      if (event.type === "farmhouse-hit") {
        reactDefender("hurt");
        showDefendEffect(event);
        audio.playSfx("farmhouseHit", { cooldown: 250 });
        const house = app.querySelector("[data-defend-house]");
        house?.classList.add("is-hit");
        window.setTimeout(() => house?.classList.remove("is-hit"), 260);
      }
    }
    if (result.outcome === "failed") {
      const stage = getDefend();
      const retryKey = stage.boss ? "boss" : stage.waveIndex;
      if ((stage.attemptsByWave[retryKey] || 0) >= 3) {
        resetDefend();
        clearScoresFrom("defend");
        updateRun({ currentScreen: "defend-select" });
        message = "That fight used all three retries. Choose a Stage 4 level and begin again.";
        render();
        return;
      }
      updateRun({ currentScreen: "defend-failure" });
      render();
      return;
    }
    if (result.outcome === "wave-won") {
      updateRun({ currentScreen: "defend-wave-transition" });
      render();
      defendTimer = window.setTimeout(() => {
        advanceDefendWave();
        updateRun({ currentScreen: "defend" });
        message = "Wave 2: the sky is getting crowded.";
        render();
      }, 1450);
      return;
    }
    if (result.outcome === "stage-won") {
      updateRun({ currentScreen: "boss-intro" });
      render();
      defendTimer = window.setTimeout(() => {
        startBossFight();
        updateRun({ currentScreen: "defend" });
        message = "The Raccoon King is here. You have one free Egg Bomb.";
        render();
      }, 1700);
      return;
    }
    if (result.outcome === "boss-won") {
      const stage = getDefend();
      const retriesUsed = Object.values(stage.attemptsByWave).reduce((total, attempts) => total + attempts, 0);
      const baseScore = Math.max(20, stage.boss.difficulty && gameData.stages.defend.boss.difficulties[stage.boss.difficulty].stagePoints * Math.max(.4, 1 - retriesUsed * .15));
      const bossScore = finishStage("defend", baseScore);
      const finalScore = getRun().score;
      const buildPoints = getRun().buildPoints + finalScore;
      const bossHighScores = { ...getRun().bossHighScores, [stage.boss.difficulty]: Math.max(getRun().bossHighScores[stage.boss.difficulty], bossScore) };
      audio.playSfx("bossDefeat", { cooldown: 900 });
      audio.softenMusic();
      updateRun({
        currentScreen: "last-memory",
        completedStages: [...new Set([...getRun().completedStages, "defend"])],
        score: finalScore,
        buildPoints,
        bossHighScores,
        lastMemory: { title: gameData.ending.title, completedAt: new Date().toISOString(), score: finalScore, difficulty: stage.boss.difficulty, bossScore }
      });
      render();
      return;
    }
    updateDefendFrame();
    animationFrame = requestAnimationFrame(tick);
  };
  animationFrame = requestAnimationFrame(tick);
}

function moveDefenderToPointer(event) {
  const board = event.target.closest("[data-defend-board]") || app.querySelector("[data-defend-board]");
  if (!board || getRun().currentScreen !== "defend") return;
  const rect = board.getBoundingClientRect();
  setDefendPosition(((event.clientX - rect.left) / rect.width) * 100);
  const direction = event.clientX < rect.left + rect.width / 2 ? "left" : "right";
  facing = direction;
}

function clearEffectSoon() {
  runWhenUnpaused(() => {
    effectCell = null;
    characterAction = "idle";
    if (getRun().currentScreen === "adventure") renderAdventure();
  }, 620);
}

function completeAdventure() {
  const stage = getAdventure();
  const baseScore = Math.max(0, Math.min(30, 18 + stage.applesCollected * 2 - stage.hazardsHit * 2));
  clearScoresFrom("catch");
  finishStage("adventure", baseScore);
  window.clearTimeout(transitionTimer);
  updateRun({ currentScreen: "transition", currentStage: "catch", completedStages: ["adventure"] });
  transitionTarget = "catch";
  message = "";
  characterAction = "victory";
  transitionTimer = window.setTimeout(() => {
    startCatchRound();
    message = "Reach 200 field points before the timer ends.";
    render();
  }, 1250);
}

function handleAdventureMove(direction) {
  const outcome = moveAdventure(direction);
  if (outcome.moved) audio.playSfx("footstep", { cooldown: 190 });
  facing = direction === "left" ? "left" : direction === "right" ? "right" : facing;
  characterAction = outcome.moved ? "walk" : "confused";
  if (!outcome.moved) message = "A hedge blocks the way.";
  else if (outcome.collected) {
    message = "Fresh apple! +2";
    characterAction = "collect";
    effectCell = { ...outcome.player, label: "+2", kind: "good" };
    clearEffectSoon();
  } else if (outcome.hitHazard) {
    message = "Thorns! -2";
    characterAction = "hurt";
    effectCell = { ...outcome.player, label: "-2", kind: "bad" };
    clearEffectSoon();
  } else message = "";
  if (outcome.complete) completeAdventure();
  render();
}

function handleAdventureJump() {
  const outcome = jumpAdventure(adventureLastDirection);
  if (!outcome.moved) {
    message = "Double-tap when a thorn patch is directly ahead.";
    characterAction = "confused";
    renderAdventure();
    return;
  }
  characterAction = "victory";
  message = "Great jump! The thorns missed you.";
  if (outcome.collected) {
    message = "Jump and apple! +2";
    effectCell = { ...outcome.player, label: "+2", kind: "good" };
    clearEffectSoon();
  }
  if (outcome.complete) completeAdventure();
  render();
}

function handleCatchMove(direction) {
  facing = direction;
  moveCatcher(direction);
}

function moveCatcherToPointer(event) {
  const board = app.querySelector("[data-catch-board]");
  if (!board) return;
  const rect = board.getBoundingClientRect();
  setCatcherPosition(((event.clientX - rect.left) / rect.width) * 100);
  facing = event.clientX < rect.left + rect.width / 2 ? "left" : "right";
}

function flashCatcher(action) {
  const farmer = app.querySelector(".catcher .farmer");
  if (!farmer) return;
  const avatar = getRun().avatar || "male";
  farmer.className = `farmer farmer--${avatar} farmer--${action} farmer--facing-${facing}`;
  window.setTimeout(() => { if (farmer.isConnected) farmer.className = `farmer farmer--${avatar} farmer--idle farmer--facing-${facing}`; }, 360);
}

function showCatchEffect(type, x, points = 0) {
  const board = app.querySelector(".catch-board");
  if (!board) return;
  const effect = document.createElement("span");
  effect.className = `catch-effect catch-effect--${points >= 0 ? "good" : "bad"}`;
  effect.style.left = `${x}%`;
  effect.innerHTML = `${rewardBurstMarkup()}<b>${points > 0 ? "+" : ""}${points}</b>`;
  board.append(effect);
  window.setTimeout(() => effect.remove(), 620);
}

function startCatchLoop() {
  lastFrame = performance.now();
  const tick = (now) => {
    if (isPaused || getRun().currentScreen !== "catch") return;
    const result = updateCatch(Math.min(45, now - lastFrame));
    lastFrame = now;
    const stage = getCatch();
    if (result.event) {
      flashCatcher(result.points > 0 ? "collect" : "hurt");
      showCatchEffect(result.event, result.eventX, result.points);
    }
    if (result.outcome === "won") {
      const baseScore = Math.max(0, Math.min(50, 40 + Math.floor((stage.fieldScore - stage.target) / 2) + Math.floor(stage.timeRemaining / 5000) * 2));
      clearScoresFrom("memory");
      finishStage("catch", baseScore);
      updateRun({ currentScreen: "transition", currentStage: "memory", completedStages: ["adventure", "catch"] });
      transitionTarget = "memory";
      message = "";
      transitionTimer = window.setTimeout(() => {
        resetMemory();
        recordStageAttempt("memory");
        updateRun({ currentScreen: "memory" });
        message = "The barn has a secret to share.";
        render();
      }, 1250);
      render();
      return;
    }
    if (result.outcome === "lost") {
      if (getRun().stageRetries.catch >= 3) {
        restartAdventureFromStageTwo();
        return;
      }
      updateRun({ currentScreen: "failure" });
      render();
      return;
    }
    updateCatchFrame();
    animationFrame = requestAnimationFrame(tick);
  };
  animationFrame = requestAnimationFrame(tick);
}

function handleMemoryCard(id) {
  const outcome = flipMemoryCard(id);
  if (outcome.type === "ignored") return;
  characterAction = outcome.type === "match" ? "excited" : "confused";
  if (outcome.type === "match") {
    message = `Pair found! +3`;
    if (outcome.complete) {
      characterAction = "victory";
      runWhenUnpaused(() => {
        const stage = getMemory();
        const baseScore = Math.max(20, 60 - Math.floor(stage.elapsed / 5000) * 2 - Math.max(0, stage.moves - stage.pairCount));
        clearScoresFrom("defend");
        finishStage("memory", baseScore);
        updateRun({ currentScreen: "transition", currentStage: "defend", completedStages: ["adventure", "catch", "memory"] });
        transitionTarget = "defend";
        message = "";
        transitionTimer = window.setTimeout(() => {
          resetDefend();
          updateRun({ currentScreen: "defend-select" });
          message = "";
          render();
        }, 1250);
        render();
      }, 720);
    }
  } else if (outcome.type === "mismatch") {
    message = "Not a pair. Watch closely.";
    memoryTimer = runWhenUnpaused(() => {
      resetOpenPair();
      characterAction = "idle";
      message = "";
      render();
    }, 700);
  }
  render();
}

function resumeSavedRun() {
  window.clearTimeout(transitionTimer);
  window.clearTimeout(memoryTimer);
  window.clearTimeout(defendTimer);
  const stage = getRun().currentStage;
  message = "Welcome back. Your farm score was saved.";
  effectCell = null;
  characterAction = "idle";
  if (getRun().lastMemory) {
    updateRun({ currentScreen: "last-memory" });
    return;
  }
  if (stage === "adventure") resetAdventure();
  if (stage === "catch") resetCatch();
  if (stage === "memory") resetMemory();
  if (stage === "defend") selectDefendDifficulty(getRun().defendDifficulty);
  updateRun({ currentScreen: stage });
}

document.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-install-action]")?.dataset.installAction;
  if (!action) return;
  if (action === "dismiss") {
    hideInstallBanner();
    return;
  }
  if (action === "show-ios-steps") {
    const instructions = installBanner?.querySelector("[data-install-instructions]");
    if (instructions) instructions.hidden = !instructions.hidden;
    return;
  }
  if (action === "install" && deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === "accepted") hideInstallBanner();
    deferredInstallPrompt = null;
  }
});

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-audio-action]")?.dataset.audioAction;
  if (!action) return;
  if (action === "open") {
    toggleAudioPanel();
    return;
  }
  if (action === "toggle") {
    audio.setEnabled(!audio.getSettings().enabled);
    renderAudioControls();
    toggleAudioPanel();
  }
});

document.addEventListener("input", (event) => {
  if (!event.target.matches("[data-audio-volume]")) return;
  audio.setVolume(Number(event.target.value) / 100);
  const output = audioControls?.querySelector("output");
  if (output) output.textContent = `${event.target.value}%`;
});

document.addEventListener("change", async (event) => {
  if (event.target.matches("[data-audio-source]")) {
    await audio.setMusicSource(event.target.value);
    renderAudioControls();
    toggleAudioPanel();
    return;
  }
  if (event.target.matches("[data-audio-files]")) {
    const imported = await audio.replaceCustomTracks(event.target.files);
    if (!imported) return;
    renderAudioControls();
    toggleAudioPanel();
  }
});

app.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  const direction = event.target.closest("[data-move]")?.dataset.move;
  const avatar = event.target.closest("[data-avatar]")?.dataset.avatar;
  const cardId = event.target.closest("[data-card-id]")?.dataset.cardId;
  const defendLevel = event.target.closest("[data-defend-level]")?.dataset.defendLevel;
  const housePart = event.target.closest("[data-house-part]")?.dataset.housePart;
  if (direction) {
    if (getRun().currentScreen === "adventure") handleAdventureMove(direction);
    if (getRun().currentScreen === "catch" && (direction === "left" || direction === "right")) handleCatchMove(direction);
    return;
  }
  if (avatar) {
    window.clearTimeout(transitionTimer);
    resetAdventure();
    message = "";
    effectCell = null;
    characterAction = "idle";
    updateRun({ avatar });
    audio.startMusic();
    startRun();
    render();
    return;
  }
  if (cardId && getRun().currentScreen === "memory") {
    handleMemoryCard(cardId);
    return;
  }
  if (defendLevel && getRun().currentScreen === "defend-select") {
    selectDefendDifficulty(defendLevel);
    clearScoresFrom("defend");
    recordStageAttempt("defend");
    updateRun({ currentScreen: "defend", defendDifficulty: defendLevel });
    message = `${gameData.stages.defend.boss.difficulties[defendLevel].label} level: Wave 1 begins. Protect the farmhouse.`;
    render();
    return;
  }
  if (!action && getRun().currentScreen === "start" && event.target.closest(".home-scene")) {
    updateRun({ currentScreen: "build-home" });
    render();
    return;
  }
  if (!action) return;
  if (action === "build-house-part" && housePart) {
    const project = homeProjects.find((item) => item.part === housePart);
    if (!project) return;
    const result = buildHousePart(project.part, project.cost);
    if (result.built) {
      homeConstructionPart = project.part;
      updateRun({ currentScreen: "start" });
      message = `${project.label} complete! The home is growing.`;
      render();
      window.setTimeout(() => {
        if (getRun().currentScreen === "start") {
          homeConstructionPart = null;
          message = "";
          render();
        }
      }, 1800);
    }
    return;
  }
  if (action === "pause") { pauseGame(); return; }
  if (action === "resume-game") { resumeGame(); return; }
  if (action === "start-over-story") { startOverStory(); return; }
  if (action === "exit-to-home") { exitToHome(); return; }
  if (action === "start" || action === "new-game") {
    startOverStory();
    return;
  }
  if (action === "resume") { audio.startMusic(); resumeSavedRun(); }
  if (action === "view-result") { updateRun({ currentScreen: "result" }); }
  if (action === "retry-catch") {
    const retries = getRun().stageRetries.catch + 1;
    clearScoresFrom("catch");
    recordStageAttempt("catch");
    resetCatch();
    message = "Fresh orchard. Reach 200 field points.";
    updateRun({ currentScreen: "catch", stageRetries: { ...getRun().stageRetries, catch: retries } });
  }
  if (action === "return-to-catch") { startCatchRound(); message = "A new orchard round begins. Reach 200 field points."; }
  if (action === "retry-defend") { retryDefendWave(); message = getDefend().boss ? "The Raccoon King returns. Protect the farmhouse." : `Wave ${getDefend().wave.id}: keep the crows from the farmhouse.`; updateRun({ currentScreen: "defend" }); }
  if (action === "use-egg-bomb") {
    const bomb = useEggBomb();
    if (bomb.used) {
      audio.playSfx("eggBomb", { cooldown: 700 });
      message = "Egg Bomb cleared the field!";
      render();
      window.setTimeout(() => {
        bomb.events.forEach((event) => showDefendEffect(event));
        const board = app.querySelector("[data-defend-board]");
        board?.classList.add("is-bombed");
        window.setTimeout(() => board?.classList.remove("is-bombed"), 430);
      }, 0);
      return;
    }
  }
  if (action === "restart") { startOverStory(); return; }
  render();
});

app.addEventListener("pointerdown", (event) => {
  const adventureBoard = event.target.closest("[data-adventure-board]");
  if (!isPaused && adventureBoard && getRun().currentScreen === "adventure") {
    adventureTouchStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    adventureBoard.setPointerCapture?.(event.pointerId);
    return;
  }
  const catchBoard = event.target.closest("[data-catch-board]");
  if (!isPaused && catchBoard && getRun().currentScreen === "catch") {
    catchTouchStart = { x: event.clientX, pointerId: event.pointerId };
    catchBoard.setPointerCapture?.(event.pointerId);
    moveCatcherToPointer(event);
    return;
  }
  if (isPaused || !event.target.closest("[data-defend-board]") || getRun().currentScreen !== "defend") return;
  event.preventDefault();
  event.target.closest("[data-defend-board]").setPointerCapture?.(event.pointerId);
  moveDefenderToPointer(event);
});

app.addEventListener("pointerup", (event) => {
  if (isPaused) return;
  if (getRun().currentScreen === "catch" && catchTouchStart?.pointerId === event.pointerId) {
    catchTouchStart = null;
    return;
  }
  if (getRun().currentScreen !== "adventure" || !adventureTouchStart || event.pointerId !== adventureTouchStart.pointerId) return;
  const deltaX = event.clientX - adventureTouchStart.x;
  const deltaY = event.clientY - adventureTouchStart.y;
  const distance = Math.hypot(deltaX, deltaY);
  adventureTouchStart = null;
  if (distance >= 24) {
    adventureLastDirection = Math.abs(deltaX) > Math.abs(deltaY) ? (deltaX > 0 ? "right" : "left") : (deltaY > 0 ? "down" : "up");
    handleAdventureMove(adventureLastDirection);
    return;
  }
  const now = performance.now();
  if (now - adventureLastTap < 320) {
    adventureLastTap = 0;
    handleAdventureJump();
  } else adventureLastTap = now;
});

app.addEventListener("pointermove", (event) => {
  if (!isPaused && getRun().currentScreen === "catch" && catchTouchStart?.pointerId === event.pointerId) {
    event.preventDefault();
    moveCatcherToPointer(event);
    return;
  }
  if (isPaused || getRun().currentScreen !== "defend" || event.buttons === 0 && event.pointerType === "mouse") return;
  if (!event.target.closest("[data-defend-board]")) return;
  event.preventDefault();
  moveDefenderToPointer(event);
});

document.addEventListener("keydown", (event) => {
  if (isPaused) return;
  const keyToDirection = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
  const direction = keyToDirection[event.key];
  if (!direction || ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
  const screen = getRun().currentScreen;
  if (screen === "adventure" || (screen === "catch" && ["left", "right"].includes(direction))) {
    event.preventDefault();
    if (screen === "adventure") handleAdventureMove(direction);
    else handleCatchMove(direction);
  }
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

if (import.meta.env.PROD) setupInstallPrompt();

audio.loadCustomTracks().finally(renderAudioControls);
render();
