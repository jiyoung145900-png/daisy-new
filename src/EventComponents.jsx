import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ============================================================
   EventBanner - 이벤트 메인 배너 (대기 / 추첨 / 결과공개 3단계 연출)
   - 대기(LIVE): 골드 글로우 펄스 + 시머 스윕 + 떠다니는 스파클
   - 추첨(DRAWING): 다크 모드 전환 + 흔들림 + 레이더 + 아이콘 셔플
   - 결과공개(impactTick 변경): 화이트 플래시 + 충격파 링 + 아이콘 팝
   ============================================================ */

const SPARKLES = [
  { icon: "✨", left: "8%",  delay: 0,   dur: 3.2, size: 18 },
  { icon: "💎", left: "20%", delay: 1.1, dur: 4.0, size: 14 },
  { icon: "⭐", left: "34%", delay: 0.5, dur: 3.6, size: 16 },
  { icon: "✨", left: "52%", delay: 1.8, dur: 3.0, size: 12 },
  { icon: "💎", left: "68%", delay: 0.2, dur: 4.4, size: 16 },
  { icon: "⭐", left: "80%", delay: 1.4, dur: 3.4, size: 13 },
  { icon: "✨", left: "92%", delay: 0.8, dur: 3.8, size: 17 },
];

export const EventBanner = ({
  round,
  timeLeft,
  isDrawing,
  drawingItems,
  lastResultItems, // 이미 로컬라이즈된 문자열 배열
  isKo = true,
  joined = false,
  impactTick = 0,
}) => {
  const isUrgent = !isDrawing && timeLeft <= 10 && timeLeft > 0;

  // 임팩트 플래시 상태 (impactTick이 바뀔 때마다 1회 재생)
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (impactTick > 0) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [impactTick]);

  return (
    <motion.div
      style={{
        ...bs.banner,
        background: isDrawing
          ? "linear-gradient(135deg, #1a1a1a 0%, #000 100%)"
          : "linear-gradient(135deg, #ffdeeb 0%, #fbc2eb 100%)",
        border: isDrawing ? "1px solid #333" : "1px solid #ffb6c1",
      }}
      animate={
        isDrawing
          ? { x: [-1.5, 1.5, -1.5, 1.5, 0], transition: { repeat: Infinity, duration: 0.12 } }
          : {
              boxShadow: [
                "0 0 0px rgba(255,179,71,0)",
                "0 0 30px rgba(255,179,71,0.45)",
                "0 0 0px rgba(255,179,71,0)",
              ],
              transition: { repeat: Infinity, duration: 2.4, ease: "easeInOut" },
            }
      }
    >
      {/* ── 대기 중: 시머 스윕 (빛줄기가 좌→우로 훑고 지나감) ── */}
      {!isDrawing && (
        <motion.div
          style={bs.shimmer}
          animate={{ x: ["-150%", "350%"] }}
          transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut", repeatDelay: 0.8 }}
        />
      )}

      {/* ── 대기 중: 떠다니는 스파클 ── */}
      {!isDrawing &&
        SPARKLES.map((s, i) => (
          <motion.div
            key={`sp-${i}`}
            style={{ ...bs.sparkle, left: s.left, fontSize: s.size }}
            animate={{ y: [10, -60], opacity: [0, 1, 0], rotate: [0, 180] }}
            transition={{ repeat: Infinity, duration: s.dur, delay: s.delay, ease: "easeOut" }}
          >
            {s.icon}
          </motion.div>
        ))}

      {/* ── 추첨 중: 레이더 링 ── */}
      <div style={bs.radarContainer}>
        {isDrawing &&
          [0, 1, 2].map((i) => (
            <motion.div
              key={`radar-${i}`}
              style={bs.radarCircle}
              initial={{ width: 0, height: 0, opacity: 0.8 }}
              animate={{ width: 600, height: 600, opacity: 0 }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: "easeOut" }}
            />
          ))}
      </div>

      {/* ── 추첨 중: 별/하트 플라이바이 ── */}
      <AnimatePresence>
        {isDrawing && (
          <>
            <motion.div
              style={{ ...bs.flyBy, left: "-10%" }}
              initial={{ x: 0, opacity: 0 }}
              animate={{ x: 300, opacity: [0, 1, 0], scale: [0.5, 1.2, 0.8] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "circIn" }}
            >
              ⭐
            </motion.div>
            <motion.div
              style={{ ...bs.flyBy, right: "-10%" }}
              initial={{ x: 0, opacity: 0 }}
              animate={{ x: -300, opacity: [0, 1, 0], scale: [0.5, 1.2, 0.8] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "circIn", delay: 1.25 }}
            >
              ❤️
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 결과 공개: 화이트 플래시 + 충격파 링 ── */}
      <AnimatePresence>
        {flash && (
          <>
            <motion.div
              key={`flash-${impactTick}`}
              style={bs.flashOverlay}
              initial={{ opacity: 0.95 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
            <motion.div
              key={`wave-${impactTick}`}
              style={bs.shockwave}
              initial={{ width: 20, height: 20, opacity: 1, borderWidth: 6 }}
              animate={{ width: 500, height: 500, opacity: 0, borderWidth: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── 본문 ── */}
      <div style={bs.content}>
        <div style={bs.topRow}>
          <motion.div
            style={{ ...bs.liveBadge, background: isDrawing ? "#ffb347" : "#ff3b30" }}
            animate={isDrawing ? {} : { opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            {isDrawing ? "DRAWING" : "LIVE"}
          </motion.div>
          <span style={{ ...bs.roundInfo, color: isDrawing ? "#999" : "#555" }}>
            {isKo ? `제 ${round}회차` : `Round ${round}`} {joined ? (isKo ? "(참여완료)" : "(Joined)") : ""}
          </span>
        </div>

        <div>
          {isDrawing ? (
            <div style={bs.drawRow}>
              {drawingItems.map((icon, idx) => {
                const isImagePath = typeof icon === "string" && (icon.startsWith("/") || icon.startsWith("http"));
                return (
                  <motion.div
                    key={`${impactTick}-${idx}-${icon}`}
                    initial={{ scale: 0.4, opacity: 0, filter: "blur(4px)" }}
                    animate={{
                      scale: [0.4, 1.35, 1.1],
                      opacity: 1,
                      filter: "blur(0px)",
                      textShadow: "0 0 30px rgba(255,215,0,0.9)",
                    }}
                    transition={{ duration: 0.35, ease: "backOut" }}
                    style={bs.drawIcon}
                  >
                    {isImagePath ? (
                      <img src={icon} alt="drawing" style={{ width: 60, height: 60, objectFit: 'contain' }} />
                    ) : (
                      icon
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.h2
              style={{ ...bs.timeNum, color: isUrgent ? "#e11d48" : "#333" }}
              animate={isUrgent ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={isUrgent ? { repeat: Infinity, duration: 1 } : {}}
            >
              {`${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}`}
            </motion.h2>
          )}
        </div>

        <div style={{ ...bs.lastBar, background: isDrawing ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.6)" }}>
          <span style={{ ...bs.lastLabel, color: isDrawing ? "#ccc" : "#333" }}>
            {round - 1}
            {isKo ? "회차 결과:" : " Result:"}
          </span>
          <div style={{ display: "flex", gap: "5px" }}>
            {lastResultItems && lastResultItems.length > 0
              ? lastResultItems.map((item, idx) => {
                  // item이 "/icons/xxx.png 이름" 형태면 파싱
                  const parts = typeof item === "string" ? item.split(" ") : [];
                  const iconPart = parts[0] || "";
                  const namePart = parts.slice(1).join(" ") || item;
                  const isImagePath = iconPart.startsWith("/") || iconPart.startsWith("http");
                  
                  return (
                    <span key={idx} style={{ ...bs.resTag, color: isDrawing ? "#ffd700" : "#000", display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      {isImagePath && (
                        <img src={iconPart} alt={namePart} style={{ width: 16, height: 16, objectFit: 'contain', verticalAlign: 'middle' }} />
                      )}
                      <span>{isImagePath ? namePart : item}</span>
                    </span>
                  );
                })
              : (isKo ? "대기중" : "Waiting")}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const bs = {
  banner: {
    borderRadius: "28px",
    padding: "25px",
    textAlign: "center",
    position: "relative",
    overflow: "hidden",
    height: "190px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.4s ease, border 0.4s ease",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "40%",
    background: "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
    transform: "skewX(-20deg)",
    pointerEvents: "none",
    zIndex: 3,
  },
  sparkle: {
    position: "absolute",
    bottom: "10%",
    pointerEvents: "none",
    zIndex: 2,
    filter: "drop-shadow(0 0 6px rgba(255,255,255,0.9))",
  },
  radarContainer: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  radarCircle: {
    position: "absolute",
    borderRadius: "50%",
    border: "8px solid rgba(255, 255, 255, 0.6)",
  },
  flyBy: {
    position: "absolute",
    fontSize: "80px",
    zIndex: 5,
    pointerEvents: "none",
  },
  flashOverlay: {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(circle, #fff 0%, rgba(255,215,0,0.8) 40%, transparent 75%)",
    zIndex: 8,
    pointerEvents: "none",
  },
  shockwave: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    borderStyle: "solid",
    borderColor: "rgba(255,215,0,0.9)",
    zIndex: 9,
    pointerEvents: "none",
  },
  content: { position: "relative", zIndex: 10, width: "100%" },
  topRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
  liveBadge: { color: "#fff", fontSize: "10px", fontWeight: "900", padding: "2px 8px", borderRadius: "4px" },
  roundInfo: { fontSize: "12px", fontWeight: "700" },
  drawRow: { display: "flex", gap: "20px", justifyContent: "center", margin: "15px 0" },
  drawIcon: { fontSize: "50px" },
  timeNum: { fontSize: "52px", fontWeight: "900", margin: "5px 0", letterSpacing: "-1px" },
  lastBar: {
    padding: "8px 15px",
    borderRadius: "12px",
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px",
  },
  lastLabel: { fontSize: "11px", fontWeight: "600" },
  resTag: { fontSize: "12px", fontWeight: "800" },
};

/* ============================================================
   ImpactBurst - 결과 공개 순간 화면 전체 폭발 파티클
   impactTick이 바뀔 때마다 1회 재생 (EventSection에서 사용)
   ============================================================ */

const BURST_PARTICLES = ["💥", "✨", "⭐", "💎", "🎉", "✨", "⭐", "💥", "🎉", "💎", "✨", "⭐"];

export const ImpactBurst = ({ impactTick }) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (impactTick > 0) {
      setActive(true);
      const t = setTimeout(() => setActive(false), 1200);
      return () => clearTimeout(t);
    }
  }, [impactTick]);

  return (
    <AnimatePresence>
      {active && (
        <div key={`burst-${impactTick}`} style={ib.overlay}>
          {/* 전체 화면 플래시 */}
          <motion.div
            style={ib.flash}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          {/* 방사형 파티클 */}
          {BURST_PARTICLES.map((p, i) => {
            const angle = (i / BURST_PARTICLES.length) * Math.PI * 2;
            const dist = 130 + (i % 3) * 60;
            return (
              <motion.div
                key={i}
                style={ib.particle}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist,
                  scale: [0, 1.4, 0.6],
                  opacity: [1, 1, 0],
                  rotate: (i % 2 === 0 ? 1 : -1) * 200,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
              >
                {p}
              </motion.div>
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
};

const ib = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 900, // 결과 모달(1000)보다 아래
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  flash: {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,215,0,0.4) 45%, transparent 80%)",
  },
  particle: {
    position: "absolute",
    fontSize: "34px",
    filter: "drop-shadow(0 0 10px rgba(255,215,0,0.8))",
  },
};