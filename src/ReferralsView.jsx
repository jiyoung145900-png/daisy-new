import React, { useState, useEffect } from "react";
import { iaStyles } from "./AdminStyles";
import { useRecentUsers } from "./useRecentUsers";

// =========================================================================
// --- 6. 추천인 관리 뷰 ---
// =========================================================================
export const ReferralsView = ({ users = [], updateFullUserInfo }) => {
  const [term, setTerm] = useState("");
  const [localHidden, setLocalHidden] = useState(new Set());
  const { recentIds, addRecentIds, removeRecentId } = useRecentUsers('admin_recent_referrals', 20);
  const isSearching = term.trim() !== "";

  useEffect(() => {
    setLocalHidden(new Set()); 
    if (isSearching) {
      const timeout = setTimeout(() => {
        const matches = users
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
    displayUsers = users.filter(u =>
      (u.id || "").toLowerCase().includes(term.toLowerCase()) && !localHidden.has(u.id)
    );
  } else {
    displayUsers = recentIds.map(id => users.find(u => u.id === id)).filter(Boolean);
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

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>🤝 추천인 관리 {isSearching ? "(검색 결과)" : "(최근 조회 기록)"}</h1>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>🔍</span>
        <input
          placeholder="아이디로 검색..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          style={iaStyles.searchInputField}
        />
      </div>
      <table style={iaStyles.table}>
        <thead><tr><th>아이디</th><th>내 코드</th><th>추천인</th><th>관리</th></tr></thead>
        <tbody>
          {displayUsers.length === 0 ? (
            <tr><td colSpan="4" style={{ padding: 20, textAlign: 'center', color: '#555' }}>기록이 없습니다. 유저를 검색해주세요.</td></tr>
          ) : (
            displayUsers.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid #222" }}>
                <td>{u.id}</td>
                <td><input id={`rc-${u.id}`} defaultValue={u.refCode || ""} style={iaStyles.giantInput} /></td>
                <td><input id={`rf-${u.id}`} defaultValue={u.referral || ""} style={{ ...iaStyles.giantInput, color: "#0ff" }} /></td>
                <td style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => updateFullUserInfo?.(u.id, u.diamond, document.getElementById(`rc-${u.id}`).value, document.getElementById(`rf-${u.id}`).value)}
                    style={iaStyles.giantBtn}
                  >
                    저장
                  </button>
                  <button
                    onClick={() => handleDeleteUI(u.id)}
                    style={{ ...iaStyles.giantBtn, background: '#ef4444', color: '#fff' }}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
