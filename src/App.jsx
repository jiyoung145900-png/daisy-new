import { useEffect, useState, useCallback, useMemo } from "react";
import { db, authReady } from "./firebase";
import { startTimeSyncLoop } from "./EventService";
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
import { validateUserId, validatePassword, validateNickname, sanitizeText } from "./validation";

// [Core] Broadcast channel
const broadcast = new BroadcastChannel('daisy_global_channel');

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
  const [lang, setLang] = useState(() => load("lang", "ko"));
  const [loggedIn, setLoggedIn] = useState(() => load("loggedIn", false));
  const [isGuest, setIsGuest] = useState(() => load("isGuest", false));
  const [users, setUsers] = useState(() => load("users", []));
  const [currentUser, setCurrentUser] = useState(() => load("currentUser", null));

  const [appAvatarImage, setAppAvatarImage] = useState(null);
  const [appAvatarIdx, setAppAvatarIdx] = useState(0);

  const [telegramLink, setTelegramLink] = useState(() => load("telegramLink", "https://t.me/BANADA_OFFICIAL"));
  const [showPopup, setShowPopup] = useState(true);
  // ★ hero 복구 (title/desc는 빈 문자열로 - 문구 안 보임)
  const [hero, setHero] = useState(() => load("hero", { mode: "image", imageSrc: null, title: { ko: "", en: "" }, desc: { ko: "", en: "" } }));
  const [members, setMembers] = useState(() => load("members", []));
  const [slideImages, setSlideImages] = useState(() => load("slideImages", []));
  const [videoURL, setVideoURL] = useState(() => load("videoURL", null));
  const [videos, setVideos] = useState(() => load("videos", []));
  const [logo, setLogo] = useState(() => load("logo", null));
  const [logoSize, setLogoSize] = useState(() => load("logoSize", 140));
  const [logoPos, setLogoPos] = useState(() => load("logoPos", { x: 0, y: 0 }));
  const [innerLogo, setInnerLogo] = useState(() => load("innerLogo", null));
  const [topAdImage, setTopAdImage] = useState(() => load("topAdImage", null));
  const [topAdImage2, setTopAdImage2] = useState(() => load("topAdImage2", null));

  const [noticeText, setNoticeText] = useState(() => load("noticeText", "📢 BANADA에 오신 것을 환영합니다!"));

  // ★ [수정] 온라인/오프라인 상태 감지
  //   - 초기값은 항상 true (오탐지 방지)
  //   - 실제 오프라인 이벤트 발생 시 검증 후 배너 표시
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  const t = useMemo(() => translations[lang] || translations.ko, [lang]);

  // ★ 서버 시간 동기화
  useEffect(() => {
    startTimeSyncLoop();
  }, []);

  // ★ [수정] 온라인/오프라인 감지 - 오탐지 방지를 위해 실제 서버 요청으로 검증
  //   - navigator.onLine은 부정확 (네트워크 인터페이스만 확인)
  //   - offline 이벤트 발생 시 실제 인터넷 연결 확인 후에만 배너 표시
  useEffect(() => {
    let checkTimer = null;
    
    const verifyConnection = async () => {
      try {
        // Google DNS를 fetch로 확인 (매우 빠르고 안정적)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch('https://www.google.com/generate_204', { 
          method: 'HEAD', 
          mode: 'no-cors',
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        return true; // 성공 = 실제 온라인
      } catch (e) {
        return false; // 실패 = 실제 오프라인
      }
    };

    const handleOnline = async () => {
      const reallyOnline = await verifyConnection();
      if (reallyOnline) {
        setIsOnline(true);
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };
    
    const handleOffline = async () => {
      // 오프라인 이벤트가 와도 즉시 배너 표시하지 않고 검증
      // 3초 지연 후 실제로 확인 (일시적 오탐지 방지)
      if (checkTimer) clearTimeout(checkTimer);
      checkTimer = setTimeout(async () => {
        const reallyOnline = await verifyConnection();
        if (!reallyOnline) {
          setIsOnline(false);
          setShowReconnected(false);
        }
      }, 3000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (checkTimer) clearTimeout(checkTimer);
    };
  }, []);

  // ★ Firebase Realtime Listener (Global Settings)
  useEffect(() => {
    let unsub = () => {};
    
    authReady.then(() => {
      unsub = onSnapshot(doc(db, "settings", "global"), (docSnap) => {
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
          if (data.topAdImage !== undefined) setTopAdImage(data.topAdImage);
          if (data.topAdImage2 !== undefined) setTopAdImage2(data.topAdImage2);
          if (data.telegramLink) setTelegramLink(data.telegramLink);
          if (data.noticeText !== undefined) setNoticeText(data.noticeText);
        }
      });
    });
    
    return () => unsub();
  }, []);

  // ★ Sync Function (LandingPage 회원가입 등에서 사용)
  const syncToFirebase = async (updates) => {
    try {
      await authReady; 
      const finalData = {
        hero, videoURL, logo, logoSize, logoPos,
        members, slideImages, videos, innerLogo, topAdImage, topAdImage2,
        telegramLink, noticeText,
        ...updates
      };
      await setDoc(doc(db, "settings", "global"), finalData, { merge: true });
      return true;
    } catch (e) {
      console.error("▶ Sync Failed:", e);
      return false;
    }
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
  useEffect(() => {
    save("lang", lang); save("loggedIn", loggedIn);
    save("isGuest", isGuest); save("users", users); save("currentUser", currentUser);
    save("members", members); save("hero", hero); save("logo", logo);
    save("logoSize", logoSize); save("logoPos", logoPos); save("slideImages", slideImages);
    save("videoURL", videoURL); save("videos", videos); save("innerLogo", innerLogo);
    save("telegramLink", telegramLink); save("noticeText", noticeText);
  }, [lang, loggedIn, isGuest, users, currentUser, hero, logo, logoSize, logoPos, members, slideImages, videoURL, videos, innerLogo, telegramLink, noticeText]);

  // ★ 로그인 액션 (일반 유저 전용, admin/game 분기 제거)
  const handleLoginAction = async (id, pw) => {
    // 관리자 아이디 완전 차단
    if (id === "admin" || id === "game") {
      return alert(t.login_fail || "존재하지 않는 아이디입니다.");
    }

    try {
      await authReady;
      const userRef = doc(db, "users", id);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        if (userData.banned === true) {
          const reason = userData.bannedReason
            ? `\n\n사유: ${userData.bannedReason}`
            : "";
          alert(`🚫 접속이 차단된 회원입니다.${reason}\n\n관리자에게 문의해주세요.`);
          return;
        }

        if (userData.password === pw) {
          setCurrentUser(userData);
          setLoggedIn(true);
          setIsGuest(false);
          
          // ★ [신규] 로그인 시 접속 이력 저장 (관리자 모니터링용)
          //   - IP + UserAgent + 시각 저장
          //   - loginHistory 배열에 append (최근 20개만 유지)
          //   - IP 조회 실패해도 lastActive는 갱신됨
          try {
            let ip = "";
            try {
              const ipRes = await fetch('https://api.ipify.org?format=json');
              if (ipRes.ok) {
                const d = await ipRes.json();
                ip = d.ip || "";
              }
            } catch (e) {}
            
            const historyEntry = { 
              at: Date.now(), 
              ip: ip,
              ua: (navigator.userAgent || "").substring(0, 100)
            };
            
            const currentHistory = userData.loginHistory || [];
            const newHistory = [...currentHistory, historyEntry].slice(-20); // 최근 20개
            
            updateDoc(userRef, { 
              lastActive: Date.now(),
              currentIp: ip,
              currentUA: (navigator.userAgent || "").substring(0, 200),
              loginHistory: newHistory,
            });
          } catch (histErr) {
            // 이력 저장 실패해도 로그인은 성공시킴
            updateDoc(userRef, { lastActive: Date.now() });
          }
        } else {
          alert(t.login_fail || "비밀번호가 일치하지 않습니다.");
        }
      } else {
        const localUser = users.find(u => u.id === id && u.pw === pw);
        if (localUser) {
          await setDoc(doc(db, "users", id), localUser, { merge: true });
          setCurrentUser(localUser);
          setLoggedIn(true);
          setIsGuest(false);
        } else {
          alert(t.login_fail || "존재하지 않는 아이디입니다.");
        }
      }
    } catch (e) {
      console.error(e);
      alert("Login Error");
    }
  };

  // ★ 회원가입 액션
  const handleSignupAction = async (id, pw, nickname, referralCode) => {
    if (!id || !pw) return alert(t.input_id_pw || "ID/PW Required");

    const idCheck = validateUserId(id);
    if (!idCheck.ok) return alert(idCheck.reason);
    const pwCheck = validatePassword(pw);
    if (!pwCheck.ok) return alert(pwCheck.reason);
    const nickCheck = validateNickname(nickname || id);
    if (!nickCheck.ok) return alert(nickCheck.reason);

    try {
      await authReady;
      const cleanId = idCheck.value;
      const cleanPw = pwCheck.value;
      const cleanNick = nickCheck.value;
      const cleanRef = sanitizeText(referralCode || "", 30);

      const userRef = doc(db, "users", cleanId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        alert(t.id_exists || "ID exists");
        return;
      }

      let referralOwnerId = "";
      if (cleanRef) {
        const q = query(collection(db, "users"), where("refCode", "==", cleanRef));
        const snap = await getDocs(q);
        if (!snap.empty) referralOwnerId = snap.docs[0].id;
      }

      const newUser = {
        id: cleanId,
        password: cleanPw,
        nickname: cleanNick,
        refCode: cleanId.toUpperCase(),
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
    setLoggedIn(false); setIsGuest(false);
    setCurrentUser(null);
  };

  const refreshAvatar = (newImg, newIdx) => {
    setAppAvatarImage(newImg); setAppAvatarIdx(newIdx);
  };

  const actualLoggedIn = loggedIn && currentUser;
  const showLanding = !actualLoggedIn;

  return (
    <div style={{ ...styles.app, height: '100vh', overflow: 'hidden' }}>

      {/* ★ [신규] 배너 슬라이드 애니메이션 CSS */}
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* ★ [신규] 오프라인 알림 배너 - 화면 최상단 고정 */}
      {!isOnline && (
        <div style={styles.offlineBanner}>
          <span style={styles.offlineIcon}>📶</span>
          <span>{lang === "ko" 
            ? "인터넷 연결이 끊어졌습니다. 연결을 확인해주세요." 
            : "You're offline. Please check your connection."}</span>
        </div>
      )}
      
      {/* ★ [신규] 재연결 알림 배너 - 3초 후 자동 사라짐 */}
      {showReconnected && isOnline && (
        <div style={styles.onlineBanner}>
          <span style={styles.onlineIcon}>✅</span>
          <span>{lang === "ko" 
            ? "다시 연결되었습니다!" 
            : "Back online!"}</span>
        </div>
      )}

      {showPopup && actualLoggedIn && !showLanding && (
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
            logo={logo} logoSize={logoSize} logoPos={logoPos} styles={styles} isAdmin={false}
            setLang={setLang}
            onLogin={handleLoginAction}
            onSignup={handleSignupAction}
            onGuestLogin={() => {
              const guestUser = { id: "GUEST", no: "G-1", diamond: 0, rewards: 0, refCode: "" };
              setCurrentUser(guestUser);
              setLoggedIn(true); setIsGuest(true);
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
          videos={videos} videoCategories={VIDEO_CATS} innerLogo={innerLogo} topAdImage={topAdImage} topAdImage2={topAdImage2} telegramLink={telegramLink}
          noticeText={noticeText}
          onLogout={handleLogout} dashStyles={dashStyles}
        />
      )}

      {showLanding && (
        <header style={{ position: 'fixed', top: 20, right: 20, zIndex: 10002 }}>
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
  popupBtn: { width: '100%', padding: '12px', background: '#ffb347', border: 'none', borderRadius: '12px', fontWeight: 'bold', color: '#000', cursor: 'pointer' },
  // ★ [신규] 오프라인 배너 (빨간색, 최상단 고정)
  offlineBanner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
    color: '#fff',
    padding: '12px 20px',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: '0 4px 20px rgba(220,38,38,0.4)',
    animation: 'slideDown 0.3s ease-out',
  },
  offlineIcon: {
    fontSize: 18,
  },
  // ★ [신규] 재연결 배너 (초록색, 3초 후 자동 사라짐)
  onlineBanner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    background: 'linear-gradient(90deg, #16a34a, #15803d)',
    color: '#fff',
    padding: '12px 20px',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: '0 4px 20px rgba(22,163,74,0.4)',
    animation: 'slideDown 0.3s ease-out',
  },
  onlineIcon: {
    fontSize: 18,
  }
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