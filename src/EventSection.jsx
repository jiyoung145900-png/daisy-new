import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useEventEngine, allItems } from "./useEventEngine"; 
import { db } from "./firebase"; 
import { collection, addDoc } from "firebase/firestore";

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

  const { 
    round, timeLeft, totalHistory, myHistory, myPendingBet, setMyPendingBet, 
    isDrawing, drawingItems, showResult, setShowResult, liveNoti, stats, updatePointWithAnim 
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

  const avatarStyles = ["adventurer", "avataaars", "big-ears", "bottts", "fun-emoji", "lorelei", "micah", "miniavs", "notionists", "open-peeps"];
  const currentAvatarUrl = useMemo(() => {
    if (confirmedImage) return confirmedImage;
    const idx = confirmedAvatarIdx || 0;
    return `https://api.dicebear.com/7.x/${avatarStyles[idx]}/svg?seed=${user?.id}_${idx}&backgroundColor=2a2a2e`;
  }, [confirmedImage, confirmedAvatarIdx, user?.id]);

  const handleDonate = async () => {
    const perAmount = parseInt(betAmount);
    const totalCost = perAmount * selectedItems.length;
    if (selectedItems.length === 0) return alert(isKo ? "아이템을 선택해주세요." : "Please select items.");
    if (!perAmount || perAmount <= 0) return alert(isKo ? "금액을 입력해주세요." : "Please enter amount.");
    if (totalCost > displayPoint) return alert(isKo ? "보유 다이아를 확인해주세요." : "Check your diamond balance.");

    const newPoint = displayPoint - totalCost;
    setDisplayPoint(newPoint); 
    updatePointWithAnim(newPoint); 
    setMyPendingBet({ round: round, items: [...selectedItems], perAmount, totalCost });

    try {
      await addDoc(collection(db, "event_bets"), {
        round: round, userId: user.id, betAmount: totalCost, items: [...selectedItems], win: null, timestamp: new Date().toISOString()
      });
    } catch (e) { console.error("서버 기록 실패:", e); }

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

        {/* 메인 배너 */}
        <motion.div 
          style={{...localDs.eventBanner, background: isDrawing ? "linear-gradient(135deg, #1a1a1a 0%, #000 100%)" : localDs.eventBanner.background}} 
          animate={isDrawing ? { x: [-1, 1, -1, 1, 0], transition: { repeat: Infinity, duration: 0.1 } } : {}}
        >
          <div style={localDs.radarContainer}>
            {isDrawing && [0, 1, 2].map((i) => (
              <motion.div key={`radar-${i}`} style={localDs.radarCircle} initial={{ width: 0, height: 0, opacity: 0.8 }} animate={{ width: 600, height: 600, opacity: 0 }} transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: "easeOut" }} />
            ))}
          </div>

          <AnimatePresence>
            {isDrawing && (
              <>
                <motion.div style={{ position: 'absolute', left: '-10%', fontSize: '80px', zIndex: 5, pointerEvents: 'none' }} initial={{ x: 0, opacity: 0 }} animate={{ x: 300, opacity: [0, 1, 0], scale: [0.5, 1.2, 0.8] }} exit={{ opacity: 0 }} transition={{ duration: 2.5, repeat: Infinity, ease: "circIn" }}>⭐</motion.div>
                <motion.div style={{ position: 'absolute', right: '-10%', fontSize: '80px', zIndex: 5, pointerEvents: 'none' }} initial={{ x: 0, opacity: 0 }} animate={{ x: -300, opacity: [0, 1, 0], scale: [0.5, 1.2, 0.8] }} exit={{ opacity: 0 }} transition={{ duration: 2.5, repeat: Infinity, ease: "circIn", delay: 1.25 }}>❤️</motion.div>
              </>
            )}
          </AnimatePresence>

          <div style={localDs.bannerContent}>
            <div style={localDs.bannerTop}>
              <div style={{...localDs.liveBadge, background: isDrawing ? '#ffb347' : '#ff3b30'}}>{isDrawing ? "DRAWING" : "LIVE"}</div>
              <span style={localDs.roundInfo}>
                {isKo ? `제 ${round}회차` : `Round ${round}`} {myPendingBet ? (isKo ? "(참여완료)" : "(Joined)") : ""}
              </span>
            </div>
            <div style={localDs.timerDisplay}>
              {isDrawing ? (
                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', margin: '15px 0' }}>
                  {drawingItems.map((icon, idx) => (
                    <motion.div key={idx} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.2, opacity: 1 }} style={{ fontSize: '50px' }}>{icon}</motion.div>
                  ))}
                </div>
              ) : <h2 style={localDs.timeLeftNum}>{`${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}`}</h2>}
            </div>
            <div style={localDs.lastResultBar}>
              <span style={localDs.lastLabel}>{round - 1}{isKo ? "회차 결과:" : " Result:"}</span>
              <div style={{display:'flex', gap:'5px'}}>
                {totalHistory[0]?.winItems.map((itemStr, idx) => (
                  <span key={idx} style={localDs.resTag}>{getLocalizedText(itemStr)}</span>
                )) || (isKo ? "대기중" : "Waiting")}
              </div>
            </div>
          </div>
        </motion.div>

        {/* 아이템 그리드 */}
        <div style={localDs.sectionLabel}>
          <span style={localDs.labelBar} /> {isKo ? "아이템 선택" : "Select Item"} 
          <small style={localDs.subLabel}>{isKo ? "최근 100회 통계" : "Last 100 Stats"}</small>
        </div>
        <div style={localDs.grid}>
          {allItems.map((item) => {
            const isSelected = selectedItems.includes(item.name);
            return (
              <motion.div key={item.name} whileTap={myPendingBet ? {} : { scale: 0.95 }} 
                onClick={() => !myPendingBet && setSelectedItems(prev => prev.includes(item.name) ? prev.filter(i => i !== item.name) : [...prev, item.name].slice(0, 2))}
                style={{...localDs.itemCard, opacity: myPendingBet ? 0.5 : 1, background: isSelected ? `linear-gradient(145deg, ${item.color}88, #111)` : "#161616", border: isSelected ? `2px solid ${item.color}` : "2px solid #252525"}}>
                <div style={localDs.multiplier}>{item.label}</div>
                <div style={localDs.statBadge}>{stats[item.name] || 0}%</div>
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
            {(activeTab === 'mine' ? myHistory : totalHistory).sort((a, b) => b.round - a.round).slice(0, 20).map((h, i) => (
              <div key={i} style={localDs.histItem}>
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
              <div style={localDs.emptyText}>{isKo ? "기록이 없습니다." : "No records found."}</div>
            )}
          </div>
        </div>
      </div>

      {/* 3. 하단 패널 */}
      <AnimatePresence>
        {(selectedItems.length > 0 || myPendingBet) && (
          <motion.div initial={{ y: 150 }} animate={{ y: 0 }} exit={{ y: 150 }} style={localDs.bottomPanel}>
            {myPendingBet ? (
              <div style={localDs.pendingContainer}>
                <div style={localDs.pendingInfo}>
                  <div style={localDs.pendingTitle}>{round}{isKo ? "회차 참여 중..." : " Round Joined..."}</div>
                  <div style={localDs.pendingDetail}>
                    {isKo ? "선택:" : "Pick:"} <b style={{color:'#fff'}}>{myPendingBet.items.map(name => getLocalizedText(name)).join(", ")}</b> | {myPendingBet.totalCost.toLocaleString()} DIA
                  </div>
                </div>
                <button style={localDs.cancelBtn} onClick={() => { 
                  const refunded = displayPoint + myPendingBet.totalCost;
                  setDisplayPoint(refunded);
                  updatePointWithAnim(refunded);
                  setMyPendingBet(null); 
                }}>{isKo ? "취소" : "Cancel"}</button>
              </div>
            ) : (
              <>
                {/* 선택 아이템 + 초기화 */}
                <div style={localDs.panelTop}>
                  <span style={localDs.selectionText}>
                    {isKo ? "선택됨:" : "Selected:"} <b style={{color: '#ffb347'}}>{selectedItems.map(name => getLocalizedText(name)).join(", ")}</b>
                  </span>
                  <button style={localDs.clearBtn} onClick={() => setSelectedItems([])}>{isKo ? "초기화" : "Reset"}</button>
                </div>

                {/* ✅ 금액 입력 + 지우기 + 베팅 버튼 */}
                <div style={localDs.betInputGroup}>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={e => setBetAmount(e.target.value)}
                    style={localDs.mainInput}
                    placeholder={isKo ? "금액 입력" : "Enter amount"}
                  />
                  <button
                    style={localDs.clearInputBtn}
                    onClick={() => setBetAmount("")}
                  >
                    {isKo ? "지우기" : "Clear"}
                  </button>
                  <button
                    style={{...localDs.finalBtn, opacity: !betAmount ? 0.5 : 1}}
                    onClick={handleDonate}
                    disabled={!betAmount}
                  >
                    {isKo ? "베팅" : "BET"}
                  </button>
                </div>

                {/* ✅ 베팅 합계 표시 */}
                {currentTotalCost > 0 && (
                  <div style={localDs.totalCostBar}>
                    {isKo ? "베팅 합계:" : "Total Bet:"} <b style={{color: '#ffb347'}}>{currentTotalCost.toLocaleString()} DIA</b>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. 결과 모달 */}
      <AnimatePresence>
        {showResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={localDs.modalOverlay} onClick={() => setShowResult(null)}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={localDs.modalCard} onClick={e => e.stopPropagation()}>
              <div style={localDs.modalTitle}>
                {showResult.isWin ? (isKo ? "🎉 당첨 성공!" : "🎉 YOU WIN!") : showResult.isDraw ? (isKo ? "⚖️ 본전 방어!" : "⚖️ DRAW!") : (isKo ? "😢 아쉬워요" : "😢 YOU LOSE")}
              </div>
              <div style={{fontSize: '50px', margin: '20px 0'}}>
                {showResult.winItems.map(str => getLocalizedText(str)).join(" ")}
              </div>
              <div style={localDs.modalInfoBox}>
                <div>{isKo ? "투자" : "Bet"}: {showResult.betTotal.toLocaleString()}</div>
                <div>{isKo ? "결과" : "Result"}: {showResult.winAmount.toLocaleString()}</div>
              </div>
              <div style={{...localDs.modalAmount, color: (showResult.winAmount - showResult.betTotal) > 0 ? '#34D399' : (showResult.winAmount - showResult.betTotal) === 0 ? '#fff' : '#FB7185'}}>
                {(showResult.winAmount - showResult.betTotal) > 0 ? "+" : ""}{(showResult.winAmount - showResult.betTotal).toLocaleString()} DIA
              </div>
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
  eventBanner: { background: "linear-gradient(135deg, #ffdeeb 0%, #fbc2eb 100%)", borderRadius: "28px", padding: "25px", border: '1px solid #ffb6c1', textAlign: 'center', position: 'relative', overflow: 'hidden', height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  radarContainer: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  radarCircle: { position: 'absolute', borderRadius: '50%', border: '8px solid rgba(255, 255, 255, 0.6)' },
  bannerContent: { position: 'relative', zIndex: 10, width: '100%' },
  bannerTop: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  liveBadge: { color: '#fff', fontSize: '10px', fontWeight: '900', padding: '2px 8px', borderRadius: '4px' },
  roundInfo: { fontSize: '12px', color: '#555', fontWeight: '700' },
  timeLeftNum: { fontSize: '52px', fontWeight: '900', margin: '5px 0', color: '#333', letterSpacing: '-1px' },
  lastResultBar: { background: 'rgba(255,255,255,0.6)', padding: '8px 15px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '10px', marginTop: '10px' },
  lastLabel: { fontSize: '11px', color: '#333', fontWeight: '600' },
  resTag: { fontSize: '12px', fontWeight: '800', color: '#000' },
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
  histWinIcons: { fontSize: '10px', color: '#666', marginTop: '2px' },
  emptyText: { padding: '40px', textAlign: 'center', color: '#444', fontSize: '13px' },
  bottomPanel: { position: "absolute", bottom: 20, left: 15, right: 15, background: "#1c1c1e", padding: "20px", borderRadius: "30px", border: "1px solid #333", zIndex: 100, boxShadow: '0 -10px 40px rgba(0,0,0,0.5)' },
  panelTop: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' },
  selectionText: { fontSize: '13px', color: '#888' },
  clearBtn: { background: 'none', border: 'none', color: '#ff3b30', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
  // ✅ 수정된 베팅 입력 영역
  betInputGroup: { display: 'flex', gap: '8px', alignItems: 'center' },
  mainInput: { flex: 1, background: '#000', border: '1px solid #444', borderRadius: '16px', padding: '15px', color: '#fff', fontSize: '18px', fontWeight: '800' },
  clearInputBtn: { background: '#2c2c2e', border: '1px solid #444', color: '#aaa', padding: '0 14px', height: '52px', borderRadius: '16px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' },
  finalBtn: { background: '#ffb347', color: '#000', border: 'none', padding: '0 18px', height: '52px', borderRadius: '16px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' },
  // ✅ 베팅 합계 바
  totalCostBar: { marginTop: '12px', textAlign: 'center', fontSize: '13px', color: '#888', padding: '10px', background: 'rgba(255,179,71,0.05)', borderRadius: '12px', border: '1px solid rgba(255,179,71,0.1)' },
  pendingContainer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  pendingInfo: { display: 'flex', flexDirection: 'column', gap: '4px' },
  pendingTitle: { fontSize: '15px', fontWeight: '900', color: '#ffb347' },
  pendingDetail: { fontSize: '12px', color: '#888' },
  cancelBtn: { background: '#ff3b30', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '16px', fontWeight: '900', fontSize: '13px', cursor: 'pointer' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modalCard: { background: '#222', padding: '40px 30px', borderRadius: '35px', textAlign: 'center', width: '100%', maxWidth: '320px', border: '1px solid #333' },
  modalTitle: { fontSize: '20px', fontWeight: '900', color: '#fff' },
  modalInfoBox: { background: '#161616', padding: '15px', borderRadius: '15px', margin: '20px 0', display: 'flex', justifyContent: 'space-around', fontSize: '12px', color: '#aaa' },
  modalAmount: { fontSize: '32px', fontWeight: '900', marginBottom: '25px' },
  modalCloseBtn: { width: '100%', background: '#fff', color: '#000', border: 'none', padding: '18px', borderRadius: '18px', fontWeight: '900', fontSize: '16px', cursor: 'pointer' },
};