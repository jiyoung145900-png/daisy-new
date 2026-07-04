// =========================================================================
// 🎯 AdminViews.jsx - 통합 export 파일
// =========================================================================
// 이 파일은 모든 뷰 컴포넌트들을 모아서 한 번에 export합니다.
//
// import { RequestsView, EventControlView, ... } from "./AdminViews";
// =========================================================================

export { RequestsView } from "./RequestsView";
export { EventControlView } from "./EventControlView";
export { UsersView } from "./UsersView";
export { AgentsView } from "./AgentsView";
export { ReferralsView } from "./ReferralsView";
export { HistoryView } from "./HistoryView";
export { SponsorshipsView } from "./SponsorshipsView";

// ★ [신규] 회원 상세 페이지 - 검색→클릭 시 진입
//   기본정보 + 통계요약 + 계좌관리 + 완료된장부 통합
export { UserDetailView } from "./UserDetailView";

// ❌ [제거] AccountsView, FinanceView - UserDetailView로 통합
//   해당 파일들은 프로젝트에서 삭제 가능
// export { AccountsView } from "./AccountsView";   ← 제거
// export { FinanceView } from "./FinanceView";     ← 제거