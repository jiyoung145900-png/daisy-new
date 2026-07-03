import React from "react";
import { iaStyles } from "./AdminStyles";
import { ITEM_CONFIG } from "./EventService";

// =========================================================================
// --- 8. 실시간 배팅 모니터링 뷰 ---
// - 최근 50개 베팅만 표시
// - 한국시간(KST) 베팅 시간 표시
// - 유저 잔액 표시 (증감 없이)
// - 수정 기능 제거 (조회 전용)
// =========================================================================
export const SponsorshipsView = ({ sponsorships = [], currentInfo }) => {
  const currentRound = currentInfo?.currentRound || currentInfo?.round;
  const currentBets = sponsorships.filter(s => s.round === currentRound);

  // ⭐ 한국시간(KST) 포맷 함수
  const formatKoreanTime = (bet) => {
    // 여러 형식의 timestamp 지원
    let timestamp = bet.timestamp || bet.createdAt || bet.betAt || bet.time;
    
    if (!timestamp) return "-";
    
    let date;
    try {
      // Firestore Timestamp 객체
      if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      }
      // 숫자 (milliseconds)
      else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      }
      // ISO 문자열
      else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      }
      // seconds 필드가 있는 Timestamp 유사 객체
      else if (timestamp?.seconds) {
        date = new Date(timestamp.seconds * 1000);
      }
      else {
        return "-";
      }

      if (isNaN(date.getTime())) return "-";

      // 한국시간(KST) 포맷: MM/DD HH:mm:ss
      return date.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return "-";
    }
  };

  // 아이템별 총 배팅액 계산 (현재 회차)
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

  // 최근 50개만 표시 (베팅 시간 최신순)
  const displayBets = [...sponsorships]
    .sort((a, b) => {
      // 회차 내림차순, 같은 회차면 timestamp 내림차순
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
    })
    .slice(0, 50);

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>💎 실시간 배팅 모니터링</h1>
      
      {/* 현재 회차 배팅 현황 */}
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

      {/* 전체 배팅 로그 */}
      <h3 style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '15px' }}>
        전체 배팅 로그 (최근 50건) - 한국시간(KST)
      </h3>
      <div style={{ maxHeight: 600, overflowY: "auto", background: '#111', borderRadius: '10px', border: '1px solid #222' }}>
        <table style={{ ...iaStyles.table, margin: 0 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#1a1a1a', zIndex: 10 }}>
            <tr>
              <th>회차</th>
              <th>ID (닉네임)</th>
              <th>선택 아이템</th>
              <th>베팅 금액</th>
              <th>유저 잔액</th>
              <th>베팅 시간</th>
              <th>결과</th>
            </tr>
          </thead>
          <tbody>
            {displayBets.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: 30, textAlign: "center", color: "#555" }}>
                  아직 베팅 내역이 없습니다.<br />
                  <span style={{ fontSize: 13, color: "#888" }}>
                    유저가 베팅하면 실시간으로 여기에 표시됩니다.
                  </span>
                </td>
              </tr>
            ) : (
              displayBets.map((s, i) => {
                const isCurrentRound = s.round === currentRound;
                let statusBadge;

                // 결과 상태 표시
                if (s.win === true) {
                  statusBadge = <span style={{ color: '#00ff00', fontWeight: 'bold' }}>승리 👑</span>;
                } else if (s.win === false) {
                  statusBadge = <span style={{ color: '#ff3b30', fontWeight: 'bold' }}>패배 ☠️</span>;
                } else if (s.win === "draw") {
                  statusBadge = <span style={{ color: '#888', fontWeight: 'bold' }}>무승부 🤝</span>;
                } else {
                  statusBadge = isCurrentRound
                    ? <span style={{ color: '#ffb347', fontSize: '12px', fontWeight: 'bold' }}>진행중 ⏳</span>
                    : <span style={{ color: '#888' }}>종료됨</span>;
                }

                // 유저명 표시 (있으면)
                const displayName = (s.userName && s.userName !== "알 수 없는 유저" && s.userName !== s.userId)
                  ? s.userName : "";

                return (
                  <tr key={s.id || i} style={{ 
                    borderBottom: "1px solid #222", 
                    background: isCurrentRound ? 'rgba(255, 179, 71, 0.05)' : 'transparent' 
                  }}>
                    {/* 회차 */}
                    <td style={{ 
                      color: isCurrentRound ? "#ffb347" : "#888", 
                      fontWeight: isCurrentRound ? 'bold' : 'normal' 
                    }}>
                      {s.round}
                    </td>

                    {/* ID (닉네임) */}
                    <td>
                      <div style={{ color: '#fff', fontWeight: 'bold' }}>{s.userId}</div>
                      {displayName && <div style={{ fontSize: '11px', color: '#888' }}>{displayName}</div>}
                    </td>

                    {/* 선택 아이템 (텍스트 표시만) */}
                    <td style={{ minWidth: '130px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(s.items || []).map(itemName => {
                          const item = ITEM_CONFIG.find(c => c.name === itemName);
                          return (
                            <span
                              key={itemName}
                              style={{
                                padding: '3px 8px', 
                                borderRadius: '5px',
                                background: item ? `${item.color}22` : '#222',
                                color: item?.color || '#aaa',
                                border: `1px solid ${item?.color || '#333'}`,
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                            >
                              {item?.icon} {itemName}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* 베팅 금액 */}
                    <td style={{ color: '#ffb347', fontWeight: 'bold', fontSize: '14px' }}>
                      {s.betAmount?.toLocaleString() || 0} DIA
                    </td>

                    {/* 유저 잔액 */}
                    <td style={{ color: '#00ffff', fontWeight: 'bold', fontSize: '14px' }}>
                      💎 {s.currentUserDiamond?.toLocaleString() || 0}
                    </td>

                    {/* 베팅 시간 (한국시간) */}
                    <td style={{ color: '#aaa', fontSize: '12px' }}>
                      {formatKoreanTime(s)}
                    </td>

                    {/* 결과 */}
                    <td>{statusBadge}</td>
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