import React, { useState, useMemo, useEffect } from "react";
import { myStyles } from "./MyPage.styles";

// ★ [신규] 스피너 CSS - MyPageViews 전체에서 재사용
const SpinnerStyle = () => (
  <style>{`
    @keyframes mp-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .mp-spinner {
      width: 16px;
      height: 16px;
      border: 3px solid rgba(0,0,0,0.15);
      border-top: 3px solid #000;
      border-radius: 50%;
      animation: mp-spin 0.7s linear infinite;
      display: inline-block;
    }
  `}</style>
);

// 공통 헤더 컴포넌트
const SubHeader = ({ title, onBack }) => (
  <div style={myStyles.subHeader}>
    <button onClick={onBack} style={myStyles.backBtn}>〈</button>
    <span style={myStyles.subTitle}>{title}</span>
    <div style={{width: 30}}></div>
  </div>
);

// --- 1. 비밀번호 변경 화면 (이전 비밀번호 필드 제거) ---
export const PasswordView = ({ onBack, isKo, onSubmit, userInfo }) => {
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const handleSave = async () => {
    const success = await onSubmit(newPw, confirmPw);
    if (success) onBack();
  };

  return (
    <div style={myStyles.container}>
      <SubHeader title={isKo ? "비밀번호 변경" : "Change Password"} onBack={onBack} />
      <div style={myStyles.formArea}>
        <div style={myStyles.inputGroup}><label style={myStyles.inputLabel}>ID</label>
          <input style={myStyles.inputDisabled} value={userInfo.id} disabled />
        </div>
        <div style={{height: 20}} />
        <div style={myStyles.inputGroup}><label style={myStyles.inputLabel}>{isKo ? "새 비밀번호" : "New Password"}</label>
          <input type="password" style={myStyles.input} value={newPw} onChange={(e)=>setNewPw(e.target.value)} />
        </div>
        <div style={myStyles.inputGroup}><label style={myStyles.inputLabel}>{isKo ? "확인" : "Confirm"}</label>
          <input type="password" style={myStyles.input} value={confirmPw} onChange={(e)=>setConfirmPw(e.target.value)} />
        </div>
        <button style={myStyles.saveBtn} onClick={handleSave}>{isKo ? "저장" : "Save"}</button>
      </div>
    </div>
  );
};

// --- 2. PIN 설정 화면 완전 삭제 ---
// (PinView 컴포넌트 제거됨)

// --- 3. 입금 화면 (기존 유지) ---
export const DepositView = ({ onBack, isKo, onSubmit, onViewHistory }) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); // ★ [신규] 신청 처리 중

  const handleReq = async () => {
    if (isSubmitting) return; // 중복 클릭 방지
    setIsSubmitting(true);
    try {
      const success = await onSubmit(name, amount);
      if(success) onBack();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={myStyles.container}>
      <SpinnerStyle />
      <SubHeader title={isKo ? "입금 신청" : "Deposit"} onBack={onBack} />
      <div style={myStyles.formArea}>
        <div style={{display:'flex', justifyContent:'flex-end', marginBottom:20}}>
            <button onClick={onViewHistory} style={{background:'#222', color:'#aaa', border:'1px solid #444', padding:'8px 12px', borderRadius:8, fontSize:13, cursor:'pointer'}}>
                📄 {isKo ? "나의 입금 신청 내역" : "My History"}
            </button>
        </div>

        <div style={myStyles.inputGroup}><label style={myStyles.inputLabel}>{isKo ? "입금자명" : "Name"}</label>
          <input style={myStyles.input} value={name} onChange={(e)=>setName(e.target.value)} disabled={isSubmitting} />
        </div>
        {/* ★ [신규] 금액 입력 + 보유 다이아 실시간 표시 + 전액 버튼 */}
        <div style={myStyles.inputGroup}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingLeft:5}}>
            <label style={{...myStyles.inputLabel, marginBottom:0}}>{isKo ? "금액" : "Amount"}</label>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{fontSize:12, color:'#D4AF37', fontWeight:600}}>
                💎 {(userInfo?.diamond || 0).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => setAmount(String(userInfo?.diamond || 0))}
                disabled={isSubmitting || !userInfo?.diamond}
                style={{
                  background:'transparent',
                  border:'1px solid #D4AF37',
                  color:'#D4AF37',
                  padding:'3px 10px',
                  borderRadius:6,
                  fontSize:11,
                  cursor: (isSubmitting || !userInfo?.diamond) ? 'not-allowed' : 'pointer',
                  fontWeight:700,
                  letterSpacing:1,
                  opacity: (isSubmitting || !userInfo?.diamond) ? 0.4 : 1,
                }}
              >
                {isKo ? "전액" : "MAX"}
              </button>
            </div>
          </div>
          <input
            type="number"
            style={myStyles.input}
            value={amount}
            onChange={(e)=>setAmount(e.target.value)}
            disabled={isSubmitting}
            placeholder={isKo ? "출금할 금액 입력" : "Enter amount"}
          />
          {amount && Number(amount) > (userInfo?.diamond || 0) && (
            <div style={{color:'#ef4444', fontSize:11, marginTop:6, paddingLeft:5, fontWeight:600}}>
              ⚠️ {isKo ? "보유 다이아를 초과했습니다" : "Exceeds your balance"}
            </div>
          )}
        </div>
        <button 
          style={{
            ...myStyles.saveBtn,
            opacity: isSubmitting ? 0.6 : 1,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }} 
          onClick={handleReq}
          disabled={isSubmitting}
        >
          {isSubmitting && <span className="mp-spinner" />}
          {isSubmitting 
            ? (isKo ? "신청 중..." : "Submitting...")
            : (isKo ? "신청하기" : "Request")}
        </button>
      </div>
    </div>
  );
};

