import { gameData } from "../content/gameData.js";

let cards;
let firstId;
let locked;
let moves;
let pairCount;
let elapsed;
let penaltyCount;

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export function resetMemory() {
  const { cards: possibleCards, pairRange } = gameData.stages.memory;
  pairCount = pairRange.min + Math.floor(Math.random() * (pairRange.max - pairRange.min + 1));
  const selectedPairs = shuffle([...possibleCards]).slice(0, pairCount);
  cards = shuffle(selectedPairs.flatMap((card) => [0, 1].map((copy) => ({
    ...card,
    id: `${card.key}-${copy}`,
    flipped: false,
    matched: false
  }))));
  firstId = null;
  locked = false;
  moves = 0;
  elapsed = 0;
  penaltyCount = 0;
}

resetMemory();

export function getMemory() {
  return {
    cards,
    moves,
    locked,
    pairCount,
    matchedPairs: cards.filter((card) => card.matched).length / 2,
    elapsed,
    penaltyCount,
    timeRemaining: Math.max(0, gameData.stages.memory.duration - elapsed)
  };
}

export function updateMemoryTimer(delta) {
  elapsed = Math.min(gameData.stages.memory.duration, elapsed + delta);
  return { elapsed, timedOut: elapsed >= gameData.stages.memory.duration };
}

export function flipMemoryCard(id) {
  const card = cards.find((item) => item.id === id);
  if (!card || card.flipped || card.matched || locked) return { type: "ignored" };
  card.flipped = true;
  if (!firstId) {
    firstId = id;
    return { type: "first" };
  }

  const first = cards.find((item) => item.id === firstId);
  moves += 1;
  firstId = null;
  if (first.key === card.key) {
    first.matched = true;
    card.matched = true;
    return { type: "match", complete: cards.every((item) => item.matched), key: card.key };
  }
  locked = true;
  return { type: "mismatch" };
}

export function resetOpenPair() {
  for (const card of cards) if (!card.matched) card.flipped = false;
  locked = false;
}
