import React, { useState, useEffect } from "react";
import { iaStyles } from "./AdminStyles";
import { ITEM_CONFIG } from "./EventService";
import { db } from "./firebase"; 
import { doc, updateDoc, collection, query, where, orderBy, getDocs, deleteDoc } from "firebase/firestore"; 

// =========================================================================
// --- 실시간 배팅 모니터링 + 이벤트 결과 제어 (통합 뷰) ---
// -------------------------------------------------------------------------
// 기존 배치:
//   - 상단: 배팅 현황판 (아이템별 총액)
//   - 하단: 전체 배팅 로그
// 변경 후:
//   - 상단: 🎯 이벤트 결과 제어 (기존 EventControlView 통째로 이식)
//   - 하단: 전체 배팅 로그 (기존 유지, 아이템별 총액은 로그에서 다 볼 수 있어 제거)
// =========================================================================
export const SponsorshipsView = ({
  sponsorships = [],
  currentInfo,
  // ★ [신규] EventControlView 기능용 props
  targetRound,
  setTargetRound,
  queue = {},
  deleteQueue,
  handleApplyManipulation,
  handleSecretRevisions,
  gameHistory = [],
}) => {
  const currentRound = currentInfo?.currentRound || currentInfo?.round;
  const currentBets = sponsorships.filter(s => s.round === currentRound);

  // ─────────────── 배팅 로그 편집 상태 (기존 유지) ───────────────
  const [editingId, setEditingId] = useState(null); 
  const [editItems, setEditItems] = useState([]);
  const [editAmount, setEditAmount] = useState(0);   
  const [isSaving, setIsSaving] = useState(false);   

  // ─────────────── 이벤트 결과 제어 상태 (EventControlView에서 이식) ───────────────
  const [selectedItems, setSelectedItems] = useState([]);
  const [isControlLoading, setIsControlLoading] = useState(false);

  const isLocked = !currentInfo || currentInfo.timeLeft <= 5;
  const isPastRound = targetRound && targetRound < currentRound;

  // ─────────────── 50개 초과 데이터 자동 삭제 (기존 유지) ───────────────
  useEffect(() => {
    if (!currentRound || currentBets.length <= 50) return;

    const autoCleanOldBets = async () => {
      try {
        const betsRef = collection(db, "event_bets");
        const q = query(
          betsRef, 
          where("round", "==", currentRound),
          orderBy("timestamp", "asc")
        );
        const querySnapshot = await getDocs(q);
        
        const excessCount = querySnapshot.size - 50;
        if (excessCount > 0) {
          for (let i = 0; i < excessCount; i++) {
            const docToDel = querySnapshot.docs[i];
            await deleteDoc(doc(db, "event_bets", docToDel.id));
          }
        }
      } catch (error) {
        console.error("데이터 최적화 삭제 실패:", error);
      }
    };

    autoCleanOldBets();
  }, [currentBets.length, currentRound]);

  // ─────────────── 한국시간(KST) 포맷 (기존 유지) ───────────────
  const formatKoreanTime = (bet) => {
    let timestamp = bet.timestamp || bet.createdAt || bet.betAt || bet.time;
    if (!timestamp) return "-";
    
    let date;
    try {
      if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else if (timestamp?.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        date = new Date();
      }
      return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    } catch (e) {
      return "-";
    }
  };

  // ─────────────── 배팅 로그 편집 (기존 유지) ───────────────
  const startEdit = (bet) => {
    setEditingId(bet.id);
    setEditItems(bet.items || []);
    setEditAmount(bet.betAmount || 0);
  };

  const handleItemCheck = (key) => {
    if (editItems.includes(key)) {
      setEditItems(editItems.filter(c => c !== key));
    } else {
      if (editItems.length >= 2) {
        alert("베팅 항목은 최대 2개까지만 선택할 수 있습니다.");
        return;
      }
      setEditItems([...editItems, key]);
    }
  };

  const saveEdit = async (betId) => {
    if (editItems.length === 0) {
      alert("최소 1개 이상의 배팅 항목을 선택해주세요.");
      return;
    }
    if (editAmount <= 0) {
      alert("올바른 배팅 금액을 입력해주세요.");
      return;
    }

    try {
      setIsSaving(true);
      const betRef = doc(db, "event_bets", betId);
      await updateDoc(betRef, {
        items: editItems, 
        betAmount: Number(editAmount),
        amount: Number(editAmount)
      });
      setEditingId(null); 
    } catch (error) {
      console.error("베팅 수정 실패:", error);
      alert("수정 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─────────────── ★ 이벤트 결과 제어 로직 (기존 EventControlView에서 이식) ───────────────
  const handleControlSave = async () => {
    if (!targetRound) return alert("회차를 입력해주세요.");
    if (selectedItems.length === 0) return alert("아이템을 선택해주세요.");

    setIsControlLoading(true);

    try {
      if (isPastRound) {
        if (!handleSecretRevisions) {
          alert("재정산 기능이 연결되지 않았습니다.");
          return;
        }
        const pastGame = gameHistory.find(h => h.round === targetRound);
        const oldWinners = pastGame ? pastGame.winItems : [];

        if (window.confirm(`${targetRound}회차는 이미 종료된 과거입니다.\n선택하신 [${selectedItems.join(", ")}] 결과로 유저들의 다이아를 즉시 회수/재지급 하시겠습니까?`)) {
          try {
            await handleSecretRevisions(targetRound, oldWinners, selectedItems);
            alert(`✅ ${targetRound}회차 재정산이 완료되었습니다!`);
            setSelectedItems([]);
          } catch (e) {
            alert("❌ 재정산 실패: " + e.message);
          }
        }
      } else {
        if (isLocked && targetRound === currentRound) {
          alert("❌ 현재 추첨 중이라 조작할 수 없습니다!");
          return;
        }
        try {
          const result = await handleApplyManipulation(selectedItems);
          if (result && result.success) {
            alert(`✅ ${targetRound}회차 결과 조작이 저장되었습니다!\n선택된 아이템: ${result.winners.join(", ")}`);
            setSelectedItems([]);
          } else {
            alert("⚠️ 저장되었으나 응답이 명확하지 않습니다.");
          }
        } catch (error) {
          alert(`❌ 결과 조작 저장 실패: ${error.message}`);
        }
      }
    } finally {
      setIsControlLoading(false);
    }
  };

  // 전체 배팅 로그 정렬 (기존 유지)
  const displayBets = [...sponsorships]
    .sort((a, b) => {
      if (b.round !== a.round) return b.round - a.round;
      const getTime = (bet) => {
        const t = bet.timestamp || bet.createdAt || bet.betAt || bet.time;
        if (!t) return 0;
        if (t?.toDate) return t.toDate().getTime();
        if (typeof t === 'number') return t;
        if (typeof t === 'string') return new Date(t).getTime();
        if (t?.seconds) return t.seconds * 1000;
        return 0;
      };
      return getTime(b) - getTime(a);
    });

  const controlLocked = (isLocked && !isPastRound && targetRound === currentRound) || isControlLoading;

  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ★ [신규] 상단: 이벤트 결과 제어 (기존 EventControlView 이식) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div style={iaStyles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ ...iaStyles.bigTabTitle, margin: 0 }}>🎯 이벤트 결과 제어</h1>
          <div style={{
            ...iaStyles.monitorBox,
            border: isLocked ? "2px solid #ff3b30" : "1px solid #333",
            padding: '10px 20px',
            margin: 0,
            gap: 20,
          }}>
            <div style={{ fontSize: 13 }}>
              현재: <b style={{ color: '#fff' }}>{currentInfo?.currentRound || '대기중'}회</b>
            </div>
            <div style={{ fontSize: 13 }}>
              추첨까지: <b style={{ color: isLocked ? "#ff3b30" : "#00ff00", fontSize: 18 }}>{currentInfo?.timeLeft || 0}초</b>
            </div>
            {isLocked && (
              <div style={{ color: '#ff3b30', fontWeight: 'bold', fontSize: 12 }}>🔒 Lock</div>
            )}
          </div>
        </div>

        <div style={{ opacity: controlLocked ? 0.5 : 1, pointerEvents: controlLocked ? 'none' : 'auto' }}>
          <input
            type="number"
            placeholder="조작/재정산 할 회차 입력..."
            value={targetRound || ""}
            onChange={(e) => setTargetRound(parseInt(e.target.value) || 0)}
            style={{ ...iaStyles.adminInput, marginBottom: 15 }}
            disabled={isControlLoading}
          />
          <div style={iaStyles.adminItemGrid}>
            {ITEM_CONFIG.map(item => (
              <div
                key={item.name}
                onClick={() => {
                  if (isControlLoading) return;
                  const exists = selectedItems.includes(item.name);
                  setSelectedItems(exists ? selectedItems.filter(i => i !== item.name) : [...selectedItems, item.name].slice(0, 2));
                }}
                style={{
                  ...iaStyles.adminItemCard,
                  border: selectedItems.includes(item.name) ? `3px solid ${item.color}` : "3px solid #333",
                  background: selectedItems.includes(item.name) ? `${item.color}33` : "#1a1a1a",
                  cursor: isControlLoading ? 'not-allowed' : 'pointer',
                  opacity: isControlLoading ? 0.5 : 1
                }}
              >
                <span style={{ fontSize: 28 }}>{item.icon}</span><br /><b>{item.name}</b>
              </div>
            ))}
          </div>

          <button
            onClick={handleControlSave}
            disabled={controlLocked}
            style={{ 
              ...iaStyles.applyBtn, 
              background: isControlLoading 
                ? "#999" 
                : isPastRound 
                  ? "#ef4444" 
                  : (isLocked && targetRound === currentRound) 
                    ? "#444" 
                    : "#ffb347", 
              color: controlLocked ? "#888" : "#000", 
              cursor: controlLocked ? 'not-allowed' : 'pointer' 
            }}
          >
            {isControlLoading 
              ? "⏳ 처리 중..." 
              : isPastRound 
                ? `🚨 ${targetRound}회차 과거 결과 재정산 (다이아 조절)` 
                : (isLocked && targetRound === currentRound) 
                  ? "🔒 조작 불가 대기중" 
                  : "✅ 미래 결과 조작 예약"}
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <h3 style={{ color: "#ffb347", marginBottom: 10, fontSize: 15 }}>📋 예약된 결과 목록</h3>
          {Object.entries(queue).length === 0 ? (
            <div style={{ color: "#555", textAlign: "center", padding: "15px", fontSize: 13 }}>
              예약된 회차가 없습니다.
            </div>
          ) : (
            Object.entries(queue)
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .slice(0, 5)
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
                    style={{ ...iaStyles.delBtn, cursor: isControlLoading ? 'not-allowed' : 'pointer', opacity: isControlLoading ? 0.5 : 1 }}
                    disabled={isControlLoading}
                  >
                    🗑️ 삭제
                  </button>
                </div>
              ))
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 하단: 전체 배팅 로그 (기존 유지 - 아이템별 총액 현황판은 제거) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div style={iaStyles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h1 style={{ ...iaStyles.bigTabTitle, margin: 0 }}>💎 실시간 배팅 모니터링</h1>
          <span style={{ background: '#ff3b30', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 'bold' }}>
            🔥 {currentRound || '-'}회차 진행중
          </span>
        </div>

        <h3 style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '14px' }}>
          전체 배팅 로그 (최근 50건) - 한국시간(KST)
        </h3>
        <div style={{ maxHeight: 600, overflowY: "auto", background: '#111', borderRadius: '10px', border: '1px solid #222' }}>
          <table style={{ ...iaStyles.table, margin: 0 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#1a1a1a', zIndex: 10 }}>
              <tr>
                <th>회차</th>
                <th>ID (닉네임)</th>
                <th>선택 아이템 (최대 2개)</th>
                <th>베팅 금액</th>
                <th>유저 잔액</th>
                <th>베팅 시간</th>
                <th>결과</th>
                <th>관리</th> 
              </tr>
            </thead>
            <tbody>
              {displayBets.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: 30, textAlign: "center", color: "#555" }}>아직 베팅 내역이 없습니다.</td></tr>
              ) : (
                displayBets.map((s, i) => {
                  const isCurrentRound = s.round === currentRound;
                  const isEditing = editingId === s.id;

                  let statusBadge;
                  if (s.win === true) statusBadge = <span style={{ color: '#00ff00', fontWeight: 'bold' }}>승리 👑</span>;
                  else if (s.win === false) statusBadge = <span style={{ color: '#ff3b30', fontWeight: 'bold' }}>패배 ☠️</span>;
                  else if (s.win === "draw") statusBadge = <span style={{ color: '#888', fontWeight: 'bold' }}>무승부 🤝</span>;
                  else statusBadge = isCurrentRound ? <span style={{ color: '#ffb347', fontSize: '12px', fontWeight: 'bold' }}>진행중 ⏳</span> : <span style={{ color: '#888' }}>종료됨</span>;

                  const displayName = (s.userName && s.userName !== "알 수 없는 유저" && s.userName !== s.userId) ? s.userName : "";

                  return (
                    <tr key={s.id || i} style={{ borderBottom: "1px solid #222", background: isEditing ? "rgba(255,255,255,0.03)" : (isCurrentRound ? 'rgba(255, 179, 71, 0.05)' : 'transparent') }}>
                      <td style={{ color: isCurrentRound ? "#ffb347" : "#888", fontWeight: isCurrentRound ? 'bold' : 'normal' }}>{s.round}</td>
                      <td>
                        <div style={{ color: '#fff', fontWeight: 'bold' }}>{s.userId}</div>
                        {displayName && <div style={{ fontSize: '11px', color: '#888' }}>{displayName}</div>}
                      </td>

                      <td style={{ minWidth: '130px' }}>
                        {isEditing ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', background: '#222', padding: '6px', borderRadius: '6px', border: '1px solid #444', width: '220px' }}>
                            {ITEM_CONFIG.map((item) => {
                              const isChecked = editItems.includes(item.name);
                              return (
                                <label key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: isChecked ? item.color : '#aaa', fontSize: '11px', cursor: 'pointer', fontWeight: isChecked ? 'bold' : 'normal' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={isChecked}
                                    onChange={() => handleItemCheck(item.name)}
                                    style={{ accentColor: '#4cd137', cursor: 'pointer' }}
                                  />
                                  {item.icon} {item.name}
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {(s.items || []).map(itemName => {
                              const item = ITEM_CONFIG.find(c => c.name === itemName);
                              return (
                                <span key={itemName} style={{ padding: '3px 8px', borderRadius: '5px', background: item ? `${item.color}22` : '#222', color: item?.color || '#aaa', border: `1px solid ${item?.color || '#333'}`, fontSize: '11px', fontWeight: 'bold' }}>
                                  {item?.icon} {itemName}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td style={{ color: '#ffb347', fontWeight: 'bold', fontSize: '14px' }}>
                        {isEditing ? (
                          <input 
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            style={{ padding: '5px 8px', background: '#222', color: '#ffb347', border: '1px solid #555', borderRadius: '4px', width: '80px', fontSize: '13px', fontWeight: 'bold' }}
                          />
                        ) : (
                          `${s.betAmount?.toLocaleString() || 0} DIA`
                        )}
                      </td>

                      <td style={{ color: '#00ffff', fontWeight: 'bold', fontSize: '14px' }}>💎 {s.currentUserDiamond?.toLocaleString() || 0}</td>
                      <td style={{ color: '#aaa', fontSize: '12px' }}>{formatKoreanTime(s)}</td>
                      <td>{statusBadge}</td>
                      <td>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button onClick={() => saveEdit(s.id)} disabled={isSaving} style={{ padding: '4px 8px', background: '#4cd137', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                              {isSaving ? "저장중" : "저장"}
                            </button>
                            <button onClick={() => setEditingId(null)} disabled={isSaving} style={{ padding: '4px 8px', background: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                              취소
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(s)} style={{ padding: '4px 8px', background: '#222', color: '#aaa', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                            수정
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};