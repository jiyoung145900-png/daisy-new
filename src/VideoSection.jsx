import React, { useState, useEffect, useRef } from "react";
import { videoThumbnail, optimizeVideo } from "./CloudinaryUrl";

export default function VideoSection({ 
  videoCategories = [], 
  selectedCategory, 
  setSelectedCategory, 
  filteredVideos = [], 
  t,
  telegramLink // ★ 관리자 문의용 텔레그램 링크 (선택적)
}) {
  const [fullScreenVideo, setFullScreenVideo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showContactMsg, setShowContactMsg] = useState(false);
  const itemsPerPage = 10;
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  const isKo = t.home === "홈페이지";

  const catTranslation = {
    "ALL": "ALL",
    "한국": "KOREA",
    "일본": "JAPAN",
    "중국": "CHINA",
    "동남아": "S.E ASIA",
    "서양": "WESTERN"
  };

  const getCatName = (name) => {
    if (isKo) return name;
    return catTranslation[name] || name;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentVideos = filteredVideos.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredVideos.length / itemsPerPage);

  const isAllActive = selectedCategory === 'ALL';

  // 뒤로가기 이벤트 감지
  useEffect(() => {
    const handlePop = () => {
      if (fullScreenVideo) {
        closeFull();
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [fullScreenVideo]);

  // ★ 10초 재생 후 자동 정지 + 관리자 문의 메시지 표시
  useEffect(() => {
    if (fullScreenVideo && videoRef.current) {
      const video = videoRef.current;
      
      // 10초 후 정지 + 메시지
      timerRef.current = setTimeout(() => {
        if (video) {
          video.pause();
          setShowContactMsg(true);
        }
      }, 10000);  // ★ 30초 → 10초로 변경
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fullScreenVideo]);

  const openFull = (url) => {
    setFullScreenVideo(url);
    setShowContactMsg(false);
    window.history.pushState({ isFullVideo: true }, ''); 
  };

  const closeFull = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setFullScreenVideo(null);
    setShowContactMsg(false);
  };

  const handleContactClick = () => {
    if (telegramLink) {
      // @ID 형태면 t.me 링크로, 이미 https 면 그대로
      const url = telegramLink.startsWith("http")
        ? telegramLink
        : `https://t.me/${telegramLink.replace(/^@/, "")}`;
      window.open(url, "_blank");
    } else {
      alert(isKo ? "관리자에게 문의해주세요." : "Please contact the administrator.");
    }
  };

  return (
    <div style={s.pagePadding}>
      <h2 style={s.tabDisplayTitle}>{isKo ? "프리미엄 갤러리" : "PREMIUM GALLERY"}</h2>

      {/* 카테고리 바 */}
      <div style={s.videoCategoryBar}>
        <span onClick={() => setSelectedCategory('ALL')}
          style={{...s.videoCatItem, color: isAllActive ? '#ffb347' : '#555', borderBottom: isAllActive ? '2px solid #ffb347' : '2px solid transparent'}}
        > {getCatName('ALL')} </span>
        {videoCategories.map((cat) => (
          <span key={cat} onClick={() => setSelectedCategory(cat)}
            style={{...s.videoCatItem, color: selectedCategory === cat ? '#ffb347' : '#555', borderBottom: selectedCategory === cat ? '2px solid #ffb347' : '2px solid transparent'}}
          > {getCatName(cat)} </span>
        ))}
      </div>

      {/* ★ 비디오 그리드 - 자동재생 대신 썸네일 이미지 표시 */}
      <div style={s.videoGrid}>
        {currentVideos.length > 0 ? (
          currentVideos.map((vid) => (
            <div key={vid.id} style={s.videoCard} onClick={() => openFull(vid.url)}>
              <div style={s.videoWrapper}>
                {/* 비디오 대신 첫 프레임 썸네일 이미지 표시 → Transformation 절약 */}
                <img 
                  src={videoThumbnail(vid.url, { width: 400, crop: "fill" })}
                  style={s.videoEl}
                  alt="video thumbnail"
                  loading="lazy"
                />
                <div style={s.playOverlay}>
                  <div style={s.playIcon}>▶</div>
                  <div style={s.playText}>{isKo ? "재생" : "PLAY"}</div>
                </div>
              </div>
              <div style={s.videoDesc}>
                <span style={s.descBadge}>EXCLUSIVE</span>
                <p style={s.descText}>
                  {vid.description || (isKo ? `프리미엄 ${vid.category} 쇼` : `PREMIUM ${getCatName(vid.category)} SHOW`)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div style={s.noData}>{isKo ? "해당 카테고리의 영상이 준비 중입니다." : "Videos in this category are coming soon."}</div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={s.pagination}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <button key={pageNum} onClick={() => { setCurrentPage(pageNum); window.scrollTo(0, 0); }}
              style={{...s.pageBtn, background: currentPage === pageNum ? '#ffb347' : '#1a1a1a', color: currentPage === pageNum ? '#000' : '#888'}}
            > {pageNum} </button>
          ))}
        </div>
      )}

      {/* ★ 풀스크린 비디오 뷰어 (10초 후 정지 + 문의 안내) */}
      {fullScreenVideo && (
        <div 
          id="full-screen-view" 
          style={s.fullOverlay} 
          onClick={closeFull}
        >
          <button style={s.closeFull} onClick={closeFull}>✕ {isKo ? "닫기" : "CLOSE"}</button>
          <div style={s.fullContent} onClick={e => e.stopPropagation()}>
            <video 
              ref={videoRef}
              src={optimizeVideo(fullScreenVideo, { width: 480 })}  // ★ 720 → 480 (대역폭 40% 절약)
              style={s.fullVideoEl} 
              controls 
              autoPlay 
              playsInline 
              preload="metadata"  // ★ 초기 로딩 최소화
            />
            
            {/* ★ 10초 후 노출되는 관리자 문의 안내 */}
            {showContactMsg && (
              <div style={s.contactOverlay}>
                <div style={s.contactBox}>
                  <div style={s.contactIcon}>🔒</div>
                  <h3 style={s.contactTitle}>
                    {isKo ? "미리보기 종료" : "PREVIEW ENDED"}
                  </h3>
                  <p style={s.contactText}>
                    {isKo 
                      ? "전체 영상은 관리자에게 문의해주세요." 
                      : "For full video access, please contact the administrator."}
                  </p>
                  <button style={s.contactBtn} onClick={handleContactClick}>
                    {isKo ? "관리자 문의" : "CONTACT ADMIN"}
                  </button>
                  <button style={s.contactCloseBtn} onClick={closeFull}>
                    {isKo ? "닫기" : "CLOSE"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  pagePadding: { padding: '0 20px 100px 20px' },
  tabDisplayTitle: { color: '#fff', fontSize: 20, fontWeight: 200, letterSpacing: 6, textAlign: 'center', marginBottom: 35, textTransform: 'uppercase' },
  videoCategoryBar: { display: 'flex', justifyContent: 'center', gap: 15, marginBottom: 30, borderBottom: '1px solid #1a1a1a', paddingBottom: 12, flexWrap: 'wrap' },
  videoCatItem: { fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: '4px 4px', transition: 'all 0.3s ease', textTransform: 'uppercase' },
  videoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 },
  videoCard: { background: '#0f0f0f', borderRadius: 12, overflow: 'hidden', border: '1px solid #1a1a1a', cursor: 'pointer' },
  videoWrapper: { width: '100%', aspectRatio: '9/16', background: '#000', position: 'relative' },
  videoEl: { width: '100%', height: '100%', objectFit: 'cover' },
  playOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: 0.9 },
  playIcon: { fontSize: 36, marginBottom: 6, textShadow: '0 2px 8px rgba(0,0,0,0.6)' },
  playText: { fontSize: 10, fontWeight: 900, letterSpacing: 2 },
  videoDesc: { padding: '12px 10px', textAlign: 'center' },
  descBadge: { fontSize: 8, color: '#000', background: '#ffb347', padding: '2px 5px', borderRadius: 3, fontWeight: 900, display: 'inline-block', marginBottom: 6 },
  descText: { margin: 0, fontSize: 11, color: '#eee', fontWeight: 500, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  noData: { gridColumn: 'span 2', textAlign: 'center', color: '#444', padding: '50px 0', fontSize: 14 },
  pagination: { display: 'flex', justifyContent: 'center', gap: 8, marginTop: 30 },
  pageBtn: { border: 'none', width: 35, height: 35, borderRadius: '50%', fontWeight: 800, fontSize: 12, cursor: 'pointer' },
  fullOverlay: { position: 'fixed', inset: 0, background: '#000', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fullContent: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  fullVideoEl: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  closeFull: { position: 'absolute', top: 30, right: 20, zIndex: 100001, background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '30px', fontWeight: 800 },

  // ★ 관리자 문의 안내 팝업
  contactOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)', zIndex: 100000 },
  contactBox: { background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)', border: '2px solid #ffb347', borderRadius: 20, padding: '35px 25px', maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(255,179,71,0.3)' },
  contactIcon: { fontSize: 48, marginBottom: 15 },
  contactTitle: { color: '#ffb347', fontSize: 20, fontWeight: 900, margin: '0 0 12px 0', letterSpacing: 2 },
  contactText: { color: '#ddd', fontSize: 13, lineHeight: 1.6, margin: '0 0 25px 0' },
  contactBtn: { width: '100%', padding: '14px', background: '#ffb347', color: '#000', border: 'none', borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: 'pointer', marginBottom: 10, letterSpacing: 1 },
  contactCloseBtn: { width: '100%', padding: '12px', background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' },
};