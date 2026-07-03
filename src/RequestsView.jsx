import React from "react";
import { iaStyles } from "./AdminStyles";

// =========================================================================
// --- 1. 입출금 요청 뷰 (승인 / 거절) ---
// =========================================================================
export const RequestsView = ({ 
  depositRequests = [], 
  withdrawRequests = [], 
  approveDeposit, 
  approveWithdraw, 
  rejectDeposit, 
  rejectWithdraw 
}) => (
  <div style={iaStyles.card}>
    <h1 style={iaStyles.bigTabTitle}>🔔 입/출금 승인 대기</h1>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
      {/* 입금 신청 섹션 */}
      <div>
        <h3 style={{ color: "#00ff00", marginTop: 0, borderBottom: "1px solid #333", paddingBottom: 10 }}>
          ▼ 입금 신청 ({depositRequests.length})
        </h3>
        <table style={iaStyles.table}>
          <thead><tr><th>정보</th><th>금액</th><th>관리</th></tr></thead>
          <tbody>
            {depositRequests.length === 0 ? (
              <tr><td colSpan="3" style={{ padding: 20, color: "#555", textAlign: 'center' }}>대기중인 내역 없음</td></tr>
            ) : (
              depositRequests.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #222" }}>
                  <td><b>{r.userId}</b><br /><span style={{ fontSize: 12, color: "#888" }}>{r.depositName}</span></td>
                  <td style={{ color: "#00ff00", fontSize: 18, fontWeight: "bold" }}>{r.amount?.toLocaleString()}</td>
                  <td style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => approveDeposit?.(r)} style={{ ...iaStyles.giantBtn, background: '#34D399', color: '#000' }}>승인</button>
                    <button onClick={() => rejectDeposit ? rejectDeposit(r) : alert('거절 로직이 연결되지 않았습니다.')} style={{ ...iaStyles.giantBtn, background: '#ef4444', color: '#fff' }}>거절</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 출금 신청 섹션 */}
      <div>
        <h3 style={{ color: "#ff3b30", marginTop: 0, borderBottom: "1px solid #333", paddingBottom: 10 }}>
          ▼ 출금 신청 ({withdrawRequests.length})
        </h3>
        <table style={iaStyles.table}>
          <thead><tr><th>정보</th><th>금액</th><th>관리</th></tr></thead>
          <tbody>
            {withdrawRequests.length === 0 ? (
              <tr><td colSpan="3" style={{ padding: 20, color: "#555", textAlign: 'center' }}>대기중인 내역 없음</td></tr>
            ) : (
              withdrawRequests.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid #222" }}>
                  <td><b>{r.userId}</b><br /><span style={{ fontSize: 12, color: "#888" }}>{r.bankInfo?.bank}</span></td>
                  <td style={{ color: "#ff3b30", fontSize: 18, fontWeight: "bold" }}>{r.amount?.toLocaleString()}</td>
                  <td style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => approveWithdraw?.(r)} style={{ ...iaStyles.giantBtn, background: '#34D399', color: '#000' }}>승인</button>
                    <button onClick={() => rejectWithdraw ? rejectWithdraw(r) : alert('거절 로직이 연결되지 않았습니다.')} style={{ ...iaStyles.giantBtn, background: '#ef4444', color: '#fff' }}>거절</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
