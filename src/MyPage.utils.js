// 아바타 스타일 종류
export const avatarStyles = [
  "adventurer", "avataaars", "big-ears", "bottts", "fun-emoji", 
  "lorelei", "micah", "miniavs", "notionists", "open-peeps"
];

// 아바타 URL 생성 함수
export const getAvatarUrl = (idx, userId) => {
  // 안전장치: idx가 범위 밖이면 0으로 처리
  const safeIdx = (idx >= 0 && idx < avatarStyles.length) ? idx : 0;
  return `https://api.dicebear.com/7.x/${avatarStyles[safeIdx]}/svg?seed=${userId}_${safeIdx}&backgroundColor=2a2a2e`;
};

// ★ [수정] 등급 시스템: 다이아 보유량 기반 자동계산 제거.
// 관리자가 회원 관리 화면에서 직접 지정한 값(user.tier)을 그대로 사용.
// 지정된 값이 없으면 기본값 SILVER로 표시.
export const TIER_OPTIONS = ["SILVER", "GOLD", "PLATINUM", "DIAMOND"];

const TIER_META = {
  SILVER: { name: "SILVER", color: "#C0C0C0" },
  GOLD: { name: "GOLD", color: "#D4AF37" },
  PLATINUM: { name: "PLATINUM", color: "#e5e4e2" },
  DIAMOND: { name: "DIAMOND", color: "#b9f2ff" },
};

export const getTierInfo = (tierKey) => {
  const key = (tierKey || "SILVER").toUpperCase();
  return TIER_META[key] || TIER_META.SILVER;
};