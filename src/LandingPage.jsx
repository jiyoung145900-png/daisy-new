import { useState, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

/* =================================================================
   LANDING PAGE (공백 제거 + DB 직통 확인 + admin/game 특수 로그인 지원)
   - 기존 기능 유지
   - admin / game 로그인 "존재하지 않는 아이디" 방지
   - pw/password 혼용 방어
   - 복붙 제로폭 공백 방어
================================================================= */

// ✅ 유틸: 제로폭 공백/이상문자 제거 + trim
const sanitizeText = (s) =>
  String(s ?? "")
    .replace(/\u200B/g, "") // zero-width space
    .replace(/\uFEFF/g, "") // BOM
    .trim();

// ✅ ID는 비교용으로만 소문자 통일 (필요 없으면 .toLowerCase() 제거 가능)
const normalizeId = (s) => sanitizeText(s).toLowerCase();

// ✅ 비번은 그대로 trim만
const normalizePw = (s) => sanitizeText(s);

// ✅ 유저 객체에서 비번 추출 (pw/password 둘 다 허용)
const passOf = (u) => String(u?.password ?? u?.pw ?? "");

// ✅ 가입 시 저장도 pw/password 둘 다 넣어서 호환
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
  hero,
  videoURL,
  logo,
  logoSize,
  logoPos,
  styles,
  isAdmin,
  syncToFirebase,
}) {
  const [mode, setMode] = useState("login");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [ref, setRef] = useState("");

  const isKo = lang === "ko";

  const texts = useMemo(
    () => ({
      fillAll: isKo ? "모든 정보를 입력해주세요." : "Please fill all info.",
      idExists: isKo ? "이미 존재하는 아이디입니다." : "ID already exists.",
      invalidInvite: isKo ? "존재하지 않는 초대 코드입니다." : "Invalid referral code.",
      needIdPw: isKo ? "아이디와 비번을 입력하세요." : "Enter ID & PW.",
      wrongPw: isKo ? "비밀번호가 틀렸습니다." : "Wrong Password.",
      idNotFound: isKo ? "존재하지 않는 아이디입니다." : "ID not found.",
      signupOk: isKo ? "성공적으로 가입되었습니다! 로그인해주세요." : "Signup Success! Please Login.",
    }),
    [isKo]
  );

  /* =====================
       1) 회원가입 (기존 기능 유지 + 호환 강화)
  ===================== */
  const signup = async () => {
    const cleanIdRaw = sanitizeText(id);
    const cleanPw = normalizePw(pw);
    const cleanRef = sanitizeText(ref);

    // ✅ 입력 확인
    if (!cleanIdRaw || !cleanPw || !cleanRef) {
      return alert(texts.fillAll);
    }

    // ✅ ID 비교는 normalize(소문자, 제로폭 제거) 기준
    const cleanId = normalizeId(cleanIdRaw);

    // ✅ 로컬 중복 확인 (pw/password 혼용 고려 X, id만 체크)
    if (users.find((u) => normalizeId(u.id) === cleanId)) {
      return alert(texts.idExists);
    }

    let agentName = "";
    let isValidRef = false;

    // ✅ 초대 코드 검증 (기존 유지)
    if (cleanRef === "ADMIN") {
      isValidRef = true;
      agentName = "ADMIN";
    } else {
      // 1) 로컬 users에서 초대코드로 찾기(기존 유지)
      const userRef = users.find((u) => u.id === cleanRef);
      if (userRef) {
        isValidRef = true;
        agentName = userRef.id;
      } else {
        // 2) Firestore invite_codes에서 찾기(기존 유지)
        try {
          const docRef = doc(db, "invite_codes", cleanRef);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            isValidRef = true;
            agentName = docSnap.data()?.name ?? "";
          } else {
            return alert(texts.invalidInvite);
          }
        } catch (error) {
          console.error("DB 에러:", error);
          return alert(`Error: ${error.message}`);
        }
      }
    }

    if (!isValidRef) return;

    // ✅ 유저 생성 (기존 필드 유지 + password도 같이 저장해서 호환)
    const startNo = 2783982189;
    const generatedNo = (startNo + users.length).toString();

    const newUser = {
      id: cleanId, // ✅ id는 normalize된 값으로 저장(원래대로 저장하고 싶으면 cleanIdRaw로 바꿔도 됨)
      ...buildUserPasswordFields(cleanPw), // pw + password 모두 저장
      no: generatedNo,
      referral: cleanRef,
      diamond: 0,
      refCode: cleanId, // 기존 유지
      agentName,
      joinedAt: new Date().toISOString(),
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);

    if (syncToFirebase) {
      // ⚠️ 여기서 settings/global에 users를 통째로 넣는 구조면 undefined 제거 필요할 수 있음.
      // 기존 기능 유지 차원에서 그대로 호출
      await syncToFirebase({ users: updatedUsers });
    }

    alert(texts.signupOk);
    setId("");
    setPw("");
    setRef("");
    setMode("login");
  };

  /* =====================
       2) 로그인 (admin/game 즉시 통과 + pw/password 호환)
  ===================== */
  const handleLogin = async () => {
    const cleanIdRaw = sanitizeText(id);
    const cleanPw = normalizePw(pw);

    if (!cleanIdRaw || !cleanPw) {
      return alert(texts.needIdPw);
    }

    const cleanId = normalizeId(cleanIdRaw);

    // ✅ [핵심] admin/game은 Landing에서 DB 조회하지 말고 App으로 바로 넘김
    if (cleanId === "admin" || cleanId === "game") {
      onLogin(cleanId, cleanPw);
      return;
    }

    // 1단계: 로컬 users 배열 먼저 확인 (빠른 로그인)
    const localUser = users.find(
      (u) => normalizeId(u.id) === cleanId && passOf(u) === cleanPw
    );
    if (localUser) {
      onLogin(cleanId, cleanPw);
      return;
    }

    // 2단계: Firestore users 컬렉션 직접 확인
    try {
      const docRef = doc(db, "users", cleanId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();

        if (passOf(userData) === cleanPw) {
          // 내 로컬 users에도 추가(기존 기능 유지)
          const newUsersList = [...users, userData];
          setUsers(newUsersList);

          onLogin(cleanId, cleanPw);
        } else {
          alert(texts.wrongPw);
        }
      } else {
        alert(texts.idNotFound);
      }
    } catch (error) {
      console.error("로그인 확인 중 에러:", error);
      alert("Error checking login.");
    }
  };

  // ✅ 엔터키 동작 유지
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      mode === "login" ? handleLogin() : signup();
    }
  };

  return (
    <div
      style={{
        ...styles.landingWrapper,
        minHeight: "100dvh",
      }}
    >
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
        {hero.mode === "image" && hero.imageSrc && (
          <img
            src={hero.imageSrc}
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
        {hero.mode === "video" && videoURL && (
          <video
            key={videoURL}
            src={videoURL}
            autoPlay
            muted
            loop
            playsInline
            style={{
              ...styles.bgVideo,
              height: "100dvh",
              objectFit: "cover",
            }}
          />
        )}
      </div>

      <div
        style={{
          ...styles.logoContainer,
          left: `${logoPos.x}px`,
          top: `${logoPos.y}px`,
          transition: "all 0.3s ease",
        }}
      >
        {logo ? (
          <img
            src={logo}
            alt="logo"
            style={{
              height: `${logoSize}px`,
              width: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 0 15px rgba(0,0,0,0.5))",
            }}
          />
        ) : (
          <strong style={styles.defaultLogo}>DAISY</strong>
        )}
      </div>

      <div style={styles.mainContent}>
        <div style={styles.heroSection}>
          <h1 style={styles.mainTitle}>{hero.title[lang]}</h1>
          <p style={styles.subTitle}>{hero.desc[lang]}</p>
        </div>

        {!isAdmin && (
          <div style={styles.authWrap}>
            <div style={{ ...styles.authCard, padding: "50px 40px" }}>
              <h2
                style={{
                  ...styles.authTitle,
                  fontSize: "28px",
                  marginBottom: "35px",
                }}
              >
                {mode === "login" ? t.login : t.signup}
              </h2>

              <input
                style={{
                  ...styles.authInput,
                  height: "60px",
                  fontSize: "18px",
                  marginBottom: "20px",
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
                  height: "60px",
                  fontSize: "18px",
                  marginBottom: "20px",
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
                    height: "60px",
                    fontSize: "18px",
                    marginBottom: "20px",
                    border: "2px solid #ffb347",
                    background: "rgba(255,179,71,0.05)",
                  }}
                  placeholder={isKo ? "초대 코드를 입력하세요" : "Enter Invitation Code"}
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              )}

              <button
                style={{
                  ...styles.primaryBtn,
                  height: "65px",
                  fontSize: "20px",
                  fontWeight: "900",
                  marginTop: "10px",
                }}
                onClick={() => (mode === "login" ? handleLogin() : signup())}
              >
                {mode === "login" ? t.login : t.signup}
              </button>

              {mode === "login" && (
                <button
                  style={{ ...styles.guestBtn, height: "55px", marginTop: "15px" }}
                  onClick={onGuestLogin}
                >
                  {t.guest}
                </button>
              )}

              <div
                style={{ ...styles.authToggle, fontSize: "15px", marginTop: "30px" }}
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setId("");
                  setPw("");
                  setRef("");
                }}
              >
                {mode === "login"
                  ? isKo
                    ? "처음이신가요? 회원가입"
                    : "New here? Sign Up"
                  : isKo
                  ? "이미 계정이 있나요? 로그인"
                  : "Have an account? Login"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
