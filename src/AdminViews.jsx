import React, { useState } from "react";
import { iaStyles } from "./AdminStyles";
import { ITEM_CONFIG } from "./EventService";
import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

// --- 1. 입출금 요청 뷰 (승인 / 거절) ---
export const RequestsView = ({ depositRequests, withdrawRequests, approveDeposit, approveWithdraw, rejectDeposit, rejectWithdraw }) => (
  <div style={iaStyles.card}>
    <h1 style={iaStyles.bigTabTitle}>🔔 입/출금 승인 대기</h1>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
      <div>
        <h3 style={{ color: "#00ff00", marginTop: 0, borderBottom: "1px solid #333", paddingBottom: 10 }}>
          ▼ 입금 신청 ({depositRequests.length})
        </h3>
        <table style={iaStyles.table}>
          <thead><tr><th>정보</th><th>금액</th><th>관리</th></tr></thead>
          <tbody>
            {depositRequests.length === 0 ? (
              <tr><td colSpan="3" style={{ padding: 20, color: "#555", textAlign: 'center' }}>대기중인 내역 없음</td></tr>
            ) : (
              depositRequests.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #222" }}>
                  <td><b>{r.userId}</b><br /><span style={{ fontSize: 12, color: "#888" }}>{r.depositName}</span></td>
                  <td style={{ color: "#00ff00", fontSize: 18, fontWeight: "bold" }}>{r.amount.toLocaleString()}</td>
                  <td style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => approveDeposit(r)} style={{ ...iaStyles.giantBtn, background: '#34D399', color: '#000' }}>승인</button>
                    <button onClick={() => rejectDeposit ? rejectDeposit(r) : alert('거절 로직이 연결되지 않았습니다.')} style={{ ...iaStyles.giantBtn, background: '#ef4444', color: '#fff' }}>거절</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h3 style={{ color: "#ff3b30", marginTop: 0, borderBottom: "1px solid #333", paddingBottom: 10 }}>
          ▼ 출금 신청 ({withdrawRequests.length})
        </h3>
        <table style={iaStyles.table}>
          <thead><tr><th>정보</th><th>금액</th><th>관리</th></tr></thead>
          <tbody>
            {withdrawRequests.length === 0 ? (
              <tr><td colSpan="3" style={{ padding: 20, color: "#555", textAlign: 'center' }}>대기중인 내역 없음</td></tr>
            ) : (
              withdrawRequests.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #222" }}>
                  <td><b>{r.userId}</b><br /><span style={{ fontSize: 12, color: "#888" }}>{r.bankInfo?.bank}</span></td>
                  <td style={{ color: "#ff3b30", fontSize: 18, fontWeight: "bold" }}>{r.amount.toLocaleString()}</td>
                  <td style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => approveWithdraw(r)} style={{ ...iaStyles.giantBtn, background: '#34D399', color: '#000' }}>승인</button>
                    <button onClick={() => rejectWithdraw ? rejectWithdraw(r) : alert('거절 로직이 연결되지 않았습니다.')} style={{ ...iaStyles.giantBtn, background: '#ef4444', color: '#fff' }}>거절</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// --- 2. 완료된 장부 뷰 ---
export const FinanceView = ({ financeHistory }) => (
  <div style={iaStyles.card}>
    <h1 style={iaStyles.bigTabTitle}>📜 자금 입/출금 완료 장부</h1>
    <table style={iaStyles.table}>
      <thead>
        <tr><th>일시</th><th>ID</th><th>구분</th><th>금액</th><th>상태</th></tr>
      </thead>
      <tbody>
        {financeHistory.length === 0 ? (
          <tr><td colSpan="5" style={{ padding: 30, textAlign: "center" }}>내역 없음</td></tr>
        ) : (
          financeHistory.map(f => {
            const displayStatus = f.status === 'pending' ? '완료' : (f.status || '완료');
            return (
              <tr key={f.id} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ color: "#888", fontSize: 13 }}>{new Date(f.completedAt).toLocaleString()}</td>
                <td style={{ fontWeight: "bold" }}>{f.userId}</td>
                <td>
                  <span style={{
                    background: f.type === "입금" ? "rgba(0,255,0,0.1)" : "rgba(255,59,48,0.1)",
                    color: f.type === "입금" ? "#00ff00" : "#ff3b30",
                    padding: "3px 8px", borderRadius: "5px", fontSize: 12, fontWeight: "bold"
                  }}>{f.type}</span>
                </td>
                <td style={{ fontSize: 16, fontWeight: "bold" }}>{f.amount.toLocaleString()}</td>
                <td style={{ color: displayStatus === '거절' ? '#ef4444' : "#4cd137", fontWeight: "bold" }}>
                  {displayStatus}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
);

// --- 3. 이벤트 조작 뷰 ---
export const EventControlView = ({ currentInfo, targetRound, setTargetRound, queue, deleteQueue, handleApplyManipulation }) => {
  const [selected, setSelected] = useState([]);
  const isLocked = !currentInfo || currentInfo.timeLeft <= 5;

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>🎯 실시간 이벤트 제어</h1>
      <div style={{ ...iaStyles.monitorBox, border: isLocked ? "2px solid #ff3b30" : "1px solid #333", transition: 'all 0.3s' }}>
        <div>현재 진행중: <b style={{ color: '#fff' }}>{currentInfo?.currentRound || '대기중'}회차</b></div>
        <div>추첨까지: <b style={{ color: isLocked ? "#ff3b30" : "#00ff00", fontSize: '24px' }}>{currentInfo?.timeLeft || 0}초</b></div>
        {isLocked && <div style={{ color: '#ff3b30', fontWeight: 'bold', marginTop: '10px', fontSize: '14px' }}>⚠️ 추첨 진행 중 (결과 조작 Lock 상태)</div>}
      </div>

      <div style={{ marginTop: 30, opacity: isLocked ? 0.5 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>
        <input
          type="number"
          placeholder="회차"
          value={targetRound || ""}
          onChange={(e) => setTargetRound(parseInt(e.target.value))}
          style={iaStyles.adminInput}
        />
        <div style={iaStyles.adminItemGrid}>
          {ITEM_CONFIG.map(item => (
            <div
              key={item.name}
              onClick={() => {
                const exists = selected.includes(item.name);
                setSelected(exists ? selected.filter(i => i !== item.name) : [...selected, item.name].slice(0, 2));
              }}
              style={{
                ...iaStyles.adminItemCard,
                border: selected.includes(item.name) ? `3px solid ${item.color}` : "3px solid #333",
                background: selected.includes(item.name) ? `${item.color}33` : "#1a1a1a",
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: 28 }}>{item.icon}</span><br /><b>{item.name}</b>
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            if (isLocked) return alert("현재 추첨 중이라 조작할 수 없습니다!");
            if (!targetRound) return alert("회차를 입력해주세요.");
            if (selected.length === 0) return alert("아이템을 선택해주세요.");
            handleApplyManipulation(selected).then(res => res && setSelected([]));
          }}
          style={{ ...iaStyles.applyBtn, background: isLocked ? "#444" : "#ffb347", color: isLocked ? "#888" : "#000", cursor: isLocked ? 'not-allowed' : 'pointer' }}
          disabled={isLocked}
        >
          {isLocked ? "🔒 조작 불가 대기중" : "결과 조작 저장"}
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        {Object.entries(queue).map(([k, v]) => (
          <div key={k} style={iaStyles.queueRow}>
            <b>{k}회</b>: {Array.isArray(v) ? v.join(", ") : String(v)}
            <button onClick={() => deleteQueue(k)} style={iaStyles.delBtn}>X</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 4. 회원 관리 뷰 ---
export const UsersView = ({ users, updateFullUserInfo, handleChangeUserPassword }) => {
  const [term, setTerm] = useState("");
  const [hiddenUsers, setHiddenUsers] = useState([]);

  const filtered = users.filter(u =>
    !hiddenUsers.includes(u.id) && (u.id || "").toLowerCase().includes(term.toLowerCase())
  );

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>💰 회원 관리</h1>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>🔍</span>
        <input
          placeholder="아이디 검색... (중요 회원만 남기고 삭제 버튼으로 숨기세요)"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          style={{ ...iaStyles.searchInputField, width: '100%' }}
        />
      </div>

      <table style={iaStyles.table}>
        <thead><tr><th>상태</th><th>아이디</th><th>다이아</th><th>변경값</th><th>액션</th></tr></thead>
        <tbody>
          {filtered.map(u => (
            <tr key={u.id} style={{ borderBottom: "1px solid #222" }}>
              <td>{u.lastActive && (Date.now() - u.lastActive < 60000) ? <span style={{ color: "#0f0" }}>●</span> : <span style={{ color: "#444" }}>●</span>}</td>
              <td style={{ fontWeight: "bold", fontSize: 18 }}>{u.id}</td>
              <td style={{ color: "#ffb347" }}>💎 {u.diamond?.toLocaleString()}</td>
              <td><input id={`pt-${u.id}`} defaultValue={u.diamond} style={iaStyles.giantInput} /></td>
              <td style={{ display: "flex", gap: 5, alignItems: "center", padding: "10px 0" }}>
                <button onClick={() => updateFullUserInfo(u.id, document.getElementById(`pt-${u.id}`).value, u.refCode, u.referral)} style={iaStyles.giantBtn}>수정</button>
                <button onClick={() => handleChangeUserPassword(u.id)} style={{ ...iaStyles.giantBtn, background: "#5856d6", color: "#fff" }}>비번</button>
                <button onClick={() => setHiddenUsers([...hiddenUsers, u.id])} style={{ ...iaStyles.giantBtn, background: "#ef4444", color: "#fff" }}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- 5. 파트너/직원 관리 뷰 ---
export const AgentsView = ({
  agents,
  users,
  newAgentName,
  setNewAgentName,
  newAgentCode,
  setNewAgentCode,
  addAgent,
  deleteAgent,
}) => (
  <div style={iaStyles.card}>
    <h1 style={iaStyles.bigTabTitle}>👔 파트너/직원 관리</h1>
    <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
      <input placeholder="이름" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} style={iaStyles.giantInput} />
      <input placeholder="코드" value={newAgentCode} onChange={(e) => setNewAgentCode(e.target.value)} style={iaStyles.giantInput} />
      <button onClick={addAgent} style={iaStyles.giantBtn}>등록</button>
    </div>
    <table style={iaStyles.table}>
      <thead><tr><th>이름</th><th>코드</th><th>인원</th><th>명단</th><th>삭제</th></tr></thead>
      <tbody>
        {agents.map(a => {
          const code = (a.code || a.id || "").toString();
          const myUsers = users.filter(u => (u.referral || "") === code);
          return (
            <tr key={code} style={{ borderBottom: "1px solid #222" }}>
              <td style={{ color: "#ffb347", fontSize: 18 }}>{a.name}</td>
              <td>{code}</td>
              <td style={{ color: "#00ff00" }}>{myUsers.length}</td>
              <td style={{ fontSize: 12, color: "#888", maxWidth: 300 }}>{myUsers.map(u => u.id).join(", ")}</td>
              <td><button onClick={() => deleteAgent(code)} style={iaStyles.delBtn}>삭제</button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// --- 6. 추천인 관리 뷰 ---
export const ReferralsView = ({ users, updateFullUserInfo }) => {
  const [refSearch, setRefSearch] = useState("");
  const filteredUsers = users.filter(u => (u.id || "").toLowerCase().includes(refSearch.toLowerCase()));

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>🤝 추천인 코드</h1>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>🔍</span>
        <input
          placeholder="아이디로 검색..."
          value={refSearch}
          onChange={(e) => setRefSearch(e.target.value)}
          style={iaStyles.searchInputField}
        />
      </div>
      <table style={iaStyles.table}>
        <thead><tr><th>아이디</th><th>내 코드</th><th>추천인</th><th>관리</th></tr></thead>
        <tbody>
          {filteredUsers.map(u => (
            <tr key={u.id} style={{ borderBottom: "1px solid #222" }}>
              <td>{u.id}</td>
              <td><input id={`rc-${u.id}`} defaultValue={u.refCode || ""} style={iaStyles.giantInput} /></td>
              <td><input id={`rf-${u.id}`} defaultValue={u.referral || ""} style={{ ...iaStyles.giantInput, color: "#0ff" }} /></td>
              <td style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={() => updateFullUserInfo(u.id, u.diamond, document.getElementById(`rc-${u.id}`).value, document.getElementById(`rf-${u.id}`).value)}
                  style={iaStyles.giantBtn}
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    document.getElementById(`rc-${u.id}`).value = "";
                    document.getElementById(`rf-${u.id}`).value = "";
                    updateFullUserInfo(u.id, u.diamond, "", "");
                  }}
                  style={{ ...iaStyles.giantBtn, background: '#ef4444', color: '#fff' }}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- 7. 이벤트 통계 뷰 ---
export const HistoryView = ({ gameHistory, sponsorships = [] }) => {
  const [secretModal, setSecretModal] = useState(null);

  // ✅ [수정] alert만 띄우던 함수 → Firestore에 실제 저장하도록 변경
  const handleSecretSave = async () => {
    if (secretModal.newResults.length === 0) {
      alert("아이템을 1개 이상 선택해주세요.");
      return;
    }
    try {
      await setDoc(
        doc(db, "event_manipulation", String(secretModal.round)),
        { winner: secretModal.newResults, updatedAt: new Date().toISOString() }
      );
      alert(`${secretModal.round}회차 결과가 [${secretModal.newResults.join(", ")}](으)로 변경되었습니다.`);
      setSecretModal(null);
    } catch (e) {
      alert("저장 실패: " + e.message);
    }
  };

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>📋 회차별 이벤트 통계</h1>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>※ 회차 텍스트를 클릭하면 결과를 은밀하게 수정할 수 있습니다.</p>

      <table style={iaStyles.table}>
        <thead><tr><th>회차</th><th>베팅 인원</th><th>총 베팅액</th><th>최종 결과</th></tr></thead>
        <tbody>
          {gameHistory.map(h => {
            const roundBets = sponsorships.filter(s => s.round === h.round);
            const totalAmount = roundBets.reduce((acc, curr) => acc + (curr.betAmount || 0), 0);
            return (
              <tr key={h.round} style={{ borderBottom: "1px solid #222" }}>
                <td
                  onClick={() => setSecretModal({ round: h.round, current: h.winItems, newResults: [] })}
                  style={{ color: "#ffb347", cursor: "pointer", textDecoration: "underline" }}
                >
                  {h.round}회
                </td>
                <td>{roundBets.length}명</td>
                <td style={{ color: '#00ff00' }}>{totalAmount.toLocaleString()} DIA</td>
                <td>{h.winItems?.join(" / ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {secretModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#222', padding: '30px', borderRadius: '20px', width: '300px', border: '1px solid #444', textAlign: 'center' }}>
            <h2 style={{ color: '#fff', marginTop: 0 }}>🤫 시크릿 결과 조작</h2>
            <p style={{ color: '#ffb347', fontWeight: 'bold' }}>{secretModal.round}회차</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '20px 0' }}>
              {ITEM_CONFIG.map(item => {
                const isSelected = secretModal.newResults.includes(item.name);
                return (
                  <div
                    key={item.name}
                    onClick={() => {
                      setSecretModal({
                        ...secretModal,
                        newResults: isSelected
                          ? secretModal.newResults.filter(i => i !== item.name)
                          : [...secretModal.newResults, item.name].slice(0, 2)
                      });
                    }}
                    style={{ background: isSelected ? '#ffb347' : '#111', color: isSelected ? '#000' : '#fff', padding: '10px', borderRadius: '10px', cursor: 'pointer', border: '1px solid #333' }}
                  >
                    {item.icon} {item.name}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSecretSave} style={{ ...iaStyles.giantBtn, flex: 1 }}>변경 적용</button>
              <button onClick={() => setSecretModal(null)} style={{ ...iaStyles.giantBtn, background: '#444', color: '#fff', flex: 1 }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- 8. 실시간 모니터링 뷰 ---
export const SponsorshipsView = ({ sponsorships, currentInfo, updateBetData }) => {
  const currentRound = currentInfo?.currentRound || currentInfo?.round;
  const currentBets = sponsorships.filter(s => s.round === currentRound);

  const [editItems, setEditItems] = useState({});

  const toggleItem = (betId, itemName, originalItems) => {
    setEditItems(prev => {
      const currentSelected = prev[betId] || originalItems || [];
      if (currentSelected.includes(itemName)) {
        return { ...prev, [betId]: currentSelected.filter(i => i !== itemName) };
      } else {
        if (currentSelected.length >= 2) {
          alert("베팅 아이템은 최대 2개까지만 선택 가능합니다.");
          return prev;
        }
        return { ...prev, [betId]: [...currentSelected, itemName] };
      }
    });
  };

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

  const displayBets = [...sponsorships]
    .sort((a, b) => b.round - a.round)
    .slice(0, 50);

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>💎 실시간 배팅 레이더망</h1>
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

      <h3 style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '15px' }}>전체 배팅 로그 (최근 50건)</h3>
      <div style={{ maxHeight: 600, overflowY: "auto", background: '#111', borderRadius: '10px', border: '1px solid #222' }}>
        <table style={{ ...iaStyles.table, margin: 0 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#1a1a1a', zIndex: 10 }}>
            <tr>
              <th>회차</th>
              <th>ID (닉네임)</th>
              <th>선택 아이템 (클릭하여 변경)</th>
              <th>베팅 금액 (수정)</th>
              <th>잔액 현황</th>
              <th>결과</th>
            </tr>
          </thead>
          <tbody>
            {displayBets.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: 30, textAlign: "center", color: "#555" }}>내역 없음</td></tr>
            ) : (
              displayBets.map((s, i) => {
                const isCurrentRound = s.round === currentRound;
                let statusBadge;
                let balanceDeltaUI;

                const itemsCount = s.items?.length || 1;
                const WIN_MULTIPLIER = itemsCount === 2 ? 4 : 2;
                const winAmount = (s.betAmount || 0) * WIN_MULTIPLIER;

                if (s.win === true) {
                  statusBadge = <span style={{ color: '#00ff00', fontWeight: 'bold' }}>승리 👑</span>;
                  balanceDeltaUI = <span style={{ color: '#00ff00', fontWeight: 'bold', fontSize: '13px' }}>+ {winAmount.toLocaleString()} DIA</span>;
                } else if (s.win === false) {
                  statusBadge = <span style={{ color: '#ff3b30', fontWeight: 'bold' }}>패배 ☠️</span>;
                  balanceDeltaUI = <span style={{ color: '#ff3b30', fontWeight: 'bold', fontSize: '13px' }}>- {s.betAmount?.toLocaleString()} DIA</span>;
                } else {
                  statusBadge = isCurrentRound
                    ? <span style={{ color: '#ffb347', fontSize: '12px', fontWeight: 'bold' }}>진행중 ⏳</span>
                    : <span style={{ color: '#888' }}>종료됨</span>;
                  balanceDeltaUI = <span style={{ color: isCurrentRound ? '#ffb347' : '#888', fontSize: '13px' }}>
                    - {s.betAmount?.toLocaleString()} {isCurrentRound && "(대기중)"}
                  </span>;
                }

                const displayName = (s.userName && s.userName !== "알 수 없는 유저" && s.userName !== s.userId)
                  ? s.userName : "";

                const currentSelectedItems = editItems[s.id] || s.items || [];

                return (
                  <tr key={s.id || i} style={{ borderBottom: "1px solid #222", background: isCurrentRound ? 'rgba(255, 179, 71, 0.05)' : 'transparent' }}>
                    <td style={{ color: isCurrentRound ? "#ffb347" : "#888", fontWeight: isCurrentRound ? 'bold' : 'normal' }}>{s.round}</td>

                    <td>
                      <div style={{ color: '#fff', fontWeight: 'bold' }}>{s.userId}</div>
                      {displayName && <div style={{ fontSize: '11px', color: '#888' }}>{displayName}</div>}
                    </td>

                    <td style={{ minWidth: '130px' }}>
                      {isCurrentRound ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {ITEM_CONFIG.map(item => {
                            const isSelected = currentSelectedItems.includes(item.name);
                            return (
                              <span
                                key={item.name}
                                onClick={() => toggleItem(s.id, item.name, s.items)}
                                style={{
                                  padding: '3px 8px', borderRadius: '5px',
                                  background: isSelected ? `${item.color}33` : '#111',
                                  color: isSelected ? item.color : '#666',
                                  cursor: 'pointer',
                                  border: `1px solid ${isSelected ? item.color : '#333'}`,
                                  fontSize: '11px',
                                  fontWeight: isSelected ? 'bold' : 'normal',
                                  transition: 'all 0.2s'
                                }}
                              >
                                {item.name}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ fontSize: '13px', color: '#aaa' }}>{s.items?.join(", ")}</span>
                      )}
                    </td>

                    <td style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        id={`betAmount-${s.id}`}
                        defaultValue={s.betAmount}
                        type="number"
                        disabled={!isCurrentRound}
                        style={{
                          ...iaStyles.giantInput, width: '90px', textAlign: 'right', padding: '5px',
                          opacity: isCurrentRound ? 1 : 0.5
                        }}
                      />
                      <button
                        onClick={() => {
                          const newVal = document.getElementById(`betAmount-${s.id}`).value;
                          const finalItems = editItems[s.id] || s.items || [];
                          if (finalItems.length === 0) {
                            alert("최소 1개의 배팅 아이템을 선택해야 합니다.");
                            return;
                          }
                          if (updateBetData) {
                            updateBetData(s.id, newVal, finalItems);
                          } else {
                            alert("수정 기능이 연결되지 않았습니다. useAdminLogic.js 를 확인해주세요.");
                          }
                        }}
                        disabled={!isCurrentRound}
                        style={{
                          ...iaStyles.giantBtn, padding: '5px 12px', fontSize: '13px',
                          opacity: isCurrentRound ? 1 : 0.5, cursor: isCurrentRound ? 'pointer' : 'not-allowed'
                        }}
                      >
                        저장
                      </button>
                    </td>

                    <td>
                      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '2px' }}>
                        보유: {s.currentUserDiamond?.toLocaleString() || 0}
                      </div>
                      <div>{balanceDeltaUI}</div>
                    </td>

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
