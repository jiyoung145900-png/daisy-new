import React from "react";
import { iaStyles } from "./AdminStyles";

// =========================================================================
// --- 2. 완료된 장부 뷰 ---
// =========================================================================
export const FinanceView = ({ financeHistory = [] }) => (
  <div style={iaStyles.card}>
    <h1 style={iaStyles.bigTabTitle}>📜 자금 입/출금 완료 장부</h1>
    <table style={iaStyles.table}>
      <thead>
        <tr><th>일시</th><th>ID</th><th>구분</th><th>금액</th><th>상태</th></tr>
      </thead>
      <tbody>
        {financeHistory.length === 0 ? (
          <tr><td colSpan="5" style={{ padding: 30, textAlign: "center" }}>내역 없음</td></tr>
        ) : (
          financeHistory.map(f => {
            const displayStatus = f.status === 'pending' ? '완료' : (f.status || '완료');
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
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
);
