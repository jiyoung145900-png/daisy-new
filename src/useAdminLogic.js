import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import {
  doc, setDoc, deleteDoc, collection, onSnapshot,
  query, orderBy, limit, updateDoc, getDoc, addDoc,
  serverTimestamp
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
  /* 베팅 데이터 실시간 매핑                                              */
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
  /* 실시간 리스너 통합                                                   */
  /* ------------------------------------------------------------------ */
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
      query(collection(db, "event_bets"), orderBy("round", "desc"), limit(100)),
      snap => setRawSponsorships(snap.docs.map(d => ({ id: d.id, ...d.data() })))
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

    return () => {
      unsubUsers(); unsubQueue(); unsubBets();
      unsubDep(); unsubWdr(); unsubFin(); unsubAgents();
      clearInterval(syncTimer);
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* 파트너/직원 초대코드 생성                                            */
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
  /* ✅ [추가] 파트너/직원 삭제                                           */
  /* ------------------------------------------------------------------ */
  const deleteAgent = async (code) => {
    if (!window.confirm(`'${code}' 코드를 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, "invite_codes", code));
    } catch (e) {
      alert("삭제 실패: " + e.message);
    }
  };

  /* ------------------------------------------------------------------ */
  /* ✅ [추가] 관리자 비밀번호 변경 (Firestore settings/global에 저장)   */
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
  /* 베팅 데이터 수정                                                     */
  /* ------------------------------------------------------------------ */
  const updateBetData = async (betId, newAmount, newItems) => {
    try {
      if (!newAmount || isNaN(newAmount)) {
        alert("유효한 금액을 입력해주세요.");
        return;
      }

      const betRef = doc(db, "event_bets", betId);
      const updateData = {
        betAmount: parseInt(newAmount, 10),
        amount: parseInt(newAmount, 10)
      };

      if (newItems && Array.isArray(newItems)) {
        updateData.items = newItems;
      }

      await updateDoc(betRef, updateData);
      alert("베팅 정보가 성공적으로 수정되었습니다.");
    } catch (error) {
      console.error("베팅 수정 중 오류 발생:", error);
      alert("베팅 수정 실패: " + error.message);
    }
  };

  /* ------------------------------------------------------------------ */
  /* 기존 기능                                                            */
  /* ------------------------------------------------------------------ */
  const updateFullUserInfo = async (userId, diamond, refCode, referral) => {
    await updateDoc(doc(db, "users", userId), {
      diamond: parseInt(diamond),
      refCode: refCode || "",
      referral: referral || ""
    });
  };

  // ✅ [추가] 회원 등급(SILVER/GOLD/PLATINUM/DIAMOND) 관리자 직접 지정
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

  // ✅ [수정] 출금 승인 - 잔액 부족 체크 추가
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

  // 입금 거절 (✅ [수정] 거절 사유를 입력받아 finance_history에 기록으로 남김 -> 회원 마이페이지에서 확인 가능)
  const rejectDeposit = async (req) => {
    const reason = window.prompt("거절 사유를 입력해주세요 (회원의 신청 내역에 표시됩니다):");
    if (reason === null) return; // 취소 누르면 아무 처리 안 함
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

  // 출금 거절 (✅ [수정] 거절 사유를 입력받아 finance_history에 기록으로 남김 -> 회원 마이페이지에서 확인 가능)
  const rejectWithdraw = async (req) => {
    const reason = window.prompt("거절 사유를 입력해주세요 (회원의 신청 내역에 표시됩니다):");
    if (reason === null) return; // 취소 누르면 아무 처리 안 함
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
    await setDoc(doc(db, "event_manipulation", String(targetRound)), {
      winner: winners, updatedAt: new Date().toISOString()
    });
  };

  const deleteQueue = async (round) => {
    await deleteDoc(doc(db, "event_manipulation", String(round)));
  };

  return {
    users,
    currentInfo, targetRound, setTargetRound, queue, deleteQueue,
    gameHistory, sponsorships, activeUsers,
    depositRequests, withdrawRequests, financeHistory,
    approveDeposit, approveWithdraw, rejectDeposit, rejectWithdraw,
    agents, newAgentName, setNewAgentName,
    newAgentCode, setNewAgentCode, addAgent,
    deleteAgent,              // ✅ 추가
    handleChangeAdminPassword, // ✅ 추가
    handleApplyManipulation, updateFullUserInfo,
    updateUserTier,            // ✅ 추가
    handleChangeUserPassword,
    updateBetData,
  };
};