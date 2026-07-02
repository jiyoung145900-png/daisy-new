import React, { useState, useEffect } from "react";
import { iaStyles } from "./AdminStyles";
import { ITEM_CONFIG } from "./EventService";
import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import { TIER_OPTIONS } from "./MyPage.utils";

// =========================================================================
// [신규 추가] 로컬 스토리지 기반 '최근 검색 유저 20명' 관리 커스텀 훅
// =========================================================================
const useRecentUsers = (storageKey, defaultLimit = 20) => {
  const [recentIds, setRecentIds] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addRecentIds = (newIds) => {
    setRecentIds(prev => {
      const combined = [...newIds, ...prev];
      const unique = Array.from(new Set(combined)).slice(0, defaultLimit);
      localStorage.setItem(storageKey, JSON.stringify(unique));
      return unique;
    });
  };

  const removeRecentId = (id) => {
    setRecentIds(prev => {
      const updated = prev.filter(prevId => prevId !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  return { recentIds, addRecentIds, removeRecentId };
};
// =========================================================================


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
export const EventControlView = ({ currentInfo, targetRound, setTargetRound, queue, deleteQueue, handleApplyManipulation, handleSecretRevisions, gameHistory }) => {
  const [selected, setSelected] = useState([]);
  const isLocked = !currentInfo || currentInfo.timeLeft <= 5;
  const currentRound = currentInfo?.currentRound || 0;
  
  const isPastRound = targetRound && targetRound < currentRound;

  const handleSave = async () => {
    if (!targetRound) return alert("회차를 입력해주세요.");
    if (selected.length === 0) return alert("아이템을 선택해주세요.");

    if (isPastRound) {
      if (!handleSecretRevisions) {
        alert("재정산 기능이 연결되지 않았습니다.");
        return;
      }
      
      const pastGame = gameHistory?.find(h => h.round === targetRound);
      const oldWinners = pastGame ? pastGame.winItems : [];

      if (window.confirm(`${targetRound}회차는 이미 종료된 과거입니다.\n선택하신 [${selected.join(", ")}] 결과로 유저들의 다이아를 즉시 회수/재지급 하시겠습니까?`)) {
        try {
          await handleSecretRevisions(targetRound, oldWinners, selected);
          alert(`${targetRound}회차 재정산이 완료되었습니다!`);
          setSelected([]);
        } catch (e) {
          alert("재정산 실패: " + e.message);
        }
      }
    } else {
      if (isLocked && targetRound === currentRound) return alert("현재 추첨 중이라 조작할 수 없습니다!");
      handleApplyManipulation(selected).then(res => res && setSelected([]));
      alert(`${targetRound}회차 결과 예약이 저장되었습니다.`);
      setSelected([]);
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

      <div style={{ marginTop: 30, opacity: (isLocked && !isPastRound && targetRound === currentRound) ? 0.5 : 1, pointerEvents: (isLocked && !isPastRound && targetRound === currentRound) ? 'none' : 'auto' }}>
        <input
          type="number"
          placeholder="조작/재정산 할 회차 입력..."
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
          onClick={handleSave}
          style={{ 
            ...iaStyles.applyBtn, 
            background: isPastRound ? "#ef4444" : (isLocked && targetRound === currentRound) ? "#444" : "#ffb347", 
            color: (isLocked && !isPastRound && targetRound === currentRound) ? "#888" : "#000", 
            cursor: (isLocked && !isPastRound && targetRound === currentRound) ? 'not-allowed' : 'pointer' 
          }}
          disabled={isLocked && !isPastRound && targetRound === currentRound}
        >
          {isPastRound ? `🚨 ${targetRound}회차 과거 결과 재정산 (다이아 조절)` : (isLocked && targetRound === currentRound) ? "🔒 조작 불가 대기중" : "미래 결과 조작 예약"}
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        {Object.entries(queue).map(([k, v]) => (
          <div key={k} style={iaStyles.queueRow}>
            <b>{k}회 예약</b>: {Array.isArray(v) ? v.join(", ") : String(v)}
            <button onClick={() => deleteQueue(k)} style={iaStyles.delBtn}>X</button>
          </div>
        ))}
      </div>
    </div>
  );
};


// --- 4. 회원 관리 뷰 (수정됨) ---
export const UsersView = ({ users, updateFullUserInfo, updateUserTier, handleChangeUserPassword }) => {
  const [term, setTerm] = useState("");
  const [localHidden, setLocalHidden] = useState(new Set()); // 검색 중 임시 숨김용
  
  // 브라우저 캐시에 20명 저장하는 훅 사용
  const { recentIds, addRecentIds, removeRecentId } = useRecentUsers('admin_recent_users', 20);

  const isSearching = term.trim() !== "";

  // 검색어 입력 시 로직
  useEffect(() => {
    setLocalHidden(new Set()); // 검색어가 1글자라도 바뀌면 기존에 임시로 가렸던 사람 다시 보이게 초기화
    
    if (isSearching) {
      // 0.6초 동안 검색어 입력이 멈추면 해당 결과 유저들을 '최근 목록'에 자동 추가
      const timeout = setTimeout(() => {
        const matches = users
          .filter(u => (u.id || "").toLowerCase().includes(term.toLowerCase()))
          .map(u => u.id);
        if (matches.length > 0) addRecentIds(matches);
      }, 600);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line
  }, [term]); 

  // 리스트 렌더링 로직
  let displayUsers = [];
  if (isSearching) {
    // 1. 검색 중일 때: 검색어 포함 + 방금 삭제버튼 안 누른 사람
    displayUsers = users.filter(u =>
      (u.id || "").toLowerCase().includes(term.toLowerCase()) && !localHidden.has(u.id)
    );
  } else {
    // 2. 평소(검색어 없을 때): 무조건 '최근 조회한 20명' 기록만 보여줌
    displayUsers = recentIds.map(id => users.find(u => u.id === id)).filter(Boolean);
  }

  // 삭제 버튼 동작
  const handleDeleteUI = (id) => {
    if (isSearching) {
      // 검색 화면에서 삭제 누르면 당장 안 보이게 임시 숨김 처리 (검색어 바꾸면 리셋됨)
      setLocalHidden(prev => new Set(prev).add(id));
    }
    // 최근 20명 리스트에서는 영구 제외
    removeRecentId(id);
  };
  
  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>💰 회원 관리 {isSearching ? "(검색 결과)" : "(최근 조회 기록)"}</h1>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>🔍</span>
        <input
          placeholder="아이디 검색... (검색하면 최근 기록에 추가됩니다)"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          style={{ ...iaStyles.searchInputField, width: '100%' }}
        />
      </div>

      <table style={{ ...iaStyles.table, width: "100%", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: "8%" }}>상태</th>
            <th style={{ width: "16%" }}>아이디</th>
            <th style={{ width: "14%" }}>다이아</th>
            <th style={{ width: "14%" }}>변경값</th>
            <th style={{ width: "13%" }}>등급</th>
            <th style={{ width: "35%" }}>액션</th>
          </tr>
        </thead>
        <tbody>
          {displayUsers.length === 0 ? (
            <tr><td colSpan="6" style={{ padding: 20, textAlign: 'center', color: '#555' }}>기록이 없습니다. 유저를 검색해주세요.</td></tr>
          ) : (
            displayUsers.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ textAlign: "center" }}>
                  {u.lastActive && (Date.now() - u.lastActive < 60000) ? <span style={{ color: "#0f0" }}>●</span> : <span style={{ color: "#444" }}>●</span>}
                </td>
                <td style={{ fontWeight: "bold", fontSize: 16 }}>{u.id}</td>
                <td style={{ color: "#ffb347" }}>💎 {u.diamond?.toLocaleString()}</td>
                <td><input id={`pt-${u.id}`} defaultValue={u.diamond} style={{ ...iaStyles.giantInput, width: "90%" }} /></td>
                <td>
                  <select
                    defaultValue={u.tier || "SILVER"}
                    onChange={(e) => updateUserTier && updateUserTier(u.id, e.target.value)}
                    style={{ ...iaStyles.giantInput, width: "100%", cursor: 'pointer' }}
                  >
                    {TIER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </td>
                <td style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                  <button onClick={() => updateFullUserInfo(u.id, document.getElementById(`pt-${u.id}`).value, u.refCode, u.referral)} style={iaStyles.giantBtn}>수정</button>
                  <button onClick={() => handleChangeUserPassword(u.id)} style={{ ...iaStyles.giantBtn, background: "#5856d6", color: "#fff" }}>비번</button>
                  <button onClick={() => handleDeleteUI(u.id)} style={{ ...iaStyles.giantBtn, background: "#ef4444", color: "#fff" }}>삭제</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

// --- 5. 파트너/직원 관리 뷰 (수정됨: 명단 삭제, 검색/최근기록 도입, 숨김 처리) ---
export const AgentsView = ({
  agents,
  users,
  newAgentName,
  setNewAgentName,
  newAgentCode,
  setNewAgentCode,
  addAgent,
  // deleteAgent, // 실제 DB 삭제 기능은 이제 사용하지 않으므로 주석 처리/제외
}) => {
  const [term, setTerm] = useState("");
  const [localHidden, setLocalHidden] = useState(new Set()); // 검색 중 임시 숨김용
  
  // 브라우저 캐시에 20명 저장 (회원/추천인 관리와 동일한 커스텀 훅 사용)
  // 파일 상단에 추가했던 useRecentUsers 훅을 재사용합니다.
  const { recentIds, addRecentIds, removeRecentId } = useRecentUsers('admin_recent_agents', 20);

  const isSearching = term.trim() !== "";

  // 검색어 입력 시 로직
  React.useEffect(() => {
    setLocalHidden(new Set()); 
    if (isSearching) {
      const timeout = setTimeout(() => {
        const matches = agents
          .filter(a => 
            (a.name || "").toLowerCase().includes(term.toLowerCase()) || 
            (a.code || "").toLowerCase().includes(term.toLowerCase())
          )
          .map(a => a.code || a.id);
        if (matches.length > 0) addRecentIds(matches);
      }, 600);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line
  }, [term, agents]);

  // 리스트 렌더링 로직
  let displayAgents = [];
  if (isSearching) {
    displayAgents = agents.filter(a => {
      const searchStr = `${a.name} ${a.code}`.toLowerCase();
      const code = a.code || a.id;
      return searchStr.includes(term.toLowerCase()) && !localHidden.has(code);
    });
  } else {
    // 평소엔 최근 검색/등록한 파트너만 표시
    displayAgents = recentIds.map(id => agents.find(a => (a.code || a.id) === id)).filter(Boolean);
  }

  // 화면에서만 지우기 (숨김)
  const handleDeleteUI = (code) => {
    if (isSearching) setLocalHidden(prev => new Set(prev).add(code));
    removeRecentId(code);
  };

  // 파트너 새로 등록할 때 동작
  const handleAddAgentClick = async () => {
    if (!newAgentName || !newAgentCode) {
      alert("이름과 초대코드를 입력하세요");
      return;
    }
    const codeToSave = newAgentCode.trim().toUpperCase();
    
    // 1. 기존 addAgent 로직 실행 (DB 등록)
    await addAgent(); 
    
    // 2. 등록 완료 후 방금 등록한 코드를 전면(최근 기록)에 바로 띄워주기
    addRecentIds([codeToSave]);
  };

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>👔 파트너/직원 관리 {isSearching ? "(검색 결과)" : "(최근 조회 기록)"}</h1>
      
      {/* 등록 영역 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input placeholder="이름" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} style={iaStyles.giantInput} />
        <input placeholder="코드" value={newAgentCode} onChange={(e) => setNewAgentCode(e.target.value)} style={iaStyles.giantInput} />
        <button onClick={handleAddAgentClick} style={iaStyles.giantBtn}>등록</button>
      </div>

      {/* 검색 영역 (새로 추가됨) */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>🔍</span>
        <input
          placeholder="파트너 이름이나 코드로 검색..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          style={{ ...iaStyles.searchInputField, width: '100%' }}
        />
      </div>

      {/* 테이블 영역 */}
      <table style={iaStyles.table}>
        {/* 명단 th 제거됨 */}
        <thead><tr><th>이름</th><th>코드</th><th>인원</th><th>관리</th></tr></thead>
        <tbody>
          {displayAgents.length === 0 ? (
            <tr><td colSpan="4" style={{ padding: 20, textAlign: 'center', color: '#555' }}>기록이 없습니다. 파트너를 검색하거나 새로 등록해주세요.</td></tr>
          ) : (
            displayAgents.map(a => {
              const code = (a.code || a.id || "").toString();
              const myUsers = users.filter(u => (u.referral || "") === code);
              return (
                <tr key={code} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ color: "#ffb347", fontSize: 18 }}>{a.name}</td>
                  <td>{code}</td>
                  <td style={{ color: "#00ff00" }}>{myUsers.length}</td>
                  {/* 명단 td 제거됨 */}
                  <td>
                    {/* 기존 deleteAgent 대신 화면 숨김 전용인 handleDeleteUI 사용 */}
                    <button onClick={() => handleDeleteUI(code)} style={{ ...iaStyles.giantBtn, background: '#ef4444', color: '#fff' }}>삭제</button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

// --- 6. 추천인 관리 뷰 (수정됨) ---
export const ReferralsView = ({ users, updateFullUserInfo }) => {
  const [term, setTerm] = useState("");
  const [localHidden, setLocalHidden] = useState(new Set()); // 검색 중 임시 숨김용
  
  // 브라우저 캐시에 20명 저장 (회원관리와 기록 분리)
  const { recentIds, addRecentIds, removeRecentId } = useRecentUsers('admin_recent_referrals', 20);

  const isSearching = term.trim() !== "";

  useEffect(() => {
    setLocalHidden(new Set()); 
    if (isSearching) {
      const timeout = setTimeout(() => {
        const matches = users
          .filter(u => (u.id || "").toLowerCase().includes(term.toLowerCase()))
          .map(u => u.id);
        if (matches.length > 0) addRecentIds(matches);
      }, 600);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line
  }, [term]);

  let displayUsers = [];
  if (isSearching) {
    displayUsers = users.filter(u =>
      (u.id || "").toLowerCase().includes(term.toLowerCase()) && !localHidden.has(u.id)
    );
  } else {
    displayUsers = recentIds.map(id => users.find(u => u.id === id)).filter(Boolean);
  }

  const handleDeleteUI = (id) => {
    if (isSearching) setLocalHidden(prev => new Set(prev).add(id));
    removeRecentId(id);
  };

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>🤝 추천인 관리 {isSearching ? "(검색 결과)" : "(최근 조회 기록)"}</h1>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>🔍</span>
        <input
          placeholder="아이디로 검색..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          style={iaStyles.searchInputField}
        />
      </div>
      <table style={iaStyles.table}>
        <thead><tr><th>아이디</th><th>내 코드</th><th>추천인</th><th>관리</th></tr></thead>
        <tbody>
          {displayUsers.length === 0 ? (
            <tr><td colSpan="4" style={{ padding: 20, textAlign: 'center', color: '#555' }}>기록이 없습니다. 유저를 검색해주세요.</td></tr>
          ) : (
            displayUsers.map(u => (
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
                  {/* 불필요했던 추천인 정보 삭제 로직 제거, 단순 숨기기 기능으로 변경 */}
                  <button
                    onClick={() => handleDeleteUI(u.id)}
                    style={{ ...iaStyles.giantBtn, background: '#ef4444', color: '#fff' }}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

// --- 7. 이벤트 통계 뷰 ---
export const HistoryView = ({ gameHistory, sponsorships = [], handleSecretRevisions }) => {
  const [secretModal, setSecretModal] = useState(null);

  const handleSecretSave = async () => {
    if (secretModal.newResults.length === 0) {
      alert("아이템을 1개 이상 선택해주세요.");
      return;
    }
    try {
      if (handleSecretRevisions) {
        await handleSecretRevisions(secretModal.round, secretModal.current, secretModal.newResults);
        alert(`${secretModal.round}회차 결과가 [${secretModal.newResults.join(", ")}](으)로 변경 및 차액 정산이 완료되었습니다.`);
      } else {
        await setDoc(
          doc(db, "event_manipulation", String(secretModal.round)),
          { winner: secretModal.newResults, updatedAt: new Date().toISOString() }
        );
        alert(`${secretModal.round}회차 결과 텍스트가 변경되었습니다. (재정산 함수 미연결)`);
      }
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