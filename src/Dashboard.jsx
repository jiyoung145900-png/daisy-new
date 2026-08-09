import React, { useState, useEffect, useCallback } from "react";
import HomeSection from "./HomeSection";
import ManagerSection from "./ManagerSection";
import VideoSection from "./VideoSection";
import EventSection from "./EventSection";
import MyPageSection from "./MyPage"; 
// ★ Firebase 연동을 위한 import 추가
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// ★ [신규] 시간대별 baseline 범위 계산
//   - 새벽/오전/오후/저녁마다 자연스러운 접속자 범위
const getTimeBasedBaseline = () => {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6)   return { min: 130, max: 170, target: 150 };  // 새벽
  if (hour >= 6 && hour < 11)  return { min: 140, max: 180, target: 160 };  // 오전
  if (hour >= 11 && hour < 18) return { min: 160, max: 200, target: 180 };  // 오후
  return { min: 180, max: 230, target: 205 };                                 // 저녁 (18~24시)
};

// ★ [신규] localStorage 키 (새로고침해도 값 유지)
const LIVE_COUNT_KEY = 'banada_live_count';
const LIVE_COUNT_TIME_KEY = 'banada_live_count_time';

export default function Dashboard({ 
  user, 
  onUpdatePoint, 
  appAvatarImage, 
  appAvatarIdx, 
  onAvatarChange,
  t, 
  onLogout, 
  lang, 
  dashStyles, 
  isGuest, 
  members = [], 
  regions = [], 
  slideImages = [],
  videos = [], 
  videoCategories = [], 
  innerLogo, 
  topAdImage, // ★ [신규] 로고 밑 첫 번째 광고 이미지 URL
  topAdImage2, // ★ [신규] LIVE CONNECTED 위, 두 번째 광고 이미지 URL
  telegramLink = "https://t.me/your_address",
  noticeText = "" // ★ [추가] 홈 상단 공지 티커 문구
}) {
  const [activeTab, setActiveTab] = useState('home');
  // ★ [신규] 베팅 UI 활성 여부 - EventSection이 알려줌 → 하단 바 숨김 트리거
  const [isBettingActive, setIsBettingActive] = useState(false);
  const [selectedM, setSelectedM] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("한국");
  const [selectedRegion, setSelectedRegion] = useState("전체");
  const [isEventLoading, setIsEventLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ★ 중요: props로 받은 user 대신 상위에서 관리되는 실시간 데이터를 참조해야 함
  // userPoint가 바뀌면 EventSection에도 실시간으로 전달되도록 수정
  const safeUser = user || { id: "MEMBER", no: "2282290", diamond: 0, rewards: 0 };

  // ★ [추가] 데일리 보너스 서버 저장 함수
  // 이 함수를 HomeSection 등에 props로 내려주어 버튼 클릭 시 실행하게 합니다.
  const handleClaimBonus = async () => {
    if (isGuest) return alert("회원만 이용 가능합니다.");
    
    const bonusAmount = 100000;
    const nextPoint = (Number(user?.diamond) || 0) + bonusAmount;

    // 1. 즉시 UI 업데이트 (상위 App.jsx의 포인트 변경)
    onUpdatePoint(nextPoint);

    // 2. Firebase 서버에 영구 저장
    if (user?.id) {
      try {
        const userRef = doc(db, "users", user.id);
        await updateDoc(userRef, {
          diamond: nextPoint,
          lastBonusDate: new Date().toISOString()
        });
        alert("데일리 보너스 10만 다이아가 서버에 저장되었습니다!");
      } catch (e) {
        console.error("보너스 서버 저장 실패:", e);
        alert("서버 저장에 실패했습니다. 인터넷 연결을 확인하세요.");
      }
    }
  };

  // 비디오 및 멤버 필터 로직 (기존 유지)
  const filteredVideos = videos.filter(v => {
    if (selectedCategory === "ALL" || !selectedCategory) return true;
    return v.category === selectedCategory;
  });

  const filteredMembers = members.filter(m => {
    if (!selectedRegion || selectedRegion === "전체" || selectedRegion === "ALL") return true;
    return m.region === selectedRegion;
  });

  // ★ [개선] 실시간 접속자 카운트 - 자연스럽고 안정적으로
  //   1) localStorage에 저장 → 새로고침해도 이전 값 유지 (급격한 변화 방지)
  //   2) 시간대별 baseline → 저녁은 높게, 새벽은 낮게 (자연스러움)
  //   3) 4초마다 부드럽게 변화 (대부분 ±1, 가끔 ±2~3)
  //   4) baseline에서 너무 벗어나면 서서히 수렴
  //   5) 30분 이상 지난 캐시는 재생성 (오래된 값 방지)
  const [matchingCount, setMatchingCount] = useState(() => {
    try {
      const saved = localStorage.getItem(LIVE_COUNT_KEY);
      const savedTime = localStorage.getItem(LIVE_COUNT_TIME_KEY);
      const baseline = getTimeBasedBaseline();
      
      // 저장된 값이 있고, 30분 이내면 그대로 사용
      if (saved && savedTime) {
        const elapsed = Date.now() - Number(savedTime);
        if (elapsed < 30 * 60 * 1000) { // 30분
          const savedNum = Number(saved);
          if (savedNum >= 100 && savedNum <= 260) return savedNum;
        }
      }
      // 없거나 오래됐으면 → 현재 시간대 baseline 범위 내에서 랜덤 시작
      return Math.floor(Math.random() * (baseline.max - baseline.min + 1)) + baseline.min;
    } catch (e) {
      return 175; // fallback
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setMatchingCount(prev => {
        const baseline = getTimeBasedBaseline();
        const rand = Math.random();
        
        // baseline에서 얼마나 벗어났는지 계산
        const distFromTarget = prev - baseline.target;
        
        let change;
        
        // baseline에서 많이 벗어났으면 (30%) 서서히 수렴 방향으로
        if (Math.abs(distFromTarget) > 20 && rand < 0.30) {
          change = distFromTarget > 0 ? -1 : 1;
        } else {
          // 일반 변동: 대부분 ±1 (부드럽게)
          //   60% → ±1, 25% → ±2, 10% → ±3, 5% → 유지
          if (rand < 0.30) change = 1;
          else if (rand < 0.60) change = -1;
          else if (rand < 0.72) change = 2;
          else if (rand < 0.85) change = -2;
          else if (rand < 0.92) change = 3;
          else if (rand < 0.97) change = -3;
          else change = 0;
        }
        
        let nextCount = prev + change;
        
        // 시간대 범위 벗어나면 강제 조정
        if (nextCount < baseline.min - 10) nextCount = baseline.min;
        if (nextCount > baseline.max + 10) nextCount = baseline.max;
        
        // localStorage 저장 (새로고침해도 유지)
        try {
          localStorage.setItem(LIVE_COUNT_KEY, String(nextCount));
          localStorage.setItem(LIVE_COUNT_TIME_KEY, String(Date.now()));
        } catch (e) {}
        
        return nextCount;
      });
    }, 4000); 
    return () => clearInterval(timer);
  }, []);

  const handlePopState = useCallback(() => {
    if (document.getElementById('full-screen-view')) return; 
    if (selectedM || document.getElementById('manager-detail-view')) return;
    if (activeTab !== 'home') { setActiveTab('home'); } 
    else { setShowLogoutConfirm(true); }
    window.history.pushState(null, '');
  }, [selectedM, activeTab]);

  useEffect(() => {
    window.history.pushState(null, '');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handlePopState]);

  const handleTabClick = (key) => {
    if (isGuest && (key === 'event' || key === 'mypage')) {
      alert(lang === "ko" ? "승인된 회원 전용 구역입니다." : "Authorized Members Only.");
      return;
    }
    if (key === 'event') {
      setIsEventLoading(true);
      setActiveTab(key);
      setTimeout(() => setIsEventLoading(false), 800);
    } else { setActiveTab(key); }
  };

  const openDetail = (m) => {
    setSelectedM(m);
    setActiveTab('manager');
    window.history.pushState({ isDetail: true }, ''); 
  };

  const handleTelegram = () => {
    if (telegramLink) window.open(telegramLink, "_blank");
    else alert(lang === "ko" ? "상담 링크가 설정되지 않았습니다." : "Link not set.");
  };

  useEffect(() => { window.scrollTo(0, 0); }, [activeTab]);
  
  // ★ [신규] 이벤트 탭 벗어나면 베팅 상태 초기화 (하단 바 다시 보이게)
  useEffect(() => {
    if (activeTab !== 'event') setIsBettingActive(false);
  }, [activeTab]);

  // ★★★ [신규] CustomEvent 리스너 - MyPage에서 이벤트 참여 클릭 시 이벤트 탭으로 이동
  //   props chain 없이 window 이벤트로 직접 통신 → 캐시/전달 실패 문제 원천 차단
  useEffect(() => {
    const handleNavigateToEvent = () => {
      console.log('📢 navigate-to-event 이벤트 수신 → 이벤트 탭으로 이동');
      setActiveTab('event');
    };
    window.addEventListener('navigate-to-event', handleNavigateToEvent);
    return () => window.removeEventListener('navigate-to-event', handleNavigateToEvent);
  }, []);

  // ★ [신규+확장] Heartbeat - 30초마다 lastActive + IP + 국가 + 지역 저장
  //   - 유저가 접속중임을 관리자가 실시간 확인 가능
  //   - IP는 5분에 한 번씩만 조회 (부담 줄이기)
  //   - 국가/지역 정보 함께 저장 (ipapi.co, HTTPS 무료)
  //   - 브라우저 탭이 활성 상태일 때만 갱신
  //   - 게스트는 갱신 안 함 (유저 문서 없음)
  useEffect(() => {
    if (!user?.id || isGuest) return;
    
    let interval = null;
    let cachedIpData = null;
    let lastIpFetch = 0;
    
    const fetchIpWithLocation = async () => {
      // 5분 캐시
      if (cachedIpData && Date.now() - lastIpFetch < 300000) return cachedIpData;
      try {
        // ★ [교체] ipinfo.io: 무료 5만회/월, 도시 정확도 훨씬 우수
        //   반환 형태: { ip, city, region, country(2자리코드), loc, org, timezone }
        const res = await fetch('https://ipinfo.io/json');
        if (res.ok) {
          const data = await res.json();
          cachedIpData = {
            ip: data.ip || "",
            country: data.country || "",  // 2자리 코드 (KR)
            countryCode: data.country || "",
            region: data.region || "",     // 예: "Seoul"
            city: data.city || "",         // 예: "Seoul"
          };
          lastIpFetch = Date.now();
        }
      } catch (e) {
        // Fallback 1: ipapi.co
        try {
          const res = await fetch('https://ipapi.co/json/');
          if (res.ok) {
            const data = await res.json();
            cachedIpData = {
              ip: data.ip || "",
              country: data.country_name || "",
              countryCode: data.country_code || "",
              region: data.region || "",
              city: data.city || "",
            };
            lastIpFetch = Date.now();
          }
        } catch (e2) {
          // Fallback 2: ipify (IP만)
          try {
            const res = await fetch('https://api.ipify.org?format=json');
            if (res.ok) {
              const data = await res.json();
              cachedIpData = {
                ip: data.ip || "",
                country: "", countryCode: "", region: "", city: "",
              };
              lastIpFetch = Date.now();
            }
          } catch (e3) {}
        }
      }
      return cachedIpData;
    };
    
    const updateLastActive = async () => {
      // 탭이 백그라운드면 스킵 (배터리/네트워크 절약)
      if (document.visibilityState !== 'visible') return;
      try {
        const ipData = await fetchIpWithLocation();
        const updates = { 
          lastActive: Date.now(),
          currentUA: (navigator.userAgent || "").substring(0, 200),
        };
        if (ipData?.ip) {
          updates.currentIp = ipData.ip;
          updates.currentCountry = ipData.country;
          updates.currentCountryCode = ipData.countryCode;
          updates.currentRegion = ipData.region;
          updates.currentCity = ipData.city;
        }
        
        await updateDoc(doc(db, "users", user.id), updates);
      } catch (e) {
        // 조용히 실패 (오프라인 등)
      }
    };
    
    // 즉시 한 번 실행 (접속 즉시 온라인 표시)
    updateLastActive();
    
    // 30초마다 반복
    interval = setInterval(updateLastActive, 30000);
    
    // 탭이 다시 활성화되면 즉시 갱신
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateLastActive();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, isGuest]);

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeSection 
            t={t} innerLogo={innerLogo} topAdImage={topAdImage} topAdImage2={topAdImage2} slideImages={slideImages} members={members} 
            setActiveTab={setActiveTab} openDetail={openDetail} 
            handleTelegram={handleTelegram} matchingCount={matchingCount}
            onClaimBonus={handleClaimBonus} // ★ 보너스 함수 전달
            noticeText={noticeText} // ★ [추가] 공지 티커 문구 전달
          />
        );
      case 'manager':
        return (
          <ManagerSection 
            t={t} regions={regions} selectedRegion={selectedRegion} setSelectedRegion={setSelectedRegion} 
            filteredMembers={filteredMembers} initialMember={selectedM} 
            onCloseDetail={() => setSelectedM(null)}
          />
        );
      case 'event':
        return isEventLoading ? (
          <div style={s.loadingContainer}>
            <div className="loading-spinner"></div>
            <div style={s.loadingText}>{lang === "ko" ? "프라이빗 혜택 로딩 중..." : "Loading Private Benefits..."}</div>
          </div>
        ) : (
          <EventSection 
            t={t} 
            user={user} // ★ safeUser 대신 상위 props user를 직접 전달 (실시간 반영)
            userPoint={user?.diamond || 0} // ★ 실시간 포인트 직접 전달
            onUpdatePoint={onUpdatePoint}
            onBack={() => setActiveTab('home')} confirmedImage={appAvatarImage} confirmedAvatarIdx={appAvatarIdx}
            // ★ [신규] 베팅 상태 변화를 Dashboard에 알림 → 하단 바 자동 숨김
            onBettingStateChange={setIsBettingActive}
          />
        );
      case 'video':
        return (
          <VideoSection 
            t={t} videoCategories={videoCategories} selectedCategory={selectedCategory} 
            setSelectedCategory={setSelectedCategory} filteredVideos={filteredVideos} 
          />
        );
      case 'mypage':
        return (
          <MyPageSection 
            t={t} user={user} onBack={() => setActiveTab('home')} onLogout={() => setShowLogoutConfirm(true)} 
            confirmedImage={appAvatarImage} confirmedAvatarIdx={appAvatarIdx} onAvatarChange={onAvatarChange} s={s} 
            telegramLink={telegramLink}
            // ★ [신규] 마이페이지 → 이벤트 참여 클릭 시 완전히 이벤트 탭으로 이동
            setActiveTab={setActiveTab}
          />
        );
      default: return null;
    }
  };

  return (
    <div style={{ ...dashStyles.container, background: '#080808', zIndex: 10, position: 'relative' }}>
      <div style={{...dashStyles.contentArea, background: 'transparent'}}>
        {activeTab !== 'home' && activeTab !== 'event' && activeTab !== 'mypage' && (
          <div style={s.topStatus}>
            <div style={s.statusInner}>
              <span className="dot-active" />
              <span style={s.statusText}>LIVE CONNECTED : </span>
              <b style={s.statusCount}>{matchingCount} MEMBERS</b>
            </div>
          </div>
        )}
        {renderContent()}
      </div>

      {showLogoutConfirm && (
        <div style={s.modalOverlay} onClick={() => setShowLogoutConfirm(false)}>
          <div style={{...s.modalContent, textAlign: 'center'}} onClick={e => e.stopPropagation()}>
            <h3 style={s.modalName}>{t.logout}</h3>
            <p style={{color: '#8E8E93', fontSize: 14, marginBottom: 20}}>
              {lang === "ko" ? "정말 로그아웃 하시겠습니까?" : "Are you sure you want to log out?"}
            </p>
            <div style={s.modalBtnGroup}>
              <button onClick={onLogout} style={s.mMatchBtn}>{t.logout}</button>
              <button onClick={() => setShowLogoutConfirm(false)} style={s.mCloseBtn}>
                {lang === "ko" ? "취소" : "CANCEL"}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav style={{ 
        ...dashStyles.bottomNav, 
        backgroundColor: '#0F0F0F', 
        borderTop: '1px solid #222', 
        paddingBottom: 'env(safe-area-inset-bottom)',
        // ★ [신규] 베팅 UI 활성 시 하단 바를 아래로 슬라이드 숨김
        transform: isBettingActive 
          ? 'translateX(-50%) translateY(100%)' 
          : 'translateX(-50%) translateY(0)',
        pointerEvents: isBettingActive ? 'none' : 'auto',
        opacity: isBettingActive ? 0 : 1
      }}>
        {[
          { key: 'home', label: t.home, icon: '🏠' },
          { key: 'manager', label: t.manager, icon: '💎' },
          { key: 'event', label: t.event, icon: '🎁' },
          { key: 'video', label: t.video, icon: '🎬' },
          { key: 'mypage', label: t.mypage, icon: '👤' }
        ].map((item) => (
          <div key={item.key} onClick={() => handleTabClick(item.key)}
            style={{ ...dashStyles.navItem, color: activeTab === item.key ? '#D4AF37' : '#555' }}>
            <span style={{ fontSize: 22, filter: activeTab === item.key ? 'none' : 'grayscale(100%) opacity(0.4)', marginBottom: 4 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 800 }}>{item.label}</span>
          </div>
        ))}
      </nav>

      <style>{`
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }
        .dot-active { width: 8px; height: 8px; background: #34C759; border-radius: 50%; box-shadow: 0 0 8px #34C759; animation: pulse 1.5s infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .loading-spinner { width: 35px; height: 35px; border: 3px solid #222; border-top: 3px solid #D4AF37; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 15px; }
      `}</style>
    </div>
  );
}

const s = {
  topStatus: { background: '#121212', padding: '12px 0', borderBottom: '1px solid #222' },
  statusInner: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusText: { color: '#666', fontSize: 11, fontWeight: 600 },
  statusCount: { color: '#D4AF37', fontSize: 11, fontWeight: 800 },
  loadingContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 0' },
  loadingText: { fontSize: 13, color: '#D4AF37', fontWeight: 700 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' },
  modalContent: { background: '#1A1A1A', width: '88%', maxWidth: '380px', padding: '24px', borderRadius: '28px', border: '1px solid #333' },
  modalName: { color: '#FFF', fontSize: 22, fontWeight: 800, margin: '0 0 6px 0' },
  modalBtnGroup: { display: 'flex', flexDirection: 'column', gap: 10 },
  mMatchBtn: { width: '100%', padding: '16px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '16px', fontWeight: 800, fontSize: '15px' },
  mCloseBtn: { width: '100%', padding: '14px', background: '#222', color: '#888', border: 'none', borderRadius: '16px', fontWeight: 700, fontSize: '14px' },
};