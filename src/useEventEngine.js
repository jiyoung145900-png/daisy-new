import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { EventService, soundManager, ITEM_CONFIG } from "./EventService"; 
import { db } from "./firebase";
import { collection, onSnapshot, query, where, doc, setDoc } from "firebase/firestore";

export { ITEM_CONFIG as allItems }; 

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

  // ✨ [신규] 결과 공개 순간 임팩트 트리거 (숫자가 바뀔 때마다 UI에서 폭발 연출 재생)
  const [impactTick, setImpactTick] = useState(0);

  // --- [원본 기능: 포인트 업데이트] ---
  const updatePointWithAnim = useCallback((newPoint) => {
    if (onUpdatePoint) {
      onUpdatePoint(newPoint);
      if (pointControls) pointControls.start({ scale: [1, 1.2, 1], transition: { duration: 0.3 } });
    }
  }, [onUpdatePoint, pointControls]);

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
          
          const { items, perAmount, totalCost } = parsedBet;
          const matchedCount = items.filter(name => winNames.includes(name)).length;
          let winAmount = 0;
          
          if (items.length === 1) { 
            if (matchedCount >= 1) winAmount = perAmount * 2; 
          } else if (items.length === 2) {
            if (matchedCount === 1) winAmount = totalCost; 
            else if (matchedCount === 2) winAmount = totalCost * 4; 
          }

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

          if (winAmount > 0) {
            updatePointWithAnim(pointRef.current + winAmount);
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
              
              const matchedCount = record.selected.filter(name => newWinners.includes(name)).length;
              let newEarn = 0;
              if (record.selected.length === 1) {
                if (matchedCount >= 1) newEarn = record.cost * 2;
              } else if (record.selected.length === 2) {
                if (matchedCount === 1) newEarn = record.cost;
                else if (matchedCount === 2) newEarn = record.cost * 4;
              }

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

  // ⭐ [핵심 신규 추가: 관리자의 실시간 베팅 수정 감지]
  // 현재 베팅 정보(docId)가 있으면 파이어베이스 문서를 실시간으로 바라보며 변경 즉시 로컬 정보 갱신
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

      const activeBet = betRef.current;
      if (activeBet && activeBet.round === targetRound) {
        const { items, perAmount, totalCost } = activeBet;
        const matchedCount = items.filter(name => winNames.includes(name)).length;
        let winAmount = 0;

        if (items.length === 1) { 
          if (matchedCount >= 1) winAmount = perAmount * 2; 
        } else if (items.length === 2) {
          if (matchedCount === 1) winAmount = totalCost; 
          else if (matchedCount === 2) winAmount = totalCost * 4; 
        }

        const isSuccess = winAmount > totalCost;
        const isDraw = winAmount === totalCost && totalCost > 0;

        setMyHistory(prev => {
          const updated = [{
            round: targetRound, selected: [...items], winNames, winIcons: winObjs.map(i => i.icon),
            earn: winAmount, cost: totalCost, date: currentTime
          }, ...prev].slice(0, 100);
          localStorage.setItem(`event_my_history_${user?.id}`, JSON.stringify(updated));
          return updated;
        });

        setTimeout(() => {
          if (isSuccess) { 
            soundManager.play("win");
            if (navigator.vibrate) navigator.vibrate([100, 50, 150]); 
          } else if (!isDraw && totalCost > 0) { 
            soundManager.play("lose");
          }

          updatePointWithAnim(pointRef.current + winAmount);
          
          setShowResult({ 
            winItems: winObjs.map(v => `${v.icon} ${v.name}`), 
            winAmount, 
            betTotal: totalCost, 
            isWin: isSuccess, 
            isDraw 
          });
        }, 800);
      }

      setTimeout(() => {
        handleSetMyPendingBet(null);
        isProcessingRef.current = false;
      }, 2600);

    }, 3000); 
  }, [user?.id, updatePointWithAnim]);

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
    updatePointWithAnim
  };
}