import { useState } from "react";
// ✅ 1. Firebase 관련 기능 불러오기
// (만약 firebase.js 파일이 components 폴더 밖에 있다면 "../firebase"로 경로를 수정해주세요)
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase"; 

/* =====================
   LANDING PAGE (완성본: Firebase 연동 + 원본 기능 통합)
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
      회원가입 로직 (Firebase DB 연동됨)
  ===================== */
  const signup = async () => {
    // 1. 입력값 확인
    if (!id || !pw || !ref) {
      return alert(lang === "ko" ? "모든 정보를 입력해주세요." : "Please fill all info.");
    }

    // 2. 이미 존재하는 아이디인지 확인 (현재 브라우저에 로드된 데이터 기준)
    if (users.find(u => u.id === id)) {
      return alert(lang === "ko" ? "이미 존재하는 아이디입니다." : "ID already exists.");
    }

    let agentName = "";
    let isValidRef = false;

    // 3. 초대 코드 검증 (순서: 관리자 -> 기존유저 -> Firebase DB)
    
    // (A) 관리자 코드
    if (ref === "ADMIN") {
      isValidRef = true;
      agentName = "ADMIN";
    } 
    // (B) 기존 유저의 ID를 추천인으로 입력한 경우
    else {
      const userRef = users.find(u => u.id === ref);
      if (userRef) {
        isValidRef = true;
        agentName = userRef.id;
      } else {
        // (C) 🔥 Firebase 'invite_codes' 컬렉션 조회 (핵심 수정)
        try {
          // 입력한 초대 코드(ref)를 문서 ID로 사용하여 검색
          const codeDocRef = doc(db, "invite_codes", ref);
          const codeSnap = await getDoc(codeDocRef);

          if (codeSnap.exists()) {
            isValidRef = true;
            const data = codeSnap.data();
            agentName = data.name; // DB에 저장된 에이전트 이름 (예: '가을')
            
            // 필요하다면 여기서 data.used 여부 등을 추가로 체크할 수 있습니다.
          }
        } catch (error) {
          console.error("초대 코드 확인 중 오류:", error);
          return alert(lang === "ko" ? "서버 연결 오류입니다. 잠시 후 다시 시도해주세요." : "Server Error.");
        }
      }
    }

    // 4. 검증 실패 시 중단
    if (!isValidRef) {
      return alert(lang === "ko" ? "존재하지 않거나 틀린 초대 코드입니다." : "Invalid referral code.");
    }

    // 5. 유저 생성 (기존 로직 유지)
    const startNo = 2783982189;
    const generatedNo = (startNo + users.length).toString();

    const newUser = { 
      id,
      pw,
      no: generatedNo,
      referral: ref,
      diamond: 0,
      refCode: id,
      agentName: agentName, // 위에서 찾아낸 정확한 에이전트 이름
      joinedAt: new Date().toISOString()
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);

    // Firebase 유저 데이터 동기화
    if (syncToFirebase) {
      await syncToFirebase({ users: updatedUsers });
    }

    alert(lang === "ko" ? "성공적으로 가입되었습니다! 로그인해주세요." : "Signup Success! Please Login.");
    setId(""); setPw(""); setRef("");
    setMode("login");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      mode === "login" ? onLogin(id, pw) : signup();
    }
  };

  return (
    <div
      style={{
        ...styles.landingWrapper,
        minHeight: "100dvh" // ✅ iOS 확대 방지 및 레이아웃 깨짐 방지
      }}
    >
      {/* =====================
          1. 배경 레이어
      ===================== */}
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

      {/* =====================
          2. 로고 레이어
      ===================== */}
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

      {/* =====================
          3. 메인 콘텐츠
      ===================== */}
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
                onClick={() => mode === "login" ? onLogin(id, pw) : signup()}
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