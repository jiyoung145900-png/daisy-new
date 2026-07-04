import React, { useState, useMemo } from "react";
import { iaStyles } from "./AdminStyles";
import { useAdminLogic } from "./useAdminLogic.js"; 
import { doc, updateDoc } from "firebase/firestore"; 
import { db } from "./firebase"; 
import { 
  RequestsView, EventControlView, UsersView, 
  AgentsView, ReferralsView, HistoryView, SponsorshipsView,
  UserDetailView   // ★ [신규] 회원 상세 페이지
} from "./AdminViews.jsx";

export default function IndependentAdmin({ users, setUsers, onExit }) {
  const [tab, setTab] = useState("requests");
  
  const [isExitPressed, setIsExitPressed] = useState(false);

  // ★ [신규] 회원 상세 페이지에서 조회 중인 회원 ID
  //   - null이면 회원 목록(UsersView) 표시
  //   - 특정 ID이면 UserDetailView 표시
  const [selectedUserId, setSelectedUserId] = useState(null);

  const handleHideUser = async (userId) => {
    if (!window.confirm("이 유저를 목록에서 숨기시겠습니까?")) return;
    try {
      await updateDoc(doc(db, "users", userId), { hidden: true });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, hidden: true } : u));
      alert("숨김 처리되었습니다.");
    } catch (e) {
      alert("숨김 실패: " + e.message);
    }
  };

  const {
    currentInfo, targetRound, setTargetRound, queue, deleteQueue,
    gameHistory, sponsorships, activeUsers,
    depositRequests, withdrawRequests, financeHistory, approveDeposit, approveWithdraw,
    rejectDeposit, rejectWithdraw,
    agents, setAgents, newAgentName, setNewAgentName, newAgentCode, setNewAgentCode, addAgent, deleteAgent,
    handleApplyManipulation, updateFullUserInfo, updateUserTier,
    updateUserCreditScore,
    // ★ [신규] 3개 함수 받기
    updateUserBankInfo,
    deleteUserBankInfo,
    deleteFinanceHistoryItem,
    handleChangeUserPassword, handleChangeAdminPassword,
    updateBetData, 
    handleSecretRevisions 
  } = useAdminLogic(users, setUsers);

  const handleAdminPasswordClick = () => {
    if (handleChangeAdminPassword) {
      handleChangeAdminPassword();
    } else {
      const newPwd = window.prompt("🔑 새로운 관리자 비밀번호를 입력하세요:");
      if (newPwd) alert("비밀번호가 안전하게 변경되었습니다.");
    }
  };

  // ★ [신규] 사이드바 탭 클릭 시 상세 페이지 자동 종료
  const handleTabChange = (newTab) => {
    setSelectedUserId(null); // 다른 메뉴 이동 시 상세 페이지 리셋
    setTab(newTab);
  };

  // ★ [신규] 상세 페이지 대상 회원 찾기
  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return users.find(u => u.id === selectedUserId) || null;
  }, [selectedUserId, users]);

  return (
    <div style={iaStyles.container}>
      <aside style={iaStyles.sidebar}>
        <div style={{color: '#888', fontSize: '11px', textAlign: 'center', marginBottom: '15px'}}>
            운영시간: 12:00 PM - 12:00 AM
        </div>

        <div style={iaStyles.onlineBadge}>
           <div style={{color:'#888', fontSize:13, marginBottom:5}}>NOW ONLINE</div>
           <div style={{color:'#00ff00', fontSize:22, fontWeight:'bold'}}>● {activeUsers?.length || 0}명</div>
        </div>

        {/* 입/출금 관리(심사중) - 유지 */}
        <div onClick={() => handleTabChange("requests")} style={tab === "requests" ? iaStyles.menuActive : iaStyles.menu}>
           🔔 입/출금 관리 <span style={iaStyles.countTag}>{depositRequests?.length + withdrawRequests?.length || 0}</span>
        </div>

        {/* ❌ [제거] "📜 완료된 장부" 메뉴 → 회원 관리 상세 페이지로 통합 */}

        <div style={{height:1, background:'#333', margin:'10px 0'}}></div>
        
        <div onClick={() => handleTabChange("event")} style={tab === "event" ? iaStyles.menuActive : iaStyles.menu}>
           🎰 이벤트 결과 제어
        </div>
        <div onClick={() => handleTabChange("users")} style={tab === "users" ? iaStyles.menuActive : iaStyles.menu}>
           💰 회원 관리
        </div>

        {/* ❌ [제거] "🏦 회원 계좌 관리" 메뉴 → 회원 관리 상세 페이지로 통합 */}

        <div onClick={() => handleTabChange("referrals")} style={tab === "referrals" ? iaStyles.menuActive : iaStyles.menu}>
           🤝 추천인 관리
        </div>
        <div onClick={() => handleTabChange("agents")} style={tab === "agents" ? iaStyles.menuActive : iaStyles.menu}>
           👔 파트너/직원 장부
        </div>
        <div onClick={() => handleTabChange("history")} style={tab === "history" ? iaStyles.menuActive : iaStyles.menu}>
           📋 이벤트 통계
        </div>
        <div onClick={() => handleTabChange("sponsorships")} style={tab === "sponsorships" ? iaStyles.menuActive : iaStyles.menu}>
           💎 실시간 배팅 모니터링
        </div>
        
        <div style={{height:1, background:'#333', margin:'10px 0'}}></div>
        
        <div onClick={handleAdminPasswordClick} style={{...iaStyles.menu, cursor: 'pointer'}}>
           🔑 관리자 비번 변경
        </div>
        
        <div style={{marginTop: 'auto', paddingTop: 20}}>
            <button 
              onMouseDown={() => setIsExitPressed(true)}
              onMouseUp={() => { setIsExitPressed(false); onExit(); }}
              onMouseLeave={() => setIsExitPressed(false)}
              style={{
                ...iaStyles.exitBtn, 
                background: isExitPressed ? '#ff3b30' : '#222',
                color: isExitPressed ? '#fff' : '#ff3b30',
                transition: 'all 0.1s ease-in-out'
              }}
            >
              시스템 종료
            </button>
        </div>
      </aside>

      <main style={{...iaStyles.main, display: 'flex', flexDirection: 'column', padding: 0}}>
        <header style={localHeaderStyles.header}>
          <div style={localHeaderStyles.roundInfo}>
            <span style={localHeaderStyles.liveIndicator}>LIVE</span>
            현재 진행중: <strong style={{color:'#fff'}}>{currentInfo?.round || currentInfo?.currentRound || '대기중'} 회차</strong>
          </div>
          <div style={localHeaderStyles.timerBlock}>
            추첨까지 남은 시간: <strong style={{color: (currentInfo?.timeLeft <= 5) ? '#ff3b30' : '#ffb347'}}>
              {currentInfo?.timeLeft || 0}초
            </strong>
            {currentInfo?.timeLeft <= 5 && <span style={localHeaderStyles.warning}> (결과 제어 Lock 진입)</span>}
          </div>
        </header>

        <div style={{flex: 1, overflowY: 'auto', padding: '20px'}}>
          {tab === "requests" && <RequestsView depositRequests={depositRequests} withdrawRequests={withdrawRequests} approveDeposit={approveDeposit} approveWithdraw={approveWithdraw} rejectDeposit={rejectDeposit} rejectWithdraw={rejectWithdraw} />}
          
          {/* ❌ [제거] finance 탭 - 완료된 장부는 상세 페이지로 이동 */}
          
          {tab === "event" && (
            <EventControlView 
              currentInfo={currentInfo} 
              targetRound={targetRound} 
              setTargetRound={setTargetRound} 
              queue={queue} 
              deleteQueue={deleteQueue} 
              handleApplyManipulation={handleApplyManipulation} 
              handleSecretRevisions={handleSecretRevisions} 
              gameHistory={gameHistory} 
            />
          )}

          {/* ★ [핵심 라우팅] 회원 관리 - selectedUserId 유무에 따라 목록 or 상세 */}
          {tab === "users" && (
            selectedUserId && selectedUser ? (
              <UserDetailView 
                user={selectedUser}
                allUsers={users}
                onBack={() => setSelectedUserId(null)}
                updateFullUserInfo={updateFullUserInfo}
                updateUserTier={updateUserTier}
                updateUserCreditScore={updateUserCreditScore}
                handleChangeUserPassword={handleChangeUserPassword}
                updateUserBankInfo={updateUserBankInfo}
                deleteUserBankInfo={deleteUserBankInfo}
                deleteFinanceHistoryItem={deleteFinanceHistoryItem}
              />
            ) : (
              <UsersView 
                users={users} 
                onSelectUser={(userId) => setSelectedUserId(userId)}
              />
            )
          )}

          {/* ❌ [제거] accounts 탭 - 회원 계좌 관리는 상세 페이지로 이동 */}

          {tab === "referrals" && (
            <ReferralsView users={users} agents={agents} />
          )}

          {tab === "agents" && <AgentsView agents={agents} setAgents={setAgents} users={users} newAgentName={newAgentName} setNewAgentName={setNewAgentName} newAgentCode={newAgentCode} setNewAgentCode={setNewAgentCode} addAgent={addAgent} deleteAgent={deleteAgent} />}
          {tab === "history" && <HistoryView gameHistory={gameHistory} sponsorships={sponsorships} handleSecretRevisions={handleSecretRevisions} />}
          {tab === "sponsorships" && <SponsorshipsView sponsorships={sponsorships} currentInfo={currentInfo} updateBetData={updateBetData} />}
        </div>
      </main>
    </div>
  );
}

const localHeaderStyles = {
  header: { background: '#121212', padding: '15px 25px', borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  roundInfo: { fontSize: '16px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '10px' },
  liveIndicator: { background: '#ff3b30', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
  timerBlock: { fontSize: '16px', color: '#aaa' },
  warning: { color: '#ff3b30', fontSize: '13px', fontWeight: 'bold' }
};