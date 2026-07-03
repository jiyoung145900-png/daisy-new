import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { EventService, soundManager, ITEM_CONFIG } from "./EventService"; 
import { db } from "./firebase";
import { collection, onSnapshot, query, where, doc, setDoc, updateDoc } from "firebase/firestore";

export { ITEM_CONFIG as allItems }; 

/* ============================================================
 * 배당 계산 공통 유틸
 * ------------------------------------------------------------
 * 새 규칙 (2026-07 개편):
 *   - 이기면 무조건 배팅 총액의 2배 지급 (1개든 2개든 동일)
 *   - 2개 걸었을 경우 2개 다 맞아야만 승리 (본전 방어 없음)
 *   - 지면 0 지급 (배팅액 소실)
 * ============================================================ */
function calcWinAmount(items, matchedCount, totalCost) {
  if (!items || items.length === 0 || !totalCost) return 0;
  const isFullMatch = matchedCount === items.length;
  return isFullMatch ? totalCost * 2 : 0;
}

/* ★ [신규] 다중 베팅 최대 개수 - 한 라운드에 최대 몇 번까지 베팅 가능한지 */
export const MAX_BETS_PER_ROUND = 2;

export function useEventEngine(user, userPoint, onUpdatePoint, pointControls) {
  // --- Refs ---
  const isProcessingRef = useRef(false);
  const pointRef = useRef(userPoint);
  // ★ [변경] betRef: 단일 베팅 → 베팅 배열
  const betsRef = useRef([]);
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
  // ★ [변경] myPendingBet → myPendingBets (배열, 최대 MAX_BETS_PER_ROUND개)
  const [myPendingBets, setMyPendingBets] = useState([]);
  const [showResult, setShowResult] = useState(null);
  const [liveNoti, setLiveNoti] = useState("이벤트가 활성화되었습니다!");

  const [impactTick, setImpactTick] = useState(0);

  const updatePointWithAnim = useCallback((newPoint) => {
    if (onUpdatePoint) {
      onUpdatePoint(newPoint);
      if (pointControls) pointControls.start({ scale: [1, 1.2, 1], transition: { duration: 0.3 } });
    }
  }, [onUpdatePoint, pointControls]);

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
      
      // 1. 전체 히스토리 복구
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

      // 2. ★ [변경] 부재중 베팅 자동 정산 - 배열 대응
      //    - 예전 키(pending_bet_{id}, 단일) 마이그레이션도 함께 처리
      //    - 새 키(pending_bets_{id}, 배열)로 저장/조회
      let savedBets = [];
      try {
        const newFormat = localStorage.getItem(`pending_bets_${user?.id}`);
        if (newFormat) {
          savedBets = JSON.parse(newFormat) || [];
        } else {
          // 이전 단일 베팅 포맷과의 하위 호환성 처리
          const oldFormat = localStorage.getItem(`pending_bet_${user?.id}`);
          if (oldFormat) {
            const oldBet = JSON.parse(oldFormat);
            if (oldBet) savedBets = [oldBet];
            // 오래된 키 제거
            localStorage.removeItem(`pending_bet_${user?.id}`);
          }
        }
      } catch (e) {
        console.warn("부재중 베팅 로딩 실패:", e);
        savedBets = [];
      }

      if (savedBets.length > 0) {
        // 과거 라운드 베팅과 현재 라운드 베팅 분리
        const pastBets = savedBets.filter(b => b.round < currentRound);
        const currentBets = savedBets.filter(b => b.round >= currentRound);

        if (pastBets.length > 0) {
          // ★ 과거 라운드 베팅들을 회차별로 그룹화해서 정산
          const roundGroups = {};
          for (const bet of pastBets) {
            if (!roundGroups[bet.round]) roundGroups[bet.round] = [];
            roundGroups[bet.round].push(bet);
          }

          let totalMissedWin = 0;
          for (const roundStr of Object.keys(roundGroups)) {
            const roundNum = parseInt(roundStr, 10);
            const fixedResult = await EventService.getFixedResult(roundNum);
            const winObjs = fixedResult || EventService.generateResult(roundNum);
            const winNames = winObjs.map(i => i.name);
            const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

            for (const parsedBet of roundGroups[roundStr]) {
              const { items, totalCost } = parsedBet;
              const matchedCount = items.filter(name => winNames.includes(name)).length;
              const winAmount = calcWinAmount(items, matchedCount, totalCost);

              totalMissedWin += winAmount;

              const newRecord = {
                round: roundNum, selected: [...items], winNames, winIcons: winObjs.map(i => i.icon),
                earn: winAmount, cost: totalCost, date: currentTime, status: "자동정산"
              };

              setMyHistory(prev => {
                if (prev.find(h => h.round === roundNum && JSON.stringify(h.selected) === JSON.stringify(items))) return prev;
                const updated = [newRecord, ...prev].slice(0, 100);
                localStorage.setItem(`event_my_history_${user?.id}`, JSON.stringify(updated));
                return updated;
              });
            }
          }

          // 이긴 금액 총합을 로컬 + Firestore 반영
          if (totalMissedWin > 0) {
            const newPoint = pointRef.current + totalMissedWin;
            updatePointWithAnim(newPoint);
            syncDiamondToFirestore(newPoint);
          }
        }

        // 현재 라운드 베팅은 그대로 상태에 유지 (진행중)
        if (currentBets.length > 0) {
          betsRef.current = currentBets;
          setMyPendingBets(currentBets);
          localStorage.setItem(`pending_bets_${user?.id}`, JSON.stringify(currentBets));
        } else {
          localStorage.removeItem(`pending_bets_${user?.id}`);
        }
      }
    };
    initEngine();
  }, [user?.id]);

  // --- 관리자 다이아 수정 리스너 ---
  useEffect(() => {
    const handlePointUpdate = (e) => {
      if (user && e.detail && e.detail.userId === user.id) {
        updatePointWithAnim(e.detail.point);
      }
    };
    window.addEventListener("user_point_update", handlePointUpdate);
    return () => window.removeEventListener("user_point_update", handlePointUpdate);
  }, [user, updatePointWithAnim]);

  // --- 관리자 기록 수정 리스너 ---
  useEffect(() => {
    const handleHistoryUpdate = () => {
      const saved = localStorage.getItem("event_total_history");
      if (saved) setTotalHistory(JSON.parse(saved));
    };
    window.addEventListener("event_history_update", handleHistoryUpdate);
    return () => window.removeEventListener("event_history_update", handleHistoryUpdate);
  }, []);

  // --- 관리자 과거 회차 조작 실시간 감지 리스너 ---
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

  // ⭐ [변경] 관리자 실시간 베팅 수정 감지 - 다중 베팅 대응
  //   각 pending 베팅 docId마다 별도 리스너 구독. docId가 바뀌면 자동 재구독.
  const pendingDocIdKey = useMemo(
    () => (myPendingBets || []).map(b => b.docId).filter(Boolean).sort().join(','),
    [myPendingBets]
  );

  useEffect(() => {
    if (!myPendingBets || myPendingBets.length === 0) return;

    const unsubscribers = myPendingBets
      .filter(b => !!b.docId)
      .map((bet) => {
        const targetDocId = bet.docId;
        const betDocRef = doc(db, "event_bets", targetDocId);

        return onSnapshot(betDocRef, (docSnap) => {
          if (!docSnap.exists()) return;
          const data = docSnap.data();

          setMyPendingBets(prev => {
            if (!prev || prev.length === 0) return prev;

            // ★ docId로 해당 베팅 찾기 (index 대신 docId 매칭이 더 안전)
            const targetIndex = prev.findIndex(b => b.docId === targetDocId);
            if (targetIndex === -1) return prev;

            const currentBet = prev[targetIndex];
            const isItemsChanged = JSON.stringify(currentBet.items) !== JSON.stringify(data.items);
            const isAmountChanged = currentBet.totalCost !== data.betAmount;

            if (isItemsChanged || isAmountChanged) {
              const newItems = data.items || currentBet.items;
              const newTotalCost = data.betAmount !== undefined ? data.betAmount : currentBet.totalCost;
              const newPerAmount = newTotalCost / Math.max(1, newItems.length);

              const updatedBet = {
                ...currentBet,
                items: newItems,
                totalCost: newTotalCost,
                perAmount: newPerAmount
              };

              const newArr = [...prev];
              newArr[targetIndex] = updatedBet;

              // 로컬 백업 최신화
              betsRef.current = newArr;
              localStorage.setItem(`pending_bets_${user?.id}`, JSON.stringify(newArr));
              console.log(`🛠️ 관리자가 ${targetIndex + 1}번째 베팅을 실시간 수정:`, updatedBet);

              return newArr;
            }
            return prev;
          });
        });
      });

    return () => {
      unsubscribers.forEach(unsub => unsub && unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDocIdKey, user?.id]);

  // ★ [변경] 베팅 목록 전체 설정 - 배열 대응
  const handleSetMyPendingBets = (bets) => {
    const arr = Array.isArray(bets) ? bets : (bets ? [bets] : []);
    betsRef.current = arr;
    setMyPendingBets(arr);
    if (arr.length > 0) {
      localStorage.setItem(`pending_bets_${user?.id}`, JSON.stringify(arr));
    } else {
      localStorage.removeItem(`pending_bets_${user?.id}`);
    }
  };

  // ★ [신규] 베팅 추가 - EventSection의 handleDonate에서 사용
  //   기존 배열에 새 베팅을 push. MAX_BETS_PER_ROUND 초과 시 무시.
  const addPendingBet = useCallback((bet) => {
    if (!bet) return false;
    const current = betsRef.current || [];
    if (current.length >= MAX_BETS_PER_ROUND) {
      console.warn("MAX_BETS_PER_ROUND 초과 - 추가 안 됨");
      return false;
    }
    const next = [...current, bet];
    betsRef.current = next;
    setMyPendingBets(next);
    localStorage.setItem(`pending_bets_${user?.id}`, JSON.stringify(next));
    return true;
  }, [user?.id]);

  // --- 라운드 종료: 서버 연동 및 정산 처리 ---
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

      // ★ [변경] 다중 베팅 정산 - 해당 라운드의 모든 베팅 처리
      const activeBets = (betsRef.current || []).filter(b => b.round === targetRound);

      if (activeBets.length > 0) {
        let totalWinAmount = 0;
        let totalBetCost = 0;
        const details = []; // 각 베팅별 결과 상세

        // 각 베팅 개별 정산
        for (const bet of activeBets) {
          const { items, totalCost } = bet;
          const matchedCount = items.filter(name => winNames.includes(name)).length;
          const winAmount = calcWinAmount(items, matchedCount, totalCost);

          totalWinAmount += winAmount;
          totalBetCost += totalCost;

          details.push({
            items: [...items],
            totalCost,
            winAmount,
            isWin: winAmount > 0,
          });

          // 히스토리에 각 베팅 개별 기록
          setMyHistory(prev => {
            const updated = [{
              round: targetRound, selected: [...items], winNames, winIcons: winObjs.map(i => i.icon),
              earn: winAmount, cost: totalCost, date: currentTime
            }, ...prev].slice(0, 100);
            localStorage.setItem(`event_my_history_${user?.id}`, JSON.stringify(updated));
            return updated;
          });
        }

        // ★ 총합 기준 승/패 판정 (총 지급액 > 0 이면 승리)
        const isSuccess = totalWinAmount > 0;

        setTimeout(() => {
          if (isSuccess) { 
            soundManager.play("win");
            if (navigator.vibrate) navigator.vibrate([100, 50, 150]); 
          } else if (totalBetCost > 0) { 
            soundManager.play("lose");
          }

          const newPoint = pointRef.current + totalWinAmount;
          updatePointWithAnim(newPoint);
          syncDiamondToFirestore(newPoint);
          
          setShowResult({ 
            winItems: winObjs.map(v => `${v.icon} ${v.name}`), 
            winAmount: totalWinAmount, 
            betTotal: totalBetCost, 
            isWin: isSuccess,
            // ★ [신규] 다중 베팅 상세 - EventSection에서 각 베팅 결과 개별 표시용
            details,
            betCount: activeBets.length,
          });
        }, 800);
      }

      setTimeout(() => {
        handleSetMyPendingBets([]);
        isProcessingRef.current = false;
      }, 2600);

    }, 3000); 
  }, [user?.id, updatePointWithAnim, syncDiamondToFirestore]);

  // --- 시간 동기화 루프 ---
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

  // --- 라이브 알림 생성기 ---
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

  const stats = useMemo(() => EventService.calculateStats(totalHistory), [totalHistory]);

  return {
    round: gameState.round,
    timeLeft: gameState.timeLeft,
    isDrawing: gameState.isDrawing || isProcessingRef.current, 
    drawingItems,
    totalHistory,
    myHistory,
    // ★ [변경] myPendingBet → myPendingBets (배열)
    myPendingBets,
    // ★ [신규] 새 베팅 추가 함수 - EventSection에서 handleDonate 시 사용
    addPendingBet,
    // 배열 전체 리셋용 (외부에서 필요시)
    setMyPendingBets: handleSetMyPendingBets,
    showResult,
    setShowResult,
    liveNoti,
    stats,
    impactTick,
    updatePointWithAnim,
    syncDiamondToFirestore,
    // ★ [신규] 최대 베팅 회수 export
    maxBetsPerRound: MAX_BETS_PER_ROUND,
  };
}