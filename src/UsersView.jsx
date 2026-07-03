import React, { useState, useEffect } from "react";
import { iaStyles } from "./AdminStyles";
import { TIER_OPTIONS } from "./MyPage.utils";
import { useRecentUsers } from "./useRecentUsers";

// =========================================================================
// --- 4. 회원 관리 뷰 ---
// =========================================================================
export const UsersView = ({ users = [], updateFullUserInfo, updateUserTier, handleChangeUserPassword }) => {
  const [term, setTerm] = useState("");
  const [localHidden, setLocalHidden] = useState(new Set());
  const { recentIds, addRecentIds, removeRecentId } = useRecentUsers('admin_recent_users', 20);
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
      <h1 style={iaStyles.bigTabTitle}>💰 회원 관리 {isSearching ? "(검색 결과)" : "(최근 조회 기록)"}</h1>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>🔍</span>
        <input
          placeholder="아이디 검색... (검색하면 최근 기록에 추가됩니다)"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          style={{ ...iaStyles.searchInputField, width: '100%' }}
        />
      </div>

      <table style={{ ...iaStyles.table, width: "100%", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: "8%" }}>상태</th>
            <th style={{ width: "16%" }}>아이디</th>
            <th style={{ width: "14%" }}>다이아</th>
            <th style={{ width: "14%" }}>변경값</th>
            <th style={{ width: "13%" }}>등급</th>
            <th style={{ width: "35%" }}>액션</th>
          </tr>
        </thead>
        <tbody>
          {displayUsers.length === 0 ? (
            <tr><td colSpan="6" style={{ padding: 20, textAlign: 'center', color: '#555' }}>기록이 없습니다. 유저를 검색해주세요.</td></tr>
          ) : (
            displayUsers.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ textAlign: "center" }}>
                  {u.lastActive && (Date.now() - u.lastActive < 60000) ? <span style={{ color: "#0f0" }}>●</span> : <span style={{ color: "#444" }}>●</span>}
                </td>
                <td style={{ fontWeight: "bold", fontSize: 16 }}>{u.id}</td>
                <td style={{ color: "#ffb347" }}>💎 {u.diamond?.toLocaleString()}</td>
                <td><input id={`pt-${u.id}`} defaultValue={u.diamond} style={{ ...iaStyles.giantInput, width: "90%" }} /></td>
                <td>
                  <select
                    defaultValue={u.tier || "SILVER"}
                    onChange={(e) => updateUserTier?.(u.id, e.target.value)}
                    style={{ ...iaStyles.giantInput, width: "100%", cursor: 'pointer' }}
                  >
                    {TIER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </td>
                <td style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                  <button onClick={() => updateFullUserInfo?.(u.id, document.getElementById(`pt-${u.id}`).value, u.refCode, u.referral)} style={iaStyles.giantBtn}>수정</button>
                  <button onClick={() => handleChangeUserPassword?.(u.id)} style={{ ...iaStyles.giantBtn, background: "#5856d6", color: "#fff" }}>비번</button>
                  <button onClick={() => handleDeleteUI(u.id)} style={{ ...iaStyles.giantBtn, background: "#ef4444", color: "#fff" }}>삭제</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
