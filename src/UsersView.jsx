import React, { useState, useEffect } from "react";
import { iaStyles } from "./AdminStyles";
// ★ [수정] 신용점수 관련 유틸 추가 임포트
import { TIER_OPTIONS, getCreditInfo, CREDIT_DEFAULT } from "./MyPage.utils";
import { useRecentUsers } from "./useRecentUsers";

// =========================================================================
// --- 4. 회원 관리 뷰 ---
// =========================================================================
// ★ [수정] props에 updateUserCreditScore 추가 (신용점수 컨트롤용)
export const UsersView = ({
  users = [],
  updateFullUserInfo,
  updateUserTier,
  updateUserCreditScore,   // ★ [신규]
  handleChangeUserPassword
}) => {
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

  // ★ [신규] 수정 버튼 클릭 시 - 다이아 + 신용점수 동시 저장
  const handleSaveAll = (u) => {
    const newDiamond = document.getElementById(`pt-${u.id}`).value;
    const newCredit = document.getElementById(`cs-${u.id}`).value;

    // 다이아 + refCode + referral (기존 로직 그대로)
    updateFullUserInfo?.(u.id, newDiamond, u.refCode, u.referral);

    // 신용점수 (값이 있고, 기존 값과 다르면 저장)
    const currentScore = u.creditScore ?? CREDIT_DEFAULT;
    if (newCredit !== "" && parseInt(newCredit, 10) !== currentScore) {
      updateUserCreditScore?.(u.id, newCredit);
    }
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

      {/* ★ [수정] 신용점수 컬럼 추가로 테이블 폭 재조정 */}
      <table style={{ ...iaStyles.table, width: "100%", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: "6%" }}>상태</th>
            <th style={{ width: "14%" }}>아이디</th>
            <th style={{ width: "12%" }}>다이아</th>
            <th style={{ width: "12%" }}>변경값</th>
            <th style={{ width: "11%" }}>등급</th>
            <th style={{ width: "14%" }}>신용점수</th>{/* ★ 신규 */}
            <th style={{ width: "31%" }}>액션</th>
          </tr>
        </thead>
        <tbody>
          {displayUsers.length === 0 ? (
            <tr><td colSpan="7" style={{ padding: 20, textAlign: 'center', color: '#555' }}>기록이 없습니다. 유저를 검색해주세요.</td></tr>
          ) : (
            displayUsers.map(u => {
              // ★ [신규] 각 유저의 신용점수 정보 계산 (색상, 라벨용)
              const credit = getCreditInfo(u.creditScore);
              return (
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

                  {/* ★ [신규] 신용점수 셀 - 현재값(색상) + 변경값 입력 */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 13, color: credit.color, fontWeight: 'bold' }}>
                          {credit.score}
                        </span>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: `${credit.color}22`,
                          color: credit.color,
                          border: `1px solid ${credit.color}55`,
                        }}>
                          {credit.labelKo}
                        </span>
                      </div>
                      <input
                        id={`cs-${u.id}`}
                        type="number"
                        min="0"
                        defaultValue={u.creditScore ?? CREDIT_DEFAULT}
                        style={{ ...iaStyles.giantInput, width: "90%", textAlign: 'center' }}
                      />
                    </div>
                  </td>

                  <td style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                    {/* ★ [수정] 수정 버튼 - 다이아 + 신용점수 동시 저장 */}
                    <button onClick={() => handleSaveAll(u)} style={iaStyles.giantBtn}>수정</button>
                    <button onClick={() => handleChangeUserPassword?.(u.id)} style={{ ...iaStyles.giantBtn, background: "#5856d6", color: "#fff" }}>비번</button>
                    <button onClick={() => handleDeleteUI(u.id)} style={{ ...iaStyles.giantBtn, background: "#ef4444", color: "#fff" }}>삭제</button>
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