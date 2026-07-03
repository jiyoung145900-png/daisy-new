import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useEventEngine, allItems } from "./useEventEngine"; 
import { EventBanner, ImpactBurst } from "./EventComponents";
import { db } from "./firebase"; 
// ★ [수정] updateDoc 추가 - handleDonate에서 배팅 즉시 Firestore 잔액 차감용
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
// 아바타 스타일 통합 소스에서 가져오기 (MyPage와 동일한 스타일 사용)
import { avatarStyles, getAvatarUrl } from "./MyPage.utils";

export default function EventSection({ user, userPoint = 0, confirmedImage, confirmedAvatarIdx, onBack, onUpdatePoint, t }) {
  const pointControls = useAnimation();
  const [displayPoint, setDisplayPoint] = useState(userPoint);
  const scrollRef = useRef(null); 

  const isKo = t && t.home === "홈페이지";

  const getLocalizedText = (inputName) => {
    if (!inputName) return "";
    const parts = inputName.split(" ");
    let pureName = inputName;
    let icon = "";
    if (parts.length > 1 && isNaN(parts[0])) {
      icon = parts[0] + " ";
      pureName = parts[1];
    }
    const targetItem = allItems.find(item => item.name === pureName);
    if (targetItem) {
      const localizedName = isKo ? targetItem.name : targetItem.nameEn;
      return icon + localizedName;
    }
    return inputName;
  };

  // ★ [수정] syncDiamondToFirestore 추가 - useEventEngine에서 제공하는 Firestore 실시간 동기화 함수
  const { 
    round, timeLeft, totalHistory, myHistory, myPendingBet, setMyPendingBet, 
    isDrawing, drawingItems, showResult, setShowResult, liveNoti, stats, impactTick, updatePointWithAnim,
    syncDiamondToFirestore
  } = useEventEngine(user, userPoint, onUpdatePoint, pointControls);

  const [selectedItems, setSelectedItems] = useState([]);
  const [betAmount, setBetAmount] = useState("");
  const [activeTab, setActiveTab] = useState("mine");

  useEffect(() => { setDisplayPoint(userPoint); }, [userPoint]);

  useEffect(() => {
    const handlePointUpdate = (e) => {
      if (user && e.detail && e.detail.userId === user.id) {
        setDisplayPoint(e.detail.point);
        updatePointWithAnim(e.detail.point);
      }
    };
    window.addEventListener("user_point_update", handlePointUpdate);
    return () => window.removeEventListener("user_point_update", handlePointUpdate);
  }, [user, updatePointWithAnim]);

  const currentAvatarUrl = useMemo(() => {
    if (confirmedImage) return confirmedImage;
    return getAvatarUrl(confirmedAvatarIdx || 0, user?.id);
  }, [confirmedImage, confirmedAvatarIdx, user?.id]);

  // ★ [삭제] handleCancelBet 함수 완전 제거
  //   - 사용자 요청: 베팅 후 취소 불가 (한 번 걸면 결과까지 진행)
  //   - deleteDoc 임포트도 함께 제거

  // ★ [수정] handleDonate - 배팅 즉시 Firestore users/{id}.diamond를 차감하여
  //   마이페이지/관리자 페이지 등 다른 화면에도 실시간 반영되도록 함
  const handleDonate = async () => {
    const perAmount = parseInt(betAmount);
    const totalCost = perAmount * selectedItems.length;
    if (selectedItems.length === 0) return alert(isKo ? "아이템을 선택해주세요." : "Please select items.");
    if (!perAmount || perAmount <= 0) return alert(isKo ? "금액을 입력해주세요." : "Please enter amount.");
    if (totalCost > displayPoint) return alert(isKo ? "보유 다이아를 확인해주세요." : "Check your diamond balance.");

    const newPoint = displayPoint - totalCost;
    setDisplayPoint(newPoint); 
    updatePointWithAnim(newPoint); 

    try {
      // ★ [신규] 배팅 즉시 Firestore 잔액 차감 - 다른 페이지 실시간 sync용
      if (user?.id) {
        await updateDoc(doc(db, "users", user.id), { diamond: newPoint });
      }

      const docRef = await addDoc(collection(db, "event_bets"), {
        round: round, userId: user.id, betAmount: totalCost, items: [...selectedItems], win: null, timestamp: new Date().toISOString()
      });
      setMyPendingBet({ round: round, items: [...selectedItems], perAmount, totalCost, docId: docRef.id });
    } catch (e) { 
      console.error("서버 기록 실패:", e); 
      alert(isKo ? "베팅 처리 중 오류가 발생했습니다." : "Error processing bet.");
      // 실패 시 UI 롤백
      setDisplayPoint(displayPoint);
      updatePointWithAnim(displayPoint);
    }

    setSelectedItems([]);
    setBetAmount("");
  };

  const currentTotalCost = (parseInt(betAmount) || 0) * (selectedItems.length || 0);

  return (
    <div style={localDs.screenContainer}>
      
      {/* 1. 상단 헤더 */}
      <div style={localDs.fixedHeader}>
        <div style={localDs.navLeft} onClick={onBack}>
          <span style={localDs.backBtn}>〈</span>
          <span style={localDs.navTitle}>DIAMOND EVENT</span>
        </div>
        <div style={localDs.navRight}>
          <motion.div animate={pointControls} style={localDs.pointBadge}>
            <span style={localDs.coinIcon}>💎</span>
            <span style={localDs.headerPoint}>{displayPoint.toLocaleString()}</span>
          </motion.div>
          <div style={localDs.profileCircle}>
            <img src={currentAvatarUrl} alt="profile" style={{...localDs.profileImg, objectFit: 'cover'}} />
          </div>
        </div>
      </div>

      {/* 2. 스크롤 영역 */}
      <div style={localDs.scrollBody} ref={scrollRef}>
        
        {/* 라이브 티커 */}
        <div style={localDs.liveTicker}>
          <motion.div key={liveNoti} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={localDs.tickerText}>
            📢 {liveNoti}
          </motion.div>
        </div>

        {/* 메인 배너 (대기중 반짝임 + 추첨 + 임팩트 연출) */}
        <EventBanner
          round={round}
          timeLeft={timeLeft}
          isDrawing={isDrawing}
          drawingItems={drawingItems}
          impactTick={impactTick}
          isKo={isKo}
          joined={!!myPendingBet}
          lastResultItems={totalHistory[0]?.winItems?.map(getLocalizedText)}
        />

        {/* 아이템 그리드 */}
        <div style={localDs.sectionLabel}>
          <span style={localDs.labelBar} /> {isKo ? "아이템 선택" : "Select Item"} 
          <small style={localDs.subLabel}>{isKo ? `최근 ${totalHistory.length}회 통계` : `Last ${totalHistory.length} Stats`}</small>
        </div>
        <div style={localDs.grid}>
          {allItems.map((item) => {
            const isSelected = selectedItems.includes(item.name);
            return (
              <motion.div key={item.name} whileTap={myPendingBet ? {} : { scale: 0.95 }} 
                onClick={() => !myPendingBet && setSelectedItems(prev => prev.includes(item.name) ? prev.filter(i => i !== item.name) : [...prev, item.name].slice(0, 2))}
                style={{...localDs.itemCard, opacity: myPendingBet ? 0.5 : 1, background: isSelected ? `linear-gradient(145deg, ${item.color}88, #111)` : "#161616", border: isSelected ? `2px solid ${item.color}` : "2px solid #252525"}}>
                <div style={localDs.multiplier}>{item.label}</div>
                {!isSelected && <div style={localDs.statBadge}>{stats[item.name] ?? 0}%</div>}
                <div style={localDs.itemIcon}>{item.icon}</div>
                <div style={localDs.itemInfoText}>
                  <span style={localDs.itemName}>{isKo ? item.name : item.nameEn}</span>
                  <span style={localDs.itemDesc}>{isKo ? item.desc : item.descEn}</span>
                </div>
                {isSelected && <div style={{...localDs.checkBadge, background: item.color}}>✓</div>}
              </motion.div>
            );
          })}
        </div>

        {/* 기록 탭 */}
        <div style={localDs.tabSection}>
          <div style={localDs.tabHeader}>
            <button style={{...localDs.tabBtn, color: activeTab === 'mine' ? '#fff' : '#666', borderBottom: activeTab === 'mine' ? '2px solid #ffb347' : '2px solid transparent'}} onClick={() => setActiveTab('mine')}>
              {isKo ? "내 후원 기록" : "My History"}
            </button>
            <button style={{...localDs.tabBtn, color: activeTab === 'total' ? '#fff' : '#666', borderBottom: activeTab === 'total' ? '2px solid #ffb347' : '2px solid transparent'}} onClick={() => setActiveTab('total')}>
              {isKo ? "회차별 결과" : "All Results"}
            </button>
          </div>
          <div style={localDs.tabContent}>
            {(activeTab === 'mine' ? myHistory : totalHistory)
              .slice()
              .sort((a, b) => b.round - a.round)
              .slice(0, activeTab === 'total' ? 50 : 20)
              .map((h, i) => (
              <div key={`${h.round}-${i}`} style={localDs.histItem}>
                <div style={localDs.histLeft}>
                  <div style={localDs.histRound}>{h.round}{isKo ? "회차" : " Rd"}</div>
                  <div style={localDs.histDetail}>{h.date}</div>
                </div>
                <div style={localDs.histRight}>
                  {activeTab === 'mine' ? (
                    <div style={{ color: h.earn > 0 ? '#34D399' : '#FB7185', fontWeight: 'bold' }}>{h.earn > 0 ? `+${h.earn.toLocaleString()}` : `-${h.cost.toLocaleString()}`}</div>
                  ) : (
                    <div style={localDs.histWinIcons}>
                      {h.winItems?.map(str => getLocalizedText(str)).join(" ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(activeTab === 'mine' ? myHistory : totalHistory).length === 0 && (
              <div style={localDs.emptyText}>
                {activeTab === 'total'
                  ? (isKo ? "기록 불러오는 중..." : "Loading records...")
                  : (isKo ? "기록이 없습니다." : "No records found.")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. 하단 패널 */}
      <AnimatePresence>
        {(selectedItems.length > 0 || myPendingBet) && (
          <motion.div initial={{ y: 150 }} animate={{ y: 0 }} exit={{ y: 150 }} style={localDs.bottomPanel}>
            {myPendingBet ? (
              // ★ [수정] 취소 버튼 완전 삭제 - 참여 중 표시만 남김
              //   사용자 요청: "취소버튼 필요없어" → 한 번 걸면 결과까지 진행
              <div style={localDs.pendingInfo}>
                <div style={localDs.pendingTitle}>
                  {round}{isKo ? "회차 참여 중..." : " Round Joined..."}
                </div>
                <div style={localDs.pendingDetail}>
                  {isKo ? "선택:" : "Pick:"} <b style={{color:'#fff'}}>{myPendingBet.items.map(name => getLocalizedText(name)).join(", ")}</b> | {myPendingBet.totalCost.toLocaleString()} DIA
                </div>
                <div style={localDs.waitingHint}>
                  ⏳ {isKo ? "결과를 기다려주세요" : "Waiting for result..."}
                </div>
              </div>
            ) : (
              <>
                {/* 선택 아이템 + 초기화 */}
                <div style={localDs.panelTop}>
                  <span style={localDs.selectionText}>
                    {isKo ? "선택됨:" : "Selected:"} <b style={{color: '#ffb347'}}>{selectedItems.map(name => getLocalizedText(name)).join(", ")}</b>
                  </span>
                  <button style={localDs.clearBtn} onClick={() => { setSelectedItems([]); setBetAmount(""); }}>{isKo ? "초기화" : "Reset"}</button>
                </div>

                {/* 베팅 입력 영역 */}
                <div style={localDs.betInputGroup}>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={e => setBetAmount(e.target.value)}
                    style={localDs.mainInput}
                    placeholder={isKo ? "금액 입력" : "Enter amount"}
                  />
                  <button
                    style={{...localDs.finalBtn, opacity: !betAmount ? 0.5 : 1}}
                    onClick={handleDonate}
                    disabled={!betAmount}
                  >
                    {isKo ? "베팅" : "BET"}
                  </button>
                </div>

                {/* 베팅 합계 표시 */}
                {currentTotalCost > 0 && (
                  <div style={localDs.totalCostBar}>
                    {isKo ? "베팅 합계:" : "Total Bet:"} <b style={{color: '#ffb347'}}>{currentTotalCost.toLocaleString()} DIA</b>
                    {/* ★ [신규] 예상 당첨금 표시 - 이기면 2배 규칙 안내 */}
                    <span style={{marginLeft: 10, color: '#34D399'}}>
                      → {isKo ? "당첨시" : "Win"}: {(currentTotalCost * 2).toLocaleString()} DIA
                    </span>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. 결과 공개 임팩트 */}
      <ImpactBurst impactTick={impactTick} />

      {/* 5. 결과 모달 - ★ [수정] 본전 방어(DRAW) 완전 제거, 승/패 두 가지만 */}
      <AnimatePresence>
        {showResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={localDs.modalOverlay} onClick={() => setShowResult(null)}>
            <motion.div 
              initial={{ scale: 0.3, rotate: -6, opacity: 0 }} 
              animate={{ scale: 1, rotate: 0, opacity: 1 }} 
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              style={{
                ...localDs.modalCard,
                border: showResult.isWin ? '2px solid #ffd700' : '1px solid #333',
                boxShadow: showResult.isWin ? '0 0 60px rgba(255,215,0,0.35)' : '0 0 40px rgba(0,0,0,0.6)'
              }} 
              onClick={e => e.stopPropagation()}
            >
              {/* 당첨 시 모달 내부 컨페티 */}
              {showResult.isWin && (
                <div style={localDs.confettiWrap}>
                  {["🎉","✨","🎊","⭐","💎","🎉","✨","🎊"].map((c, i) => (
                    <motion.span
                      key={i}
                      style={{ position: 'absolute', left: `${8 + i * 12}%`, top: '-10px', fontSize: '18px' }}
                      initial={{ y: -20, opacity: 0, rotate: 0 }}
                      animate={{ y: [0, 90], opacity: [0, 1, 0], rotate: (i % 2 ? 1 : -1) * 260 }}
                      transition={{ duration: 1.6, delay: i * 0.12, repeat: Infinity, repeatDelay: 0.6 }}
                    >
                      {c}
                    </motion.span>
                  ))}
                </div>
              )}

              <motion.div 
                style={localDs.modalTitle}
                initial={{ scale: 0.6 }}
                animate={{ scale: [0.6, 1.15, 1] }}
                transition={{ duration: 0.45, delay: 0.1 }}
              >
                {/* ★ [수정] DRAW/본전 방어 케이스 완전 제거 → 승/패 두 가지만 */}
                {showResult.isWin
                  ? (isKo ? "🎉 당첨 성공!" : "🎉 YOU WIN!")
                  : (isKo ? "😢 아쉬워요" : "😢 YOU LOSE")}
              </motion.div>

              <div style={{fontSize: '50px', margin: '20px 0', display: 'flex', justifyContent: 'center', gap: '12px'}}>
                {showResult.winItems.map((str, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.25 + i * 0.15 }}
                  >
                    {getLocalizedText(str)}
                  </motion.span>
                ))}
              </div>

              <div style={localDs.modalInfoBox}>
                <div>{isKo ? "투자" : "Bet"}: {showResult.betTotal.toLocaleString()}</div>
                <div>{isKo ? "결과" : "Result"}: {showResult.winAmount.toLocaleString()}</div>
              </div>

              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.55 }}
                style={{
                  ...localDs.modalAmount, 
                  // ★ [수정] 손익 색상 - 이기면 초록(+), 지면 빨강(-). 본전은 없음
                  color: (showResult.winAmount - showResult.betTotal) > 0 ? '#34D399' : '#FB7185'
                }}
              >
                {(showResult.winAmount - showResult.betTotal) > 0 ? "+" : ""}{(showResult.winAmount - showResult.betTotal).toLocaleString()} DIA
              </motion.div>

              <button style={localDs.modalCloseBtn} onClick={() => setShowResult(null)}>{isKo ? "확인" : "CLOSE"}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const localDs = {
  screenContainer: { position: 'relative', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0c0c0c', overflow: 'hidden', fontFamily: '-apple-system, sans-serif' },
  fixedHeader: { flex: '0 0 auto', height: '70px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', backgroundColor: '#0c0c0c', zIndex: 10, paddingTop: 'env(safe-area-inset-top)' },
  scrollBody: { flex: 1, overflowY: 'auto', padding: '20px 20px 200px', WebkitOverflowScrolling: 'touch' },
  navLeft: { display: "flex", alignItems: "center", gap: "12px", cursor: 'pointer' },
  navTitle: { fontSize: "17px", fontWeight: "900", color: "#fff" },
  backBtn: { fontSize: "22px", color: '#666' },
  navRight: { display: "flex", alignItems: "center", gap: "12px" },
  pointBadge: { background: '#1a1a1a', padding: '6px 14px', borderRadius: '20px', border: '1px solid #333', display: 'flex', gap: '6px', alignItems: 'center' },
  coinIcon: { fontSize: '14px' },
  headerPoint: { fontSize: "15px", fontWeight: "800", color: "#ffb347" },
  profileCircle: { width: "36px", height: "36px", borderRadius: "50%", overflow: "hidden", border: "1px solid #444" },
  profileImg: { width: "100%", height: "100%", objectFit: "cover" },
  liveTicker: { height: '34px', background: 'rgba(255, 179, 71, 0.05)', margin: '0 -20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tickerText: { fontSize: '11px', color: '#ffb347', fontWeight: '600' },
  sectionLabel: { fontSize: "16px", fontWeight: "900", margin: "35px 0 15px", display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' },
  labelBar: { width: '4px', height: '16px', background: '#ffb347', borderRadius: '2px' },
  subLabel: { opacity: 0.4, marginLeft: '5px', fontWeight: '400', fontSize: '12px', color: '#fff' },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  itemCard: { height: "145px", borderRadius: "24px", position: 'relative', display: "flex", flexDirection: 'column', alignItems: "center", justifyContent: "center", cursor: 'pointer', overflow: 'hidden', transition: 'all 0.2s ease' },
  multiplier: { position: 'absolute', top: 12, left: 15, fontSize: '11px', fontWeight: '900', color: 'rgba(255,255,255,0.3)' },
  statBadge: { position: 'absolute', top: 12, right: 12, fontSize: '10px', color: '#ffb347', fontWeight: 'bold', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' },
  itemIcon: { fontSize: "44px", marginBottom: '8px' },
  itemInfoText: { textAlign: 'center' },
  itemName: { fontSize: "16px", fontWeight: "900", display: 'block', color: '#fff' },
  itemDesc: { fontSize: '10px', color: '#777', marginTop: '2px' },
  checkBadge: { position: 'absolute', top: 12, right: 12, width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '12px', fontWeight: '900', zIndex: 2 },
  tabSection: { marginTop: '40px' },
  tabHeader: { display: 'flex', gap: '20px', borderBottom: '1px solid #222' },
  tabBtn: { background: 'none', border: 'none', padding: '15px 5px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' },
  tabContent: { background: '#111', borderRadius: '20px', marginTop: '15px', border: '1px solid #222', overflow: 'hidden' },
  histItem: { padding: '15px 20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  histLeft: { display: 'flex', flexDirection: 'column', gap: '4px' },
  histRound: { fontSize: '14px', fontWeight: '800', color: '#fff' },
  histDetail: { fontSize: '11px', color: '#555' },
  histRight: { textAlign: 'right' },
  histWinIcons: { fontSize: '12px', color: '#ccc', marginTop: '2px', fontWeight: '600' },
  emptyText: { padding: '40px', textAlign: 'center', color: '#444', fontSize: '13px' },
  bottomPanel: { position: "absolute", bottom: 20, left: 15, right: 15, background: "#1c1c1e", padding: "20px", borderRadius: "30px", border: "1px solid #333", zIndex: 100, boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', boxSizing: 'border-box' },
  panelTop: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' },
  selectionText: { fontSize: '13px', color: '#888' },
  clearBtn: { background: 'none', border: 'none', color: '#ff3b30', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
  betInputGroup: { display: 'flex', gap: '8px', alignItems: 'center' },
  mainInput: { flex: 1, background: '#000', border: '1px solid #444', borderRadius: '16px', padding: '15px', color: '#fff', fontSize: '18px', fontWeight: '800', minWidth: 0 },
  finalBtn: { background: '#ffb347', color: '#000', border: 'none', padding: '0 24px', height: '52px', borderRadius: '16px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' },
  totalCostBar: { marginTop: '12px', textAlign: 'center', fontSize: '13px', color: '#888', padding: '10px', background: 'rgba(255,179,71,0.05)', borderRadius: '12px', border: '1px solid rgba(255,179,71,0.1)' },
  // ★ [수정] pendingContainer 스타일 사용 안 함 (취소 버튼 제거로 정렬 방식 변경)
  pendingInfo: { display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', textAlign: 'center' },
  pendingTitle: { fontSize: '15px', fontWeight: '900', color: '#ffb347' },
  pendingDetail: { fontSize: '12px', color: '#888' },
  // ★ [신규] 결과 대기 안내 문구 스타일
  waitingHint: { fontSize: '11px', color: '#666', marginTop: 4, fontWeight: '600' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modalCard: { background: '#222', padding: '40px 30px', borderRadius: '35px', textAlign: 'center', width: '100%', maxWidth: '320px', position: 'relative', overflow: 'hidden' },
  confettiWrap: { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' },
  modalTitle: { fontSize: '20px', fontWeight: '900', color: '#fff' },
  modalInfoBox: { background: '#161616', padding: '15px', borderRadius: '15px', margin: '20px 0', display: 'flex', justifyContent: 'space-around', fontSize: '12px', color: '#aaa' },
  modalAmount: { fontSize: '32px', fontWeight: '900', marginBottom: '25px' },
  modalCloseBtn: { width: '100%', background: '#fff', color: '#000', border: 'none', padding: '18px', borderRadius: '18px', fontWeight: '900', fontSize: '16px', cursor: 'pointer' },
};