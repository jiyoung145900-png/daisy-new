import React, { useState } from "react";
import { iaStyles } from "./AdminStyles";
import { ITEM_CONFIG } from "./EventService";

// =========================================================================
// --- 3. 이벤트 조작 뷰 (✅ 완전히 수정됨) ---
// =========================================================================
export const EventControlView = ({ 
  currentInfo, 
  targetRound, 
  setTargetRound, 
  queue = {}, 
  deleteQueue, 
  handleApplyManipulation, 
  handleSecretRevisions, 
  gameHistory = [] 
}) => {
  const [selected, setSelected] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const isLocked = !currentInfo || currentInfo.timeLeft <= 5;
  const currentRound = currentInfo?.currentRound || 0;
  const isPastRound = targetRound && targetRound < currentRound;

  const handleSave = async () => {
    if (!targetRound) return alert("회차를 입력해주세요.");
    if (selected.length === 0) return alert("아이템을 선택해주세요.");

    setIsLoading(true);

    try {
      if (isPastRound) {
        if (!handleSecretRevisions) {
          alert("재정산 기능이 연결되지 않았습니다.");
          setIsLoading(false);
          return;
        }
        
        const pastGame = gameHistory.find(h => h.round === targetRound);
        const oldWinners = pastGame ? pastGame.winItems : [];

        if (window.confirm(`${targetRound}회차는 이미 종료된 과거입니다.\n선택하신 [${selected.join(", ")}] 결과로 유저들의 다이아를 즉시 회수/재지급 하시겠습니까?`)) {
          try {
            await handleSecretRevisions(targetRound, oldWinners, selected);
            alert(`✅ ${targetRound}회차 재정산이 완료되었습니다!`);
            setSelected([]);
          } catch (e) {
            alert("❌ 재정산 실패: " + e.message);
            console.error("재정산 오류:", e);
          }
        }
      } else {
        if (isLocked && targetRound === currentRound) {
          alert("❌ 현재 추첨 중이라 조작할 수 없습니다!");
          setIsLoading(false);
          return;
        }

        try {
          const result = await handleApplyManipulation(selected);
          
          if (result && result.success) {
            alert(`✅ ${targetRound}회차 결과 조작이 저장되었습니다!\n선택된 아이템: ${result.winners.join(", ")}`);
            setSelected([]);
          } else {
            alert("⚠️ 저장되었으나 응답이 명확하지 않습니다.");
          }
        } catch (error) {
          alert(`❌ 결과 조작 저장 실패: ${error.message}`);
          console.error("결과 조작 오류:", error);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>🎯 실시간 이벤트 제어</h1>
      <div style={{ ...iaStyles.monitorBox, border: isLocked ? "2px solid #ff3b30" : "1px solid #333", transition: 'all 0.3s' }}>
        <div>현재 진행중: <b style={{ color: '#fff' }}>{currentInfo?.currentRound || '대기중'}회차</b></div>
        <div>추첨까지: <b style={{ color: isLocked ? "#ff3b30" : "#00ff00", fontSize: '24px' }}>{currentInfo?.timeLeft || 0}초</b></div>
        {isLocked && <div style={{ color: '#ff3b30', fontWeight: 'bold', marginTop: '10px', fontSize: '14px' }}>⚠️ 추첨 진행 중 (결과 조작 Lock 상태)</div>}
      </div>

      <div style={{ marginTop: 30, opacity: (isLocked && !isPastRound && targetRound === currentRound) || isLoading ? 0.5 : 1, pointerEvents: (isLocked && !isPastRound && targetRound === currentRound) || isLoading ? 'none' : 'auto' }}>
        <input
          type="number"
          placeholder="조작/재정산 할 회차 입력..."
          value={targetRound || ""}
          onChange={(e) => setTargetRound(parseInt(e.target.value) || 0)}
          style={iaStyles.adminInput}
          disabled={isLoading}
        />
        <div style={iaStyles.adminItemGrid}>
          {ITEM_CONFIG.map(item => (
            <div
              key={item.name}
              onClick={() => {
                if (isLoading) return;
                const exists = selected.includes(item.name);
                setSelected(exists ? selected.filter(i => i !== item.name) : [...selected, item.name].slice(0, 2));
              }}
              style={{
                ...iaStyles.adminItemCard,
                border: selected.includes(item.name) ? `3px solid ${item.color}` : "3px solid #333",
                background: selected.includes(item.name) ? `${item.color}33` : "#1a1a1a",
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1
              }}
            >
              <span style={{ fontSize: 28 }}>{item.icon}</span><br /><b>{item.name}</b>
            </div>
          ))}
        </div>
        
        <button
          onClick={handleSave}
          disabled={isLoading || (isLocked && !isPastRound && targetRound === currentRound)}
          style={{ 
            ...iaStyles.applyBtn, 
            background: isLoading 
              ? "#999" 
              : isPastRound 
                ? "#ef4444" 
                : (isLocked && targetRound === currentRound) 
                  ? "#444" 
                  : "#ffb347", 
            color: isLoading || (isLocked && !isPastRound && targetRound === currentRound) ? "#888" : "#000", 
            cursor: isLoading || (isLocked && !isPastRound && targetRound === currentRound) ? 'not-allowed' : 'pointer' 
          }}
        >
          {isLoading 
            ? "⏳ 처리 중..." 
            : isPastRound 
              ? `🚨 ${targetRound}회차 과거 결과 재정산 (다이아 조절)` 
              : (isLocked && targetRound === currentRound) 
                ? "🔒 조작 불가 대기중" 
                : "✅ 미래 결과 조작 예약"}
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3 style={{ color: "#ffb347", marginBottom: 10 }}>📋 예약된 결과 목록</h3>
        {Object.entries(queue).length === 0 ? (
          <div style={{ color: "#555", textAlign: "center", padding: "20px" }}>예약된 회차가 없습니다.</div>
        ) : (
          Object.entries(queue)
            .sort((a, b) => Number(b[0]) - Number(a[0])) // 최신 회차(숫자가 큰 순서)가 위로 오게 정렬
            .slice(0, 5) // 상위 5개만 자르기
            .map(([k, v]) => (
            <div key={k} style={{ ...iaStyles.queueRow, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <b style={{ color: "#ffb347" }}>{k}회 예약</b>
                <span style={{ marginLeft: 10, color: "#aaa" }}>: {Array.isArray(v) ? v.join(", ") : String(v)}</span>
              </div>
              <button 
                onClick={() => {
                  if (window.confirm(`${k}회차 예약을 삭제하시겠습니까?`)) {
                    deleteQueue?.(k);
                  }
                }} 
                style={{ ...iaStyles.delBtn, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1 }}
                disabled={isLoading}
              >
                🗑️ 삭제
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};