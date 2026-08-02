import { useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
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

  const texts = useMemo(
    () => ({
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
    []
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
    fontSize: "0.95rem",
    color: "rgba(255,255,255,0.65)",
    fontWeight: 300,
    letterSpacing: "2px",
    margin: 0,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  mainText: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#fff",
    margin: 0,
    letterSpacing: "-0.5px",
    lineHeight: 1.4,
    textShadow: "0 2px 20px rgba(0,0,0,0.5)",
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