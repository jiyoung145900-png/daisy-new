import { useState } from "react";
// ✅ Firebase 관련
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase"; 

/* =====================
   LANDING PAGE (공백 자동 제거 + 탐정 모드 탑재)
===================== */
export default function LandingPage({ 
  t, lang, users, setUsers, onLogin, onGuestLogin, 
  hero, videoURL, logo, logoSize, logoPos, styles, isAdmin,
  syncToFirebase
}) {
  const [mode, setMode] = useState("login");
  const [id, setId] = useState(""); 
  const [pw, setPw] = useState(""); 
  const [ref, setRef] = useState("");

  /* =====================
      회원가입 로직 (공백 강력 제거 ✂️)
  ===================== */
  const signup = async () => {
    // 1. 앞뒤 공백 무조건 제거
    const cleanId = id.trim();
    const cleanPw = pw.trim();
    const cleanRef = ref.trim();

    // 2. 입력값 확인
    if (!cleanId || !cleanPw || !cleanRef) {
      return alert(lang === "ko" ? "모든 정보를 입력해주세요." : "Please fill all info.");
    }

    // 3. 이미 존재하는 아이디인지 확인
    if (users.find(u => u.id === cleanId)) {
      return alert(lang === "ko" ? "이미 존재하는 아이디입니다." : "ID already exists.");
    }

    let agentName = "";
    let isValidRef = false;

    // 4. 초대 코드 검증
    if (cleanRef === "ADMIN") {
      isValidRef = true;
      agentName = "ADMIN";
    } else {
      const userRef = users.find(u => u.id === cleanRef);
      if (userRef) {
        isValidRef = true;
        agentName = userRef.id;
      } else {
        try {
          // Firebase 초대 코드 조회
          const docRef = doc(db, "invite_codes", cleanRef);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            isValidRef = true;
            agentName = docSnap.data().name;
          } else {
            // 실패 시 안내
            return alert(lang === "ko" ? "존재하지 않는 초대 코드입니다." : "Invalid referral code.");
          }
        } catch (error) {
          console.error("DB 에러:", error);
          return alert(`Error: ${error.message}`);
        }
      }
    }

    if (!isValidRef) return;

    // 5. 유저 생성 (공백 제거된 cleanId 사용!)
    const startNo = 2783982189;
    const generatedNo = (startNo + users.length).toString();

    const newUser = { 
      id: cleanId, // 👈 여기가 핵심! 공백 없는 아이디로 저장
      pw: cleanPw,
      no: generatedNo,
      referral: cleanRef,
      diamond: 0,
      refCode: cleanId,
      agentName: agentName,
      joinedAt: new Date().toISOString()
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);

    if (syncToFirebase) {
      await syncToFirebase({ users: updatedUsers });
    }

    alert(lang === "ko" ? "성공적으로 가입되었습니다! 로그인해주세요." : "Signup Success! Please Login.");
    setId(""); setPw(""); setRef("");
    setMode("login");
  };

  // ✅ 엔터키 쳤을 때도 공백 제거하고 로그인
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      mode === "login" ? onLogin(id.trim(), pw.trim()) : signup();
    }
  };

  return (
    <div
      style={{
        ...styles.landingWrapper,
        minHeight: "100dvh" 
      }}
    >
      <div
        style={{
          ...styles.bgWrap,
          minHeight: "100dvh",
          position: "absolute",
          inset: 0,
          overflow: "hidden"
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
              zIndex: -1
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
              objectFit: "cover"
            }}
          />
        )}
      </div>

      <div style={{ 
        ...styles.logoContainer,
        left: `${logoPos.x}px`,
        top: `${logoPos.y}px`,
        transition: "all 0.3s ease"
      }}>
        {logo ? (
          <img
            src={logo}
            alt="logo"
            style={{
              height: `${logoSize}px`,
              width: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 0 15px rgba(0,0,0,0.5))"
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
              <h2 style={{ ...styles.authTitle, fontSize: "28px", marginBottom: "35px" }}>
                {mode === "login" ? t.login : t.signup}
              </h2>

              <input
                style={{ ...styles.authInput, height: "60px", fontSize: "18px", marginBottom: "20px" }}
                placeholder={t.id}
                value={id}
                onChange={e => setId(e.target.value)}
                onKeyDown={handleKeyDown}
              />

              <input
                type="password"
                style={{ ...styles.authInput, height: "60px", fontSize: "18px", marginBottom: "20px" }}
                placeholder={t.pw}
                value={pw}
                onChange={e => setPw(e.target.value)}
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
                    background: "rgba(255,179,71,0.05)"
                  }}
                  placeholder={lang === "ko" ? "초대 코드를 입력하세요" : "Enter Invitation Code"}
                  value={ref}
                  onChange={e => setRef(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              )}

              <button
                style={{ ...styles.primaryBtn, height: "65px", fontSize: "20px", fontWeight: "900", marginTop: "10px" }}
                // 👇 버튼 클릭 시에도 공백(.trim) 제거하고 보냄
                onClick={() => mode === "login" ? onLogin(id.trim(), pw.trim()) : signup()}
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
                  setId(""); setPw(""); setRef("");
                }}
              >
                {mode === "login"
                  ? (lang === "ko" ? "처음이신가요? 회원가입" : "New here? Sign Up")
                  : (lang === "ko" ? "이미 계정이 있나요? 로그인" : "Have an account? Login")}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}