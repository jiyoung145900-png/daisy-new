import React, { useState, useEffect } from "react";
import { optimizeImage, optimizeVideo, videoThumbnail } from "./CloudinaryUrl";

export default function ManagerSection({ 
  filteredMembers, 
  regions, 
  selectedRegion, 
  setSelectedRegion,
  initialMember,       
  onCloseDetail,
  t // ★ Dashboard에서 전달받은 번역 객체
}) {
  const [selectedMember, setSelectedMember] = useState(null);
  const [fullScreenMedia, setFullScreenMedia] = useState(null);

  // [기존 유지] 1. 관제탑 연동
  useEffect(() => {
    if (initialMember) {
      setSelectedMember(initialMember);
      window.history.pushState({ isDetail: true }, ''); 
    }
  }, [initialMember]);

  // [기존 유지] 2. 뒤로가기 감지
  useEffect(() => {
    const handlePop = () => {
      if (fullScreenMedia) {
        setFullScreenMedia(null);
      } else if (selectedMember) {
        handleClose();
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [fullScreenMedia, selectedMember]);

  // [기존 유지] 3. 풀스크린 열기
  const openFull = (type, url) => {
    setFullScreenMedia({ type, url });
    window.history.pushState({ isFull: true }, ''); 
  };

  // [기존 유지] 4. 상세창 닫기
  const handleClose = () => {
    setSelectedMember(null);
    if (onCloseDetail) onCloseDetail();
  };

  // [기존 유지] 비디오 판별 로직
  const isVideo = (url) => {
    return url && (url.includes('/video/upload/') || url.match(/\.(mp4|webm|mov|avi)$/i));
  };

  // ★ [핵심 추가] 지역명 번역 매핑 데이터
  const regionTranslation = {
    "전체": "ALL",
    "서울": "SEOUL",
    "경기 북부": "Gyeonggi N.",
    "경기 남부": "Gyeonggi S.",
    "인천": "INCHEON",
    "충청": "CHUNGCHEONG",
    "강원": "GANGWON",
    "전라": "JEONLA",
    "경북·대구": "DAEGU/GB",
    "부산·울산·경남": "BUSAN/GN",
    "제주": "JEJU"
  };

  const isKo = t.home === "홈페이지";

  // 지역 이름을 현재 언어에 맞춰 반환하는 함수
  const getRegionName = (name) => {
    if (isKo) return name;
    return regionTranslation[name] || name;
  };

  const generateIntro = (name) => {
    const intros = isKo ? [
      `${name} 매니저는 세련된 매너와 섬세한 감각을 갖춘 엘리트 멤버입니다.`,
      `철저한 자기관리로 완성된 비주얼을 자랑하는 ${name} 매니저를 소개합니다.`,
      `밝은 에너지와 배려심으로 편안한 시간을 약속드리는 ${name} 매니저입니다.`
    ] : [
      `${name} is an elite member with sophisticated manners and delicate senses.`,
      `Introducing ${name}, who boasts a visual perfected through thorough self-management.`,
      `${name} promises a comfortable time with bright energy and consideration.`
    ];
    let hash = (name || "").split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return intros[hash % intros.length];
  };

  return (
    <div style={m.container}>
      {/* ===== 1. 지역 필터 ===== */}
      <div style={m.filterWrapper}>
        <div style={m.filterScroll}>
          {regions.map(r => (
            <div key={r} onClick={() => setSelectedRegion(r)}
              style={{...m.filterItem, 
                color: selectedRegion === r ? '#000' : '#888', 
                background: selectedRegion === r ? '#FFD700' : 'transparent', 
                borderColor: selectedRegion === r ? '#FFD700' : '#333'
              }}
            > 
              {getRegionName(r)} 
            </div>
          ))}
        </div>
      </div>

      {/* ===== 2. 매니저 그리드 (썸네일 사이즈 최적화) ===== */}
      <div style={m.grid}>
        {filteredMembers.map((member, idx) => (
          <div key={idx} style={m.card} onClick={() => {
            setSelectedMember(member);
            window.history.pushState({ isDetail: true }, ''); 
          }}>
            <div style={m.cardImgWrap}>
              {/* ★ 카드 썸네일 - 최적화 파라미터 자동 추가 */}
              <img 
                src={optimizeImage(member.img, { width: 400, crop: "fill" })} 
                style={m.cardImg} 
                alt={member.name}
                loading="lazy"
              />
              <div style={m.cardOverlay} />
              <div style={m.cardBadge}>PREMIUM</div>
            </div>
            <div style={m.cardInfo}>
              <div style={m.cardName}>{member.name}</div>
              <div style={m.cardSpecs}>
                {getRegionName(member.loc || member.region || (isKo ? "지역" : "LOC"))} · {member.age ? `${member.age}${isKo ? '세' : ''}` : (isKo ? '20대' : '20s')}
              </div>
              <div style={{ ...m.cardSpecs, marginTop: '4px' }}>
                {member.height ? member.height + 'cm' : 'cm'} · {member.bust || member.size || "Size"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== 3. 상세 프로필 팝업 ===== */}
      {selectedMember && (
        <div style={m.modalOverlay} onClick={handleClose}>
          <div style={m.modalContent} onClick={e => e.stopPropagation()}>
            <div style={m.modalImageWrap} onClick={() => openFull('img', selectedMember.img)}>
              {/* ★ 상세 이미지 - 좀 더 큰 사이즈로 최적화 */}
              <img 
                src={optimizeImage(selectedMember.img, { width: 600 })} 
                style={m.modalActualImg} 
                alt="" 
              />
              <div style={m.luxTag}>✦ {isKo ? "클릭하여 확대" : "CLICK TO ZOOM"}</div>
            </div>

            <div style={m.modalBody}>
              <h2 style={m.modalName}>{selectedMember.name}</h2>
              
              <div style={m.specGrid}>
                <div style={m.specItem}>LOC<br/><b style={m.specVal}>{getRegionName(selectedMember.loc || selectedMember.region || (isKo ? "미정" : "TBA"))}</b></div>
                <div style={m.specItem}>AGE<br/><b style={m.specVal}>{selectedMember.age ? `${selectedMember.age}${isKo ? '세' : ''}` : (isKo ? '20s' : '20s')}</b></div>
                <div style={m.specItem}>HEIGHT<br/><b style={m.specVal}>{selectedMember.height ? selectedMember.height + 'cm' : 'cm'}</b></div>
                <div style={m.specItem}>WEIGHT<br/><b style={m.specVal}>{selectedMember.weight ? selectedMember.weight + 'kg' : 'kg'}</b></div>
                <div style={m.specItem}>SIZE<br/><b style={m.specVal}>{selectedMember.bust || selectedMember.size || "Size"}</b></div>
              </div>

              <div style={m.introBox}>
                <div style={m.introTitle}>INTRO</div>
                <p style={m.introText}>{selectedMember.desc || generateIntro(selectedMember.name)}</p>
              </div>

              {/* ★ 매니저 소개 영상 - 비디오 자동재생 대신 썸네일 이미지로 대체 */}
              {(selectedMember.video || isVideo(selectedMember.img)) && (
                <div style={m.videoArea} onClick={() => openFull('video', selectedMember.video || selectedMember.img)}>
                  <div style={m.introTitle}>PRIVATE MOVIE ({isKo ? "클릭하여 확대" : "CLICK TO ENLARGE"})</div>
                  <div style={{ position: 'relative' }}>
                    {/* 비디오 → 첫 프레임 썸네일 이미지 */}
                    <img 
                      src={videoThumbnail(selectedMember.video || selectedMember.img, { width: 500, crop: "fill" })} 
                      style={m.videoTag} 
                      alt="preview"
                      loading="lazy"
                    />
                    <div style={m.videoOverlay}>
                      <div style={m.videoPlayIcon}>▶</div>
                      <div>{isKo ? "전체화면 재생" : "TAP TO PLAY"}</div>
                    </div>
                  </div>
                </div>
              )}
              <button style={m.closeBtn} onClick={handleClose}>{isKo ? "닫기" : "CLOSE"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 4. 풀스크린 뷰어 (URL 최적화 적용) ===== */}
      {fullScreenMedia && (
        <div id="full-screen-view" style={m.fullScreenOverlay} onClick={() => setFullScreenMedia(null)}>
          <button style={m.fullScreenClose} onClick={() => setFullScreenMedia(null)}>✕ {isKo ? "닫기" : "CLOSE"}</button>
          <div style={m.fullScreenContent} onClick={e => e.stopPropagation()}>
            {fullScreenMedia.type === 'video' ? (
              <video 
                src={optimizeVideo(fullScreenMedia.url, { width: 720 })} 
                style={m.fullMedia} 
                controls 
                autoPlay 
                loop 
                playsInline 
              />
            ) : (
              <img 
                src={optimizeImage(fullScreenMedia.url, { width: 1080 })} 
                style={m.fullMedia} 
                alt="" 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// [기존 유지] 스타일 객체 전체
const m = {
  container: { padding: '20px 0 100px', backgroundColor: '#080808' },
  filterWrapper: { overflowX: 'auto', padding: '0 20px 20px', whiteSpace: 'nowrap' },
  filterScroll: { display: 'inline-flex', gap: 10 },
  filterItem: { padding: '10px 25px', borderRadius: '25px', border: '1px solid #333', fontSize: 15, fontWeight: 800, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, padding: '0 20px' },
  card: { background: '#111', borderRadius: '15px', overflow: 'hidden', border: '1px solid #222', cursor: 'pointer' },
  cardImgWrap: { position: 'relative', aspectRatio: '1/1.3' },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, #111 100%)' },
  cardBadge: { position: 'absolute', top: 12, left: 12, background: 'rgba(255,215,0,0.9)', color: '#000', fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 6 },
  cardInfo: { padding: '18px 12px', textAlign: 'center' },
  cardName: { color: '#fff', fontSize: 20, fontWeight: 900, marginBottom: 5 },
  cardSpecs: { fontSize: 13, color: '#aaa', fontWeight: 600 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(8px)' },
  modalContent: { background: '#0f0f0f', width: '100%', maxWidth: '400px', borderRadius: '35px', overflowY: 'auto', border: '1px solid #333', maxHeight: '92vh' },
  modalImageWrap: { position: 'relative', width: '100%', aspectRatio: '1/1.2', cursor: 'zoom-in' },
  modalActualImg: { width: '100%', height: '100%', objectFit: 'cover' },
  luxTag: { position: 'absolute', bottom: 15, right: 15, background: 'rgba(0,0,0,0.5)', color: '#FFD700', fontSize: 10, fontWeight: 900, padding: '6px 12px', borderRadius: 5, border: '1px solid #FFD700' },
  modalBody: { padding: 30 },
  modalName: { color: '#fff', fontSize: 30, fontWeight: 900, textAlign: 'center', marginBottom: 25 },
  specGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 30 },
  specItem: { textAlign: 'center', color: '#888', fontSize: 11, background: '#161616', padding: '15px 5px', borderRadius: 15, border: '1px solid #222' },
  specVal: { color: '#FFD700', fontSize: 15, fontWeight: 900, display: 'block', marginTop: 5 },
  introBox: { background: '#161616', padding: 25, borderRadius: 20, borderLeft: '5px solid #FFD700', marginBottom: 30 },
  introTitle: { color: '#FFD700', fontSize: 13, fontWeight: 900, marginBottom: 12, letterSpacing: 1.5 },
  introText: { color: '#eee', fontSize: 16, lineHeight: 1.8, margin: 0 },
  videoArea: { marginBottom: 30, cursor: 'zoom-in' },
  videoTag: { width: '100%', borderRadius: 20, border: '1px solid #333', display: 'block' },
  videoOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 900, borderRadius: 20 },
  videoPlayIcon: { fontSize: 40, marginBottom: 8, textShadow: '0 2px 8px rgba(0,0,0,0.7)' },
  closeBtn: { width: '100%', padding: 20, background: '#222', color: '#fff', border: 'none', borderRadius: 20, fontSize: 18, fontWeight: 900, cursor: 'pointer' },
  fullScreenOverlay: { position: 'fixed', inset: 0, background: '#000', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fullScreenContent: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fullMedia: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  fullScreenClose: { position: 'absolute', top: 40, right: 20, zIndex: 100001, background: '#FFD700', color: '#000', border: 'none', padding: '12px 25px', borderRadius: '30px', fontWeight: 900, cursor: 'pointer' }
};