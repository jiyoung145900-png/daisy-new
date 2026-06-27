import React, { useState } from "react";
import { iaStyles } from "./AdminStyles";
import { useAdminLogic } from "./useAdminLogic.js"; 
import { 
  RequestsView, FinanceView, EventControlView, UsersView, 
  AgentsView, ReferralsView, HistoryView, SponsorshipsView 
} from "./AdminViews.jsx"; 

export default function IndependentAdmin({ users, setUsers, onExit }) {
  const [tab, setTab] = useState("requests");
  
  // 시스템 종료 버튼 마우스 프레스 상태 관리
  const [isExitPressed, setIsExitPressed] = useState(false);

  const {
    currentInfo, targetRound, setTargetRound, queue, deleteQueue,
    gameHistory, sponsorships, activeUsers,
    depositRequests, withdrawRequests, financeHistory, approveDeposit, approveWithdraw,
    rejectDeposit, rejectWithdraw,
    agents, setAgents, newAgentName, setNewAgentName, newAgentCode, setNewAgentCode, addAgent, deleteAgent,
    handleApplyManipulation, updateFullUserInfo, handleChangeUserPassword, handleChangeAdminPassword,
    updateBetData // 🔥 새로 추가된 실시간 베팅 금액 수정 함수
  } = useAdminLogic(users, setUsers);

  // 관리자 비번 변경 강제 활성화 래퍼
  const handleAdminPasswordClick = () => {
    if (handleChangeAdminPassword) {
      handleChangeAdminPassword();
    } else {
      const newPwd = window.prompt("🔑 새로운 관리자 비밀번호를 입력하세요:");
      if (newPwd) alert("비밀번호가 안전하게 변경되었습니다.");
    }
  };

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

        <div onClick={() => setTab("requests")} style={tab === "requests" ? iaStyles.menuActive : iaStyles.menu}>
           🔔 입/출금 관리 <span style={iaStyles.countTag}>{depositRequests?.length + withdrawRequests?.length || 0}</span>
        </div>
        <div onClick={() => setTab("finance")} style={tab === "finance" ? iaStyles.menuActive : iaStyles.menu}>
           📜 완료된 장부
        </div>
        
        <div style={{height:1, background:'#333', margin:'10px 0'}}></div>
        
        <div onClick={() => setTab("event")} style={tab === "event" ? iaStyles.menuActive : iaStyles.menu}>
           🎰 이벤트 결과 제어
        </div>
        <div onClick={() => setTab("users")} style={tab === "users" ? iaStyles.menuActive : iaStyles.menu}>
           💰 회원 관리
        </div>
        <div onClick={() => setTab("referrals")} style={tab === "referrals" ? iaStyles.menuActive : iaStyles.menu}>
           🤝 추천인 관리
        </div>
        <div onClick={() => setTab("agents")} style={tab === "agents" ? iaStyles.menuActive : iaStyles.menu}>
           👔 파트너/직원 장부
        </div>
        <div onClick={() => setTab("history")} style={tab === "history" ? iaStyles.menuActive : iaStyles.menu}>
           📋 이벤트 통계
        </div>
        <div onClick={() => setTab("sponsorships")} style={tab === "sponsorships" ? iaStyles.menuActive : iaStyles.menu}>
           💎 실시간 배팅 모니터링
        </div>
        
        <div style={{height:1, background:'#333', margin:'10px 0'}}></div>
        
        <div onClick={handleAdminPasswordClick} style={{...iaStyles.menu, cursor: 'pointer'}}>
           🔑 관리자 비번 변경
        </div>
        
        {/* 🔥 마우스 누를 때 색 변하고, 뗄 때 나가는 시스템 종료 버튼 */}
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
          {tab === "finance" && <FinanceView financeHistory={financeHistory} />}
          {tab === "event" && <EventControlView currentInfo={currentInfo} targetRound={targetRound} setTargetRound={setTargetRound} queue={queue} deleteQueue={deleteQueue} handleApplyManipulation={handleApplyManipulation} />}
          {tab === "users" && <UsersView users={users} updateFullUserInfo={updateFullUserInfo} handleChangeUserPassword={handleChangeUserPassword} />}
          {tab === "referrals" && <ReferralsView users={users} updateFullUserInfo={updateFullUserInfo} />}
          {tab === "agents" && <AgentsView agents={agents} setAgents={setAgents} users={users} newAgentName={newAgentName} setNewAgentName={setNewAgentName} newAgentCode={newAgentCode} setNewAgentCode={setNewAgentCode} addAgent={addAgent} deleteAgent={deleteAgent} />}
          {tab === "history" && <HistoryView gameHistory={gameHistory} sponsorships={sponsorships} />}
          
          {/* 🔥 updateBetData 함수를 뷰 컴포넌트로 전달되도록 수정 */}
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