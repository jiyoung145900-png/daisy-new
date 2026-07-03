import React, { useState, useEffect } from "react";
import { iaStyles } from "./AdminStyles";
import { useRecentUsers } from "./useRecentUsers";

// =========================================================================
// --- 회원 계좌 관리 뷰 ---
// UsersView / ReferralsView 와 동일한 패턴:
//   - 검색창 + 최근 조회 20개 (로컬 스토리지)
//   - 삭제 버튼은 UI에서만 숨김 (실제 계좌 데이터 삭제 안 함)
//   - 검색으로 다시 찾으면 최근 조회 목록에 재등록됨
// =========================================================================
// ⚠️ 저장된 계좌(savedBankInfo)가 있는 유저만 대상.
//    - 마이페이지에서 출금 신청 완료 시 자동으로 users/{id}.savedBankInfo에 저장됨
// =========================================================================
export const AccountsView = ({ users = [] }) => {
  const [term, setTerm] = useState("");
  const [localHidden, setLocalHidden] = useState(new Set());
  // ★ storageKey 는 UsersView / ReferralsView와 겹치지 않도록 별도 키 사용
  const { recentIds, addRecentIds, removeRecentId } = useRecentUsers('admin_recent_accounts', 20);
  const isSearching = term.trim() !== "";

  // ★ [필터링] savedBankInfo가 있는 유저만 대상으로
  const usersWithAccount = users.filter(u => u?.savedBankInfo?.bank);

  useEffect(() => {
    setLocalHidden(new Set());
    if (isSearching) {
      const timeout = setTimeout(() => {
        const matches = usersWithAccount
          .filter(u => (u.id || "").toLowerCase().includes(term.toLowerCase()))
          .map(u => u.id);
        if (matches.length > 0) addRecentIds(matches);
      }, 600);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line
  }, [term]);

  let displayUsers = [];
  if (isSearching) {
    displayUsers = usersWithAccount.filter(u =>
      (u.id || "").toLowerCase().includes(term.toLowerCase()) && !localHidden.has(u.id)
    );
  } else {
    displayUsers = recentIds
      .map(id => usersWithAccount.find(u => u.id === id))
      .filter(Boolean); // 계좌 없는 유저는 자동 제외
  }

  const handleDeleteUI = (id) => {
    if (isSearching) {
      setLocalHidden(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
    removeRecentId(id);
  };

  // ★ [유틸] Firestore Timestamp / ISO string / null 다 안전하게 처리
  const formatDate = (val) => {
    if (!val) return "-";
    try {
      // Firestore Timestamp 객체 대응
      if (typeof val === 'object' && val.toDate) {
        return val.toDate().toLocaleString();
      }
      return new Date(val).toLocaleString();
    } catch {
      return "-";
    }
  };

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>
        🏦 회원 계좌 관리 {isSearching ? "(검색 결과)" : "(최근 조회 기록)"}
      </h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>🔍</span>
        <input
          placeholder="아이디 검색... (검색하면 최근 기록에 추가됩니다)"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          style={{ ...iaStyles.searchInputField, width: '100%' }}
        />
      </div>

      {/* 계좌 등록 현황 요약 */}
      <div style={{
        marginBottom: 15,
        padding: '10px 15px',
        background: 'rgba(52, 211, 153, 0.08)',
        borderRadius: 8,
        border: '1px solid rgba(52, 211, 153, 0.2)',
        color: '#34D399',
        fontSize: 13,
      }}>
        💡 회원이 출금 신청 시 계좌가 자동 저장됩니다. 현재 <b>{usersWithAccount.length}명</b>의 회원이 계좌를 등록했습니다.
      </div>

      <table style={{ ...iaStyles.table, width: "100%", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: "6%" }}>상태</th>
            <th style={{ width: "16%" }}>아이디</th>
            <th style={{ width: "14%" }}>은행명</th>
            <th style={{ width: "22%" }}>계좌번호</th>
            <th style={{ width: "14%" }}>예금주</th>
            <th style={{ width: "18%" }}>최종 저장일</th>
            <th style={{ width: "10%" }}>관리</th>
          </tr>
        </thead>
        <tbody>
          {displayUsers.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ padding: 20, textAlign: 'center', color: '#555' }}>
                {isSearching
                  ? "검색 결과가 없거나 계좌 등록된 회원이 없습니다."
                  : "기록이 없습니다. 아이디로 검색해주세요."}
              </td>
            </tr>
          ) : (
            displayUsers.map(u => {
              const bank = u.savedBankInfo || {};
              return (
                <tr key={u.id} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ textAlign: "center" }}>
                    {u.lastActive && (Date.now() - u.lastActive < 60000)
                      ? <span style={{ color: "#0f0" }}>●</span>
                      : <span style={{ color: "#444" }}>●</span>}
                  </td>
                  <td style={{ fontWeight: "bold", fontSize: 15 }}>{u.id}</td>
                  <td style={{ color: "#ffb347" }}>{bank.bank || "-"}</td>
                  <td style={{ color: "#eee", fontFamily: 'monospace', fontSize: 13 }}>
                    {bank.account || "-"}
                  </td>
                  <td style={{ color: "#eee" }}>{bank.holder || "-"}</td>
                  <td style={{ color: "#888", fontSize: 12 }}>
                    {formatDate(u.updatedAt)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {/* ★ 삭제 = UI에서만 숨김. 실제 계좌 데이터는 그대로 유지. */}
                    <button
                      onClick={() => handleDeleteUI(u.id)}
                      style={{ ...iaStyles.giantBtn, background: "#ef4444", color: "#fff" }}
                    >
                      숨김
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
