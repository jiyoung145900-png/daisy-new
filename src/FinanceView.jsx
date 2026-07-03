import React, { useState } from "react";
import { iaStyles } from "./AdminStyles";

// =========================================================================
// --- 2. 완료된 장부 뷰 ---
// =========================================================================
export const FinanceView = ({ financeHistory = [] }) => {
  // 1. 아이디 검색을 위한 상태(State) 추가
  const [searchTerm, setSearchTerm] = useState("");

  // 2. 검색어에 맞춰 데이터 필터링 로직 (소문자로 변환하여 대소문자 구분 없이 검색)
  const filteredHistory = financeHistory.filter(f => 
    f.userId && f.userId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={iaStyles.card}>
      {/* 상단 타이틀 및 검색창 영역을 flex로 가로 배치 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ ...iaStyles.bigTabTitle, margin: 0 }}>📜 자금 입/출금 완료 장부</h1>
        
        {/* 3. 손님 아이디 검색창 UI 추가 */}
        <input 
          type="text" 
          placeholder="🔍 아이디 검색..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '10px 15px',
            borderRadius: '8px',
            border: '1px solid #444',
            background: '#222',
            color: '#fff',
            fontSize: '14px',
            width: '250px',
            outline: 'none'
          }}
        />
      </div>

      <table style={iaStyles.table}>
        <thead>
          {/* 4. '사유' 컬럼(th) 추가 */}
          <tr><th>일시</th><th>ID</th><th>구분</th><th>금액</th><th>상태</th><th>사유</th></tr>
        </thead>
        <tbody>
          {filteredHistory.length === 0 ? (
            <tr><td colSpan="6" style={{ padding: 30, textAlign: "center" }}>내역 없음</td></tr>
          ) : (
            filteredHistory.map(f => {
              const displayStatus = f.status === 'pending' ? '완료' : (f.status || '완료');
              
              // 5. 사유 데이터 가져오기 (거절이면 rejectReason, 아니면 approveReason)
              const reasonText = displayStatus === '거절' ? f.rejectReason : f.approveReason;

              return (
                <tr key={f.id} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ color: "#888", fontSize: 13 }}>{f.completedAt ? new Date(f.completedAt).toLocaleString() : "-"}</td>
                  <td style={{ fontWeight: "bold" }}>{f.userId}</td>
                  <td>
                    <span style={{
                      background: f.type === "입금" ? "rgba(0,255,0,0.1)" : "rgba(255,59,48,0.1)",
                      color: f.type === "입금" ? "#00ff00" : "#ff3b30",
                      padding: "3px 8px", borderRadius: "5px", fontSize: 12, fontWeight: "bold"
                    }}>{f.type}</span>
                  </td>
                  <td style={{ fontSize: 16, fontWeight: "bold" }}>{f.amount?.toLocaleString()}</td>
                  <td style={{ color: displayStatus === '거절' ? '#ef4444' : "#4cd137", fontWeight: "bold" }}>
                    {displayStatus}
                  </td>
                  {/* 6. 사유 데이터 출력 (내용이 길면 말줄임표 처리, 마우스 올리면 툴팁으로 전체 보임) */}
                  <td 
                    style={{ color: "#ccc", fontSize: 13, maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} 
                    title={reasonText || "-"}
                  >
                    {reasonText || "-"}
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