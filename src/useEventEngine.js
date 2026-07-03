import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { EventService, soundManager, ITEM_CONFIG } from "./EventService"; 
import { db } from "./firebase";
// ★ [수정] updateDoc 추가 - 결과 확정 시 users/{id}.diamond 실시간 갱신용
import { collection, onSnapshot, query, where, doc, setDoc, updateDoc } from "firebase/firestore";

export { ITEM_CONFIG as allItems }; 

/* ============================================================
 * ★ [신규] 배당 계산 공통 유틸 - 4곳에 흩어져 있던 로직을 통일
 * ------------------------------------------------------------
 * 새 규칙 (2026-07 개편):
 *   - 이기면 무조건 배팅 총액의 2배 지급 (1개든 2개든 동일)
 *   - 2개를 걸었을 경우 2개 다 맞아야만 승리
 *   - 1개만 맞으면 패배 (본전 방어 없음)
 *   - 지면 0 지급 (배팅액 소실)
 * ============================================================ */
function calcWinAmount(items, matchedCount, totalCost) {
  if (!items || items.length === 0 || !totalCost) return 0;
  const isFullMatch = matchedCount === items.length;
  return isFullMatch ? totalCost * 2 : 0;
}

export function useEventEngine(user, userPoint, onUpdatePoint, pointControls) {
  // --- Refs ---
  const isProcessingRef = useRef(false);
  const pointRef = useRef(userPoint);
  const betRef = useRef(null);
  const roundRef = useRef(0); 

  useEffect(() => { pointRef.current = userPoint; }, [userPoint]);

  const [totalHistory, setTotalHistory] = useState([]);

  const [myHistory, setMyHistory] = useState(() => {
    const saved = localStorage.getItem(`event_my_history_${user?.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [gameState, setGameState] = useState({
    round: 0,
    timeLeft: 60,
    isDrawing: false
  });

  const [drawingItems, setDrawingItems] = useState(["🚀", "❤️"]);
  const [myPendingBet, setMyPendingBet] = useState(null);
  const [showResult, setShowResult] = useState(null);
  const [liveNoti, setLiveNoti] = useState("이벤트가 활성화되었습니다!");

  // ✨ 결과 공개 순간 임팩트 트리거
  const [impactTick, setImpactTick] = useState(0);

  // --- [원본 기능: 포인트 업데이트] ---
  const updatePointWithAnim = useCallback((newPoint) => {
    if (onUpdatePoint) {
      onUpdatePoint(newPoint);
      if (pointControls) pointControls.start({ scale: [1, 1.2, 1], transition: { duration: 0.3 } });
    }
  }, [onUpdatePoint, pointControls]);

  // ★ [신규] Firestore users/{id}.diamond 즉시 반영 헬퍼
  //   - 다른 페이지(마이페이지, 관리자 뷰 등)가 onSnapshot으로 실시간 구독하므로
  //     여기서 업데이트하면 모든 화면에 즉시 반영됨
  //   - 실패해도 로컬 UI는 이미 반영되어 있으므로 사용자 경험에는 영향 없음
  const syncDiamondToFirestore = useCallback(async (newPoint) => {
    if (!user?.id) return;
    try {
      await updateDoc(doc(db, "users", user.id), { diamond: newPoint });
    } catch (err) {
      console.error("💎 잔액 동기화 실패:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    const initEngine = async () => {
      const { round: currentRound } = EventService.getCurrentRoundInfo();
      
      const savedTotal = JSON.parse(localStorage.getItem("event_total_history") || "[]");
      const lastSavedRound = savedTotal.length > 0 ? savedTotal[0].round : currentRound - 101;

      if (currentRound > lastSavedRound + 1) {
        const missed = await EventService.getMissedHistory(lastSavedRound, currentRound, 100);
        const updatedTotal = [...missed.reverse(), ...savedTotal].slice(0, 100);
        setTotalHistory(updatedTotal);
        localStorage.setItem("event_total_history", JSON.stringify(updatedTotal));
      } else {
        setTotalHistory(savedTotal);
      }

      // 2. 부재중 베팅 자동 정산
      const savedBet = localStorage.getItem(`pending_bet_${user?.id}`);
      if (savedBet) {
        const parsedBet = JSON.parse(savedBet);

        if (parsedBet.round < currentRound) {
          const fixedResult = await EventService.getFixedResult(parsedBet.round);
          const winObjs = fixedResult || EventService.generateResult(parsedBet.round);
          const winNames = winObjs.map(i => i.name);
          
          const { items, totalCost } = parsedBet;
          const matchedCount = items.filter(name => winNames.includes(name)).length;
          // ★ [수정] 배당 계산 공통 함수 사용 (이기면 2배, 지면 0)
          const winAmount = calcWinAmount(items, matchedCount, totalCost);

          const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          const newRecord = {
            round: parsedBet.round, selected: [...items], winNames, winIcons: winObjs.map(i => i.icon),
            earn: winAmount, cost: totalCost, date: currentTime, status: "자동정산"
          };

          setMyHistory(prev => {
            if (prev.find(h => h.round === parsedBet.round)) return prev;
            const updated = [newRecord, ...prev].slice(0, 100);
            localStorage.setItem(`event_my_history_${user?.id}`, JSON.stringify(updated));
            return updated;
          });

          // ★ [수정] 부재중 정산: 이겼을 때 로컬 + Firestore 모두 즉시 반영
          if (winAmount > 0) {
            const newPoint = pointRef.current + winAmount;
            updatePointWithAnim(newPoint);
            syncDiamondToFirestore(newPoint);
          }
          localStorage.removeItem(`pending_bet_${user?.id}`);
        } else {
          betRef.current = parsedBet;
          setMyPendingBet(parsedBet);
        }
      }
    };
    initEngine();
  }, [user?.id]); 

  // --- [원본 기능: 관리자 다이아 수정 리스너] ---
  useEffect(() => {
    const handlePointUpdate = (e) => {
      if (user && e.detail && e.detail.userId === user.id) {
        updatePointWithAnim(e.detail.point);
      }
    };
    window.addEventListener("user_point_update", handlePointUpdate);
    return () => window.removeEventListener("user_point_update", handlePointUpdate);
  }, [user, updatePointWithAnim]);

  // --- [원본 기능: 관리자 기록 수정 리스너] ---
  useEffect(() => {
    const handleHistoryUpdate = () => {
      const saved = localStorage.getItem("event_total_history");
      if (saved) setTotalHistory(JSON.parse(saved));
    };
    window.addEventListener("event_history_update", handleHistoryUpdate);
    return () => window.removeEventListener("event_history_update", handleHistoryUpdate);
  }, []);

  // ⭐ [원본 기능: 관리자 과거 회차 조작 실시간 감지 리스너]
  useEffect(() => {
    if (!user?.id) return;

    const revisionQuery = query(
      collection(db, "event_manipulation"),
      where("isRevision", "==", true)
    );

    const unsubscribe = onSnapshot(revisionQuery, async (snapshot) => {
      const changes = snapshot.docChanges();
      
      for (const change of changes) {
        if (change.type === "added" || change.type === "modified") {
          const revisedRound = parseInt(change.doc.id);
          const data = change.doc.data();
          const newWinners = data.winner || [];

          console.log(`🔄 ${revisedRound}회차 결과 재정산 감지! 로컬 캐시 갱신 중...`);

          const savedTotal = JSON.parse(localStorage.getItem("event_total_history") || "[]");
          const updatedTotal = savedTotal.map(item => {
            if (item.round === revisedRound) {
              const winItems = newWinners.map(name => {
                const config = ITEM_CONFIG.find(c => c.name === name);
                return config ? `${config.icon} ${config.name}` : name;
              });
              return { ...item, winItems };
            }
            return item;
          });

          localStorage.setItem("event_total_history", JSON.stringify(updatedTotal));
          setTotalHistory(updatedTotal);

          const myHist = JSON.parse(localStorage.getItem(`event_my_history_${user?.id}`) || "[]");
          const myUpdated = myHist.map(record => {
            if (record.round === revisedRound) {
              const winIcons = newWinners.map(name => {
                const config = ITEM_CONFIG.find(c => c.name === name);
                return config ? config.icon : "❓";
              });
              
              // ★ [수정] 재정산 배당 계산도 공통 함수 사용
              const matchedCount = record.selected.filter(name => newWinners.includes(name)).length;
              const newEarn = calcWinAmount(record.selected, matchedCount, record.cost);

              return {
                ...record,
                winNames: newWinners,
                winIcons,
                earn: newEarn,
                revised: true 
              };
            }
            return record;
          });

          localStorage.setItem(`event_my_history_${user?.id}`, JSON.stringify(myUpdated));
          setMyHistory(myUpdated);

          console.log(`✅ ${revisedRound}회차 로컬 캐시 갱신 완료`);
        }
      }
    }, (error) => {
      console.error("❌ 재정산 리스너 오류:", error);
    });

    return () => unsubscribe();
  }, [user?.id]);

  // ⭐ [사용자 추가 기능 유지] 관리자의 실시간 베팅 수정 감지
  // 현재 유저의 pending 베팅(docId)을 실시간 구독하여, 관리자가 items나 betAmount를
  // 파이어베이스에서 수정하면 즉시 유저 UI/로컬 상태가 갱신됨
  useEffect(() => {
    if (!myPendingBet?.docId) return;

    const betDocRef = doc(db, "event_bets", myPendingBet.docId);
    const unsubscribe = onSnapshot(betDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        setMyPendingBet(prev => {
          if (!prev) return prev;
          
          // 기존 데이터와 관리자가 수정한 파이어베이스 데이터 비교
          const isItemsChanged = JSON.stringify(prev.items) !== JSON.stringify(data.items);
          const isAmountChanged = prev.totalCost !== data.betAmount;

          if (isItemsChanged || isAmountChanged) {
            const newItems = data.items || prev.items;
            const newTotalCost = data.betAmount !== undefined ? data.betAmount : prev.totalCost;
            const newPerAmount = newTotalCost / Math.max(1, newItems.length); // 아이템 개수로 베팅 단가 재계산

            const updatedBet = {
              ...prev,
              items: newItems,
              totalCost: newTotalCost,
              perAmount: newPerAmount
            };

            // 엔진 최신화 및 로컬 백업 최신화
            betRef.current = updatedBet;
            localStorage.setItem(`pending_bet_${user?.id}`, JSON.stringify(updatedBet));
            console.log("🛠️ 관리자가 베팅 정보를 실시간으로 수정했습니다.", updatedBet);
            
            return updatedBet;
          }
          return prev;
        });
      }
    });

    return () => unsubscribe();
  }, [myPendingBet?.docId, user?.id]);

  // 베팅 시 로컬 스토리지에 즉시 백업
  const handleSetMyPendingBet = (bet) => {
    betRef.current = bet;
    setMyPendingBet(bet);
    if (bet) {
      localStorage.setItem(`pending_bet_${user?.id}`, JSON.stringify(bet));
    } else {
      localStorage.removeItem(`pending_bet_${user?.id}`);
    }
  };

  // --- [라운드 종료: 서버 연동 및 정산 처리] ---
  const handleRoundEnd = useCallback(async (targetRound) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    
    setGameState(prev => ({ ...prev, isDrawing: true, timeLeft: 0 }));
    soundManager.play("draw");

    const shuffleInterval = setInterval(() => {
      const randomIcons = EventService.generateResult(Math.random()).map(i => i.icon);
      setDrawingItems(randomIcons);
    }, 120);

    const fixedResult = await EventService.getFixedResult(targetRound);

    setTimeout(() => {
      clearInterval(shuffleInterval);
      
      const winObjs = fixedResult || EventService.generateResult(targetRound);
      const winNames = winObjs.map(i => i.name);
      const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      
      // 💥 결과 확정 순간: 임팩트 폭발 연출 + 붐 사운드
      setDrawingItems(winObjs.map(v => v.icon));
      setImpactTick(t => t + 1);
      soundManager.play("impact");
      if (navigator.vibrate) navigator.vibrate(80);
      
      setTotalHistory(prev => {
        const newHistoryItem = { 
          round: targetRound, 
          winItems: winObjs.map(v => `${v.icon} ${v.name}`), 
          date: currentTime 
        };
        const updated = [newHistoryItem, ...prev].slice(0, 100);
        localStorage.setItem("event_total_history", JSON.stringify(updated));
        return updated;
      });

      // game_history 컬렉션에 회차 결과 자동 저장 (관리자 페이지 이벤트 통계용)
      try {
        setDoc(doc(db, "game_history", String(targetRound)), {
          round: targetRound,
          winner: winNames,
          winItems: winObjs.map(v => `${v.icon} ${v.name}`),
          date: currentTime,
          savedAt: new Date().toISOString()
        }, { merge: true }).catch(err => {
          console.error("game_history 저장 실패:", err);
        });
      } catch (e) {
        console.error("game_history 저장 오류:", e);
      }

      const activeBet = betRef.current;
      if (activeBet && activeBet.round === targetRound) {
        const { items, totalCost } = activeBet;
        const matchedCount = items.filter(name => winNames.includes(name)).length;
        // ★ [수정] 배당 계산 공통 함수 사용
        const winAmount = calcWinAmount(items, matchedCount, totalCost);

        // ★ [수정] "본전 방어(isDraw)" 개념 완전 삭제
        //   - 이기면 winAmount > 0, 지면 winAmount === 0
        //   - 무승부 없음
        const isSuccess = winAmount > 0;

        setMyHistory(prev => {
          const updated = [{
            round: targetRound, selected: [...items], winNames, winIcons: winObjs.map(i => i.icon),
            earn: winAmount, cost: totalCost, date: currentTime
          }, ...prev].slice(0, 100);
          localStorage.setItem(`event_my_history_${user?.id}`, JSON.stringify(updated));
          return updated;
        });

        // ✨ 임팩트가 먼저 터지고 → 0.8초 뒤에 결과 모달 등장
        setTimeout(() => {
          if (isSuccess) { 
            soundManager.play("win");
            if (navigator.vibrate) navigator.vibrate([100, 50, 150]); 
          } else if (totalCost > 0) { 
            soundManager.play("lose");
          }

          // ★ [수정] 결과 반영: 로컬 상태 + Firestore 잔액을 동시에 업데이트
          //   - 로컬 = 즉시 UI 반영, 사용자 애니메이션 자연스러움
          //   - Firestore = 마이페이지 등 다른 페이지에도 실시간 반영
          //   - 지면 winAmount = 0이므로 잔액 그대로 (배팅액은 handleDonate에서 이미 차감됨)
          const newPoint = pointRef.current + winAmount;
          updatePointWithAnim(newPoint);
          syncDiamondToFirestore(newPoint);
          
          setShowResult({ 
            winItems: winObjs.map(v => `${v.icon} ${v.name}`), 
            winAmount, 
            betTotal: totalCost, 
            isWin: isSuccess
            // ★ [삭제] isDraw 필드 제거 - 본전 방어 개념 없음
          });
        }, 800);
      }

      setTimeout(() => {
        handleSetMyPendingBet(null);
        isProcessingRef.current = false;
      }, 2600);

    }, 3000); 
  }, [user?.id, updatePointWithAnim, syncDiamondToFirestore]);

  // --- [원본 기능: 시간 동기화 루프] ---
  useEffect(() => {
    const tick = () => {
      const { round, timeLeft, isDrawingPhase } = EventService.getCurrentRoundInfo();
      if (roundRef.current !== 0 && round > roundRef.current && !isProcessingRef.current) {
        handleRoundEnd(roundRef.current); 
      }
      roundRef.current = round; 
      setGameState(prev => {
        if (isProcessingRef.current) return prev; 
        if (prev.round !== round || prev.timeLeft !== timeLeft) {
          return { round, timeLeft, isDrawing: isDrawingPhase };
        }
        return prev;
      });
    };
    const interval = setInterval(tick, 1000);
    tick(); 
    return () => clearInterval(interval);
  }, [handleRoundEnd]);

  // --- [원본 기능: 라이브 알림 생성기] ---
  useEffect(() => {
    const generateRandomUser = () => {
      const type = Math.random();
      if (type < 0.3) {
        const f = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신"];
        const l = ["수", "진", "영", "호", "민", "훈", "우", "석", "준", "현", "철", "미"];
        return `${f[Math.floor(Math.random()*f.length)]}*${l[Math.floor(Math.random()*l.length)]}`;
      } else if (type < 0.6) {
        return `010-****-${Math.floor(1000 + Math.random() * 8999)}`;
      } else {
        const pre = ["Super", "King", "God", "Win", "Lucky"];
        return `${pre[Math.floor(Math.random()*pre.length)]}${Math.floor(Math.random()*999)}`;
      }
    };
    const messages = ["대박 당첨!", "적중 성공!", "수익 실현!", "축하합니다!", "배당금 획득!"];
    const notiTimer = setInterval(() => {
      const rName = generateRandomUser();
      const rItem = ITEM_CONFIG[Math.floor(Math.random() * ITEM_CONFIG.length)];
      const rMsg = messages[Math.floor(Math.random() * messages.length)];
      setLiveNoti(`${rName}님이 ${rItem.icon} ${rItem.name} ${rMsg}`);
    }, 6000 + Math.random() * 4000);
    return () => clearInterval(notiTimer);
  }, []);

  // --- [원본 기능: 통계 계산] ---
  const stats = useMemo(() => EventService.calculateStats(totalHistory), [totalHistory]);

  return {
    round: gameState.round,
    timeLeft: gameState.timeLeft,
    isDrawing: gameState.isDrawing || isProcessingRef.current, 
    drawingItems,
    totalHistory,
    myHistory,
    myPendingBet,
    setMyPendingBet: handleSetMyPendingBet,
    showResult,
    setShowResult,
    liveNoti,
    stats,
    impactTick,
    updatePointWithAnim,
    // ★ [신규] Firestore 잔액 동기화 함수 export - EventSection의 handleDonate에서 사용
    syncDiamondToFirestore,
  };
}