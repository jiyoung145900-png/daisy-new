// ═════════════════════════════════════════════════════════════════════
// validation.js - 입력 검증 및 XSS 방어 유틸리티
// ───────────────────────────────────────────────────────────────────
// 사용처:
//   - 회원가입 폼 (App.jsx handleSignupAction)
//   - 프로필 수정 (닉네임, 은행 정보)
//   - 관리자 입력 (배팅 사유, 차단 사유)
//   - 채팅/공지 텍스트
//
// 방어 대상:
//   1. XSS - <script> 태그 삽입
//   2. Firestore Injection - 특수 문자로 쿼리 조작
//   3. 길이 폭탄 - 극단적으로 긴 문자열
//   4. 비정상 데이터 - null, 배열, 객체 등이 문자열 필드에 들어옴
// ═════════════════════════════════════════════════════════════════════

// ─── 기본 문자열 정제 (모든 입력에 우선 적용) ───
export function sanitizeText(input, maxLength = 200) {
  if (input === null || input === undefined) return "";
  if (typeof input !== "string") input = String(input);

  return input
    .trim()
    // HTML 태그 완전 제거 (XSS 방어)
    .replace(/<[^>]*>/g, "")
    // HTML 엔티티 이스케이프 (혹시 위 정규식 통과한 경우 대비)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    // 0-width 문자, RTL 오버라이드 등 눈에 안 보이는 조작 문자 제거
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    // 컨트롤 문자 제거 (엔터, 탭 제외)
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "")
    // 최대 길이 제한
    .slice(0, maxLength);
}

// ─── 아이디 검증 (영문/숫자만 3~30자) ───
export function validateUserId(id) {
  if (typeof id !== "string") return { ok: false, reason: "아이디는 문자열이어야 합니다." };
  const clean = id.trim().toLowerCase();

  if (clean.length < 3) return { ok: false, reason: "아이디는 최소 3자 이상이어야 합니다." };
  if (clean.length > 30) return { ok: false, reason: "아이디는 최대 30자까지 가능합니다." };
  if (!/^[a-z0-9_]+$/.test(clean)) {
    return { ok: false, reason: "아이디는 영문 소문자, 숫자, 언더바(_) 만 사용 가능합니다." };
  }
  // 예약어 차단
  const reserved = ["admin", "administrator", "root", "system", "banada", "game", "master", "guest"];
  if (reserved.includes(clean)) return { ok: false, reason: "사용할 수 없는 아이디입니다." };

  return { ok: true, value: clean };
}

// ─── 비밀번호 검증 (4~50자, 공백 불가) ───
export function validatePassword(pw) {
  if (typeof pw !== "string") return { ok: false, reason: "비밀번호는 문자열이어야 합니다." };
  if (pw.length < 4) return { ok: false, reason: "비밀번호는 최소 4자 이상이어야 합니다." };
  if (pw.length > 50) return { ok: false, reason: "비밀번호는 최대 50자까지 가능합니다." };
  if (/\s/.test(pw)) return { ok: false, reason: "비밀번호에 공백을 포함할 수 없습니다." };
  return { ok: true, value: pw };
}

// ─── 닉네임 검증 (1~20자, XSS 방어) ───
export function validateNickname(name) {
  const clean = sanitizeText(name, 20);
  if (clean.length < 1) return { ok: false, reason: "닉네임을 입력해주세요." };
  if (clean.length > 20) return { ok: false, reason: "닉네임은 20자 이하로 입력해주세요." };
  return { ok: true, value: clean };
}

// ─── 금액 검증 (양의 정수, 최대 1억) ───
export function validateAmount(amount, { min = 0, max = 100_000_000 } = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return { ok: false, reason: "숫자를 입력해주세요." };
  if (!Number.isInteger(n)) return { ok: false, reason: "정수만 입력 가능합니다." };
  if (n < min) return { ok: false, reason: `${min.toLocaleString()} 이상 입력해주세요.` };
  if (n > max) return { ok: false, reason: `${max.toLocaleString()} 이하로 입력해주세요.` };
  return { ok: true, value: n };
}

// ─── 은행 계좌번호 (숫자와 하이픈만) ───
export function validateBankAccount(account) {
  if (typeof account !== "string") return { ok: false, reason: "계좌번호는 문자열이어야 합니다." };
  const clean = account.trim().replace(/\s/g, "");
  if (clean.length < 4) return { ok: false, reason: "계좌번호가 너무 짧습니다." };
  if (clean.length > 30) return { ok: false, reason: "계좌번호가 너무 깁니다." };
  if (!/^[0-9-]+$/.test(clean)) return { ok: false, reason: "계좌번호는 숫자와 하이픈(-)만 사용 가능합니다." };
  return { ok: true, value: clean };
}

// ─── 은행 예금주 이름 (한글/영문/공백만, 20자 이내) ───
export function validateHolderName(name) {
  const clean = sanitizeText(name, 20);
  if (clean.length < 1) return { ok: false, reason: "예금주 이름을 입력해주세요." };
  if (!/^[가-힣a-zA-Z\s]+$/.test(clean)) {
    return { ok: false, reason: "예금주 이름은 한글/영문만 가능합니다." };
  }
  return { ok: true, value: clean };
}

// ─── PIN (6자리 숫자) ───
export function validatePin(pin) {
  if (typeof pin !== "string") pin = String(pin || "");
  if (!/^\d{6}$/.test(pin)) return { ok: false, reason: "PIN은 6자리 숫자여야 합니다." };
  return { ok: true, value: pin };
}

// ─── 사유/메모 (긴 텍스트, 300자 이내, XSS 방어) ───
export function validateReason(text, maxLength = 300) {
  const clean = sanitizeText(text, maxLength);
  return { ok: true, value: clean }; // 사유는 비어도 OK
}

// ─── 여러 검증 결과 한번에 처리하는 헬퍼 ───
// 사용 예:
//   const result = validateAll({
//     id: validateUserId(rawId),
//     pw: validatePassword(rawPw),
//     nickname: validateNickname(rawNick),
//   });
//   if (!result.ok) { alert(result.reason); return; }
//   // result.values 에 검증 통과한 값들
export function validateAll(checks) {
  const values = {};
  for (const [key, check] of Object.entries(checks)) {
    if (!check.ok) return { ok: false, reason: `${key}: ${check.reason}`, failedField: key };
    values[key] = check.value;
  }
  return { ok: true, values };
}