// --- 4. 출금 화면 (PIN 필드 삭제) ---
export const WithdrawView = ({ onBack, isKo, onSubmit, onViewHistory, userInfo }) => {
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [holder, setHolder] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); // ★ [신규] 신청 처리 중

  const hasSavedBankInfo = !!(userInfo?.savedBankInfo?.bank);

  useEffect(() => {
    const saved = userInfo?.savedBankInfo;
    if (saved) {
      if (saved.bank) setBank(saved.bank);
      if (saved.account) setAccount(saved.account);
      if (saved.holder) setHolder(saved.holder);
    }
  }, [userInfo?.savedBankInfo]);

  const handleClearBank = () => {
    setBank("");
    setAccount("");
    setHolder("");
  };

  const handleReq = async () => {
    if (isSubmitting) return; // 중복 클릭 방지
    setIsSubmitting(true);
    try {
      const success = await onSubmit(amount, { bank, account, holder });
      if(success) onBack();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={myStyles.container}>
      <SpinnerStyle />
      <SubHeader title={isKo ? "출금 신청" : "Withdraw"} onBack={onBack} />
      <div style={myStyles.formArea}>
        <div style={{display:'flex', justifyContent:'flex-end', marginBottom:20}}>
            <button onClick={onViewHistory} style={{background:'#222', color:'#aaa', border:'1px solid #444', padding:'8px 12px', borderRadius:8, fontSize:13, cursor:'pointer'}}>
                📄 {isKo ? "나의 출금 신청 내역" : "My History"}
            </button>
        </div>

        {/* ★ [신규] 금액 입력 + 보유 다이아 실시간 표시 + 전액 버튼 */}
        <div style={myStyles.inputGroup}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingLeft:5}}>
            <label style={{...myStyles.inputLabel, marginBottom:0}}>{isKo ? "금액" : "Amount"}</label>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{fontSize:12, color:'#D4AF37', fontWeight:600}}>
                💎 {(userInfo?.diamond || 0).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => setAmount(String(userInfo?.diamond || 0))}
                disabled={isSubmitting || !userInfo?.diamond}
                style={{
                  background:'transparent',
                  border:'1px solid #D4AF37',
                  color:'#D4AF37',
                  padding:'3px 10px',
                  borderRadius:6,
                  fontSize:11,
                  cursor: (isSubmitting || !userInfo?.diamond) ? 'not-allowed' : 'pointer',
                  fontWeight:700,
                  letterSpacing:1,
                  opacity: (isSubmitting || !userInfo?.diamond) ? 0.4 : 1,
                }}
              >
                {isKo ? "전액" : "MAX"}
              </button>
            </div>
          </div>
          <input
            type="number"
            style={myStyles.input}
            value={amount}
            onChange={(e)=>setAmount(e.target.value)}
            disabled={isSubmitting}
            placeholder={isKo ? "출금할 금액 입력" : "Enter amount"}
          />
          {amount && Number(amount) > (userInfo?.diamond || 0) && (
            <div style={{color:'#ef4444', fontSize:11, marginTop:6, paddingLeft:5, fontWeight:600}}>
              ⚠️ {isKo ? "보유 다이아를 초과했습니다" : "Exceeds your balance"}
            </div>
          )}
        </div>

        <div style={myStyles.inputGroup}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, paddingLeft:5}}>
            <label style={{...myStyles.inputLabel, marginBottom:0}}>{isKo ? "은행 정보" : "Bank Info"}</label>
            {hasSavedBankInfo && (
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{fontSize:11, color:'#4cd137', fontWeight:'700'}}>
                  ✓ {isKo ? "저장된 계좌 불러옴" : "Auto-filled"}
                </span>
                <button
                  type="button"
                  onClick={handleClearBank}
                  disabled={isSubmitting}
                  style={{background:'transparent', border:'1px solid #444', color:'#888', padding:'3px 8px', borderRadius:6, fontSize:11, cursor:'pointer'}}
                >
                  {isKo ? "다시 입력" : "Clear"}
                </button>
              </div>
            )}
          </div>
          <input style={{...myStyles.input, marginBottom:5}} placeholder={isKo ? "은행명" : "Bank Name"} value={bank} onChange={(e)=>setBank(e.target.value)} disabled={isSubmitting}/>
          <input style={{...myStyles.input, marginBottom:5}} placeholder={isKo ? "계좌번호" : "Account No"} value={account} onChange={(e)=>setAccount(e.target.value)} disabled={isSubmitting}/>
          <input style={myStyles.input} placeholder={isKo ? "예금주" : "Holder"} value={holder} onChange={(e)=>setHolder(e.target.value)} disabled={isSubmitting}/>
        </div>

        {/* ★ [수정] 잔액 초과 or 0 이하 시 신청 버튼 자동 비활성화 */}
        <button 
          style={{
            ...myStyles.saveBtn, 
            background:'#D4AF37', 
            color:'#000',
            opacity: (isSubmitting || !amount || Number(amount) <= 0 || Number(amount) > (userInfo?.diamond || 0)) ? 0.4 : 1,
            cursor: (isSubmitting || !amount || Number(amount) <= 0 || Number(amount) > (userInfo?.diamond || 0)) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }} 
          onClick={handleReq}
          disabled={isSubmitting || !amount || Number(amount) <= 0 || Number(amount) > (userInfo?.diamond || 0)}
        >
          {isSubmitting && <span className="mp-spinner" />}
          {isSubmitting
            ? (isKo ? "신청 중..." : "Submitting...")
            : (isKo ? "신청하기" : "Request")}
        </button>
      </div>
    </div>
  );
};

