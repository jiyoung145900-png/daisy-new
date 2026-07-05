import { useEffect, useState, useCallback, useMemo } from "react";
import { db } from "./firebase"; 
import { startTimeSyncLoop } from "./EventService"; // ★ 서버 시간 동기화
// ★ [핵심] Firestore 함수들 import
import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import LandingPage from "./LandingPage";
import Dashboard from "./Dashboard";
import AdminCMS from "./AdminCMS";
import IndependentAdmin from "./IndependentAdmin"; 

// [Core] Broadcast channel
const broadcast = new BroadcastChannel('daisy_global_channel');

const ADMIN_ID = "admin";
const REGIONS = ["서울", "경기 북부", "경기 남부", "인천", "충청", "강원", "전라", "경북·대구", "부산·울산·경남", "제주"];
const VIDEO_CATS = ["한국", "일본", "중국", "동남아", "서양"];

// --- [Utility] ---
const load = (k, d) => { 
  try { 
    const v = localStorage.getItem(k); 
    if (!v) return d;
    const parsed = JSON.parse(v);
    return parsed === null ? d : parsed;
  } catch { return d; } 
};

const save = (k, v) => { 
  try { 
    if (v === undefined) return;
    localStorage.setItem(k, JSON.stringify(v)); 
  } catch (e) {
    if (e.name === 'QuotaExceededError') alert("Storage quota exceeded!");
  } 
};

// ★ Translations
const translations = {
  ko: { login: "로그인", signup: "회원가입", id: "아이디", pw: "비밀번호", ref: "추천인 코드", guest: "게스트로 시작", logout: "로그아웃", home: "홈페이지", manager: "매니저", event: "이벤트", video: "동영상", mypage: "마이페이지", welcome: "📢 BANADA에 오신 것을 환영합니다!", desc_suffix: " 화면입니다.", prepare: "컨텐츠 준비 중입니다.", close: "닫기", input_id_pw: "아이디와 비밀번호를 입력하세요.", id_exists: "이미 존재하는 아이디입니다.", signup_ok: "가입이 완료되었습니다!", login_fail: "로그인 정보가 틀립니다." },
  en: { login: "LOGIN", signup: "SIGN UP", id: "ID", pw: "PASSWORD", ref: "REFERRAL CODE", guest: "START AS GUEST", logout: "LOGOUT", home: "HOME", manager: "MODELS", event: "GAMES", video: "GALLERY", mypage: "MY PAGE", welcome: "📢 Welcome to BANADA!", desc_suffix: " Page Content.", prepare: "Coming Soon.", close: "CLOSE", input_id_pw: "Please enter ID and Password.", id_exists: "ID already exists.", signup_ok: "Sign up successful!", login_fail: "Login Failed" }
};

