const SETTINGS_KEY = "wander-farm-audio-v1";
const MUSIC_SOURCE = "/music/wander.ogg";
const MUSIC_DB = "wander-farm-playlist-v1";
const MUSIC_STORE = "tracks";
const MAX_CUSTOM_TRACKS = 5;

const sfx = (name) => `/music/sfx/${name.replaceAll(" ", "%20")}`;
const SFX_LIBRARY = {
  footstep: [sfx("footstep_grass_000 (1).ogg"), sfx("footstep_grass_001 (1).ogg"), sfx("footstep_grass_002 (1).ogg"), sfx("footstep_grass_003 (1).ogg"), sfx("footstep_grass_004 (1).ogg")],
  crowDefeat: [sfx("impactSoft_medium_000 (1).ogg"), sfx("impactSoft_medium_002 (1).ogg")],
  foxHit: [sfx("impactWood_medium_001 (1).ogg"), sfx("impactWood_medium_003 (1).ogg")],
  foxDefeat: [sfx("impactWood_heavy_000 (1).ogg"), sfx("impactWood_heavy_002 (1).ogg")],
  locustHit: [sfx("impactSoft_medium_003 (1).ogg")],
  locustDefeat: [sfx("impactSoft_medium_004 (1).ogg")],
  farmhouseHit: [sfx("impactPlank_medium_001 (1).ogg"), sfx("impactPlank_medium_003 (1).ogg")],
  bossHit: [sfx("impactWood_heavy_003 (1).ogg"), sfx("impactWood_heavy_004 (1).ogg")],
  bossDefeat: [sfx("impactWood_heavy_001 (1).ogg")],
  eggBomb: [sfx("impactSoft_heavy_001 (1).ogg"), sfx("impactSoft_heavy_003 (1).ogg")],
  powerup: [sfx("impactBell_heavy_002 (1).ogg")],
  bossPhaseTwo: [sfx("impactBell_heavy_001 (1).ogg")]
};

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return {
      enabled: saved?.enabled !== false,
      volume: Number.isFinite(saved?.volume) ? Math.max(0, Math.min(1, saved.volume)) : 1,
      musicSource: saved?.musicSource === "custom" ? "custom" : "default"
    };
  } catch {
    return { enabled: true, volume: 1, musicSource: "default" };
  }
}

function openMusicDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MUSIC_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(MUSIC_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredTracks() {
  const database = await openMusicDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(MUSIC_STORE, "readonly").objectStore(MUSIC_STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.id - b.id));
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
}

async function storeTracks(tracks) {
  const database = await openMusicDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MUSIC_STORE, "readwrite");
    const store = transaction.objectStore(MUSIC_STORE);
    store.clear();
    tracks.forEach((track, index) => store.put({ id: index, name: track.name, blob: track }));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => database.close());
}

class AudioManager {
  constructor() {
    this.settings = readSettings();
    this.music = null;
    this.customTracks = [];
    this.trackIndex = 0;
    this.unlocked = false;
    this.wantsMusic = false;
    this.lastPlayed = new Map();
  }

  persist() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // Browser storage is optional; audio still works for this visit.
    }
  }

  getSettings() {
    return { ...this.settings, customTrackCount: this.customTracks.length };
  }

  async loadCustomTracks() {
    try {
      const tracks = await readStoredTracks();
      this.setCustomTracks(tracks.map((track) => ({ name: track.name, url: URL.createObjectURL(track.blob) })));
    } catch {
      this.customTracks = [];
    }
    if (this.settings.musicSource === "custom" && !this.customTracks.length) {
      this.settings.musicSource = "default";
      this.persist();
    }
  }

  setCustomTracks(tracks) {
    this.customTracks.forEach((track) => URL.revokeObjectURL(track.url));
    this.customTracks = tracks;
    this.trackIndex = 0;
  }

  async replaceCustomTracks(files) {
    const tracks = Array.from(files).filter((file) => file.type.startsWith("audio/")).slice(0, MAX_CUSTOM_TRACKS);
    if (!tracks.length) return 0;
    await storeTracks(tracks);
    this.setCustomTracks(tracks.map((track) => ({ name: track.name, url: URL.createObjectURL(track) })));
    this.settings.musicSource = "custom";
    this.persist();
    if (this.wantsMusic) await this.startMusic(true);
    return tracks.length;
  }

  ensureMusic() {
    if (this.music) return this.music;
    this.music = new Audio();
    this.music.preload = "metadata";
    this.music.addEventListener("ended", () => {
      if (this.settings.musicSource !== "custom" || !this.customTracks.length) return;
      this.trackIndex = (this.trackIndex + 1) % this.customTracks.length;
      this.startMusic(true);
    });
    this.syncMusicVolume();
    return this.music;
  }

  syncMusicVolume(multiplier = 1) {
    if (this.music) this.music.volume = this.settings.enabled ? this.settings.volume * 0.45 * multiplier : 0;
  }

  async startMusic(forceTrack = false) {
    this.wantsMusic = true;
    if (!this.settings.enabled) return;
    const music = this.ensureMusic();
    this.unlocked = true;
    const customTrack = this.settings.musicSource === "custom" ? this.customTracks[this.trackIndex] : null;
    const source = customTrack?.url || MUSIC_SOURCE;
    if (music.src !== new URL(source, window.location.href).href || forceTrack) {
      music.pause();
      music.src = source;
      music.currentTime = 0;
    }
    music.loop = !customTrack;
    this.syncMusicVolume();
    try {
      await music.play();
    } catch {
      // A later player gesture retries playback on browsers with strict audio rules.
    }
  }

  pauseMusic() {
    this.music?.pause();
  }

  resumeMusic() {
    if (this.wantsMusic) this.startMusic();
  }

  softenMusic() {
    this.syncMusicVolume(0.35);
  }

  setEnabled(enabled) {
    this.settings.enabled = Boolean(enabled);
    this.persist();
    if (!this.settings.enabled) this.pauseMusic();
    else this.resumeMusic();
  }

  async setMusicSource(source) {
    this.settings.musicSource = source === "custom" && this.customTracks.length ? "custom" : "default";
    this.trackIndex = 0;
    this.persist();
    if (this.wantsMusic) await this.startMusic(true);
  }

  setVolume(volume) {
    this.settings.volume = Math.max(0, Math.min(1, Number(volume)));
    this.persist();
    this.syncMusicVolume();
  }

  playSfx(name, { cooldown = 90 } = {}) {
    const sources = SFX_LIBRARY[name];
    if (!this.settings.enabled || !this.unlocked || !sources?.length) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) || 0) < cooldown) return;
    this.lastPlayed.set(name, now);
    const sound = new Audio(sources[Math.floor(Math.random() * sources.length)]);
    sound.volume = this.settings.volume * 0.5;
    sound.play().catch(() => {});
  }
}

export const audio = new AudioManager();
