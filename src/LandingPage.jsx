import { useState } from "react";
// ✅ Firebase 관련 기능 불러오기
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase"; 

/* =================================================================
   LANDING PAGE (완성본: 공백 제거 + DB 직통 확인 기능 탑재)
================================================================= */
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
       1. 회원가입 로직 (공백 강력 제거 ✂️)
  ===================== */
  const signup = async () => {
    // 앞뒤 공백 무조건 제거
    const cleanId = id.trim();
    const cleanPw = pw.trim();
    const cleanRef = ref.trim();

    // 입력값 확인
    if (!cleanId || !cleanPw || !cleanRef) {
      return alert(lang === "ko" ? "모든 정보를 입력해주세요." : "Please fill all info.");
    }

    // 이미 존재하는 아이디인지 확인
    if (users.find(u => u.id === cleanId)) {
      return alert(lang === "ko" ? "이미 존재하는 아이디입니다." : "ID already exists.");
    }

    let agentName = "";
    let isValidRef = false;

    // 초대 코드 검증
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
            return alert(lang === "ko" ? "존재하지 않는 초대 코드입니다." : "Invalid referral code.");
          }
        } catch (error) {
          console.error("DB 에러:", error);
          return alert(`Error: ${error.message}`);
        }
      }
    }

    if (!isValidRef) return;

    // 유저 생성 (공백 제거된 cleanId 사용!)
    const startNo = 2783982189;
    const generatedNo = (startNo + users.length).toString();

    const newUser = { 
      id: cleanId, 
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

  /* =====================
       2. 로그인 로직 (DB 직통 확인 기능 추가 🕵️‍♂️)
  ===================== */
  const handleLogin = async () => {
    const cleanId = id.trim();
    const cleanPw = pw.trim();

    if (!cleanId || !cleanPw) {
      return alert(lang === "ko" ? "아이디와 비번을 입력하세요." : "Enter ID & PW.");
    }

    // 1단계: 내 컴퓨터(users 배열)에 있는지 먼저 확인 (빠른 로그인)
    const localUser = users.find(u => u.id === cleanId && u.pw === cleanPw);
    if (localUser) {
      onLogin(cleanId, cleanPw);
      return;
    }

    // 2단계: 없으면 Firebase 본사에 직접 물어봅니다! (데이터 로딩 지연 해결)
    try {
      const docRef = doc(db, "users", cleanId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (userData.pw === cleanPw) {
          // 비밀번호까지 맞으면 로그인 성공! 
          // (내 컴퓨터 명단에도 강제로 추가해줌)
          const newUsersList = [...users, userData];
          setUsers(newUsersList); 
          
          // 로그인 진행
          onLogin(cleanId, cleanPw);
        } else {
          alert(lang === "ko" ? "비밀번호가 틀렸습니다." : "Wrong Password.");
        }
      } else {
        alert(lang === "ko" ? "존재하지 않는 아이디입니다." : "ID not found.");
      }
    } catch (error) {
      console.error("로그인 확인 중 에러:", error);
      alert("Error checking login.");
    }
  };

  // ✅ 엔터키 쳤을 때도 새로 만든 handleLogin 사용
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      mode === "login" ? handleLogin() : signup();
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
                // 👇 기존 버튼 로직을 handleLogin으로 교체!
                onClick={() => mode === "login" ? handleLogin() : signup()}
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