import { useMemo, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { optimizeImage, optimizeVideo } from "./CloudinaryUrl";
import { motion, AnimatePresence } from "framer-motion";

/*
  LandingPage (UTF-8 safe) - 리디자인
  - 로고 위치 하드코딩 (상단 중앙, 화면 상단에서 8vh 여백)
  - 로그인 카드 접기/펼치기 (초기 접힘 상태, 클릭 시 펼침)
  - 문구 추가:
      한글: 시간이 멈추는 곳 / BANADA에 오신 것을 환영합니다
      영어: Where time slows / Welcome to BANADA
  - Signup: invite code check (local users -> Firestore invite_codes)
  - Login: local users first, then Firestore users
  - admin/game: bypass DB and delegate to onLogin (App.jsx에서 처리)
  - Enter key triggers login/signup
*/

const sanitizeText = (s) =>
  String(s ?? "")
    .replace(/\u200B/g, "") // zero-width space
    .replace(/\uFEFF/g, "") // BOM
    .trim();

const normalizeId = (s) => sanitizeText(s).toLowerCase();
const normalizePw = (s) => sanitizeText(s);

const passOf = (u) => String(u?.password ?? u?.pw ?? "");

const buildUserPasswordFields = (pw) => {
  const clean = normalizePw(pw);
  return { pw: clean, password: clean };
};

export default function LandingPage({
  t,
  lang,
  users,
  setUsers,
  onLogin,
  onGuestLogin,
  hero, // ★ [무시] title/desc 무시하고 배경 이미지/비디오 모드만 사용
  videoURL,
  logo,
  logoSize,
  logoPos, // ★ [무시] 관리자 조절 안 함 - 하드코딩된 위치 사용
  styles,
  isAdmin,
  syncToFirebase,
}) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [ref, setRef] = useState("");
  const [isExpanded, setIsExpanded] = useState(false); // ★ [신규] 로그인 카드 접힘/펼침 상태
  const [isLoading, setIsLoading] = useState(false); // ★ [신규] 로그인/회원가입 처리 중 상태

  // 언어 판별 (t.home이 "홈페이지"면 한국어)
  const isKo = t && t.home === "홈페이지";

  // ★ [수정] 한글/영어 자동 전환 - isKo 값에 따라 문구 자동 변경
  const texts = useMemo(
    () => (isKo ? {
      // 한글 버전
      fillAll: "모든 정보를 입력해주세요.",
      idExists: "이미 존재하는 아이디입니다.",
      invalidInvite: "잘못된 초대 코드입니다.",
      needIdPw: "아이디와 비밀번호를 입력하세요.",
      wrongPw: "비밀번호가 일치하지 않습니다.",
      idNotFound: "존재하지 않는 아이디입니다.",
      signupOk: "가입 완료! 로그인해주세요.",
      enterInvite: "초대 코드 입력",
      newHere: "처음이신가요? 회원가입",
      haveAccount: "계정이 있으신가요? 로그인",
    } : {
      // 영어 버전
      fillAll: "Please fill all info.",
      idExists: "ID already exists.",
      invalidInvite: "Invalid invitation code.",
      needIdPw: "Enter ID & Password.",
      wrongPw: "Wrong Password.",
      idNotFound: "ID not found.",
      signupOk: "Signup Success! Please Login.",
      enterInvite: "Enter Invitation Code",
      newHere: "New here? Sign Up",
      haveAccount: "Have an account? Login",
    }),
    [isKo]
  );

  const signup = async () => {
    if (isLoading) return; // 중복 클릭 방지
    
    const cleanIdRaw = sanitizeText(id);
    const cleanPw = normalizePw(pw);
    const cleanRef = sanitizeText(ref);

    if (!cleanIdRaw || !cleanPw || !cleanRef) return alert(texts.fillAll);

    const cleanId = normalizeId(cleanIdRaw);

    if (users.find((u) => normalizeId(u?.id) === cleanId)) {
      return alert(texts.idExists);
    }

    setIsLoading(true); // ★ [신규] 처리 시작

    try {
      let agentName = "";
      let isValidRef = false;

      if (cleanRef === "ADMIN") {
        isValidRef = true;
        agentName = "ADMIN";
      } else {
        const localInviteOwner = users.find((u) => u?.id === cleanRef);
        if (localInviteOwner) {
          isValidRef = true;
          agentName = localInviteOwner.id;
        } else {
          try {
            const inviteRef = doc(db, "invite_codes", cleanRef);
            const inviteSnap = await getDoc(inviteRef);

            if (inviteSnap.exists()) {
              isValidRef = true;
              agentName = inviteSnap.data()?.name ?? "";
            } else {
              alert(texts.invalidInvite);
              return;
            }
          } catch (e) {
            console.error("Invite check error:", e);
            alert(`Error: ${e.message}`);
            return;
          }
        }
      }

      if (!isValidRef) return;

      const startNo = 2783982189;
      const generatedNo = (startNo + users.length).toString();

      // ★ [신규] 회원가입 시 IP + 브라우저 정보 자동 조회
      //   - 봇/멀티계정 감지용 (관리자가 조회 가능)
      //   - IP 조회 실패해도 가입은 정상 진행 (fallback)
      let signupIp = "";
      let userAgent = "";
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          signupIp = ipData.ip || "";
        }
      } catch (ipErr) {
        console.warn("IP 조회 실패:", ipErr);
      }
      try {
        userAgent = navigator.userAgent || "";
      } catch (uaErr) {}

      const newUser = {
        id: cleanId,
        ...buildUserPasswordFields(cleanPw),
        no: generatedNo,
        referral: cleanRef,
        diamond: 0,
        refCode: cleanId,
        agentName,
        joinedAt: new Date().toISOString(),
        // ★ [신규] 봇/멀티계정 방지용 메타 데이터
        signupIp: signupIp,
        signupUA: userAgent.substring(0, 200),
        signupAt: new Date().toISOString(),
      };

      const updatedUsers = [...users, newUser];
      setUsers(updatedUsers);

      // ★ [필수 수정] users 컬렉션에 개별 문서로 저장
      //   - 관리자 페이지가 users 컬렉션을 실시간 구독
      //   - 이거 안 하면 회원가입해도 관리자 화면에 안 뜸
      try {
        await setDoc(doc(db, "users", cleanId), newUser);
      } catch (userDocErr) {
        console.error("users 컬렉션 저장 실패:", userDocErr);
      }

      // 기존 settings/global 동기화도 유지 (랜딩페이지용 유저 목록)
      if (syncToFirebase) {
        await syncToFirebase({ users: updatedUsers });
      }

      alert(texts.signupOk);
      setId("");
      setPw("");
      setRef("");
      setMode("login");
    } finally {
      setIsLoading(false); // ★ [신규] 성공/실패 상관없이 로딩 해제
    }
  };

  const handleLogin = async () => {
    if (isLoading) return; // 중복 클릭 방지
    
    const cleanIdRaw = sanitizeText(id);
    const cleanPw = normalizePw(pw);

    if (!cleanIdRaw || !cleanPw) return alert(texts.needIdPw);

    const cleanId = normalizeId(cleanIdRaw);

    if (cleanId === "admin" || cleanId === "game") {
      onLogin(cleanId, cleanPw);
      return;
    }

    setIsLoading(true); // ★ [신규] 처리 시작

    try {
      const localUser = users.find(
        (u) => normalizeId(u?.id) === cleanId && passOf(u) === cleanPw
      );
      if (localUser) {
        onLogin(cleanId, cleanPw);
        return;
      }

      try {
        const userRef = doc(db, "users", cleanId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (passOf(userData) === cleanPw) {
            setUsers((prev) => [...prev, userData]);
            onLogin(cleanId, cleanPw);
          } else {
            alert(texts.wrongPw);
          }
        } else {
          alert(texts.idNotFound);
        }
      } catch (e) {
        console.error("Login check error:", e);
        alert("Error checking login.");
      }
    } finally {
      setIsLoading(false); // ★ [신규] 성공/실패 상관없이 로딩 해제
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      mode === "login" ? handleLogin() : signup();
    }
  };

  return (
    <div style={{ ...styles.landingWrapper, minHeight: "100dvh" }}>
      {/* ===== 배경 (이미지/비디오) ===== */}
      <div
        style={{
          ...styles.bgWrap,
          minHeight: "100dvh",
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
      >
        <div style={styles.bgOverlay} />
        
        {/* ★ [럭셔리] 은은한 로즈골드 & 립스틱 레드 광채 오버레이 */}
        <div style={landingStyles.luxuryOverlay} />

        {hero?.mode === "image" && hero?.imageSrc && (
          <img
            src={optimizeImage(hero.imageSrc, { width: 1280 })}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100dvh",
              objectFit: "cover",
              zIndex: -1,
            }}
          />
        )}

        {hero?.mode === "video" && videoURL && (
          <video
            key={videoURL}
            src={optimizeVideo(videoURL, { width: 720 })}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            style={{ ...styles.bgVideo, height: "100dvh", objectFit: "cover" }}
          />
        )}
      </div>

      {/* ===== 로고 (상단 중앙 고정, 모든 기기 동일) ===== */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "8vh", // ★ 화면 상단에서 8% 여백
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        {logo ? (
          <img
            src={optimizeImage(logo, { width: 500 })}
            alt="logo"
            style={{
              height: `${logoSize || 140}px`,
              width: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 0 15px rgba(0,0,0,0.5))",
            }}
          />
        ) : (
          <strong style={styles.defaultLogo}>BANADA</strong>
        )}
      </div>

      {/* ===== 메인 콘텐츠 ===== */}
      <div style={{ ...styles.mainContent, paddingTop: "28vh" }}>
        {/* ★ [신규] 스피너 CSS */}
        <style>{`
          @keyframes lp-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .lp-spinner {
            width: 18px;
            height: 18px;
            border: 3px solid rgba(0,0,0,0.15);
            border-top: 3px solid #000;
            border-radius: 50%;
            animation: lp-spin 0.7s linear infinite;
            display: inline-block;
          }
        `}</style>

        {/* ★ [신규] 문구 섹션 - 서브(작은) 위, 웰컴(큰) 아래 */}
        <div style={landingStyles.heroSection}>
          <p style={landingStyles.subText}>
            {isKo ? "시간이 멈추는 곳" : "Where time slows"}
          </p>
          <h1 style={landingStyles.mainText}>
            {isKo ? "BANADA에 오신 것을 환영합니다" : "Welcome to BANADA"}
          </h1>
        </div>

        {!isAdmin && (
          <div style={styles.authWrap}>
            {/* ★ [신규] 로그인 카드 - 접기/펼치기 */}
            <AnimatePresence mode="wait" initial={false}>
              {!isExpanded ? (
                // 접힌 상태: 얇은 버튼 형태
                <motion.button
                  key="collapsed"
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => setIsExpanded(true)}
                  style={landingStyles.collapsedCard}
                >
                  <span style={landingStyles.collapsedIcon}>🔒</span>
                  <span style={landingStyles.collapsedText}>
                    {isKo ? "로그인 / 회원가입" : "LOGIN / SIGN UP"}
                  </span>
                  <span style={landingStyles.collapsedArrow}>▼</span>
                </motion.button>
              ) : (
                // 펼친 상태: 전체 로그인 카드
                <motion.div
                  key="expanded"
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={{ 
                    ...styles.authCard, 
                    ...landingStyles.authCardOverride,
                    padding: "45px 32px", 
                    position: "relative" 
                  }}
                >
                  {/* 접기 버튼 (우상단) */}
                  <button
                    onClick={() => {
                      setIsExpanded(false);
                      setId("");
                      setPw("");
                      setRef("");
                    }}
                    style={landingStyles.closeBtn}
                    aria-label="close"
                  >
                    ▲
                  </button>

                  <h2
                    style={{
                      ...styles.authTitle,
                      ...landingStyles.authTitleOverride,
                    }}
                  >
                    {mode === "login" ? t.login : t.signup}
                  </h2>

                  <input
                    style={{
                      ...styles.authInput,
                      ...landingStyles.authInputOverride,
                      height: "50px",
                    }}
                    placeholder={t.id}
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />

                  <input
                    type="password"
                    style={{
                      ...styles.authInput,
                      ...landingStyles.authInputOverride,
                      height: "50px",
                    }}
                    placeholder={t.pw}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />

                  {mode === "signup" && (
                    <input
                      style={{
                        ...styles.authInput,
                        ...landingStyles.authInputOverride,
                        height: "50px",
                        borderBottom: "1px solid #e0a898",
                        background: "linear-gradient(to bottom, rgba(224, 168, 152, 0.03) 0%, transparent 100%)",
                        color: "#f5e6d3",
                      }}
                      placeholder={texts.enterInvite}
                      value={ref}
                      onChange={(e) => setRef(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                  )}

                  <button
                    style={{
                      ...styles.primaryBtn,
                      ...landingStyles.primaryBtnOverride,
                      height: "55px",
                      marginTop: "18px",
                      opacity: isLoading ? 0.6 : 1,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                    }}
                    onClick={() => (mode === "login" ? handleLogin() : signup())}
                    disabled={isLoading}
                  >
                    {isLoading && <span className="lp-spinner" />}
                    {isLoading 
                      ? (isKo ? "처리 중..." : "Processing...")
                      : (mode === "login" ? t.login : t.signup)}
                  </button>

                  <button
                    style={{
                      ...styles.guestBtn,
                      ...landingStyles.guestBtnOverride,
                      height: "48px",
                      marginTop: "14px",
                      opacity: isLoading ? 0.5 : 1,
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                    }}
                    onClick={() => {
                      if (isLoading) return;
                      setMode(mode === "login" ? "signup" : "login");
                      setId("");
                      setPw("");
                      setRef("");
                    }}
                    disabled={isLoading}
                  >
                    {mode === "login" ? t.signup : t.login}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// ★ [신규] 랜딩페이지 전용 스타일
// ============================================================
// ★ [럭셔리 리뉴얼] 딥 블랙 + 로즈골드 컨셉
//   - 브랜드 컨셉: 프라이빗 라운지, 매혹적, 유혹적
//   - 컬러 팔레트:
//     · 배경: 순 블랙 + 미묘한 붉은 광채
//     · 로즈골드: #e0a898, #d4af7f (텍스트)
//     · 골드: #d4af37 (액센트)
//     · 립스틱 레드: #ff2d55 (강조/포인트)
//     · 부드러운 화이트: #f5f5f5
//   - 폰트: 세리프 (Playfair Display 느낌)
//   - 효과: 글래스모피즘, 은은한 광채, 골드 그라디언트
// ============================================================
const landingStyles = {
  heroSection: {
    textAlign: "center",
    marginBottom: 45,
    padding: "0 20px",
  },
  // ★ 서브 텍스트 - 세리프 폰트로 우아하게, 로즈골드 그라디언트
  subText: {
    fontSize: "0.85rem",
    color: "rgba(224, 168, 152, 0.85)", // 로즈골드
    fontWeight: 300,
    letterSpacing: "6px", // 넓은 자간으로 우아하게
    margin: 0,
    marginBottom: 18,
    textTransform: "uppercase",
    fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
    fontStyle: "italic",
    textShadow: "0 0 20px rgba(224, 168, 152, 0.3)",
  },
  // ★ 메인 텍스트 - 세리프 폰트, 골드 그라디언트로 반짝임
  mainText: {
    fontSize: "1.75rem",
    fontWeight: 400,
    color: "#f5f5f5",
    margin: 0,
    letterSpacing: "1px",
    lineHeight: 1.5,
    fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
    // 골드 그라디언트 텍스트
    background: "linear-gradient(135deg, #f5e6d3 0%, #e0a898 40%, #d4af7f 60%, #f5e6d3 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    textShadow: "0 4px 30px rgba(224, 168, 152, 0.3)",
    filter: "drop-shadow(0 0 25px rgba(224, 168, 152, 0.2))",
  },
  // ★ 접힌 로그인 카드 - 매혹적인 딥 블랙 + 로즈골드 테두리
  collapsedCard: {
    width: "100%",
    maxWidth: 320,
    padding: "20px 26px",
    borderRadius: 100, // 완전 둥근 모양 (립스틱 느낌)
    // 딥 블랙 + 미묘한 붉은 광채
    background: "linear-gradient(135deg, rgba(10, 5, 8, 0.85) 0%, rgba(20, 10, 15, 0.85) 100%)",
    backdropFilter: "blur(30px) saturate(180%)",
    WebkitBackdropFilter: "blur(30px) saturate(180%)",
    // 로즈골드 테두리 광채
    border: "1px solid rgba(224, 168, 152, 0.4)",
    boxShadow: `
      0 8px 32px rgba(0, 0, 0, 0.6),
      0 0 40px rgba(224, 168, 152, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.08)
    `,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    cursor: "pointer",
    color: "#f5f5f5",
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: "3px",
    textTransform: "uppercase",
    transition: "all 0.3s ease",
    fontFamily: "'Playfair Display', Georgia, serif",
  },
  collapsedIcon: {
    fontSize: 16,
    color: "#e0a898", // 로즈골드
    filter: "drop-shadow(0 0 8px rgba(224, 168, 152, 0.5))",
  },
  collapsedText: {
    flex: 1,
    textAlign: "left",
    // 로즈골드 그라디언트
    background: "linear-gradient(135deg, #f5e6d3 0%, #e0a898 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  collapsedArrow: {
    fontSize: 10,
    color: "#e0a898",
    opacity: 0.8,
  },
  // ★ 펼친 카드의 접기 버튼 - 우아한 로즈골드
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "linear-gradient(135deg, rgba(224, 168, 152, 0.1) 0%, rgba(224, 168, 152, 0.05) 100%)",
    border: "1px solid rgba(224, 168, 152, 0.3)",
    color: "#e0a898",
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    backdropFilter: "blur(10px)",
    transition: "all 0.25s ease",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
  },
  // ★ [신규] 배경 오버레이 - 은은한 붉은 광채
  luxuryOverlay: {
    position: "absolute",
    inset: 0,
    background: `
      radial-gradient(ellipse at 30% 40%, rgba(255, 45, 85, 0.08) 0%, transparent 60%),
      radial-gradient(ellipse at 70% 70%, rgba(224, 168, 152, 0.05) 0%, transparent 50%),
      linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.7) 100%)
    `,
    pointerEvents: "none",
    zIndex: 1,
  },
  // ★ [신규] 카드 스타일 오버라이드 (styles.authCard 위에 겹치기)
  authCardOverride: {
    background: "linear-gradient(135deg, rgba(10, 5, 8, 0.9) 0%, rgba(20, 10, 15, 0.85) 100%)",
    backdropFilter: "blur(40px) saturate(180%)",
    WebkitBackdropFilter: "blur(40px) saturate(180%)",
    border: "1px solid rgba(224, 168, 152, 0.25)",
    boxShadow: `
      0 20px 60px rgba(0, 0, 0, 0.8),
      0 0 80px rgba(224, 168, 152, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.05)
    `,
    borderRadius: 24,
  },
  // ★ [신규] 로그인/회원가입 제목 - 세리프, 로즈골드
  authTitleOverride: {
    fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
    fontSize: "1.6rem",
    fontWeight: 500,
    letterSpacing: "3px",
    textAlign: "center",
    marginBottom: 30,
    background: "linear-gradient(135deg, #f5e6d3 0%, #e0a898 50%, #d4af7f 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    filter: "drop-shadow(0 0 20px rgba(224, 168, 152, 0.2))",
  },
  // ★ [신규] 입력 필드 - 우아하고 매혹적
  authInputOverride: {
    background: "rgba(255, 255, 255, 0.03)",
    border: "none",
    borderBottom: "1px solid rgba(224, 168, 152, 0.3)",
    borderRadius: 0,
    padding: "14px 4px",
    marginBottom: 22,
    color: "#f5f5f5",
    fontSize: 15,
    letterSpacing: "0.5px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    outline: "none",
    transition: "all 0.3s ease",
    width: "100%",
    boxSizing: "border-box",
  },
  // ★ [신규] 메인 버튼 - 로즈골드 그라디언트, 우아함
  primaryBtnOverride: {
    background: "linear-gradient(135deg, #e0a898 0%, #d4af7f 50%, #e0a898 100%)",
    color: "#1a0d10",
    border: "none",
    padding: "16px 24px",
    borderRadius: 100,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "3px",
    textTransform: "uppercase",
    cursor: "pointer",
    width: "100%",
    boxShadow: `
      0 10px 30px rgba(224, 168, 152, 0.4),
      0 0 40px rgba(224, 168, 152, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.3)
    `,
    transition: "all 0.3s ease",
    fontFamily: "'Playfair Display', Georgia, serif",
  },
  // ★ [신규] 게스트 버튼 - 부드럽고 은은
  guestBtnOverride: {
    background: "transparent",
    color: "rgba(224, 168, 152, 0.7)",
    border: "1px solid rgba(224, 168, 152, 0.3)",
    padding: "14px 24px",
    borderRadius: 100,
    fontSize: 13,
    fontWeight: 400,
    letterSpacing: "2px",
    textTransform: "uppercase",
    cursor: "pointer",
    width: "100%",
    transition: "all 0.3s ease",
    fontFamily: "'Playfair Display', Georgia, serif",
  },
  // ★ [신규] 언어 전환 링크 - 우아하게
  languageLink: {
    color: "rgba(224, 168, 152, 0.6)",
    fontSize: 11,
    letterSpacing: "2px",
    textTransform: "uppercase",
    fontFamily: "'Playfair Display', Georgia, serif",
    cursor: "pointer",
    transition: "color 0.25s ease",
  },
  // ★ [신규] 모드 전환 (로그인/회원가입 스위치)
  modeSwitch: {
    textAlign: "center",
    marginTop: 20,
    color: "rgba(245, 245, 245, 0.6)",
    fontSize: 12,
    letterSpacing: "1.5px",
    fontFamily: "'Playfair Display', Georgia, serif",
  },
  modeSwitchLink: {
    color: "#e0a898",
    cursor: "pointer",
    fontWeight: 500,
    textDecoration: "none",
    transition: "color 0.25s ease",
    marginLeft: 8,
  },
};