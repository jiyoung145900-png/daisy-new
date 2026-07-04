import React, { useState, useEffect } from "react";
import { iaStyles } from "./AdminStyles";
import { TIER_OPTIONS, getCreditInfo, CREDIT_DEFAULT, getTierInfo } from "./MyPage.utils";
import { useRecentUsers } from "./useRecentUsers";

// =========================================================================
// --- 회원 관리 뷰 (간소화) ---
// -------------------------------------------------------------------------
// 변경사항:
//   - 편집 기능(다이아/등급/신용점수/비번)은 모두 UserDetailView로 이동
//   - 여기는 검색 + 최근 조회 20개 + 리스트 미리보기만
//   - 아이디 클릭 시 onSelectUser(userId) 호출 → 상세 페이지로 이동
//   - 각 행은 클릭 가능한 카드 스타일 (호버 시 강조)
// =========================================================================
export const UsersView = ({ users = [], onSelectUser }) => {
  const [term, setTerm] = useState("");
  const [localHidden, setLocalHidden] = useState(new Set());
  const { recentIds, addRecentIds, removeRecentId } = useRecentUsers('admin_recent_users', 20);
  const isSearching = term.trim() !== "";

  const [hoveredId, setHoveredId] = useState(null);

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

  const handleDeleteUI = (e, id) => {
    e.stopPropagation(); // 카드 클릭 방지
    if (isSearching) {
      setLocalHidden(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
    removeRecentId(id);
  };

  const handleClickUser = (userId) => {
    // 최근 조회에 추가 (검색 없이 최근 목록에서 클릭해도 갱신)
    addRecentIds([userId]);
    onSelectUser?.(userId);
  };

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>
        💰 회원 관리 {isSearching ? "(검색 결과)" : "(최근 조회 기록)"}
      </h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
        <span style={{ fontSize: 24 }}>🔍</span>
        <input
          placeholder="아이디 검색... (검색하면 최근 기록에 추가됩니다)"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          style={{ ...iaStyles.searchInputField, width: '100%' }}
        />
      </div>

      {/* 안내 문구 */}
      <div style={{
        marginBottom: 20,
        padding: '10px 15px',
        background: 'rgba(255,179,71,0.08)',
        borderRadius: 8,
        border: '1px solid rgba(255,179,71,0.2)',
        color: '#ffb347',
        fontSize: 13,
      }}>
        💡 아이디를 클릭하면 <b>회원 상세 페이지</b>로 이동합니다. (다이아 조정, 계좌 관리, 완료 장부 등)
      </div>

      {displayUsers.length === 0 ? (
        <div style={emptyBox}>
          {isSearching ? "검색 결과가 없습니다." : "기록이 없습니다. 아이디를 검색해주세요."}
        </div>
      ) : (
        <table style={{ ...iaStyles.table, width: "100%", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "6%" }}>상태</th>
              <th style={{ width: "20%" }}>아이디</th>
              <th style={{ width: "18%" }}>다이아</th>
              <th style={{ width: "14%" }}>등급</th>
              <th style={{ width: "18%" }}>신용점수</th>
              <th style={{ width: "14%" }}>계좌</th>
              <th style={{ width: "10%" }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {displayUsers.map(u => {
              const tier = getTierInfo(u.tier);
              const credit = getCreditInfo(u.creditScore);
              const isOnline = u.lastActive && (Date.now() - u.lastActive < 60000);
              const isHovered = hoveredId === u.id;
              const hasBank = !!u.savedBankInfo?.bank;

              return (
                <tr
                  key={u.id}
                  onClick={() => handleClickUser(u.id)}
                  onMouseEnter={() => setHoveredId(u.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    borderBottom: "1px solid #222",
                    cursor: 'pointer',
                    background: isHovered ? 'rgba(255,179,71,0.05)' : 'transparent',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <td style={{ textAlign: "center" }}>
                    {isOnline
                      ? <span style={{ color: "#0f0" }}>●</span>
                      : <span style={{ color: "#444" }}>●</span>}
                  </td>
                  <td>
                    <span style={{
                      fontWeight: "bold",
                      fontSize: 15,
                      color: isHovered ? '#ffb347' : '#fff',
                      transition: 'color 0.15s'
                    }}>
                      {u.id}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#666' }}>
                      {isHovered && '→ 상세보기'}
                    </span>
                  </td>
                  <td style={{ color: "#ffb347" }}>
                    💎 {(u.diamond ?? 0).toLocaleString()}
                  </td>
                  <td>
                    <span style={{
                      background: tier.color,
                      color: '#000',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 900,
                    }}>
                      {tier.name}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: credit.color, fontWeight: 'bold', fontSize: 14 }}>
                      {credit.score}
                    </span>
                    <span style={{
                      marginLeft: 6,
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: 3,
                      background: `${credit.color}22`,
                      color: credit.color,
                      border: `1px solid ${credit.color}55`,
                    }}>
                      {credit.labelKo}
                    </span>
                  </td>
                  <td>
                    {hasBank ? (
                      <span style={{
                        color: '#34D399',
                        fontSize: 11,
                        fontWeight: 700,
                        background: 'rgba(52,211,153,0.1)',
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: '1px solid rgba(52,211,153,0.3)',
                      }}>
                        ✓ 등록됨
                      </span>
                    ) : (
                      <span style={{ color: '#555', fontSize: 11 }}>-</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={(e) => handleDeleteUI(e, u.id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #444',
                        color: '#ef4444',
                        padding: '5px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      숨김
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

const emptyBox = {
  padding: 40,
  textAlign: 'center',
  color: '#555',
  fontSize: 13,
  background: '#0a0a0a',
  borderRadius: 10,
};