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
          <>
            <video
              key={videoURL}
              src={optimizeVideo(videoURL, { width: 720 })}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              style={{ 
                ...styles.bgVideo, 
                height: "100dvh", 
                objectFit: "cover",
                // ★ [수정] 살짝만 부드럽게 - 밝기 유지, 대비 살짝만 조정
                filter: "contrast(1.05) saturate(1.05)",
              }}
            />
            {/* ★★★ [신규] 부드러운 하단 그라디언트 - 폼 가독성 확보 */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: `
                linear-gradient(
                  180deg,
                  transparent 0%,
                  transparent 40%,
                  rgba(0,0,0,0.15) 60%,
                  rgba(0,0,0,0.55) 100%
                )
              `,
              pointerEvents: "none",
              zIndex: 1,
            }} />
            {/* ★★★ [신규] 다층 파티클 - 원거리 별 반짝임 */}
            <div style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 2,
              opacity: 0.5,
            }}>
              {[...Array(25)].map((_, i) => (
                <div key={`star-${i}`} style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  background: "#fff",
                  borderRadius: "50%",
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  boxShadow: "0 0 3px rgba(255, 255, 255, 0.9)",
                  animation: `landingStarTwinkle ${4 + Math.random() * 5}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 4}s`,
                }} />
              ))}
            </div>

            {/* ★★★ [신규] 다층 파티클 - 중거리 눈송이 */}
            <div style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 3,
              overflow: "hidden",
            }}>
              {[...Array(15)].map((_, i) => (
                <div key={`mid-${i}`} style={{
                  position: "absolute",
                  width: 3,
                  height: 3,
                  background: "rgba(255, 255, 255, 0.9)",
                  borderRadius: "50%",
                  top: `-10px`,
                  left: `${Math.random() * 100}%`,
                  boxShadow: "0 0 8px rgba(255, 255, 255, 0.8)",
                  animation: `landingMidSnow ${9 + Math.random() * 8}s linear infinite`,
                  animationDelay: `${Math.random() * 8}s`,
                }} />
              ))}
            </div>

            {/* ★★★ [신규] 다층 파티클 - 근거리 큰 눈송이 (blur 살짝) */}
            <div style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 4,
              overflow: "hidden",
              filter: "blur(0.5px)",
            }}>
              {[...Array(6)].map((_, i) => (
                <div key={`near-${i}`} style={{
                  position: "absolute",
                  width: 5 + Math.random() * 3,
                  height: 5 + Math.random() * 3,
                  background: "radial-gradient(circle, rgba(255, 255, 255, 1) 30%, transparent 70%)",
                  borderRadius: "50%",
                  top: `-15px`,
                  left: `${Math.random() * 100}%`,
                  boxShadow: "0 0 15px rgba(255, 255, 255, 0.9)",
                  animation: `landingNearSnow ${6 + Math.random() * 4}s linear infinite`,
                  animationDelay: `${Math.random() * 4}s`,
                }} />
              ))}
            </div>
          </>
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
        {/* ★★★ [신규] 로고 컨테이너 - 발광 링 + shimmer 효과 */}
        {logo ? (
          <div style={{
            position: "relative",
            display: "inline-block",
          }}>
            {/* 이중 발광 링 */}
            <div style={{
              position: "absolute",
              inset: -30,
              background: "radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 60%)",
              borderRadius: "50%",
              animation: "logoOuterGlow 4s ease-in-out infinite",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute",
              inset: -50,
              background: "radial-gradient(circle, rgba(255, 255, 255, 0.12) 0%, transparent 70%)",
              borderRadius: "50%",
              animation: "logoOuterGlow 5s ease-in-out infinite reverse",
              pointerEvents: "none",
            }} />

            {/* 로고 이미지 (shimmer 포함) */}
            <div style={{
              position: "relative",
              height: `${logoSize || 140}px`,
              display: "inline-block",
              borderRadius: "50%",
              overflow: "hidden",
            }}>
              <img
                src={optimizeImage(logo, { width: 500 })}
                alt="logo"
                style={{
                  height: `${logoSize || 140}px`,
                  width: "auto",
                  objectFit: "contain",
                  filter: "drop-shadow(0 0 25px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 50px rgba(255, 255, 255, 0.15)) drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
                  animation: "logoBreathe 4s ease-in-out infinite",
                  display: "block",
                }}
              />
              {/* Shimmer 빛 스캔 */}
              <div style={{
                position: "absolute",
                top: 0,
                left: "-100%",
                width: "100%",
                height: "100%",
                background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)",
                animation: "landingShimmer 5s ease-in-out infinite",
                pointerEvents: "none",
                mixBlendMode: "overlay",
              }} />
            </div>
          </div>
        ) : (
          <strong style={styles.defaultLogo}>BANADA</strong>
        )}
      </div>

      {/* ===== 메인 콘텐츠 ===== */}
      <div style={{ ...styles.mainContent, paddingTop: "28vh" }}>
        {/* ★ [신규] 스피너 CSS + 프리미엄 애니메이션 */}
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
          
          /* ★★★ 로고 심장 박동 */
          @keyframes logoBreathe {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.03);
              opacity: 0.95;
            }
          }
          
          /* ★★★ 로고 외곽 발광 */
          @keyframes logoOuterGlow {
            0%, 100% {
              transform: scale(1);
              opacity: 0.4;
            }
            50% {
              transform: scale(1.15);
              opacity: 0.8;
            }
          }
          
          /* ★★★ 로고 shimmer 스캔 */
          @keyframes landingShimmer {
            0% { left: -100%; }
            60%, 100% { left: 200%; }
          }
          
          /* ★★★ 슬로건 글자 stagger 등장 */
          @keyframes slogancharFade {
            0% { 
              opacity: 0; 
              transform: translateY(15px);
              filter: blur(4px);
            }
            100% { 
              opacity: 1; 
              transform: translateY(0);
              filter: blur(0);
            }
          }
          
          /* ★★★ 라인 확장 */
          @keyframes lineExpand {
            0% { width: 0; }
            100% { width: 50px; }
          }
          
          /* ★★★ 원거리 별 반짝임 */
          @keyframes landingStarTwinkle {
            0%, 100% { 
              opacity: 0.2; 
              transform: scale(1);
            }
            50% { 
              opacity: 1; 
              transform: scale(1.5); 
            }
          }
          
          /* ★★★ 중거리 눈송이 낙하 */
          @keyframes landingMidSnow {
            0% {
              transform: translateY(0) translateX(0) rotate(0deg);
              opacity: 0;
            }
            10% { opacity: 0.9; }
            90% { opacity: 0.9; }
            100% {
              transform: translateY(110vh) translateX(30px) rotate(360deg);
              opacity: 0;
            }
          }
          
          /* ★★★ 근거리 큰 눈송이 낙하 */
          @keyframes landingNearSnow {
            0% {
              transform: translateY(0) translateX(0);
              opacity: 0;
            }
            15% { opacity: 1; }
            85% { opacity: 1; }
            100% {
              transform: translateY(110vh) translateX(-20px);
              opacity: 0;
            }
          }
        `}</style>

        {/* ★ [수정] 럭셔리 슬로건 - 글자 stagger 등장 */}
        <div style={landingStyles.heroSection}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            marginBottom: 14,
          }}>
            <div style={{
              width: 50,
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7))",
              animation: "lineExpand 1.5s ease-out 0.3s both",
            }} />
            <p style={{
              ...landingStyles.subText,
              display: "flex",
              gap: "0.05em",
            }}>
              {(isKo ? "시간이 멈추는 곳" : "Where time slows").split("").map((char, idx) => (
                <span 
                  key={idx}
                  style={{
                    display: "inline-block",
                    animation: `slogancharFade 0.6s ease ${idx * 0.06 + 0.5}s both`,
                  }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </span>
              ))}
            </p>
            <div style={{
              width: 50,
              height: 1,
              background: "linear-gradient(90deg, rgba(255,255,255,0.7), transparent)",
              animation: "lineExpand 1.5s ease-out 0.3s both",
            }} />
          </div>
          <h1 style={landingStyles.mainText}>
            {(isKo ? "BANADA에 오신 것을 환영합니다" : "Welcome to BANADA").split("").map((char, idx) => (
              <span 
                key={idx}
                style={{
                  display: "inline-block",
                  animation: `slogancharFade 0.5s ease ${idx * 0.04 + 1.5}s both`,
                }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
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
                  style={{ ...styles.authCard, padding: "40px 30px", position: "relative" }}
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
                      fontSize: "26px",
                      marginBottom: "30px",
                    }}
                  >
                    {mode === "login" ? t.login : t.signup}
                  </h2>

                  <input
                    style={{
                      ...styles.authInput,
                      height: "55px",
                      fontSize: "16px",
                      marginBottom: "15px",
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
                      height: "55px",
                      fontSize: "16px",
                      marginBottom: "15px",
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
                        height: "55px",
                        fontSize: "16px",
                        marginBottom: "15px",
                        border: "2px solid #ffb347",
                        background: "rgba(255,179,71,0.05)",
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
                      height: "58px",
                      fontSize: "18px",
                      fontWeight: "900",
                      marginTop: "10px",
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
                      height: "48px",
                      marginTop: "12px",
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
const landingStyles = {
  heroSection: {
    textAlign: "center",
    marginBottom: 40,
    padding: "0 20px",
  },
  subText: {
    // ★★★ [수정] 부드러운 화이트 세리프 (겨울 감성)
    fontSize: "0.85rem",
    color: "rgba(255,255,255,0.9)",
    fontWeight: 300,
    letterSpacing: "0.4em",
    margin: 0,
    textTransform: "uppercase",
    fontFamily: '"Cormorant Garamond", "Noto Serif KR", serif',
    textShadow: "0 0 12px rgba(255, 255, 255, 0.3), 0 2px 8px rgba(0,0,0,0.5)",
    whiteSpace: "nowrap",
  },
  mainText: {
    // ★★★ [수정] 우아한 세리프 - 부드러운 발광
    fontSize: "1.65rem",
    fontWeight: 400,
    color: "#fff",
    margin: 0,
    letterSpacing: "0.03em",
    lineHeight: 1.4,
    fontFamily: '"Cormorant Garamond", "Noto Serif KR", serif',
    textShadow: "0 0 25px rgba(255, 255, 255, 0.25), 0 2px 20px rgba(0,0,0,0.6)",
  },
  // 접힌 로그인 카드
  collapsedCard: {
    width: "100%",
    maxWidth: 340,
    padding: "18px 24px",
    borderRadius: 20,
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.15)",
    boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    cursor: "pointer",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: "0.5px",
  },
  collapsedIcon: {
    fontSize: 18,
  },
  collapsedText: {
    flex: 1,
    textAlign: "left",
  },
  collapsedArrow: {
    fontSize: 12,
    opacity: 0.7,
  },
  // 펼친 카드의 접기 버튼 (우상단)
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#fff",
    fontSize: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
};