import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";

const broadcast = new BroadcastChannel("daisy_global_channel");

export const useMyPageLogic = (user, onUpdatePoint, isKo) => {
  const [userInfo, setUserInfo] = useState(user || null);
  const [globalSettings, setGlobalSettings] = useState({}); // ✅ [추가됨] 시스템 전역 설정(텔레그램 등)을 담을 상태

  // ★ [제거됨] 데일리 보너스 관련 isCheckedIn 상태 삭제

  // ★ State for transaction history
  const [myDeposits, setMyDeposits] = useState([]);
  const [myWithdraws, setMyWithdraws] = useState([]);
  // ★ [신규] 게임 배팅 이용 내역 - event_bets 실시간 구독으로 관리
  const [myBetHistory, setMyBetHistory] = useState([]);

  // Sync initial user info from props
  useEffect(() => {
    if (user) setUserInfo(user);
  }, [user]);

  // ✅ [추가됨] AdminCMS에서 저장하는 전체 설정(텔레그램 링크 등) 실시간 구독
  useEffect(() => {
    // 보통 설정 데이터는 'settings' 컬렉션의 'global' 문서에 저장됩니다.
    const configRef = doc(db, "settings", "global"); 
    const unsub = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        // ⚠️ [보안 수정] settings/global 문서에는 adminPw, gamePw 같은
        // 민감한 값도 함께 들어있음. 마이페이지에서 필요한 값만 골라서 저장.
        const data = snap.data();
        setGlobalSettings({
          telegramLink: data.telegramLink ?? "",
          noticeText: data.noticeText ?? "",
        });
      }
    });
    return () => unsub();
  }, []);

  // ✅ Real-time subscription to the true source of truth: users/{id}
  useEffect(() => {
    if (!user?.id) return;

    const userRef = doc(db, "users", user.id);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setUserInfo(snap.data());
      } else {
        // 문서가 없으면 기존 user 상태 유지
        setUserInfo((prev) => prev || user);
      }
    });

    return () => unsub();
  }, [user?.id]);

  // Real-time point updates (cross-tab/app broadcast) - keep for instant UI
  useEffect(() => {
    const handleUpdate = (targetId, newPoint) => {
      setUserInfo((prev) =>
        prev && prev.id === targetId ? { ...prev, diamond: newPoint } : prev
      );
    };

    const onWindowEvent = (e) => {
      const { userId, point } = e.detail || {};
      if (userId) handleUpdate(userId, point);
    };

    window.addEventListener("user_point_update", onWindowEvent);

    broadcast.onmessage = (e) => {
      const { type, userId, point } = e.data || {};
      if (type === "POINT_UPDATE" && userId) handleUpdate(userId, point);
    };

    return () => window.removeEventListener("user_point_update", onWindowEvent);
  }, []);

  // Real-time subscription for Deposits & Withdrawals (Pending + Completed)
  useEffect(() => {
    if (!userInfo?.id) return;

    const qDepPending = query(
      collection(db, "deposit_requests"),
      where("userId", "==", userInfo.id)
    );
    const qWdrPending = query(
      collection(db, "withdraw_requests"),
      where("userId", "==", userInfo.id)
    );
    const qHistory = query(
      collection(db, "finance_history"),
      where("userId", "==", userInfo.id)
    );

    let pendingDeps = [];
    let pendingWdrs = [];
    let historyAll = [];

    const mergeAndSet = () => {
      // ✅ [수정] finance_history 원본 status가 "거절"이면 그대로 유지, 그 외(승인 완료건)는 "완료"로 표시
      const doneDeps = historyAll
        .filter((h) => h.type === "입금")
        .map((h) => ({ ...h, status: h.status === "거절" ? "거절" : "완료" }));
      const allDeps = [...pendingDeps, ...doneDeps].sort(
        (a, b) =>
          new Date(b.timestamp || b.completedAt) -
          new Date(a.timestamp || a.completedAt)
      );
      setMyDeposits(allDeps);

      const doneWdrs = historyAll
        .filter((h) => h.type === "출금")
        .map((h) => ({ ...h, status: h.status === "거절" ? "거절" : "완료" }));
      const allWdrs = [...pendingWdrs, ...doneWdrs].sort(
        (a, b) =>
          new Date(b.timestamp || b.completedAt) -
          new Date(a.timestamp || a.completedAt)
      );
      setMyWithdraws(allWdrs);
    };

    const unsub1 = onSnapshot(qDepPending, (snap) => {
      pendingDeps = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        status: "심사중",
      }));
      mergeAndSet();
    });

    const unsub2 = onSnapshot(qWdrPending, (snap) => {
      pendingWdrs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        status: "심사중",
      }));
      mergeAndSet();
    });

    const unsub3 = onSnapshot(qHistory, (snap) => {
      historyAll = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      mergeAndSet();
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [userInfo?.id]);

  // ★ [신규] 게임 배팅 이용 내역 실시간 구독 (event_bets)
  //   - 관리자가 실시간 모니터링에서 배팅 수정하면 여기서 감지해서 마이페이지 UI 즉시 갱신
  //   - 진행중 배팅(win null)은 제외, 정산 완료된 것만 히스토리에 표시
  useEffect(() => {
    if (!userInfo?.id) return;
    // fast paint를 위해 로컬 캐시로 우선 세팅
    try {
      const cached = localStorage.getItem(`event_my_history_${userInfo.id}`);
      if (cached) setMyBetHistory(JSON.parse(cached));
    } catch (e) {}

    const q = query(
      collection(db, "event_bets"),
      where("userId", "==", userInfo.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const records = snap.docs
        .map(d => {
          const b = d.data();
          if (b.win === null || b.win === undefined) return null; // 진행중 제외
          const cost = b.betAmount || 0;
          const items = b.items || [];
          const earn = b.win === true ? cost * 2 : 0;
          const ts = b.timestamp ? new Date(b.timestamp) : new Date();
          return {
            round: b.round,
            selected: items,
            cost,
            earn,
            date: ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            timestamp: b.timestamp,
            status: b.win === true ? "승리" : b.win === false ? "패배" : "무승부",
            docId: d.id,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.round - a.round)
        .slice(0, 100);
      setMyBetHistory(records);
      // 로컬 캐시 갱신
      try { localStorage.setItem(`event_my_history_${userInfo.id}`, JSON.stringify(records)); } catch (e) {}
    }, (err) => {
      console.error("배팅 이용내역 구독 실패:", err);
    });
    return () => unsub();
  }, [userInfo?.id]);

  // Voice Alert (Fixed pitch/rate)
  const playFemaleVoice = useCallback(
    (text) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();

      const femaleVoice =
        voices.find((v) => v.lang.includes("ko") && v.name.includes("Google")) ||
        voices.find(
          (v) =>
            v.lang.includes("ko") &&
            (v.name.includes("Female") || v.name.includes("여성"))
        ) ||
        voices.find((v) => v.lang.includes("ko"));

      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.lang = isKo ? "ko-KR" : "en-US";
      utterance.rate = 1.1;
      utterance.pitch = 1.0;

      window.speechSynthesis.speak(utterance);
    },
    [isKo]
  );

  // Deposit Request
  const requestDeposit = async (name, amount) => {
    if (!name.trim() || !amount)
      return alert(isKo ? "정보를 입력해주세요." : "Enter info.");
    try {
      await addDoc(collection(db, "deposit_requests"), {
        userId: userInfo.id,
        userName: userInfo.name || userInfo.id,
        depositName: name,
        amount: Number(amount),
        status: "pending",
        timestamp: new Date().toISOString(),
      });
      playFemaleVoice(isKo ? "입금이 신청되었습니다." : "Deposit requested.");
      alert(isKo ? "신청 완료!" : "Done!");
      return true;
    } catch (e) {
      alert("Error: " + e.message);
      return false;
    }
  };

  // ★★★ Withdraw Request - 다이아 즉시 홀딩 (트랜잭션) ★★★
  //   - 출금 신청 시 다이아를 즉시 차감 (중복 신청 방지)
  //   - 잔액 부족 시 트랜잭션 자동 실패
  //   - 관리자가 거절하면 heldAmount 만큼 회원에게 환급 (Admin useAdminLogic.js 참조)
  const requestWithdraw = async (amount, bankInfo) => {
    const withdrawAmount = Number(amount);

    // 프론트 1차 검증 (트랜잭션에서 다시 재검증)
    if (!withdrawAmount || withdrawAmount <= 0)
      return alert(isKo ? "올바른 금액을 입력해주세요." : "Enter valid amount");
    if (withdrawAmount > (userInfo.diamond || 0))
      return alert(isKo ? "잔액 부족" : "Not enough balance");

    // 은행 정보 유효성 체크
    if (!bankInfo?.bank?.trim() || !bankInfo?.account?.trim() || !bankInfo?.holder?.trim()) {
      return alert(isKo ? "은행 정보를 모두 입력해주세요." : "Please fill in all bank info.");
    }

    try {
      const userRef = doc(db, "users", userInfo.id);

      // ★★★ 트랜잭션: 잔액 재확인 + 다이아 차감 + 요청 문서 생성을 원자적으로 처리
      //   - 회원이 여러 창에서 동시 신청해도 안전
      //   - 잔액 부족 시 트랜잭션 자체가 실패해서 아무것도 반영 안 됨
      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");

        const currentDiamond = userSnap.data().diamond || 0;

        // 서버 기준 잔액 재확인 (동시 신청 방어)
        if (currentDiamond < withdrawAmount) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        // 1) 회원 다이아에서 즉시 차감 (홀딩) + 은행 정보 저장
        tx.update(userRef, {
          diamond: currentDiamond - withdrawAmount,
          savedBankInfo: bankInfo,
          updatedAt: serverTimestamp(),
        });

        // 2) 요청 문서 생성 (heldAmount 필드로 홀딩 표시)
        //    → 관리자가 거절 시 이 금액만큼 환급함
        const requestRef = doc(collection(db, "withdraw_requests"));
        tx.set(requestRef, {
          userId: userInfo.id,
          userName: userInfo.name || userInfo.id,
          amount: withdrawAmount,
          bankInfo,
          status: "pending",
          heldAmount: withdrawAmount,      // ★ 홀딩된 금액 (환급 시 사용)
          heldAt: new Date().toISOString(), // ★ 홀딩 시각
          timestamp: new Date().toISOString(),
        });
      });

      playFemaleVoice(isKo ? "출금이 신청되었습니다." : "Withdrawal requested.");
      alert(isKo ? "신청 완료! 신청 금액은 심사 완료까지 홀딩됩니다." : "Done! Amount held until reviewed.");
      return true;
    } catch (e) {
      if (e.message === "INSUFFICIENT_BALANCE") {
        alert(isKo ? "잔액 부족" : "Not enough balance");
      } else if (e.message === "USER_NOT_FOUND") {
        alert(isKo ? "회원 정보를 찾을 수 없습니다." : "User not found");
      } else {
        alert("Error: " + e.message);
      }
      return false;
    }
  };

  // ★ [신규] 닉네임 변경 (users/{id}.nickname)
  //   - 2~10자, 한글/영문/숫자만 허용 (공백/특수문자 불가)
  //   - 중복 체크는 하지 않음 (동일 닉네임 허용)
  const updateNickname = async (newNickname) => {
    const nick = (newNickname || "").trim();

    if (!nick) {
      alert(isKo ? "닉네임을 입력해주세요." : "Please enter a nickname.");
      return false;
    }
    if (nick.length < 2 || nick.length > 10) {
      alert(isKo ? "닉네임은 2자 이상 10자 이하여야 합니다." : "Nickname must be 2–10 characters.");
      return false;
    }
    // 한글/영문/숫자만 허용 (공백/특수문자 불가)
    if (!/^[가-힣a-zA-Z0-9]+$/.test(nick)) {
      alert(isKo
        ? "닉네임은 한글, 영문, 숫자만 사용 가능합니다."
        : "Only Korean, English letters and numbers are allowed.");
      return false;
    }

    try {
      const userRef = doc(db, "users", userInfo.id);
      await updateDoc(userRef, { nickname: nick, updatedAt: serverTimestamp() });
      alert(isKo ? "닉네임이 변경되었습니다." : "Nickname updated.");
      return true;
    } catch (e) {
      alert("Error: " + e.message);
      return false;
    }
  };

  // Update Password (users/{id}) - 이전 비밀번호 체크 제거됨
  const updatePassword = async (newPw, confirmPw) => {
    if (!newPw || newPw !== confirmPw)
      return alert(isKo ? "입력 정보를 확인해주세요." : "Check inputs.");
    if (newPw.length < 4)
      return alert(isKo ? "비밀번호는 4자 이상이어야 합니다." : "Password must be at least 4 characters.");
    try {
      const userRef = doc(db, "users", userInfo.id);
      await updateDoc(userRef, { password: newPw, updatedAt: serverTimestamp() });

      alert(isKo ? "비밀번호 변경 완료" : "Success");
      return true;
    } catch (e) {
      alert("Error: " + e.message);
      return false;
    }
  };

  // ★ [제거됨] Setup PIN (updatePin) 함수 완전 삭제

  // Change Avatar (users/{id} + local cache)
  const updateAvatar = async (img, idx, onLocalUpdate) => {
    const avatarData = { image: img, idx: idx };

    try {
      const userRef = doc(db, "users", userInfo.id);
      await updateDoc(userRef, { avatar: avatarData, updatedAt: serverTimestamp() });

      localStorage.setItem(
        `user_avatar_data_${userInfo.id}`,
        JSON.stringify(avatarData)
      );

      if (onLocalUpdate) onLocalUpdate(img, idx);

      alert(isKo ? "프로필 변경 완료" : "Updated");
      return true;
    } catch (e) {
      alert("Error: " + e.message);
      return false;
    }
  };

  return {
    // ✅ [보안 수정] globalSettings에는 이제 telegramLink, noticeText만 들어있어서
    // adminPw / gamePw가 클라이언트에 노출되지 않음
    userInfo: userInfo ? { ...globalSettings, ...userInfo } : globalSettings,
    myDeposits,
    myWithdraws,
    // ★ [신규] 게임 배팅 이용 내역 (event_bets 실시간 구독)
    myBetHistory,
    requestDeposit,
    requestWithdraw,
    updatePassword,
    updateAvatar,
    updateNickname, // ★ [신규] 닉네임 변경 함수
  };
};