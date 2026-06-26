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
      const queue = JSON.parse(localStorage.getItem("event_manipulation_queue") || "{}");
      if (queue[round]) {
        return queue[round].map(name => ITEM_CONFIG.find(i => i.name === name)).filter(Boolean);
      }
      const docRef = doc(db, "event_manipulation", String(round));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const targetNames = docSnap.data().items;
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

  getMissedHistory: async (lastRound, currentRound) => {
    const missed = [];
    const start = Math.max(lastRound + 1, currentRound - 30); 
    for (let r = start; r < currentRound; r++) {
      const fixed = await EventService.getFixedResult(r); 
      const winItems = fixed || EventService.generateResult(r);
      const timeAtRound = new Date(CONFIG.START_TIME + (r - CONFIG.BASE_ROUND) * CONFIG.ROUND_DURATION * 1000);
      missed.push({
        round: r,
        winItems: winItems.map(i => `${i.icon} ${i.name}`), 
        date: timeAtRound.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      });
    }
    return missed;
  },

  // ✅ 수정: totalWins 계산 버그 수정 (history.length * 2 → 실제 카운트 기반)
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