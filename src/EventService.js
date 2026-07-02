import { db } from "./firebase"; 
import { doc, getDoc } from "firebase/firestore";

export const ITEM_CONFIG = [
  { 
    name: "로켓", nameEn: "Rocket", 
    icon: "🚀", color: "#6366f1", label: "x2.0 / x4.0", 
    desc: "고득점 찬스", descEn: "High Score Chance" 
  },
  { 
    name: "사랑", nameEn: "Heart",
    icon: "❤️", color: "#f43f5e", label: "x2.0 / x4.0", 
    desc: "행운의 심볼", descEn: "Symbol of Luck" 
  },
  { 
    name: "요트", nameEn: "Yacht", 
    icon: "🚢", color: "#0ea5e9", label: "x2.0 / x4.0", 
    desc: "프리미엄 픽", descEn: "Premium Pick" 
  },
  { 
    name: "장미", nameEn: "Rose", 
    icon: "🌹", color: "#ef4444", label: "x2.0 / x4.0", 
    desc: "정열의 배당", descEn: "Passion Payout" 
  },
];

export const allItems = ITEM_CONFIG;

export const CONFIG = {
  ROUND_DURATION: 180, 
  BASE_ROUND: 1824231, 
  START_TIME: new Date("2024-01-01T00:00:00Z").getTime(), 
};

class AudioController {
  constructor() { this.ctx = null; }
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  play(type) {
    try {
      const ctx = this.init();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (type === "draw") {
        osc.type = "sine"; osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 3);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 3);
        osc.start(now); osc.stop(now + 3);
      } else if (type === "win") {
        osc.type = "triangle"; [523.25, 659.25, 783.99].forEach((f, i) => osc.frequency.setValueAtTime(f, now + i * 0.1));
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
      } else if (type === "lose") {
        osc.type = "sawtooth"; osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.4);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
      } else if (type === "impact") {
        // 💥 결과 공개 순간의 "붐!" 사운드 (저음 킥)
        osc.type = "square"; osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
        // 하이 핑 레이어
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2); gain2.connect(ctx.destination);
        osc2.type = "sine"; osc2.frequency.setValueAtTime(1800, now + 0.05);
        gain2.gain.setValueAtTime(0.12, now + 0.05); gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc2.start(now + 0.05); osc2.stop(now + 0.3);
      }
    } catch (e) {}
  }
}
export const soundManager = new AudioController();

export const EventService = {
  getCurrentRoundInfo: () => {
    const now = Date.now();
    const elapsed = now - CONFIG.START_TIME;
    const durationMs = CONFIG.ROUND_DURATION * 1000;
    const currentRound = CONFIG.BASE_ROUND + Math.floor(elapsed / durationMs);
    const remainingMs = durationMs - (elapsed % durationMs);
    let timeLeft = Math.floor(remainingMs / 1000);
    if (timeLeft >= CONFIG.ROUND_DURATION) timeLeft = 0;
    return { round: currentRound, timeLeft, isDrawingPhase: timeLeft <= 5 };
  },

  getFixedResult: async (round) => {
    try {
      // 로컬 조작 큐 먼저 확인 (관리자 연동 유지)
      const queue = JSON.parse(localStorage.getItem("event_manipulation_queue") || "{}");
      if (queue[round]) {
        return queue[round].map(name => ITEM_CONFIG.find(i => i.name === name)).filter(Boolean);
      }

      // Firestore: winner 필드 우선, 구버전 items 필드 fallback (관리자 연동 유지)
      const docRef = doc(db, "event_manipulation", String(round));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const targetNames = data.winner || data.items;
        if (!targetNames || targetNames.length === 0) return null;
        return targetNames.map(name => ITEM_CONFIG.find(i => i.name === name)).filter(Boolean);
      }
    } catch (e) { console.error("Result Fetch Error:", e); }
    return null;
  },

  generateResult: (round) => {
    const getLuckScore = (name) => {
      let hash = 0;
      const combined = round.toString() + name + "daisy-secret";
      for (let i = 0; i < combined.length; i++) {
        hash = (hash << 5) - hash + combined.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(Math.sin(hash * 0.123456 + round) * 10000) % 100;
    };
    const scoredItems = ITEM_CONFIG.map(item => ({
      ...item,
      luckScore: getLuckScore(item.name)
    }));
    const shuffled = scoredItems.sort((a, b) => b.luckScore - a.luckScore);
    return shuffled.slice(0, 2).map(({luckScore, ...rest}) => rest); 
  },

  // ✅ [수정] 최대 100회까지 백필 + Promise.all 병렬 조회 (기존: 30회 제한 + 순차 조회)
  getMissedHistory: async (lastRound, currentRound, maxCount = 100) => {
    const start = Math.max(lastRound + 1, currentRound - maxCount);
    const rounds = [];
    for (let r = start; r < currentRound; r++) rounds.push(r);
    if (rounds.length === 0) return [];

    const results = await Promise.all(
      rounds.map(async (r) => {
        const fixed = await EventService.getFixedResult(r);
        const winItems = fixed || EventService.generateResult(r);
        const timeAtRound = new Date(CONFIG.START_TIME + (r - CONFIG.BASE_ROUND) * CONFIG.ROUND_DURATION * 1000);
        return {
          round: r,
          winItems: winItems.map(i => `${i.icon} ${i.name}`),
          date: timeAtRound.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        };
      })
    );
    return results; // 오름차순 (과거 → 최신)
  },

  calculateStats: (history) => {
    const totalRounds = history.length;
    if (totalRounds === 0) return {};
    const counts = {};
    history.forEach(h => {
      h.winItems.forEach(itemStr => {
        const parts = itemStr.split(" ");
        const name = parts[1];
        if (name) counts[name] = (counts[name] || 0) + 1;
      });
    });
    const res = {};
    ITEM_CONFIG.forEach(item => {
      res[item.name] = Math.round(((counts[item.name] || 0) / (totalRounds || 1)) * 100);
    });
    return res;
  }
};