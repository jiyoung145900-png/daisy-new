import React, { useState } from "react";
import AvatarEditorModal from "./AvatarEditorModal";
import { myStyles } from "./MyPage.styles";
// ★ [수정] getCreditInfo 추가 임포트
import { getTierInfo, getAvatarUrl, avatarStyles, getCreditInfo } from "./MyPage.utils";

// ★ 로직 파일 임포트 (.js)
import { useMyPageLogic } from "./useMyPageLogic.js"; 

// ★ 뷰 파일 임포트 (.jsx) - TransactionHistoryView 추가됨
import { 
  PasswordView, DepositView, WithdrawView, HistoryView, SettingsView, TransactionHistoryView 
} from "./MyPageViews.jsx";

// ★ [수정완료] telegramLink 와 t 등 모든 인자(props)를 빠짐없이 받도록 세팅
export default function MyPage({ 
  user, 
  telegramLink, // <- Dashboard.jsx에서 넘어온 텔레그램 전체 링크
  onBack, 
  onLogout, 
  confirmedImage, 
  confirmedAvatarIdx, 
  onAvatarChange, 
  onUpdatePoint, 
  t,            // <- 빠지면 에러나는 번역 함수 (복구 완료)
  setActiveTab  // ★ [신규] 이벤트 참여 시 완전히 이벤트 탭으로 이동하기 위해
}) {
  const [view, setView] = useState("main");
  const isKo = t.home === "홈페이지";
  
  // ★ [수정] myDeposits, myWithdraws (내역 데이터) 받아오기 / 데일리 보너스 관련 값 제거
 const { 
    userInfo, myDeposits, myWithdraws,
    requestDeposit, requestWithdraw, updatePassword, updateAvatar 
  } = useMyPageLogic(user, onUpdatePoint, isKo);

  const [tempSelectedIdx, setTempSelectedIdx] = useState(confirmedAvatarIdx || 0);
  const [tempUploadedImg, setTempUploadedImg] = useState(confirmedImage || null);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);

  if (!userInfo) return <div style={myStyles.loading}>SECRET MEMBERSHIP...</div>;
  // ★ [수정] 다이아 보유량 기반 자동계산 대신, 관리자가 지정한 userInfo.tier 값을 그대로 사용
  const tier = getTierInfo(userInfo.tier);

  // ★ [신규] 신용점수 계산 - 관리자가 지정한 userInfo.creditScore 값 사용
  // 값이 없으면 기본값 100 (첫 가입자)
  const credit = getCreditInfo(userInfo.creditScore);

  // --- 화면 라우팅 ---
  if (view === "profile") return <PasswordView onBack={()=>setView("settings")} isKo={isKo} onSubmit={updatePassword} userInfo={userInfo} />;
  
  // ★ [수정] 입금 화면: 내역 버튼 누르면 'deposit_history'로 이동
  if (view === "deposit") return <DepositView onBack={()=>setView("main")} isKo={isKo} onSubmit={requestDeposit} onViewHistory={()=>setView("deposit_history")} />;
  
  // ★ [수정] 출금 화면: userInfo를 넘겨서 저장된 계좌 자동 불러오기 활성화
  if (view === "withdraw") return <WithdrawView onBack={()=>setView("main")} isKo={isKo} onSubmit={requestWithdraw} onViewHistory={()=>setView("withdraw_history")} userInfo={userInfo} />;
  
  // ★ [신규] 입금 신청 내역 화면 연결
  if (view === "deposit_history") return <TransactionHistoryView onBack={()=>setView("deposit")} isKo={isKo} title={isKo?"입금 신청 내역":"Deposit History"} data={myDeposits} />;
  
  // ★ [신규] 출금 신청 내역 화면 연결
  if (view === "withdraw_history") return <TransactionHistoryView onBack={()=>setView("withdraw")} isKo={isKo} title={isKo?"출금 신청 내역":"Withdraw History"} data={myWithdraws} />;

  if (view === "history") return <HistoryView onBack={()=>setView("main")} isKo={isKo} userId={userInfo.id} />;