export default function App() {
  // --- [State Management] ---
  const [lang, setLang] = useState(() => load("lang", "ko"));
  const [loggedIn, setLoggedIn] = useState(() => load("loggedIn", false));
  const [isAdmin, setIsAdmin] = useState(() => load("isAdmin", false));
  const [isGuest, setIsGuest] = useState(() => load("isGuest", false));
  const [users, setUsers] = useState(() => load("users", []));
  const [currentUser, setCurrentUser] = useState(() => load("currentUser", null));
  
  const [appAvatarImage, setAppAvatarImage] = useState(null);
  const [appAvatarIdx, setAppAvatarIdx] = useState(0);
  const [isIndependentAdmin, setIsIndependentAdmin] = useState(false); 
  
  // Password Management
  const [adminPw, setAdminPw] = useState(() => load("adminPw", "123456"));
  const [gamePw, setGamePw] = useState(() => load("gamePw", "1234")); 

  const [telegramLink, setTelegramLink] = useState(() => load("telegramLink", "https://t.me/BANADA_OFFICIAL"));
  const [showPopup, setShowPopup] = useState(true);
  const [members, setMembers] = useState(() => load("members", []));
  const [slideImages, setSlideImages] = useState(() => load("slideImages", []));
  const [hero, setHero] = useState(() => load("hero", { mode: "image", imageSrc: null, title: { ko: "BANADA", en: "BANADA" }, desc: { ko: "선택된 사람들을 위한 프라이빗 커넥션", en: "Private connections for the chosen few" } }));
  const [videoURL, setVideoURL] = useState(() => load("videoURL", null));
  const [videos, setVideos] = useState(() => load("videos", []));
  const [logo, setLogo] = useState(() => load("logo", null));
  const [logoSize, setLogoSize] = useState(() => load("logoSize", 140));
  const [logoPos, setLogoPos] = useState(() => load("logoPos", { x: 0, y: 0 }));
  const [innerLogo, setInnerLogo] = useState(() => load("innerLogo", null));

  // ★ [추가] 홈 상단 공지 티커 문구
  const [noticeText, setNoticeText] = useState(() => load("noticeText", "📢 BANADA에 오신 것을 환영합니다!"));

  const [adminPreviewMode, setAdminPreviewMode] = useState("dashboard");
  const t = useMemo(() => translations[lang] || translations.ko, [lang]);

  // ★ 서버 시간 동기화 - 앱 최초 로드 시 1회 실행, 이후 30분마다 자동 재동기화
  // 모든 기기(PC/갤럭시/아이폰)가 동일한 라운드 타이머를 보도록 보정
  useEffect(() => {
    startTimeSyncLoop();
  }, []);

  // ★ Firebase Realtime Listener (Global Settings)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "global"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.hero) setHero(data.hero);
        if (data.videoURL !== undefined) setVideoURL(data.videoURL);
        if (data.logo !== undefined) setLogo(data.logo);
        if (data.logoSize) setLogoSize(data.logoSize);
        if (data.logoPos) setLogoPos(data.logoPos);
        if (data.members) setMembers(data.members);
        if (data.slideImages) setSlideImages(data.slideImages);
        if (data.videos) setVideos(data.videos);
        if (data.innerLogo !== undefined) setInnerLogo(data.innerLogo);
        
        if (data.adminPassword) setAdminPw(data.adminPassword);
        else if (data.adminPw) setAdminPw(data.adminPw);

        if (data.gamePw) setGamePw(data.gamePw);
        if (data.telegramLink) setTelegramLink(data.telegramLink);
        // ★ [추가] 공지 티커 실시간 반영
        if (data.noticeText !== undefined) setNoticeText(data.noticeText);
        
        // users는 별도 onSnapshot으로 관리하거나 필요시 로드
        // (여기서는 users state가 로컬 캐시 역할도 함)
      }
    });
    return () => unsub();
  }, []);

  // ★ Sync Function
  const syncToFirebase = async (updates) => {
    try {
      const finalData = {
        hero, videoURL, logo, logoSize, logoPos,
        members, slideImages, videos, innerLogo,
        adminPw, gamePw, telegramLink, noticeText,
        // users는 너무 커질 수 있으므로 settings/global에 통째로 넣지 않는 게 좋지만, 
        // 기존 구조 호환을 위해 일단 유지하거나 생략 가능.
        ...updates 
      };
      await setDoc(doc(db, "settings", "global"), finalData, { merge: true });
      console.log("▶ Server Sync Complete");
      return true;
    } catch (e) {
      console.error("▶ Sync Failed:", e);
      return false;
    }
  };

  const saveToFirebase = async () => {
    return await syncToFirebase({});
  };

  const syncUpdate = useCallback((targetId, newPoint, newRefCode, newReferral) => {
    setUsers(prev => prev.map(u => u.id === targetId ? { ...u, diamond: newPoint, refCode: newRefCode, referral: newReferral } : u));
    setCurrentUser(prev => (prev?.id === targetId ? { ...prev, diamond: newPoint, refCode: newRefCode, referral: newReferral } : prev));
  }, []);

  // External Broadcast/Listener
  useEffect(() => {
    broadcast.onmessage = (event) => {
      const { type, userId, point, refCode, referral } = event.data || {};
      if ((type === 'USER_UPDATE' || type === 'POINT_UPDATE') && userId) {
        syncUpdate(userId, point, refCode, referral);
      }
    };
    const handleLocalUpdate = (e) => {
      const { userId, point, refCode, referral } = e.detail || {};
      if (userId) syncUpdate(userId, point, refCode, referral);
    };
    window.addEventListener("user_point_update", handleLocalUpdate);
    return () => window.removeEventListener("user_point_update", handleLocalUpdate);
  }, [syncUpdate]);

  // Local Storage Auto-Save
  // ★ [개선 3] 비밀번호 관련 로컬 스토리지 자동 저장 제거
  useEffect(() => {
    save("lang", lang); save("loggedIn", loggedIn); save("isAdmin", isAdmin);
    save("isGuest", isGuest); save("users", users); save("currentUser", currentUser);
    save("members", members); save("hero", hero); save("logo", logo); 
    save("logoSize", logoSize); save("logoPos", logoPos); save("slideImages", slideImages); 
    save("videoURL", videoURL); save("videos", videos); save("innerLogo", innerLogo); 
    save("telegramLink", telegramLink); save("noticeText", noticeText);
    // adminPw, gamePw 저장 코드 제거함
  }, [lang, loggedIn, isAdmin, isGuest, users, currentUser, hero, logo, logoSize, logoPos, members, slideImages, videoURL, videos, innerLogo, telegramLink, noticeText]);

  // ★ [수정됨] 로그인 액션 (DB 연동)
  const handleLoginAction = async (id, pw) => {
    let serverAdminPw = adminPw; 
    let serverGamePw = gamePw;

    // 1. 서버 설정값 최신화 (비번 확인용)
    try {
      const snap = await getDoc(doc(db, "settings", "global"));
      if (snap.exists()) {
        const data = snap.data();
        if (data.adminPw) serverAdminPw = data.adminPw;
        if (data.gamePw) serverGamePw = data.gamePw;
        setAdminPw(serverAdminPw);
        setGamePw(serverGamePw);
      }
    } catch (e) { console.error("Setting Load Fail"); }

    // [A] 게임 관리자 (ID: game)
    if (id === "game") {
      if (pw === serverGamePw) {
        setIsIndependentAdmin(true); 
        setLoggedIn(true); 
        return;
      } else {
        return alert("게임 관리자 비밀번호가 틀립니다.");
      }
    }
    
    // [B] 디자인 관리자 (ID: admin)
    if (id === "admin") {
      if (pw === serverAdminPw) { 
        setIsAdmin(true); 
        setLoggedIn(true); 
        setCurrentUser({ id: "admin", no: "000001", diamond: 999999, rewards: 0, refCode: "MASTER" }); 
        setAdminPreviewMode("dashboard"); 
        return;
      } else {
        return alert("디자인 관리자 비밀번호가 틀립니다.");
      }
    }
    
    // [C] 일반 유저 로그인 (DB 체크)
    try {
        const userRef = doc(db, "users", id);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.password === pw) {
                setCurrentUser(userData);
                setLoggedIn(true);
                setIsGuest(false);
                // 접속 시간 업데이트
                updateDoc(userRef, { lastActive: Date.now() });
            } else {
                alert(t.login_fail || "비밀번호가 일치하지 않습니다.");
            }
        } else {
            // 로컬 스토리지 백업 데이터에서도 한번 더 찾아봄 (DB 마이그레이션 전 유저 대응)
            const localUser = users.find(u => u.id === id && u.pw === pw);
            if (localUser) {
                // 로컬에만 있는 유저라면 DB로 자동 업로드 후 로그인
                await setDoc(doc(db, "users", id), localUser, { merge: true });
                setCurrentUser(localUser);
                setLoggedIn(true);
                setIsGuest(false);
            } else {
                alert(t.login_fail || "존재하지 않는 아이디입니다.");
            }
        }
    } catch(e) {
        console.error(e);
        alert("Login Error");
    }
  };

  // ★ [추가됨] 회원가입 액션 (LandingPage로 전달됨)
 // ★ [수정됨] 회원가입 액션
  const handleSignupAction = async (id, pw, nickname, referralCode) => {
    if (!id || !pw) return alert(t.input_id_pw || "ID/PW Required");

    try {
      const cleanId = String(id).trim();
      const cleanPw = String(pw).trim();
      const cleanNick = (nickname && String(nickname).trim()) || cleanId;
      const cleanRef = (referralCode && String(referralCode).trim()) || "";

      // 1) 아이디 중복 확인
      const userRef = doc(db, "users", cleanId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        alert(t.id_exists || "ID exists");
        return;
      }

      // 2) 추천인 검증 로직 생략 (기존과 동일)
      let referralOwnerId = "";
      if (cleanRef) {
        const q = query(collection(db, "users"), where("refCode", "==", cleanRef));
        const snap = await getDocs(q);
        if (!snap.empty) referralOwnerId = snap.docs[0].id;
      }

      // 3) 유저 생성 (refCode 자동 생성 추가)
      const newUser = {
        id: cleanId,
        password: cleanPw,
        nickname: cleanNick,
        refCode: cleanId.toUpperCase(), // ★ [개선 2] 추천인 코드 자동 생성
        referral: referralOwnerId,
        referralCode: cleanRef,
        diamond: 0,
        rewards: 0,
        lastActive: Date.now(),
        createdAt: new Date().toISOString(),
      };

      await setDoc(userRef, newUser);
      setUsers((prev) => [...prev, newUser]);
      alert(t.signup_ok || "Sign up successful!");
    } catch (e) {
      console.error(e);
      alert("Signup Error");
    }
  };


  const handleLogout = () => {
    setLoggedIn(false); setIsAdmin(false); setIsGuest(false); setIsIndependentAdmin(false);
    setCurrentUser(null);
  };

  const refreshAvatar = (newImg, newIdx) => {
    setAppAvatarImage(newImg); setAppAvatarIdx(newIdx);
  };

  if (isIndependentAdmin) {
    return <IndependentAdmin users={users} setUsers={setUsers} onExit={handleLogout} />;
  }

  const actualLoggedIn = loggedIn && currentUser;
  const showLanding = !actualLoggedIn || (isAdmin && adminPreviewMode === "landing");

  return (
    <div style={{ ...styles.app, height: '100vh', overflow: 'hidden' }}>
      
      {showPopup && !isAdmin && actualLoggedIn && !showLanding && (
        <div style={styles.popupOverlay}>
          <div style={styles.popupContent}>
            <h2 style={{ color: '#ffb347', marginBottom: '15px' }}>NOTICE</h2>
            <p style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '25px' }}>최상의 서비스를 제공하겠습니다.</p>
            <button onClick={() => setShowPopup(false)} style={styles.popupBtn}>{t.close}</button>
          </div>
        </div>
      )}

      {showLanding ? (
        <div style={{ height: '100%', overflowY: 'auto' }}>
          <LandingPage 
            t={t} lang={lang} users={users} setUsers={setUsers} hero={hero} videoURL={videoURL}
            logo={logo} logoSize={logoSize} logoPos={logoPos} styles={styles} isAdmin={isAdmin}
            setLang={setLang} 
            onLogin={handleLoginAction}
            // ★ LandingPage에서 회원가입 시 이 함수가 호출됨
            onSignup={handleSignupAction} 
            onGuestLogin={() => { 
              const guestUser = {id:"GUEST", no:"G-1", diamond:0, rewards:0, refCode: ""};
              setCurrentUser(guestUser);
              setLoggedIn(true); setIsAdmin(false); setIsGuest(true); 
            }}
            syncToFirebase={syncToFirebase} 
          />
        </div>
      ) : (
        <Dashboard 
          user={currentUser} 
          onUpdatePoint={(newVal) => syncUpdate(currentUser.id, newVal, currentUser.refCode, currentUser.referral)}
          appAvatarImage={appAvatarImage} appAvatarIdx={appAvatarIdx} onAvatarChange={refreshAvatar}
          t={t} lang={lang} isGuest={isGuest} members={members} regions={REGIONS} slideImages={slideImages}
          videos={videos} videoCategories={VIDEO_CATS} innerLogo={innerLogo} telegramLink={telegramLink}
          noticeText={noticeText}
          onLogout={handleLogout} dashStyles={dashStyles} 
        />
      )}

      {isAdmin && (
        <AdminCMS 
          adminPreviewMode={adminPreviewMode} setAdminPreviewMode={setAdminPreviewMode}
          hero={hero} setHero={setHero} setVideoURL={setVideoURL} videoURL={videoURL}
          logo={logo} setLogo={setLogo} logoSize={logoSize} setLogoSize={setLogoSize} 
          logoPos={logoPos} setLogoPos={setLogoPos} members={members} setMembers={setMembers} 
          regions={REGIONS} slideImages={slideImages} setSlideImages={setSlideImages}
          videos={videos} setVideos={setVideos} videoCategories={VIDEO_CATS} 
          innerLogo={innerLogo} setInnerLogo={setInnerLogo} onExit={handleLogout} styles={styles}
          adminPw={adminPw} setAdminPw={setAdminPw} telegramLink={telegramLink} setTelegramLink={setTelegramLink}
          noticeText={noticeText} setNoticeText={setNoticeText}
          openIndependent={() => setIsIndependentAdmin(true)} 
          saveToFirebase={saveToFirebase}
          syncToFirebase={syncToFirebase} 
        />
      )}

      {!isAdmin && showLanding && (
        <header style={{position:'fixed', top:20, right:20, zIndex:10002}}>
          <button style={styles.langBtn} onClick={() => setLang(lang === "ko" ? "en" : "ko")}>
            {lang === "ko" ? "ENGLISH" : "한국어"}
          </button>
        </header>
      )}
    </div>
  );
}

