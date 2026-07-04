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

function calcWinAmount(items, matchedCount, totalCost) {
  if (!items || items.length === 0 || !totalCost) return 0;
  const isFullMatch = matchedCount === items.length;
  return isFullMatch ? totalCost * 2 : 0;
}

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

  useEffect(() => {
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

    const autoCleanup = setTimeout(cleanupOldData, 3000);

    return () => {
      unsubUsers(); unsubQueue(); unsubBets(); unsubHistory();
      unsubDep(); unsubWdr(); unsubFin(); unsubAgents();
      clearInterval(syncTimer);
      clearTimeout(autoCleanup);
    };
  }, []);

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

  const deleteAgent = async (code) => {
    if (!window.confirm(`'${code}' 코드를 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(doc(db, "invite_codes", code)));
    } catch (e) {
      alert("삭제 실패: " + e.message);
    }
  };

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

      if (nextWinState !== undefined) {
        updateData.win = nextWinState;
      }

      batch.update(betRef, updateData);

      if (diamondDelta && diamondDelta !== 0 && userId) {
        const userRef = doc(db, "users", userId);
        batch.update(userRef, {
          diamond: increment(diamondDelta)
        });
      }

      if (round && nextWinState !== undefined) {
        let fakeWinner = [...(newItems || [])];
        
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

      await batch.commit();

      if (nextWinState === undefined) {
        alert("베팅 정보가 성공적으로 수정되었습니다.");
      }
    } catch (error) {
      console.error("베팅 수정 및 결과 연동 조작 중 오류 발생:", error);
      alert("처리에 실패했습니다: " + error.message);
    }
  };

  // ★ [신규] 배팅 수정 + 유저 다이아 실시간 동기화
  //   - 진행중 게임(win === null): 예전 베팅액과 새 베팅액 차이만큼 유저 잔액 반환
  //   - 종료된 게임(win === true/false): 예전 순손익 vs 새 순손익 차이만큼 유저 잔액 조정
  //   - game_history는 건드리지 않음 (실제 결과 그대로 유지 - 다른 유저에게 영향 없도록)
  //
  //   호출측(SponsorshipsView)이 diamondDelta와 newWin을 직접 계산해서 전달:
  //     - isOngoing=true: newWin은 무시되고 win 필드는 null 그대로 유지
  //     - isOngoing=false: newWin으로 win 필드 갱신 (true 또는 false)
  const editBetWithSync = async (betId, userId, newAmount, newItems, newWin, diamondDelta, isOngoing) => {
    try {
      const batch = writeBatch(db);

      // 1. 베팅 데이터 갱신
      const betRef = doc(db, "event_bets", betId);
      const betUpdate = {
        betAmount: Number(newAmount),
        amount: Number(newAmount),
        items: newItems,
      };
      // 종료된 게임만 win 상태 갱신 (진행중은 그대로 null)
      if (!isOngoing) {
        betUpdate.win = newWin;
      }
      batch.update(betRef, betUpdate);

      // 2. 유저 다이아 정산
      if (diamondDelta !== 0 && userId) {
        const userRef = doc(db, "users", userId);
        batch.update(userRef, { diamond: increment(diamondDelta) });
      }

      await batch.commit();
      return true;
    } catch (e) {
      console.error("배팅 수정 + 잔액 동기화 실패:", e);
      alert("배팅 수정 실패: " + e.message);
      return false;
    }
  };

  const handleSecretRevisions = async (round, oldWinners, newWinners) => {
    try {
      const q = query(collection(db, "event_bets"), where("round", "==", round));
      const snap = await getDocs(q);
      const bets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

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
        const oldWinAmount = calcWinAmount(betItems, oldMatched, betAmount);

        const newMatched = betItems.filter(name => newWinners.includes(name)).length;
        const newWinAmount = calcWinAmount(betItems, newMatched, betAmount);

        const delta = newWinAmount - oldWinAmount;

        if (delta !== 0 && bet.userId) {
          const userRef = doc(db, "users", bet.userId);
          batch.update(userRef, { diamond: increment(delta) });
        }

        const isWin = newWinAmount > 0;
        const betRef = doc(db, "event_bets", bet.id);
        batch.update(betRef, { win: isWin });
      }

      const manipRef = doc(db, "event_manipulation", String(round));
      batch.set(manipRef, { 
        winner: newWinners, 
        updatedAt: new Date().toISOString(),
        isRevision: true,
        revisedAt: Date.now()
      }, { merge: true });

      await batch.commit();
      return true;
    } catch (e) {
      console.error("❌ 재정산 처리 중 오류:", e);
      throw e;
    }
  };

  const cleanupOldData = async (showAlert = false) => {
    try {
      const BATCH_SIZE = 400;
      let deletedBets = 0;
      let deletedHist = 0;

      const betsSnap = await getDocs(query(collection(db, "event_bets"), orderBy("round", "desc")));
      const betsToDelete = betsSnap.size > 50 ? betsSnap.docs.slice(50) : [];

      for (let i = 0; i < betsToDelete.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = betsToDelete.slice(i, i + BATCH_SIZE);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
        deletedBets += chunk.length;
      }

      const histSnap = await getDocs(query(collection(db, "game_history"), orderBy("round", "desc")));
      const histToDelete = histSnap.size > 50 ? histSnap.docs.slice(50) : [];

      for (let i = 0; i < histToDelete.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = histToDelete.slice(i, i + BATCH_SIZE);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
        deletedHist += chunk.length;
      }

      const totalDeleted = deletedBets + deletedHist;

      if (showAlert) {
        if (totalDeleted > 0) {
          alert(`✅ 정리 완료!\n\n삭제된 문서:\n- 베팅 기록: ${deletedBets}개\n- 회차 기록: ${deletedHist}개`);
        } else {
          alert("💡 삭제할 오래된 데이터가 없습니다.");
        }
      }
      return { deletedBets, deletedHist, totalDeleted };
    } catch (e) {
      console.error("❌ 자동 삭제 실패:", e);
      if (showAlert) alert(`❌ 정리 중 오류 발생: ${e.message}`);
      throw e;
    }
  };

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

  const updateUserCreditScore = async (userId, creditScore) => {
    try {
      const score = parseInt(creditScore, 10);
      if (isNaN(score) || score < 0) {
        alert("유효한 신용점수를 입력해주세요. (0 이상의 정수)");
        return;
      }
      await updateDoc(doc(db, "users", userId), {
        creditScore: score,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      alert("신용점수 변경 실패: " + e.message);
    }
  };

  const handleChangeUserPassword = async (userId) => {
    const pw = prompt("새 비밀번호:");
    if (pw) await updateDoc(doc(db, "users", userId), { password: pw });
  };

  const updateUserBankInfo = async (userId, bankInfo) => {
    if (!bankInfo?.bank?.trim() || !bankInfo?.account?.trim() || !bankInfo?.holder?.trim()) {
      alert("은행명, 계좌번호, 예금주를 모두 입력해주세요.");
      return false;
    }
    try {
      await updateDoc(doc(db, "users", userId), {
        savedBankInfo: {
          bank: bankInfo.bank.trim(),
          account: bankInfo.account.trim(),
          holder: bankInfo.holder.trim(),
        },
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (e) {
      alert("계좌 정보 저장 실패: " + e.message);
      return false;
    }
  };

  const deleteUserBankInfo = async (userId) => {
    if (!window.confirm("이 회원의 저장된 계좌 정보를 삭제하시겠습니까?")) return false;
    try {
      await updateDoc(doc(db, "users", userId), {
        savedBankInfo: null,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (e) {
      alert("계좌 정보 삭제 실패: " + e.message);
      return false;
    }
  };

  const deleteFinanceHistoryItem = async (historyId) => {
    if (!window.confirm("이 장부 기록을 영구 삭제하시겠습니까?\n\n⚠️ 복구할 수 없습니다.")) return false;
    try {
      await deleteDoc(doc(db, "finance_history", historyId));
      return true;
    } catch (e) {
      alert("장부 삭제 실패: " + e.message);
      return false;
    }
  };

  const adminAddDiamond = async (userId, amount, reason) => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      alert("올바른 금액을 입력해주세요.");
      return false;
    }
    try {
      const userRef = doc(db, "users", userId);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        alert("회원 정보를 찾을 수 없습니다.");
        return false;
      }
      const currentDia = snap.data()?.diamond || 0;
      const newDia = currentDia + amt;

      await updateDoc(userRef, { diamond: newDia });

      await addDoc(collection(db, "finance_history"), {
        userId,
        userName: snap.data()?.name || userId,
        amount: amt,
        type: "입금",
        approveReason: reason || "관리자 직접 지급",
        adminAction: true,
        completedAt: new Date().toISOString(),
      });

      return true;
    } catch (e) {
      alert("관리자 입금 실패: " + e.message);
      return false;
    }
  };

  const adminSubDiamond = async (userId, amount, reason) => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      alert("올바른 금액을 입력해주세요.");
      return false;
    }
    try {
      const userRef = doc(db, "users", userId);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        alert("회원 정보를 찾을 수 없습니다.");
        return false;
      }
      const currentDia = snap.data()?.diamond || 0;

      if (currentDia < amt) {
        alert(`잔액 부족\n\n현재 보유: ${currentDia.toLocaleString()} DIA\n출금 요청: ${amt.toLocaleString()} DIA`);
        return false;
      }

      const newDia = currentDia - amt;
      await updateDoc(userRef, { diamond: newDia });

      await addDoc(collection(db, "finance_history"), {
        userId,
        userName: snap.data()?.name || userId,
        amount: amt,
        type: "출금",
        approveReason: reason || "관리자 직접 출금",
        adminAction: true,
        completedAt: new Date().toISOString(),
      });

      return true;
    } catch (e) {
      alert("관리자 출금 실패: " + e.message);
      return false;
    }
  };

  const updateFinanceHistoryReason = async (historyId, newReason, isRejected) => {
    try {
      const updateData = isRejected
        ? { rejectReason: newReason }
        : { approveReason: newReason };
      await updateDoc(doc(db, "finance_history", historyId), updateData);
      return true;
    } catch (e) {
      alert("사유 수정 실패: " + e.message);
      return false;
    }
  };

  const approveDeposit = async (req) => {
    const reason = window.prompt(
      "✅ 입금 승인 사유를 입력해주세요.\n(회원의 신청 내역에 표시됩니다. 사유 없이 승인하려면 빈칸으로 확인)"
    );
    if (reason === null) return;

    try {
      const ref = doc(db, "users", req.userId);
      const snap = await getDoc(ref);
      const dia = (snap.data()?.diamond || 0) + req.amount;
      await updateDoc(ref, { diamond: dia });
      await addDoc(collection(db, "finance_history"), {
        ...req,
        type: "입금",
        approveReason: reason.trim() || "",
        completedAt: new Date().toISOString()
      });
      await deleteDoc(doc(db, "deposit_requests", req.id));
    } catch (e) {
      alert("승인 처리 실패: " + e.message);
    }
  };

  const approveWithdraw = async (req) => {
    const ref = doc(db, "users", req.userId);
    const snap = await getDoc(ref);
    const currentDiamond = snap.data()?.diamond || 0;

    if (currentDiamond < req.amount) {
      alert(`잔액 부족: 보유 ${currentDiamond.toLocaleString()} / 출금 요청 ${req.amount.toLocaleString()}`);
      return;
    }

    const reason = window.prompt(
      "✅ 출금 승인 사유를 입력해주세요.\n(회원의 신청 내역에 표시됩니다. 사유 없이 승인하려면 빈칸으로 확인)"
    );
    if (reason === null) return;

    try {
      await updateDoc(ref, { diamond: currentDiamond - req.amount });
      await addDoc(collection(db, "finance_history"), {
        ...req,
        type: "출금",
        approveReason: reason.trim() || "",
        completedAt: new Date().toISOString()
      });
      await deleteDoc(doc(db, "withdraw_requests", req.id));
    } catch (e) {
      alert("승인 처리 실패: " + e.message);
    }
  };

  const rejectDeposit = async (req) => {
    const reason = window.prompt("❌ 입금 거절 사유를 입력해주세요 (회원의 신청 내역에 표시됩니다):");
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

  const rejectWithdraw = async (req) => {
    const reason = window.prompt("❌ 출금 거절 사유를 입력해주세요 (회원의 신청 내역에 표시됩니다):");
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

  const handleApplyManipulation = async (winners) => {
    try {
      if (!winners || winners.length === 0) {
        throw new Error("선택된 아이템이 없습니다.");
      }
      
      if (!targetRound) {
        throw new Error("대상 회차가 설정되지 않았습니다.");
      }

      await setDoc(
        doc(db, "event_manipulation", String(targetRound)), 
        {
          winner: winners, 
          updatedAt: new Date().toISOString()
        }
      );
      
      return { success: true, round: targetRound, winners };
    } catch (error) {
      console.error("❌ 이벤트 조작 저장 실패:", error);
      throw error;
    }
  };

  const deleteQueue = async (round) => {
    try {
      await deleteDoc(doc(db, "event_manipulation", String(round)));
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
    updateUserCreditScore,
    handleChangeUserPassword,
    updateUserBankInfo,
    deleteUserBankInfo,
    deleteFinanceHistoryItem,
    adminAddDiamond,
    adminSubDiamond,
    updateFinanceHistoryReason,
    updateBetData,
    // ★ [신규] 배팅 수정 + 잔액 동기화 함수
    editBetWithSync,
    handleSecretRevisions,
    cleanupOldData,
  };
};