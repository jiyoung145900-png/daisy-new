import React, { useState, useEffect } from "react";
import { iaStyles } from "./AdminStyles";
import { useRecentUsers } from "./useRecentUsers";
import { getTierInfo, getCreditInfo } from "./MyPage.utils";

// =========================================================================
// --- 6. 추천인 관리 뷰 (재설계) ---
// -------------------------------------------------------------------------
// 목적: 실장(파트너) 기준으로 어떤 손님이 몇일에 가입했는지 확인
//
// 기능:
//   - 실장 이름 or 코드로 검색
//   - 매칭된 실장별로 카드로 표시
//   - 각 카드 안에 해당 실장의 손님을 최근 가입순으로 나열
//   - 손님 정보: 아이디, 가입일, 다이아, 등급, 신용점수
//   - 최근 검색 실장 20개 로컬 저장
//   - 삭제 버튼 = UI에서만 숨김 (실제 데이터 유지)
//
// 회원가입 시점에 users/{id}에 이미 저장되는 필드들:
//   - referral: 실장의 코드
//   - agentName: 실장 이름
//   - joinedAt: ISO 형식 가입 날짜
// =========================================================================
export const ReferralsView = ({ users = [], agents = [] }) => {
  const [term, setTerm] = useState("");
  const [localHidden, setLocalHidden] = useState(new Set());
  const { recentIds, addRecentIds, removeRecentId } = useRecentUsers('admin_recent_referrals', 20);
  const isSearching = term.trim() !== "";

  // ★ 검색어 변경 시 최근 조회 목록에 추가 (600ms 디바운스)
  useEffect(() => {
    setLocalHidden(new Set());
    if (isSearching) {
      const timeout = setTimeout(() => {
        const matches = agents
          .filter(a =>
            (a.name || "").toLowerCase().includes(term.toLowerCase()) ||
            (a.code || "").toLowerCase().includes(term.toLowerCase())
          )
          .map(a => a.code || a.id);
        if (matches.length > 0) addRecentIds(matches);
      }, 600);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line
  }, [term, agents]);

  // ★ 검색 중이면 매칭된 실장들, 아니면 최근 조회한 실장들 표시
  let displayAgents = [];
  if (isSearching) {
    displayAgents = agents.filter(a => {
      const code = a.code || a.id;
      const searchStr = `${a.name || ""} ${code}`.toLowerCase();
      return searchStr.includes(term.toLowerCase()) && !localHidden.has(code);
    });
  } else {
    displayAgents = recentIds
      .map(id => agents.find(a => (a.code || a.id) === id))
      .filter(Boolean);
  }

  const handleDeleteUI = (code) => {
    if (isSearching) {
      setLocalHidden(prev => {
        const next = new Set(prev);
        next.add(code);
        return next;
      });
    }
    removeRecentId(code);
  };

  // ★ [유틸] 가입일 포맷 (Firestore Timestamp / ISO string / null 안전 처리)
  const formatJoinDate = (val) => {
    if (!val) return "-";
    try {
      if (typeof val === 'object' && val.toDate) {
        return val.toDate().toLocaleDateString('ko-KR', {
          year: 'numeric', month: '2-digit', day: '2-digit'
        });
      }
      return new Date(val).toLocaleDateString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch {
      return "-";
    }
  };

  // ★ [유틸] 실장 코드로 해당 실장의 손님들 가져오기 (최근 가입순 정렬)
  const getReferredUsers = (agentCode) => {
    return users
      .filter(u => (u.referral || "") === agentCode)
      .sort((a, b) => {
        // joinedAt 없는 경우 뒤로 밀리게
        const timeA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
        const timeB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
        return timeB - timeA; // 내림차순 (최신 → 오래된)
      });
  };

  return (
    <div style={iaStyles.card}>
      <h1 style={iaStyles.bigTabTitle}>
        🤝 추천인 관리 {isSearching ? "(검색 결과)" : "(최근 조회 기록)"}
      </h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
        <span style={{ fontSize: 24 }}>🔍</span>
        <input
          placeholder="실장 이름이나 코드로 검색... (예: 김실장, ABC123)"
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
        💡 실장 이름/코드로 검색하면 해당 실장의 손님들이 <b>가입일 최신순</b>으로 표시됩니다.
      </div>

      {/* 실장 카드 리스트 */}
      {displayAgents.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#555', background: '#111', borderRadius: 12 }}>
          {isSearching
            ? "검색 결과가 없습니다."
            : "기록이 없습니다. 실장 이름이나 코드로 검색해주세요."}
        </div>
      ) : (
        displayAgents.map(agent => {
          const code = (agent.code || agent.id || "").toString();
          const referredUsers = getReferredUsers(code);

          return (
            <div key={code} style={agentCardStyle.card}>
              {/* 실장 헤더 */}
              <div style={agentCardStyle.header}>
                <div style={agentCardStyle.headerLeft}>
                  <div style={agentCardStyle.agentBadge}>👔</div>
                  <div>
                    <div style={agentCardStyle.agentName}>{agent.name || "이름없음"}</div>
                    <div style={agentCardStyle.agentCode}>
                      코드: <span style={{ color: '#ffb347', fontFamily: 'monospace' }}>{code}</span>
                    </div>
                  </div>
                </div>
                <div style={agentCardStyle.headerRight}>
                  <div style={agentCardStyle.userCountBox}>
                    <div style={agentCardStyle.userCountLabel}>총 손님</div>
                    <div style={agentCardStyle.userCountValue}>{referredUsers.length}명</div>
                  </div>
                  <button
                    onClick={() => handleDeleteUI(code)}
                    style={{ ...iaStyles.giantBtn, background: '#ef4444', color: '#fff', marginLeft: 10 }}
                  >
                    숨김
                  </button>
                </div>
              </div>

              {/* 손님 리스트 */}
              {referredUsers.length === 0 ? (
                <div style={agentCardStyle.emptyUsers}>
                  아직 이 실장의 손님이 없습니다.
                </div>
              ) : (
                <div style={agentCardStyle.userListWrap}>
                  <table style={{ ...iaStyles.table, width: "100%" }}>
                    <thead>
                      <tr style={{ background: '#0f0f0f' }}>
                        <th style={{ width: "8%" }}>#</th>
                        <th style={{ width: "22%" }}>손님 아이디</th>
                        <th style={{ width: "18%" }}>가입일</th>
                        <th style={{ width: "18%" }}>다이아</th>
                        <th style={{ width: "14%" }}>등급</th>
                        <th style={{ width: "20%" }}>신용점수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referredUsers.map((u, idx) => {
                        const tier = getTierInfo(u.tier);
                        const credit = getCreditInfo(u.creditScore);
                        return (
                          <tr key={u.id} style={{ borderBottom: "1px solid #222" }}>
                            <td style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 'bold', fontSize: 14, color: '#fff' }}>{u.id}</td>
                            <td style={{ color: '#aaa', fontSize: 12 }}>{formatJoinDate(u.joinedAt)}</td>
                            <td style={{ color: '#ffb347' }}>
                              💎 {(u.diamond || 0).toLocaleString()}
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
                              <span style={{ color: credit.color, fontWeight: 'bold', fontSize: 13 }}>
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

// 실장 카드 로컬 스타일 (전역 iaStyles에 없는 것만 여기 정의)
const agentCardStyle = {
  card: {
    background: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 22px',
    background: 'linear-gradient(90deg, rgba(255,179,71,0.08) 0%, transparent 100%)',
    borderBottom: '1px solid #2a2a2a',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 15,
  },
  agentBadge: {
    fontSize: 32,
    width: 50,
    height: 50,
    borderRadius: '50%',
    background: '#1c1c1c',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #333',
  },
  agentName: {
    color: '#ffb347',
    fontSize: 18,
    fontWeight: 900,
    marginBottom: 4,
  },
  agentCode: {
    color: '#888',
    fontSize: 12,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
  },
  userCountBox: {
    textAlign: 'center',
    padding: '8px 16px',
    background: '#0f0f0f',
    borderRadius: 10,
    border: '1px solid #333',
  },
  userCountLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: 700,
    marginBottom: 3,
  },
  userCountValue: {
    fontSize: 16,
    color: '#00ff00',
    fontWeight: 900,
  },
  emptyUsers: {
    padding: '30px 20px',
    textAlign: 'center',
    color: '#555',
    fontSize: 13,
  },
  userListWrap: {
    padding: '10px 15px 15px',
  },
};