const styles = {
  app: { width: "100%", background: "#000", fontFamily: "'Inter', sans-serif", color: '#fff', position: 'relative' },
  bgWrap: { position: "fixed", inset: 0, zIndex: 0 },
  bgOverlay: { position: 'absolute', inset: 0, background: 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.6) 100%)', zIndex: 1 },
  bgImage: { width: "100%", height: "100%", backgroundSize: "cover", backgroundPosition: "center" },
  bgVideo: { width: "100%", height: "100%", objectFit: "cover" },
  logoContainer: { position: "absolute", zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' },
  defaultLogo: { fontSize: 32, letterSpacing: 4, fontWeight: 900, color: '#fff', textShadow: '0 0 20px rgba(255,179,71,0.5)' },
  landingWrapper: { minHeight: '100vh', position: 'relative', zIndex: 1 },
  mainContent: { position: 'relative', zIndex: 5, paddingTop: '15vh' },
  heroSection: { textAlign: "center", marginBottom: 40 },
  mainTitle: { fontSize: '4rem', fontWeight: 900, letterSpacing: -2, margin: 0, color: '#fff' },
  subTitle: { fontSize: '1.2rem', opacity: 0.7, color: '#fff', fontWeight: 300, marginTop: 10 },
  authWrap: { display: "flex", justifyContent: "center", padding: '0 20px' },
  authCard: { width: '100%', maxWidth: 380, padding: 40, borderRadius: 30, background: "rgba(255,255,255,0.05)", backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' },
  authTitle: { textAlign: 'center', marginBottom: 25, fontSize: 24, fontWeight: 700 },
  authInput: { width: "100%", padding: '15px 20px', marginBottom: 15, borderRadius: 15, background: "rgba(255,255,255,0.1)", border: '1px solid rgba(255,255,255,0.1)', color: "#fff", fontSize: 16, boxSizing: 'border-box' },
  primaryBtn: { width: "100%", padding: 15, borderRadius: 15, fontWeight: 700, background: '#fff', color: '#000', border: 'none', cursor: 'pointer', fontSize: 16 },
  guestBtn: { width: "100%", padding: 15, marginTop: 10, borderRadius: 15, background: "transparent", color: "#fff", border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14 },
  authToggle: { marginTop: 20, textAlign: "center", fontSize: 13, opacity: 0.6, cursor: 'pointer', textDecoration: 'underline' },
  langBtn: { padding: "8px 16px", borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', fontWeight: 600, backdropFilter: 'blur(5px)' },
  popupOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' },
  popupContent: { width: '90%', maxWidth: '350px', backgroundColor: '#111', border: '2px solid #ffb347', borderRadius: '25px', padding: '30px', textAlign: 'center', boxShadow: '0 0 30px rgba(255,179,71,0.4)' },
  popupBtn: { width: '100%', padding: '12px', background: '#ffb347', border: 'none', borderRadius: '12px', fontWeight: 'bold', color: '#000', cursor: 'pointer' }
};

const dashStyles = {
  container: { 
    position: 'relative', zIndex: 10, width: '100%', maxWidth: 500, margin: '0 auto', background: '#000', 
    height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' 
  },
  contentArea: { 
    flex: 1, overflowY: 'auto', paddingBottom: 20, WebkitOverflowScrolling: 'touch' 
  },
  bottomNav: { 
    position: 'relative', width: '100%', maxWidth: 500, height: 80, background: 'rgba(20,20,20,0.95)', 
    display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #222', 
    backdropFilter: 'blur(10px)', flexShrink: 0
  },
  navItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' },
  logoutBtn: { padding: '12px 30px', borderRadius: 15, background: 'rgba(255,45,85,0.1)', color: '#ff2d55', border: '1px solid #ff2d55', fontWeight: 700, cursor: 'pointer' }
};