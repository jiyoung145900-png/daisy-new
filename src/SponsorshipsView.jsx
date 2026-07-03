import React, { useState, useEffect } from "react";
import { iaStyles } from "./AdminStyles";
import { ITEM_CONFIG } from "./EventService";
import { db } from "./firebase"; 
import { doc, updateDoc, collection, query, where, orderBy, getDocs, deleteDoc } from "firebase/firestore"; 

// =========================================================================
// --- 8. 실시간 배팅 모니터링 뷰 ---
// - 현재 회차 기준 최대 50개 자동 유지
// - 한국시간(KST) 베팅 시간 표시
// - 관리자 베팅 항목 복수 선택(최대 2개) 및 베팅 금액 수정 기능 (이벤트 엔진 완벽 연동)
// =========================================================================
export const SponsorshipsView = ({ sponsorships = [], currentInfo }) => {
  const currentRound = currentInfo?.currentRound || currentInfo?.round;
  const currentBets = sponsorships.filter(s => s.round === currentRound);

  // 📝 수정을 위한 상태(State) 관리
  const [editingId, setEditingId] = useState(null); 
  const [editItems, setEditItems] = useState([]); // ⭐ choices -> items 로 수정 (이벤트 연동 핵심)
  const [editAmount, setEditAmount] = useState(0);   
  const [isSaving, setIsSaving] = useState(false);   

  // 🧹 50개 초과 데이터 파이어베이스 자동 삭제 로직
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

  // ⭐ 한국시간(KST) 포맷 함수
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

  // 📊 현재 회차 배팅 현황 (풀 계산)
  const itemTotals = { "로켓": 0, "사랑": 0, "요트": 0, "장미": 0 };
  let totalCurrentPool = 0;

  currentBets.forEach(bet => {
    totalCurrentPool += bet.betAmount || 0;
    const itemsCount = bet.items?.length || 1;
    const perItemBet = (bet.betAmount || 0) / itemsCount;
    bet.items?.forEach(item => {
      if (itemTotals[item] !== undefined) itemTotals[item] += perItemBet;
    });
  });

  // 🛠️ 수정 모드 진입 함수
  const startEdit = (bet) => {
    setEditingId(bet.id);
    setEditItems(bet.items || []); // ⭐ 이벤트 엔진이 읽는 items 필드 매핑
    setEditAmount(bet.betAmount || 0);
  };

  // 🔲 베팅 항목 체크박스 다중 선택 핸들러
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

  // 💾 파이어베이스 데이터 저장 함수 (이벤트 화면 동기화)
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
      
      // ⭐ 이벤트 엔진과 100% 호환되도록 필드명 엄격 적용 (items, amount 추가)
      await updateDoc(betRef, {
        items: editItems, 
        betAmount: Number(editAmount),
        amount: Number(editAmount) // 만약을 대비해 amount 필드도 동기화 업데이트
      });

      setEditingId(null); 
    } catch (error) {
      console.error("베팅 수정 실패:", error);
      alert("수정 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // 전체 배팅 로그 정렬 (시간순)
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

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>💎 실시간 배팅 모니터링</h1>
      
      {/* ⭐ 상단 현황판 (수정 시 실시간으로 게이지 및 금액이 변동됨) */}
      <div style={{ background: '#161616', padding: '20px', borderRadius: '15px', border: '1px solid #333', marginBottom: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>🔥 {currentRound || '-'}회차 배팅 현황</h3>
          <span style={{ background: '#ff3b30', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
            총 접수: {totalCurrentPool.toLocaleString()} DIA
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {Object.entries(itemTotals).map(([itemName, amount]) => {
            const itemConfig = ITEM_CONFIG.find(i => i.name === itemName);
            return (
              <div key={itemName} style={{ background: '#222', padding: '15px 10px', borderRadius: '10px', textAlign: 'center', border: `1px solid ${amount > 0 ? itemConfig?.color : '#333'}` }}>
                <div style={{ fontSize: '24px', marginBottom: '5px' }}>{itemConfig?.icon}</div>
                <div style={{ color: '#aaa', fontSize: '12px' }}>{itemName}</div>
                <div style={{ color: amount > 0 ? itemConfig?.color : '#555', fontSize: '16px', fontWeight: 'bold', marginTop: '5px' }}>
                  {amount.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <h3 style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '15px' }}>
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

                    {/* ⭐ 베팅 항목 렌더링 */}
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
  );
};