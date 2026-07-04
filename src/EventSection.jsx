import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useEventEngine, allItems } from "./useEventEngine"; 
import { EventBanner, ImpactBurst } from "./EventComponents";
import { db } from "./firebase"; 
import { collection, addDoc, doc, updateDoc, increment } from "firebase/firestore";
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

  // ★ [변경] myPendingBets(배열), addPendingBet, maxBetsPerRound 받기
  const { 
    round, timeLeft, totalHistory, myHistory, myPendingBets, addPendingBet,
    isDrawing, drawingItems, showResult, setShowResult, liveNoti, stats, impactTick, updatePointWithAnim,
    syncDiamondToFirestore, maxBetsPerRound
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

  // ★ [신규 유틸] 남은 베팅 가능 횟수 / 최대 도달 여부
  const pendingCount = myPendingBets?.length || 0;
  const isMaxReached = pendingCount >= maxBetsPerRound;

  // ★ [신규] 회차 번호 → 당첨 아이콘 배열 룩업
  //   "내 후원 기록" 탭에서도 회차별 결과 아이콘을 함께 보여주기 위해 사용.
  //   myHistory 항목에 winItems가 이미 들어있으면 우선 사용하고,
  //   없으면 이 맵에서 totalHistory 기준으로 조회하는 하이브리드 방식.
  const winItemsByRound = useMemo(() => {
    const map = {};
    (totalHistory || []).forEach(h => {
      if (h && h.round && h.winItems) map[h.round] = h.winItems;
    });
    return map;
  }, [totalHistory]);

  // ★ [수정] handleDonate - 다중 베팅 지원
  //   - 최대 횟수 체크 → 초과 시 알림
  //   - Firestore 잔액 즉시 차감 (기존 유지)
  //   - addPendingBet으로 배열에 추가 (기존 setMyPendingBet 방식 대체)
  const handleDonate = async () => {
    if (isMaxReached) {
      return alert(isKo 
        ? `한 회차 최대 ${maxBetsPerRound}회까지 베팅 가능합니다.` 
        : `Max ${maxBetsPerRound} bets per round.`);
    }

    const perAmount = parseInt(betAmount);
    const totalCost = perAmount * selectedItems.length;
    if (selectedItems.length === 0) return alert(isKo ? "아이템을 선택해주세요." : "Please select items.");
    if (!perAmount || perAmount <= 0) return alert(isKo ? "금액을 입력해주세요." : "Please enter amount.");
    if (totalCost > displayPoint) return alert(isKo ? "보유 다이아를 확인해주세요." : "Check your diamond balance.");

    const newPoint = displayPoint - totalCost;
    setDisplayPoint(newPoint); 
    updatePointWithAnim(newPoint); 

    try {
      // ★ [수정] Firestore 잔액 delta 방식으로 차감 (관리자 편집과 충돌 방지)
      //   기존: updateDoc(userRef, { diamond: newPoint }) - 절대값 덮어쓰기
      //   신규: updateDoc(userRef, { diamond: increment(-totalCost) }) - 원자적 차감
      if (user?.id) {
        await updateDoc(doc(db, "users", user.id), { diamond: increment(-totalCost) });
      }

      const docRef = await addDoc(collection(db, "event_bets"), {
        round: round, userId: user.id, betAmount: totalCost, items: [...selectedItems], win: null, timestamp: new Date().toISOString()
      });

      // ★ [변경] 배열에 추가 (기존 세팅 방식과 달리 append)
      addPendingBet({ 
        round: round, 
        items: [...selectedItems], 
        perAmount, 
        totalCost, 
        docId: docRef.id 
      });
    } catch (e) { 
      console.error("서버 기록 실패:", e); 
      alert(isKo ? "베팅 처리 중 오류가 발생했습니다." : "Error processing bet.");
      // 실패 시 UI 롤백
      setDisplayPoint(displayPoint);
      updatePointWithAnim(displayPoint);
    }

    // 입력 초기화 → 다음 베팅 위한 상태 리셋
    setSelectedItems([]);
    setBetAmount("");
  };

  const currentTotalCost = (parseInt(betAmount) || 0) * (selectedItems.length || 0);

  // ★ [신규] 결과 모달에서 사용할 순손익 (net profit)
  //   - winAmount: 총 지급액 (승리 시 totalCost * 2)
  //   - betTotal: 총 베팅액
  //   - netProfit = winAmount - betTotal → 실제 손익
  //     예) 2만원 걸어 이김: 40000 - 20000 = +20000
  //     예) 2만원 걸어 짐: 0 - 20000 = -20000
  const netProfit = showResult ? (showResult.winAmount - showResult.betTotal) : 0;

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
        <EventBanner
          round={round}
          timeLeft={timeLeft}
          isDrawing={isDrawing}
          drawingItems={drawingItems}
          impactTick={impactTick}
          isKo={isKo}
          joined={pendingCount > 0}
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
            // ★ [수정] 아이템 선택 비활성화 조건: pending 아닌 "최대 도달" 기준
            //   즉 첫 베팅 후에도 두 번째 베팅 위한 선택 가능
            return (
              <motion.div key={item.name} whileTap={isMaxReached ? {} : { scale: 0.95 }} 
                onClick={() => !isMaxReached && setSelectedItems(prev => prev.includes(item.name) ? prev.filter(i => i !== item.name) : [...prev, item.name].slice(0, 2))}
                style={{...localDs.itemCard, opacity: isMaxReached ? 0.5 : 1, background: isSelected ? `linear-gradient(145deg, ${item.color}88, #111)` : "#161616", border: isSelected ? `2px solid ${item.color}` : "2px solid #252525"}}>
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
                    // ★ [수정] 순손익 표시 + 회차별 당첨 아이콘 함께 표시
                    //   상단: 이기면 +(earn - cost), 지면 -cost
                    //   하단: 해당 회차 당첨 아이콘 (회차별 결과 탭과 동일 포맷)
                    <>
                      <div style={{ color: h.earn > 0 ? '#34D399' : '#FB7185', fontWeight: 'bold' }}>
                        {h.earn > 0 
                          ? `+${(h.earn - h.cost).toLocaleString()}` 
                          : `-${h.cost.toLocaleString()}`}
                      </div>
                      {/* ★ [신규] 해당 회차 당첨 아이콘 표시
                          - h.winItems가 있으면 우선 사용
                          - 없으면 winItemsByRound에서 조회 (totalHistory 기준) */}
                      {(() => {
                        const roundWinItems = h.winItems || winItemsByRound[h.round];
                        if (!roundWinItems || roundWinItems.length === 0) return null;
                        return (
                          <div style={localDs.histWinIcons}>
                            {roundWinItems.map(str => getLocalizedText(str)).join(" ")}
                          </div>
                        );
                      })()}
                    </>
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

      {/* 3. 하단 패널 - ★ 다중 베팅 UI로 완전 재설계 */}
      <AnimatePresence>
        {(selectedItems.length > 0 || pendingCount > 0) && (
          <motion.div initial={{ y: 150 }} animate={{ y: 0 }} exit={{ y: 150 }} style={localDs.bottomPanel}>

            {/* ★ [신규] 참여 중인 베팅 리스트 (있을 때만) */}
            {pendingCount > 0 && (
              <div style={localDs.pendingBox}>
                <div style={localDs.pendingHeader}>
                  <span style={{color:'#ffb347', fontWeight:900}}>
                    {round}{isKo ? "회차 참여 중" : " Round Joined"}
                  </span>
                  <span style={localDs.pendingCounter}>
                    {pendingCount}/{maxBetsPerRound}
                  </span>
                </div>
                {myPendingBets.map((bet, idx) => (
                  <div key={bet.docId || idx} style={localDs.pendingRow}>
                    <span style={localDs.pendingIdx}>#{idx + 1}</span>
                    <span style={localDs.pendingItems}>
                      {bet.items.map(name => getLocalizedText(name)).join(", ")}
                    </span>
                    <span style={localDs.pendingCost}>
                      {bet.totalCost.toLocaleString()} DIA
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ★ 최대 도달 시: 결과 대기, 아니면: 추가 베팅 UI */}
            {isMaxReached ? (
              <div style={localDs.waitingHint}>
                ⏳ {isKo 
                  ? `${maxBetsPerRound}회 베팅 완료 - 결과를 기다려주세요` 
                  : `Max bets placed - Waiting for result...`}
              </div>
            ) : (
              <>
                {/* 선택 아이템 + 초기화 (선택이 있을 때만) */}
                {selectedItems.length > 0 && (
                  <div style={localDs.panelTop}>
                    <span style={localDs.selectionText}>
                      {isKo ? "선택됨:" : "Selected:"} <b style={{color: '#ffb347'}}>
                        {selectedItems.map(name => getLocalizedText(name)).join(", ")}
                      </b>
                    </span>
                    <button style={localDs.clearBtn} onClick={() => { setSelectedItems([]); setBetAmount(""); }}>
                      {isKo ? "초기화" : "Reset"}
                    </button>
                  </div>
                )}

                {/* 베팅 입력 (선택이 있거나, pending이 이미 있으면 계속 표시) */}
                {(selectedItems.length > 0 || pendingCount > 0) && (
                  <>
                    <div style={localDs.betInputGroup}>
                      <input
                        type="number"
                        value={betAmount}
                        onChange={e => setBetAmount(e.target.value)}
                        style={localDs.mainInput}
                        placeholder={
                          selectedItems.length === 0
                            ? (isKo ? "아이템 선택 후 금액 입력" : "Select item first")
                            : (isKo ? "금액 입력" : "Enter amount")
                        }
                        disabled={selectedItems.length === 0}
                      />
                      <button
                        style={{
                          ...localDs.finalBtn, 
                          opacity: (!betAmount || selectedItems.length === 0) ? 0.5 : 1
                        }}
                        onClick={handleDonate}
                        disabled={!betAmount || selectedItems.length === 0}
                      >
                        {isKo 
                          ? (pendingCount === 0 ? "베팅" : "추가베팅") 
                          : (pendingCount === 0 ? "BET" : "ADD BET")}
                      </button>
                    </div>

                    {/* 예상 순수익 표시 (2배 지급 = 순수익 = 베팅액 그대로) */}
                    {currentTotalCost > 0 && (
                      <div style={localDs.totalCostBar}>
                        {isKo ? "베팅 합계:" : "Total Bet:"} <b style={{color: '#ffb347'}}>{currentTotalCost.toLocaleString()} DIA</b>
                        <span style={{marginLeft: 10, color: '#34D399'}}>
                          → {isKo ? "당첨시 순수익" : "Net Profit"}: +{currentTotalCost.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. 결과 공개 임팩트 */}
      <ImpactBurst impactTick={impactTick} />

      {/* 5. 결과 모달 - ★ 다중 베팅 상세 + 순손익 표시로 재설계 */}
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

              {/* ★ [신규] 다중 베팅인 경우 각 베팅 상세 표시 */}
              {showResult.details && showResult.details.length > 1 && (
                <div style={localDs.detailsBox}>
                  {showResult.details.map((d, i) => {
                    const dNet = d.winAmount - d.totalCost;
                    return (
                      <div key={i} style={localDs.detailRow}>
                        <span style={localDs.detailIdx}>#{i + 1}</span>
                        <span style={localDs.detailItems}>
                          {d.items.map(name => getLocalizedText(name)).join(", ")}
                        </span>
                        <span style={{
                          ...localDs.detailResult,
                          color: dNet > 0 ? '#34D399' : '#FB7185'
                        }}>
                          {dNet > 0 ? `+${dNet.toLocaleString()}` : `-${d.totalCost.toLocaleString()}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ★ [수정] 총 순손익 표시 - 걸었던 돈만큼만 오르내리게 */}
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.55 }}
                style={{
                  ...localDs.modalAmount, 
                  color: netProfit > 0 ? '#34D399' : '#FB7185'
                }}
              >
                {netProfit > 0 ? "+" : ""}{netProfit.toLocaleString()} DIA
              </motion.div>

              {/* 참고 정보 (총 베팅액만 표시 - 총 지급액은 혼란 방지를 위해 숨김) */}
              <div style={localDs.modalHint}>
                {isKo ? "총 베팅:" : "Total Bet:"} {showResult.betTotal.toLocaleString()} DIA
                {showResult.betCount > 1 && (
                  <span style={{marginLeft: 8, color: '#666'}}>
                    ({showResult.betCount}{isKo ? "회 베팅" : " bets"})
                  </span>
                )}
              </div>

              <button style={localDs.modalCloseBtn} onClick={() => setShowResult(null)}>
                {isKo ? "확인" : "CLOSE"}
              </button>
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
  scrollBody: { flex: 1, overflowY: 'auto', padding: '20px 20px 250px', WebkitOverflowScrolling: 'touch' },
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
  bottomPanel: { position: "absolute", bottom: 20, left: 15, right: 15, background: "#1c1c1e", padding: "18px", borderRadius: "28px", border: "1px solid #333", zIndex: 100, boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', boxSizing: 'border-box' },

  // ★ [신규] 다중 베팅 상태 표시 UI
  pendingBox: { 
    background: 'rgba(255,179,71,0.05)', 
    border: '1px solid rgba(255,179,71,0.15)', 
    borderRadius: 16, 
    padding: '12px 14px', 
    marginBottom: 12 
  },
  pendingHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    fontSize: 13, 
    marginBottom: 8 
  },
  pendingCounter: { 
    background: '#0a0a0a', 
    border: '1px solid #333', 
    color: '#ffb347', 
    padding: '3px 10px', 
    borderRadius: 12, 
    fontSize: 11, 
    fontWeight: 900 
  },
  pendingRow: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: 10, 
    padding: '6px 4px', 
    fontSize: 12, 
    color: '#ddd', 
    borderTop: '1px solid rgba(255,255,255,0.04)' 
  },
  pendingIdx: { 
    color: '#666', 
    fontWeight: 800, 
    minWidth: 22 
  },
  pendingItems: { 
    flex: 1, 
    color: '#fff', 
    fontWeight: 600 
  },
  pendingCost: { 
    color: '#ffb347', 
    fontWeight: 800 
  },

  waitingHint: { 
    fontSize: 12, 
    color: '#888', 
    textAlign: 'center', 
    padding: '10px 4px 4px', 
    fontWeight: 600 
  },

  panelTop: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' },
  selectionText: { fontSize: '13px', color: '#888' },
  clearBtn: { background: 'none', border: 'none', color: '#ff3b30', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
  betInputGroup: { display: 'flex', gap: '8px', alignItems: 'center' },
  mainInput: { flex: 1, background: '#000', border: '1px solid #444', borderRadius: '16px', padding: '15px', color: '#fff', fontSize: '18px', fontWeight: '800', minWidth: 0 },
  finalBtn: { background: '#ffb347', color: '#000', border: 'none', padding: '0 22px', height: '52px', borderRadius: '16px', fontWeight: '900', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' },
  totalCostBar: { marginTop: '12px', textAlign: 'center', fontSize: '13px', color: '#888', padding: '10px', background: 'rgba(255,179,71,0.05)', borderRadius: '12px', border: '1px solid rgba(255,179,71,0.1)' },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modalCard: { background: '#222', padding: '35px 28px', borderRadius: '35px', textAlign: 'center', width: '100%', maxWidth: '340px', position: 'relative', overflow: 'hidden' },
  confettiWrap: { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' },
  modalTitle: { fontSize: '20px', fontWeight: '900', color: '#fff' },

  // ★ [신규] 다중 베팅 결과 상세 박스
  detailsBox: { 
    background: '#161616', 
    padding: '12px', 
    borderRadius: '15px', 
    margin: '15px 0', 
    border: '1px solid #2a2a2a' 
  },
  detailRow: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: 8, 
    padding: '6px 4px', 
    fontSize: 12,
    borderTop: '1px solid rgba(255,255,255,0.04)' 
  },
  detailIdx: { color: '#666', fontWeight: 800, minWidth: 22 },
  detailItems: { flex: 1, color: '#ccc', textAlign: 'left' },
  detailResult: { fontWeight: 900 },

  modalAmount: { fontSize: '36px', fontWeight: '900', marginBottom: 12, marginTop: 20 },
  modalHint: { fontSize: 11, color: '#888', marginBottom: 20, fontWeight: 600 },
  modalCloseBtn: { width: '100%', background: '#fff', color: '#000', border: 'none', padding: '18px', borderRadius: '18px', fontWeight: '900', fontSize: '16px', cursor: 'pointer' },
};