if (view === "settings") return <SettingsView onBack={()=>setView("main")} isKo={isKo} onChangeView={setView} telegramLink={telegramLink} />;

  // --- 메인 대시보드 (기존 유지) ---
  return (
    <div style={myStyles.container}>
      <div style={myStyles.topBar}>
        <button onClick={onBack} style={myStyles.backBtn}>〈</button>
        <span style={myStyles.topTitle}>PRIVATE LOUNGE</span>
        <span onClick={() => setView("settings")} style={myStyles.settingsIcon}>⚙️</span>
      </div>
      
      <div style={myStyles.profileHeaderMain}>
        <div style={myStyles.profileInfoMain}>
          <div style={myStyles.avatarWrapper}>
            <div style={myStyles.avatarLarge}>
              {confirmedImage ? 
                <img src={confirmedImage} alt="profile" style={myStyles.imgFull} /> : 
                <img src={getAvatarUrl(confirmedAvatarIdx, userInfo.id)} alt="avatar" style={myStyles.imgFull} />
              }
            </div>
            <button style={myStyles.editBadgeOutside} onClick={() => setShowAvatarEditor(true)}>{isKo ? "변경" : "Edit"}</button>
          </div>
          <div style={myStyles.userTextMain}>
            <div style={myStyles.userIdMain}>
              {userInfo.name || userInfo.id}
              <span style={{...myStyles.vipBadge, background: tier.color, color:'#000'}}>{tier.name}</span>
            </div>

            {/* ★ [수정] 기존 UID 표시 제거 → 신용점수 + 진행바로 교체 */}
            <div style={myStyles.creditBox}>
              <div style={myStyles.creditTopRow}>
                <span style={myStyles.creditLabel}>
                  {isKo ? "신용점수" : "CREDIT SCORE"}
                </span>
                <div style={{display:'flex', alignItems:'center'}}>
                  <span style={{...myStyles.creditScoreText, color: credit.color}}>
                    {credit.score}
                  </span>
                  <span style={{
                    ...myStyles.creditRankText,
                    background: `${credit.color}22`,
                    color: credit.color,
                    border: `1px solid ${credit.color}55`,
                  }}>
                    {isKo ? credit.labelKo : credit.label}
                  </span>
                </div>
              </div>
              <div style={myStyles.creditBarOuter}>
                <div style={{
                  ...myStyles.creditBarInner,
                  width: `${credit.percent}%`,
                  background: `linear-gradient(to right, ${credit.color}88, ${credit.color})`,
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={myStyles.balanceCard}>
        <div style={myStyles.balanceItem}>
          <div style={myStyles.label}>{isKo ? "보유 다이아몬드" : "Diamonds"}</div>
          <div style={myStyles.value}>💎 {userInfo.diamond?.toLocaleString() ?? 0}</div>
        </div>
        <div style={myStyles.divider}></div>
        {/* ★ [수정] 데일리 보너스 버튼 자리를 빠른 출금 버튼으로 교체 - 기존 출금 로직/화면(WithdrawView) 그대로 재사용 */}
        <div style={{...myStyles.balanceItem, cursor: 'pointer'}} onClick={() => setView("withdraw")}>
          <div style={{...myStyles.label, color: '#D4AF37'}}>{isKo ? "빠른 출금" : "Quick Withdraw"}</div>
          <div style={myStyles.value}>🏦</div>
        </div>
      </div>

      <div style={myStyles.menuList}>
        {/* ★ [수정] setView 대신 setActiveTab으로 완전히 이벤트 탭으로 이동 (마이페이지 닫기) */}
        <div style={myStyles.goldMenu} onClick={() => setActiveTab && setActiveTab("event")}>
          <div style={myStyles.goldMenuContent}>
            <div style={myStyles.goldTag}>HOT</div>
            <span style={myStyles.goldMenuTitle}>{isKo ? "프라이빗 이벤트 참여" : "Join Event"}</span>
          </div>
          <span>❯</span>
        </div>
        <div style={myStyles.menuGroup}>
          <div style={myStyles.menuItem} onClick={() => setView("deposit")}>
            <span style={myStyles.menuTitle}>💰 &nbsp; {isKo ? "입금 신청" : "Deposit"}</span>
            <span style={myStyles.arrow}>❯</span>
          </div>
          <div style={myStyles.menuItem} onClick={() => setView("withdraw")}>
            <span style={myStyles.menuTitle}>🏦 &nbsp; {isKo ? "출금 신청" : "Withdraw"}</span>
            <span style={myStyles.arrow}>❯</span>
          </div>
          <div style={myStyles.menuItem} onClick={() => setView("history")}>
            <span style={myStyles.menuTitle}>📋 &nbsp; {isKo ? "이용 내역" : "History"}</span>
            <span style={myStyles.arrow}>❯</span>
          </div>
          {/* ★ [수정완료] App.jsx의 telegramLink가 전체 URL 형식이므로 그대로 띄우게 연결했습니다. */}
          <div style={myStyles.menuItem} onClick={() => window.open(telegramLink || 'https://t.me/BANADA_support', '_blank')}>
            <span style={myStyles.menuTitle}>💬 &nbsp; {isKo ? "1:1 실시간 상담" : "1:1 Support"}</span>
            <span style={myStyles.arrow}>❯</span>
          </div>
        </div>
        <button onClick={onLogout} style={{...myStyles.logoutBtnMain, marginTop: 40, border: '1px solid #444', color: '#ff4d4d', fontWeight: 'bold', letterSpacing: '2px'}}>{isKo ? "로그아웃" : "LOG OUT"}</button>
      </div>

      {showAvatarEditor && 
        <AvatarEditorModal 
          userId={userInfo.id} 
          tempSelectedIdx={tempSelectedIdx} 
          tempUploadedImg={tempUploadedImg} 
          setTempSelectedIdx={setTempSelectedIdx} 
          setTempUploadedImg={setTempUploadedImg} 
          onClose={() => setShowAvatarEditor(false)} 
          onApply={() => updateAvatar(tempUploadedImg, tempSelectedIdx, onAvatarChange).then(res => res && setShowAvatarEditor(false))} 
          onRandom={() => { setTempUploadedImg(null); setTempSelectedIdx(Math.floor(Math.random() * avatarStyles.length)); }} 
        />
      }
    </div>
  );
}