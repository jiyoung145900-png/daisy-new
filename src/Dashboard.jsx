import React, { useState, useEffect, useCallback } from "react";
import HomeSection from "./HomeSection";
import ManagerSection from "./ManagerSection";
import VideoSection from "./VideoSection";
import EventSection from "./EventSection";
import MyPageSection from "./MyPage"; 
// ★ Firebase 연동을 위한 import 추가
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

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
  topAdImage,
  topAdImage2,
  telegramLink = "https://t.me/your_address",
  noticeText = ""
}) {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedM, setSelectedM] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("한국");
  const [selectedRegion, setSelectedRegion] = useState("전체");
  const [isEventLoading, setIsEventLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const safeUser = user || { id: "MEMBER", no: "2282290", diamond: 0, rewards: 0 };

  const handleClaimBonus = async () => {
    if (isGuest) return alert("회원만 이용 가능합니다.");
    
    const bonusAmount = 100000;
    const nextPoint = (Number(user?.diamond) || 0) + bonusAmount;

    onUpdatePoint(nextPoint);

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

  const filteredVideos = videos.filter(v => {
    if (selectedCategory === "ALL" || !selectedCategory) return true;
    return v.category === selectedCategory;
  });

  const filteredMembers = members.filter(m => {
    if (!selectedRegion || selectedRegion === "전체" || selectedRegion === "ALL") return true;
    return m.region === selectedRegion;
  });

  const [matchingCount, setMatchingCount] = useState(() => {
    return Math.floor(Math.random() * (198 - 131 + 1)) + 131;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setMatchingCount(prev => {
        const rand = Math.random();
        let change = rand < 0.35 ? 1 : rand < 0.70 ? -1
          : rand < 0.82 ? 2 : rand < 0.90 ? -2
          : rand < 0.95 ? 4 : -4;
        let nextCount = prev + change;
        if (nextCount <= 110) nextCount = 118;
        if (nextCount >= 215) nextCount = 205;
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

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeSection 
            t={t} innerLogo={innerLogo} topAdImage={topAdImage} topAdImage2={topAdImage2} slideImages={slideImages} members={members} 
            setActiveTab={setActiveTab} openDetail={openDetail} 
            handleTelegram={handleTelegram} matchingCount={matchingCount}
            onClaimBonus={handleClaimBonus}
            noticeText={noticeText}
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
            user={user}
            userPoint={user?.diamond || 0}
            onUpdatePoint={onUpdatePoint}
            onBack={() => setActiveTab('home')} confirmedImage={appAvatarImage} confirmedAvatarIdx={appAvatarIdx}
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
          />
        );
      default: return null;
    }
  };

  return (
    <div style={{ ...dashStyles.container, background: '#080808', zIndex: 10, position: 'relative' }}>
      {/* ★ [수정] contentArea에 하단 여백 추가 (fixed 네비바에 안 가리게) */}
      <div style={{
        ...dashStyles.contentArea, 
        background: 'transparent',
        paddingBottom: 'calc(90px + env(safe-area-inset-bottom))'  // ← 네비바 높이만큼 여백
      }}>
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

      {/* ★ [수정] 하단 네비바를 화면 하단에 고정 (position: fixed) */}
      <nav style={{ 
        ...dashStyles.bottomNav, 
        position: 'fixed',           // ← 고정
        bottom: 0,                    // ← 화면 맨 아래
        left: '50%',                  // ← 가운데 정렬 (maxWidth 500 대응)
        transform: 'translateX(-50%)', // ← 가운데 정렬
        zIndex: 1000,                 // ← 다른 요소 위에
        backgroundColor: '#0F0F0F', 
        borderTop: '1px solid #222', 
        paddingBottom: 'env(safe-area-inset-bottom)'  // ← 아이폰 홈바 대응
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