// --- 5. 입/출금 신청 내역 화면 (기존 유지) ---
export const TransactionHistoryView = ({ onBack, isKo, title, data }) => {
    return (
      <div style={myStyles.container}>
        <SubHeader title={title} onBack={onBack} />
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {data.length === 0 ? <div style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>{isKo ? "내역이 없습니다." : "No records."}</div> :
            data.map((h, i) => {
              const isDone = h.status === '완료';
              const isRejected = h.status === '거절';
              const statusColor = isRejected ? '#ef4444' : isDone ? '#4cd137' : '#fbc531';
              const statusBg = isRejected ? 'rgba(239, 68, 68, 0.1)' : isDone ? 'rgba(76, 209, 55, 0.1)' : 'rgba(251, 197, 49, 0.1)';
              const statusText = isRejected ? (isKo ? '거절됨' : 'Rejected') : isDone ? (isKo ? '처리완료' : 'Done') : (isKo ? '심사중' : 'Pending');

              const hasApproveReason = isDone && h.approveReason && h.approveReason.trim() !== "";

              return (
                <div key={i} style={{ background: '#1a1a1a', padding: '20px', borderRadius: '15px', marginBottom: '15px', border: isRejected ? '1px solid rgba(239,68,68,0.4)' : '1px solid #333' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                        <div style={{color: '#888', fontSize: '12px', marginBottom: '5px'}}>
                            {new Date(h.timestamp || h.completedAt).toLocaleString()}
                        </div>
                        <div style={{color: '#fff', fontSize: '18px', fontWeight:'bold'}}>
                            {h.amount?.toLocaleString()} DIA
                        </div>
                        <div style={{color: '#666', fontSize:'13px', marginTop:4}}>
                            {h.depositName ? (isKo ? `입금자: ${h.depositName}` : `Name: ${h.depositName}`) : 
                             (h.bankInfo ? `${h.bankInfo.bank} ${h.bankInfo.holder}` : '')}
                        </div>
                    </div>
                    <div style={{
                        padding: '6px 12px', borderRadius:'8px', fontSize:'13px', fontWeight:'bold',
                        background: statusBg, color: statusColor, border: `1px solid ${statusColor}`
                    }}>
                        {statusText}
                    </div>
                  </div>

                  {hasApproveReason && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(76, 209, 55, 0.2)' }}>
                      <div style={{ color: '#4cd137', fontSize: '11px', fontWeight: 'bold', marginBottom: 4 }}>
                        {isKo ? '✓ 승인 사유' : '✓ Approval Note'}
                      </div>
                      <div style={{ color: '#ccc', fontSize: '13px', lineHeight: 1.5 }}>
                        {h.approveReason}
                      </div>
                    </div>
                  )}

                  {isRejected && h.rejectReason && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(239,68,68,0.2)' }}>
                      <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 'bold', marginBottom: 4 }}>
                        {isKo ? '거절 사유' : 'Rejection Reason'}
                      </div>
                      <div style={{ color: '#ccc', fontSize: '13px', lineHeight: 1.5 }}>
                        {h.rejectReason}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    );
};

// --- 6. 게임 이용 내역 화면 (기존 유지) ---
// --- 6. 게임 이용 내역 화면 (기존 유지) ---
// ★ ITEM_CONFIG import 추가 - 아이템 이름으로 이미지 URL 찾아서 표시
import { ITEM_CONFIG } from "./EventService";

// 아이템 이름을 아이콘+텍스트로 렌더링하는 헬퍼
const HistoryItemDisplay = ({ name, isKo, size = 18 }) => {
  const item = ITEM_CONFIG.find(it => it.name === name);
  if (!item) return <span>{name}</span>;
  const displayName = isKo ? item.name : item.nameEn;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
      {item.isImage ? (
        <img src={item.icon} alt={displayName} style={{ width: size, height: size, objectFit: 'contain' }} />
      ) : (
        <span style={{ fontSize: size }}>{item.icon}</span>
      )}
      <span>{displayName}</span>
    </span>
  );
};

export const HistoryView = ({ onBack, isKo, userId, myBetHistory }) => {
  const donationHistory = useMemo(() => {
    if (Array.isArray(myBetHistory)) return myBetHistory;
    if (!userId) return [];
    const saved = localStorage.getItem(`event_my_history_${userId}`);
    return saved ? JSON.parse(saved) : [];
  }, [userId, myBetHistory]);

  return (
    <div style={myStyles.container}>
      <SubHeader title={isKo ? "이용 내역" : "History"} onBack={onBack} />
      <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {donationHistory.length === 0 ? <div style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>{isKo ? "내역이 없습니다." : "No records."}</div> :
          donationHistory.map((h, i) => (
            <div key={i} style={{ background: '#1a1a1a', padding: '15px', borderRadius: '10px', marginBottom: '10px', border: '1px solid #333' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '11px', marginBottom: '5px' }}>
                <span>{h.round}{isKo ? "회차" : "R"}</span>
                <span>{h.date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {h.selected?.map((name, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <span style={{ color: '#666' }}>,</span>}
                      <HistoryItemDisplay name={name} isKo={isKo} />
                    </React.Fragment>
                  ))}
                </span>
                <span style={{ color: h.earn > 0 ? '#4cd137' : '#e84118', fontWeight: 'bold' }}>
                  {h.earn > 0 
                    ? `+${(h.earn - h.cost).toLocaleString()}` 
                    : `-${h.cost.toLocaleString()}`}
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

// --- 7. 설정 메뉴 화면 (재구성) ---
// ★ 결제 PIN 삭제, 1:1 실시간 상담 추가
export const SettingsView = ({ onBack, isKo, onChangeView, telegramLink }) => (
  <div style={myStyles.container}>
    <SubHeader title={isKo ? "시스템 설정" : "Settings"} onBack={onBack} />
    <div style={myStyles.settingList}>
      <div style={myStyles.settingItem} onClick={() => onChangeView("profile")}>
        <span style={myStyles.settingText}>{isKo ? "로그인 비밀번호 변경" : "Change Password"}</span><span style={myStyles.arrow}>❯</span>
      </div>
      <div style={myStyles.settingItem} onClick={() => window.open(telegramLink || 'https://t.me/BANADA_support', '_blank')}>
        <span style={myStyles.settingText}>{isKo ? "1:1 실시간 상담" : "1:1 Support"}</span><span style={myStyles.arrow}>❯</span>
      </div>
    </div>
  </div>
);