import React, { useState, useEffect, useMemo } from "react";
import { iaStyles } from "./AdminStyles";
import { TIER_OPTIONS, getCreditInfo, CREDIT_DEFAULT, getTierInfo } from "./MyPage.utils";
import { db } from "./firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";

// =========================================================================
// --- 회원 상세 페이지 (신규) ---
// -------------------------------------------------------------------------
// 구성:
//   1. 상단 뒤로가기 헤더
//   2. 기본 정보 카드 (다이아, 등급, 신용점수, 비밀번호)
//   3. 통계 요약 카드 (초대 인원, 누적 입금/출금, 순변동)
//   4. 계좌 정보 카드 (수정 + 삭제)
//   5. 완료된 장부 카드 (개별 삭제 + 아이디 검색 없이 이 회원 전용)
// =========================================================================
export const UserDetailView = ({
  user,                       // 상세 조회 대상 회원 데이터
  allUsers = [],              // 초대 인원 계산용
  onBack,                     // 목록으로 돌아가기
  updateFullUserInfo,         // 다이아 수정
  updateUserTier,             // 등급 변경
  updateUserCreditScore,      // 신용점수 변경
  handleChangeUserPassword,   // 비밀번호 변경
  updateUserBankInfo,         // 계좌 정보 수정
  deleteUserBankInfo,         // 계좌 정보 삭제
  deleteFinanceHistoryItem,   // 장부 개별 삭제
}) => {
  // ★ 계좌 정보 편집용 로컬 상태
  const [bankEdit, setBankEdit] = useState({
    bank: user?.savedBankInfo?.bank || "",
    account: user?.savedBankInfo?.account || "",
    holder: user?.savedBankInfo?.holder || "",
  });

  // user 정보 바뀌면 계좌 편집 상태도 sync
  useEffect(() => {
    setBankEdit({
      bank: user?.savedBankInfo?.bank || "",
      account: user?.savedBankInfo?.account || "",
      holder: user?.savedBankInfo?.holder || "",
    });
  }, [user?.id, user?.savedBankInfo?.bank, user?.savedBankInfo?.account, user?.savedBankInfo?.holder]);

  // ★ [실시간] 이 회원의 전체 finance_history 실시간 구독
  //    - useAdminLogic은 limit(50)만 구독하므로 여기서 별도로 이 유저의 전체 조회
  //    - onSnapshot으로 삭제/추가가 즉시 반영됨
  const [userFinanceHistory, setUserFinanceHistory] = useState([]);
  const [financeLoading, setFinanceLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setFinanceLoading(true);

    const q = query(
      collection(db, "finance_history"),
      where("userId", "==", user.id),
      orderBy("completedAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUserFinanceHistory(list);
        setFinanceLoading(false);
      },
      (err) => {
        console.error("finance_history 조회 실패:", err);
        // where + orderBy 복합 인덱스 필요 시 에러 발생 가능
        // 콘솔에 안내 링크 나옴 (Firebase Console에서 인덱스 생성)
        setFinanceLoading(false);
      }
    );

    return () => unsub();
  }, [user?.id]);

  // ★ 통계 계산 (초대 인원 + 누적 입금/출금)
  const stats = useMemo(() => {
    const referredUsers = allUsers.filter((u) => (u.referral || "") === (user?.refCode || user?.id || ""));

    let totalDeposit = 0;
    let totalWithdraw = 0;
    let depositCount = 0;
    let withdrawCount = 0;

    for (const f of userFinanceHistory) {
      // 거절된 건은 제외
      if (f.status === "거절") continue;
      const amt = Number(f.amount || 0);
      if (f.type === "입금") {
        totalDeposit += amt;
        depositCount++;
      } else if (f.type === "출금") {
        totalWithdraw += amt;
        withdrawCount++;
      }
    }

    return {
      referredCount: referredUsers.length,
      totalDeposit,
      totalWithdraw,
      netChange: totalDeposit - totalWithdraw,
      depositCount,
      withdrawCount,
    };
  }, [allUsers, user, userFinanceHistory]);

  // ★ 저장 버튼: 다이아 + 신용점수 동시 저장
  const handleSaveInfo = () => {
    const newDiamond = document.getElementById(`ud-diamond-${user.id}`).value;
    const newCredit = document.getElementById(`ud-credit-${user.id}`).value;

    updateFullUserInfo?.(user.id, newDiamond, user.refCode, user.referral);

    const currentScore = user.creditScore ?? CREDIT_DEFAULT;
    if (newCredit !== "" && parseInt(newCredit, 10) !== currentScore) {
      updateUserCreditScore?.(user.id, newCredit);
    }
  };

  // ★ 계좌 저장
  const handleSaveBank = async () => {
    const ok = await updateUserBankInfo?.(user.id, bankEdit);
    if (ok) alert("✅ 계좌 정보가 저장되었습니다.");
  };

  // ★ 계좌 삭제
  const handleDeleteBank = async () => {
    const ok = await deleteUserBankInfo?.(user.id);
    if (ok) {
      setBankEdit({ bank: "", account: "", holder: "" });
      alert("✅ 계좌 정보가 삭제되었습니다.");
    }
  };

  // ★ 장부 개별 삭제
  const handleDeleteFinance = async (historyId) => {
    await deleteFinanceHistoryItem?.(historyId);
  };

  const tier = getTierInfo(user?.tier);
  const credit = getCreditInfo(user?.creditScore);

  // 가입일 표시 유틸
  const formatDate = (val) => {
    if (!val) return "-";
    try {
      if (typeof val === "object" && val.toDate) return val.toDate().toLocaleDateString("ko-KR");
      return new Date(val).toLocaleDateString("ko-KR");
    } catch {
      return "-";
    }
  };

  if (!user) {
    return (
      <div style={iaStyles.card}>
        <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
          회원 정보를 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ────────── 상단 뒤로가기 헤더 ────────── */}
      <div style={ds.pageHeader}>
        <button onClick={onBack} style={ds.backBtn}>
          〈 목록으로
        </button>
        <div style={ds.pageTitle}>
          <span style={ds.pageTitleIcon}>👤</span>
          회원 상세: <span style={ds.pageTitleId}>{user.id}</span>
          <span style={{ ...ds.headerTierBadge, background: tier.color }}>{tier.name}</span>
        </div>
        <div style={ds.headerRight}>
          {user.lastActive && Date.now() - user.lastActive < 60000 ? (
            <span style={ds.onlineDot}>● 접속중</span>
          ) : (
            <span style={ds.offlineDot}>● 오프라인</span>
          )}
        </div>
      </div>

      {/* ────────── 상단 2컬럼 (기본정보 + 통계요약) ────────── */}
      <div style={ds.gridTwoCol}>
        {/* 기본 정보 카드 */}
        <div style={{ ...iaStyles.card, marginBottom: 0 }}>
          <h2 style={ds.sectionTitle}>👤 기본 정보</h2>

          <div style={ds.infoRow}>
            <span style={ds.infoLabel}>아이디</span>
            <span style={ds.infoValueId}>{user.id}</span>
          </div>
          <div style={ds.infoRow}>
            <span style={ds.infoLabel}>UID</span>
            <span style={ds.infoValueSmall}>{user.no || "-"}</span>
          </div>
          <div style={ds.infoRow}>
            <span style={ds.infoLabel}>가입일</span>
            <span style={ds.infoValueSmall}>{formatDate(user.joinedAt)}</span>
          </div>
          <div style={ds.infoRow}>
            <span style={ds.infoLabel}>추천인 코드</span>
            <span style={ds.infoValueSmall}>{user.referral || "-"}</span>
          </div>
          <div style={ds.infoRow}>
            <span style={ds.infoLabel}>내 초대코드</span>
            <span style={{ ...ds.infoValueSmall, color: "#ffb347" }}>{user.refCode || "-"}</span>
          </div>

          <div style={ds.divider} />

          {/* 편집 가능 항목 */}
          <div style={ds.editField}>
            <label style={ds.editLabel}>💎 다이아몬드</label>
            <input
              id={`ud-diamond-${user.id}`}
              defaultValue={user.diamond ?? 0}
              type="number"
              style={{ ...iaStyles.giantInput, textAlign: "left" }}
            />
          </div>

          <div style={ds.editField}>
            <label style={ds.editLabel}>🏆 등급</label>
            <select
              defaultValue={user.tier || "SILVER"}
              onChange={(e) => updateUserTier?.(user.id, e.target.value)}
              style={{ ...iaStyles.giantInput, textAlign: "left", cursor: "pointer" }}
            >
              {TIER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div style={ds.editField}>
            <label style={ds.editLabel}>
              📊 신용점수{" "}
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: `${credit.color}22`,
                  color: credit.color,
                  border: `1px solid ${credit.color}55`,
                  marginLeft: 6,
                  fontWeight: 800,
                }}
              >
                현재 {credit.score} · {credit.labelKo}
              </span>
            </label>
            <input
              id={`ud-credit-${user.id}`}
              defaultValue={user.creditScore ?? CREDIT_DEFAULT}
              type="number"
              min="0"
              style={{ ...iaStyles.giantInput, textAlign: "left" }}
            />
          </div>

          <div style={ds.btnGroup}>
            <button onClick={handleSaveInfo} style={ds.primaryBtn}>
              💾 저장
            </button>
            <button
              onClick={() => handleChangeUserPassword?.(user.id)}
              style={{ ...ds.primaryBtn, background: "#5856d6", color: "#fff" }}
            >
              🔑 비밀번호
            </button>
          </div>
        </div>

        {/* 통계 요약 카드 */}
        <div style={{ ...iaStyles.card, marginBottom: 0 }}>
          <h2 style={ds.sectionTitle}>📊 통계 요약</h2>

          <div style={ds.statBig}>
            <div style={ds.statLabel}>🤝 초대한 인원</div>
            <div style={{ ...ds.statValue, color: "#ffb347" }}>
              {stats.referredCount}
              <span style={ds.statUnit}>명</span>
            </div>
          </div>

          <div style={ds.divider} />

          <div style={ds.statRow}>
            <div style={ds.statSmall}>
              <div style={ds.statLabel}>💰 누적 입금</div>
              <div style={{ ...ds.statValue, color: "#34D399", fontSize: 20 }}>
                +{stats.totalDeposit.toLocaleString()}
              </div>
              <div style={ds.statSubText}>{stats.depositCount}회</div>
            </div>
            <div style={ds.statSmall}>
              <div style={ds.statLabel}>💸 누적 출금</div>
              <div style={{ ...ds.statValue, color: "#FB7185", fontSize: 20 }}>
                -{stats.totalWithdraw.toLocaleString()}
              </div>
              <div style={ds.statSubText}>{stats.withdrawCount}회</div>
            </div>
          </div>

          <div style={ds.divider} />

          <div style={ds.netBox}>
            <div style={ds.statLabel}>📈 순변동 (입금 - 출금)</div>
            <div
              style={{
                ...ds.statValue,
                color: stats.netChange >= 0 ? "#34D399" : "#FB7185",
                fontSize: 26,
                marginTop: 6,
              }}
            >
              {stats.netChange >= 0 ? "+" : ""}
              {stats.netChange.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* ────────── 계좌 정보 카드 ────────── */}
      <div style={iaStyles.card}>
        <div style={ds.sectionHeaderRow}>
          <h2 style={ds.sectionTitle}>🏦 계좌 정보</h2>
          {user?.savedBankInfo?.bank && (
            <span style={ds.tagGreen}>✓ 저장됨</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 15, marginBottom: 15, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={ds.editLabel}>은행명</label>
            <input
              value={bankEdit.bank}
              onChange={(e) => setBankEdit({ ...bankEdit, bank: e.target.value })}
              placeholder="예: 국민은행"
              style={{ ...iaStyles.giantInput, textAlign: "left" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={ds.editLabel}>계좌번호</label>
            <input
              value={bankEdit.account}
              onChange={(e) => setBankEdit({ ...bankEdit, account: e.target.value })}
              placeholder="예: 123-456-789012"
              style={{ ...iaStyles.giantInput, textAlign: "left", fontFamily: "monospace" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={ds.editLabel}>예금주</label>
            <input
              value={bankEdit.holder}
              onChange={(e) => setBankEdit({ ...bankEdit, holder: e.target.value })}
              placeholder="예: 홍길동"
              style={{ ...iaStyles.giantInput, textAlign: "left" }}
            />
          </div>
        </div>

        <div style={ds.btnGroup}>
          <button onClick={handleSaveBank} style={ds.primaryBtn}>
            💾 계좌 저장
          </button>
          {user?.savedBankInfo?.bank && (
            <button onClick={handleDeleteBank} style={ds.dangerBtn}>
              🗑️ 계좌 삭제
            </button>
          )}
        </div>
      </div>

      {/* ────────── 완료된 장부 카드 ────────── */}
      <div style={iaStyles.card}>
        <div style={ds.sectionHeaderRow}>
          <h2 style={ds.sectionTitle}>📜 완료된 장부</h2>
          <span style={ds.countTag}>총 {userFinanceHistory.length}건</span>
        </div>

        {financeLoading ? (
          <div style={ds.emptyBox}>불러오는 중...</div>
        ) : userFinanceHistory.length === 0 ? (
          <div style={ds.emptyBox}>이 회원의 완료된 장부 기록이 없습니다.</div>
        ) : (
          <table style={iaStyles.table}>
            <thead>
              <tr>
                <th style={{ width: "20%" }}>일시</th>
                <th style={{ width: "10%" }}>구분</th>
                <th style={{ width: "15%" }}>금액</th>
                <th style={{ width: "10%" }}>상태</th>
                <th style={{ width: "30%" }}>사유</th>
                <th style={{ width: "15%" }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {userFinanceHistory.map((f) => {
                // FinanceView 기존 로직 그대로 이식
                const displayStatus = f.status === "pending" ? "완료" : (f.status || "완료");
                const reasonText = displayStatus === "거절" ? f.rejectReason : f.approveReason;
                const isRejected = displayStatus === "거절";

                return (
                  <tr key={f.id} style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ color: "#888", fontSize: 12 }}>
                      {f.completedAt ? new Date(f.completedAt).toLocaleString() : "-"}
                    </td>
                    <td>
                      <span
                        style={{
                          background: f.type === "입금" ? "rgba(0,255,0,0.1)" : "rgba(255,59,48,0.1)",
                          color: f.type === "입금" ? "#00ff00" : "#ff3b30",
                          padding: "3px 8px",
                          borderRadius: 5,
                          fontSize: 12,
                          fontWeight: "bold",
                        }}
                      >
                        {f.type}
                      </span>
                    </td>
                    <td style={{ fontSize: 15, fontWeight: "bold" }}>
                      {f.amount?.toLocaleString()}
                    </td>
                    <td
                      style={{
                        color: isRejected ? "#ef4444" : "#4cd137",
                        fontWeight: "bold",
                        fontSize: 13,
                      }}
                    >
                      {displayStatus}
                    </td>
                    <td
                      style={{
                        color: "#ccc",
                        fontSize: 12,
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={reasonText || "-"}
                    >
                      {reasonText || "-"}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeleteFinance(f.id)}
                        style={ds.rowDelBtn}
                      >
                        🗑️ 삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// 상세 페이지 전용 로컬 스타일 (iaStyles 로 부족한 것만)
// ─────────────────────────────────────────────────────────
const ds = {
  pageHeader: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "15px 25px",
    background: "#111",
    borderRadius: 16,
    marginBottom: 25,
    border: "1px solid #222",
  },
  backBtn: {
    background: "#1c1c1c",
    color: "#ffb347",
    border: "1px solid #333",
    padding: "10px 16px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
  },
  pageTitle: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 20,
    fontWeight: 900,
    color: "#fff",
  },
  pageTitleIcon: { fontSize: 24 },
  pageTitleId: { color: "#ffb347" },
  headerTierBadge: {
    fontSize: 11,
    color: "#000",
    padding: "3px 10px",
    borderRadius: 5,
    fontWeight: 900,
    marginLeft: 5,
  },
  headerRight: { display: "flex", alignItems: "center" },
  onlineDot: { color: "#0f0", fontSize: 12, fontWeight: 800 },
  offlineDot: { color: "#555", fontSize: 12, fontWeight: 800 },

  gridTwoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 25,
    marginBottom: 25,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#fff",
    marginTop: 0,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  infoLabel: { color: "#888", fontSize: 13, fontWeight: 600 },
  infoValueId: { color: "#ffb347", fontSize: 16, fontWeight: 900 },
  infoValueSmall: { color: "#ddd", fontSize: 13 },

  divider: { height: 1, background: "#2a2a2a", margin: "20px 0" },

  editField: { marginBottom: 15 },
  editLabel: {
    display: "block",
    color: "#888",
    fontSize: 12,
    marginBottom: 6,
    fontWeight: 700,
  },

  btnGroup: { display: "flex", gap: 10, marginTop: 15 },
  primaryBtn: {
    flex: 1,
    background: "#ffb347",
    color: "#000",
    border: "none",
    padding: "13px 15px",
    borderRadius: 10,
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  dangerBtn: {
    flex: 1,
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "13px 15px",
    borderRadius: 10,
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },

  statBig: {
    textAlign: "center",
    padding: "10px 0",
  },
  statLabel: { color: "#888", fontSize: 12, fontWeight: 700 },
  statValue: {
    fontSize: 32,
    fontWeight: 900,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  statUnit: { fontSize: 14, marginLeft: 4, color: "#888" },
  statRow: { display: "flex", gap: 15 },
  statSmall: {
    flex: 1,
    textAlign: "center",
    padding: "12px 8px",
    background: "#1a1a1a",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
  },
  statSubText: { fontSize: 11, color: "#666", marginTop: 4 },
  netBox: {
    padding: "18px 15px",
    background: "linear-gradient(135deg, rgba(255,179,71,0.06), transparent)",
    borderRadius: 12,
    border: "1px solid rgba(255,179,71,0.2)",
    textAlign: "center",
  },

  tagGreen: {
    fontSize: 11,
    color: "#34D399",
    background: "rgba(52,211,153,0.1)",
    border: "1px solid rgba(52,211,153,0.3)",
    padding: "4px 10px",
    borderRadius: 8,
    fontWeight: 700,
  },
  countTag: {
    fontSize: 12,
    color: "#ffb347",
    background: "rgba(255,179,71,0.1)",
    border: "1px solid rgba(255,179,71,0.3)",
    padding: "4px 10px",
    borderRadius: 8,
    fontWeight: 700,
  },

  emptyBox: {
    padding: 40,
    textAlign: "center",
    color: "#555",
    fontSize: 13,
    background: "#0a0a0a",
    borderRadius: 10,
  },

  rowDelBtn: {
    background: "#2a1a1a",
    color: "#ef4444",
    border: "1px solid rgba(239,68,68,0.3)",
    padding: "6px 12px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },
};