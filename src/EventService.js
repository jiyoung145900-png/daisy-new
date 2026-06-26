import { db } from "./firebase"; 
import { doc, getDoc } from "firebase/firestore";

<<<<<<< HEAD
=======
// --- [설정 및 상수 수정: 영문 데이터(nameEn, descEn) 추가] ---
// ★ 핵심: name은 DB 호환을 위해 한글 유지, UI 표시용 nameEn 추가
>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
export const ITEM_CONFIG = [
  { 
    name: "로켓", nameEn: "Rocket", 
    icon: "🚀", color: "#6366f1", label: "x2.0 / x4.0", 
    desc: "고득점 찬스", descEn: "High Score Chance" 
  },
  { 
<<<<<<< HEAD
    name: "사랑", nameEn: "Heart",
=======
    name: "사랑", nameEn: "Heart", // 아이콘에 맞춰 Heart로 번역
>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
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

<<<<<<< HEAD
export const allItems = ITEM_CONFIG;

export const CONFIG = {
  ROUND_DURATION: 180, 
=======
// UI에서 'allItems'로 import 하는 경우를 위해 별칭 export 추가
export const allItems = ITEM_CONFIG;

export const CONFIG = {
  ROUND_DURATION: 65, 
>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
  BASE_ROUND: 1824231, 
  START_TIME: new Date("2024-01-01T00:00:00Z").getTime(), 
};

<<<<<<< HEAD
=======
// --- [사운드 매니저: 100% 원본 유지] ---
>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
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

<<<<<<< HEAD
=======
// --- [서비스 로직: 원본 유지 (DB 호환성 보장)] ---
>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
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
<<<<<<< HEAD
        return queue[round].map(name => ITEM_CONFIG.find(i => i.name === name)).filter(Boolean);
      }
=======
        // DB에는 한글 이름이 저장되어 있으므로 name으로 찾습니다.
        return queue[round].map(name => ITEM_CONFIG.find(i => i.name === name)).filter(Boolean);
      }
      
>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
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
<<<<<<< HEAD
=======
      // ★ 중요: 결과 해시 생성 시 '한글 이름'을 그대로 사용해야 과거 회차 결과가 안 바뀝니다.
>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
      const combined = round.toString() + name + "daisy-secret";
      for (let i = 0; i < combined.length; i++) {
        hash = (hash << 5) - hash + combined.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(Math.sin(hash * 0.123456 + round) * 10000) % 100;
    };
<<<<<<< HEAD
=======

>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
    const scoredItems = ITEM_CONFIG.map(item => ({
      ...item,
      luckScore: getLuckScore(item.name)
    }));
<<<<<<< HEAD
=======

>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
    const shuffled = scoredItems.sort((a, b) => b.luckScore - a.luckScore);
    return shuffled.slice(0, 2).map(({luckScore, ...rest}) => rest); 
  },

  getMissedHistory: async (lastRound, currentRound) => {
    const missed = [];
    const start = Math.max(lastRound + 1, currentRound - 30); 
<<<<<<< HEAD
=======
    
>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
    for (let r = start; r < currentRound; r++) {
      const fixed = await EventService.getFixedResult(r); 
      const winItems = fixed || EventService.generateResult(r);
      const timeAtRound = new Date(CONFIG.START_TIME + (r - CONFIG.BASE_ROUND) * CONFIG.ROUND_DURATION * 1000);
<<<<<<< HEAD
      missed.push({
        round: r,
=======
      
      missed.push({
        round: r,
        // ★ 중요: 히스토리 포맷도 "🚀 로켓" (한글) 유지. 변환은 UI에서 담당.
>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
        winItems: winItems.map(i => `${i.icon} ${i.name}`), 
        date: timeAtRound.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      });
    }
    return missed;
  },

<<<<<<< HEAD
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
=======
  calculateStats: (history) => {
    const totalWins = history.length * 2;
    if (totalWins === 0) return {};
    const counts = {};
    history.forEach(h => {
      h.winItems.forEach(itemStr => {
        // 기존 포맷 "🚀 로켓"에서 한글 이름 추출
        const name = itemStr.split(" ")[1]; 
        if(name) counts[name] = (counts[name] || 0) + 1;
>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
      });
    });
    const res = {};
    ITEM_CONFIG.forEach(item => {
<<<<<<< HEAD
      res[item.name] = Math.round(((counts[item.name] || 0) / (totalRounds || 1)) * 100);
=======
      // 통계 키값도 한글 name 기준 (UI에서 매핑해서 사용)
      res[item.name] = Math.round(((counts[item.name] || 0) / (totalWins || 1)) * 100);
>>>>>>> 1f5b9257c9059ed70f6052d32871d9264cfe2b9a
    });
    return res;
  }
};