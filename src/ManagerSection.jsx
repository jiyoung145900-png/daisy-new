import React, { useState, useEffect, useRef } from "react";
import { optimizeImage, optimizeVideo, videoThumbnail } from "./CloudinaryUrl";

// ★★★ [신규] 애플급 3D 틸트 카드 컴포넌트
//   - 마우스 위치에 따라 3D 회전 (rotateX, rotateY)
//   - 광택 반사 효과 (glare)
//   - 부드러운 이징 (mouseleave 시 원위치)
function TiltCard({ children, onClick, style, index = 0 }) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // ★★★ [신규] Stagger 등장 - 순차적으로 페이드인 + 슬라이드업
  useEffect(() => {
    const delay = Math.min(index * 60, 800); // 최대 800ms까지만 (성능)
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [index]);

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // 최대 12도 기울기
    const rotateY = ((x - centerX) / centerX) * 12;
    const rotateX = -((y - centerY) / centerY) * 12;

    setTilt({ x: rotateX, y: rotateY });
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    });
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
    setGlarePos({ x: 50, y: 50 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        ...style,
        position: 'relative',
        // ★★★ [수정] Stagger 등장 효과 + 3D 틸트
        opacity: isVisible ? 1 : 0,
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(${isHovered ? 1.03 : 1}, ${isHovered ? 1.03 : 1}, 1) translateY(${isVisible ? 0 : 30}px)`,
        transition: isHovered
          ? 'transform 0.1s ease-out'
          : `opacity 0.6s cubic-bezier(0.19, 1, 0.22, 1), transform 0.7s cubic-bezier(0.19, 1, 0.22, 1)`,
        transformStyle: 'preserve-3d',
        willChange: 'transform, opacity',
        boxShadow: isHovered
          ? `${-tilt.y * 2}px ${tilt.x * 2}px 30px rgba(255, 215, 0, 0.2), 0 20px 40px rgba(0,0,0,0.6)`
          : '0 4px 15px rgba(0,0,0,0.3)',
      }}
    >
      {children}
      {/* 광택 반사 오버레이 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.15), transparent 60%)`,
          pointerEvents: 'none',
          borderRadius: 'inherit',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.3s ease',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}

export default function ManagerSection({ 
  filteredMembers, 
  regions, 
  selectedRegion, 
  setSelectedRegion,
  initialMember,       
  onCloseDetail,
  t,
  backHandlerRef // ★★★ [신규] Dashboard의 로컬 뒤로가기 핸들러 ref
}) {
  const [selectedMember, setSelectedMember] = useState(null);
  const [fullScreenMedia, setFullScreenMedia] = useState(null);

  // [기존 유지] 1. 관제탑 연동
  useEffect(() => {
    if (initialMember) {
      setSelectedMember(initialMember);
    }
  }, [initialMember]);

  // ★★★ [수정] 자체 popstate 대신 Dashboard의 backHandlerRef에 로컬 뒤로가기 등록
  //   자체 popstate 리스너는 Dashboard 리스너와 충돌하므로 제거
  //   대신 Dashboard가 이 함수를 먼저 호출해서 로컬 뒤로가기 처리
  useEffect(() => {
    if (!backHandlerRef) return;
    
    backHandlerRef.current = () => {
      // 우선순위 1: 전체화면 미디어 닫기
      if (fullScreenMedia) {
        setFullScreenMedia(null);
        return true; // 처리 완료
      }
      // 우선순위 2: 매니저 상세 모달 닫기
      if (selectedMember) {
        handleClose();
        return true; // 처리 완료
      }
      return false; // 로컬 뒤로갈 것 없음 - Dashboard가 탭 pop
    };
    
    return () => {
      if (backHandlerRef.current) {
        backHandlerRef.current = null;
      }
    };
  }, [fullScreenMedia, selectedMember, backHandlerRef]);

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

  // ★ [수정] 지역 필터 탭 번역 (광역 - 3개 언어)
  const regionTranslation = {
    "전체":         { ja: "全体", en: "ALL" },
    "서울":         { ja: "ソウル", en: "SEOUL" },
    "경기 북부":    { ja: "京畿北部", en: "Gyeonggi N." },
    "경기 남부":    { ja: "京畿南部", en: "Gyeonggi S." },
    "인천":         { ja: "仁川", en: "INCHEON" },
    "충청":         { ja: "忠清", en: "CHUNGCHEONG" },
    "강원":         { ja: "江原", en: "GANGWON" },
    "전라":         { ja: "全羅", en: "JEONLA" },
    "경북·대구":    { ja: "慶北·大邱", en: "DAEGU/GB" },
    "부산·울산·경남": { ja: "釜山·蔚山·慶南", en: "BUSAN/GN" },
    "제주":         { ja: "済州", en: "JEJU" },
  };

  // ★ [신규] 시군구 번역 (매니저 카드의 loc 필드)
  const LOC_MAP = {
    "강남/서초/송파": { ja: "江南/瑞草/松坡", en: "Gangnam/Seocho/Songpa" },
    "강동/광진/성동": { ja: "江東/広津/城東", en: "Gangdong/Gwangjin/Seongdong" },
    "마포/강서/양천": { ja: "麻浦/江西/陽川", en: "Mapo/Gangseo/Yangcheon" },
    "영등포/구로/금천": { ja: "永登浦/九老/衿川", en: "Yeongdeungpo/Guro/Geumcheon" },
    "종로/중구/용산": { ja: "鍾路/中区/龍山", en: "Jongno/Jung-gu/Yongsan" },
    "동대문/중랑/노원": { ja: "東大門/中浪/蘆原", en: "Dongdaemun/Jungnang/Nowon" },
    "일산/파주/고양": { ja: "一山/坡州/高陽", en: "Ilsan/Paju/Goyang" },
    "의정부/양주/동두천": { ja: "議政府/楊州/東豆川", en: "Uijeongbu/Yangju/Dongducheon" },
    "남양주/구리/포천": { ja: "南楊州/九里/抱川", en: "Namyangju/Guri/Pocheon" },
    "수원/용인/화성": { ja: "水原/龍仁/華城", en: "Suwon/Yongin/Hwaseong" },
    "분당/판교/성남": { ja: "盆唐/板橋/城南", en: "Bundang/Pangyo/Seongnam" },
    "안양/군포/의왕": { ja: "安養/軍浦/義王", en: "Anyang/Gunpo/Uiwang" },
    "안산/시흥/광명": { ja: "安山/始興/光明", en: "Ansan/Siheung/Gwangmyeong" },
    "부천/김포": { ja: "富川/金浦", en: "Bucheon/Gimpo" },
    "평택/안성/오산": { ja: "平澤/安城/烏山", en: "Pyeongtaek/Anseong/Osan" },
    "부평/계양": { ja: "富平/桂陽", en: "Bupyeong/Gyeyang" },
    "미추홀/연수/남동": { ja: "弥鄒忽/延寿/南洞", en: "Michuhol/Yeonsu/Namdong" },
    "서구/강화/옹진": { ja: "西区/江華/甕津", en: "Seo-gu/Ganghwa/Ongjin" },
    "천안/아산/당진": { ja: "天安/牙山/唐津", en: "Cheonan/Asan/Dangjin" },
    "대전/세종/공주": { ja: "大田/世宗/公州", en: "Daejeon/Sejong/Gongju" },
    "청주/충주/음성": { ja: "清州/忠州/陰城", en: "Cheongju/Chungju/Eumseong" },
    "춘천/홍천/철원": { ja: "春川/洪川/鉄原", en: "Chuncheon/Hongcheon/Cheorwon" },
    "원주/횡성/평창": { ja: "原州/横城/平昌", en: "Wonju/Hoengseong/Pyeongchang" },
    "강릉/속초/동해": { ja: "江陵/束草/東海", en: "Gangneung/Sokcho/Donghae" },
    "광주/나주/담양": { ja: "光州/羅州/潭陽", en: "Gwangju/Naju/Damyang" },
    "전주/익산/군산": { ja: "全州/益山/群山", en: "Jeonju/Iksan/Gunsan" },
    "목포/무안/영암": { ja: "木浦/務安/霊岩", en: "Mokpo/Muan/Yeongam" },
    "순천/여수/광양": { ja: "順天/麗水/光陽", en: "Suncheon/Yeosu/Gwangyang" },
    "대구 시내/수성/동구": { ja: "大邱市内/寿城/東区", en: "Daegu/Suseong/Dong-gu" },
    "대구 서구/남구/달서": { ja: "大邱西区/南区/達西", en: "Daegu Seo/Nam/Dalseo" },
    "포항/경주/영덕": { ja: "浦項/慶州/盈徳", en: "Pohang/Gyeongju/Yeongdeok" },
    "구미/김천/상주": { ja: "亀尾/金泉/尚州", en: "Gumi/Gimcheon/Sangju" },
    "안동/영주/경산": { ja: "安東/栄州/慶山", en: "Andong/Yeongju/Gyeongsan" },
    "부산 서면/동래/연제": { ja: "釜山西面/東莱/蓮堤", en: "Busan Seomyeon/Dongnae/Yeonje" },
    "부산 해운대/수영/기장": { ja: "海雲台/水営/機張", en: "Haeundae/Suyeong/Gijang" },
    "부산 사하/강서/사상": { ja: "沙下/江西/沙上", en: "Saha/Gangseo/Sasang" },
    "울산/양산": { ja: "蔚山/梁山", en: "Ulsan/Yangsan" },
    "창원/김해/거제": { ja: "昌原/金海/巨済", en: "Changwon/Gimhae/Geoje" },
    "제주시 권역": { ja: "済州市エリア", en: "Jeju City Area" },
    "서귀포시 권역": { ja: "西帰浦市エリア", en: "Seogwipo Area" },
  };

  const isKo = t.home === "홈페이지";
  const isJa = t.home === "ホーム";
  const tr = (ko, ja, en) => isKo ? ko : isJa ? ja : en;
  
  // ★ 매니저 이름/소개 - 언어별 자동 선택
  const getMemberName = (member) => {
    if (!member) return "";
    if (isJa) return member.name_ja || member.name;
    if (!isKo) return member.name_en || member.name;
    return member.name_ko || member.name;
  };
  const getMemberDesc = (member) => {
    if (!member) return "";
    if (isJa) return member.desc_ja || member.desc;
    if (!isKo) return member.desc_en || member.desc;
    return member.desc_ko || member.desc;
  };

  // ★ [수정] 지역명 번역 - 필터 탭 + 시군구 카드 모두 커버
  const getRegionName = (name) => {
    if (!name) return "";
    if (isKo) return name;
    // 필터 탭 (광역) 먼저 체크
    const region = regionTranslation[name];
    if (region) return isJa ? region.ja : region.en;
    // 시군구 (loc) 체크
    const loc = LOC_MAP[name];
    if (loc) return isJa ? loc.ja : loc.en;
    return name;
  };

  const generateIntro = (name) => {
    const intros = isKo ? [
      `${name} 매니저는 세련된 매너와 섬세한 감각을 갖춘 엘리트 멤버입니다.`,
      `철저한 자기관리로 완성된 비주얼을 자랑하는 ${name} 매니저를 소개합니다.`,
      `밝은 에너지와 배려심으로 편안한 시간을 약속드리는 ${name} 매니저입니다.`
    ] : isJa ? [
      `${name}マネージャーは、洗練されたマナーと繊細な感性を持つエリートメンバーです。`,
      `徹底した自己管理で完成されたビジュアルを誇る${name}マネージャーをご紹介します。`,
      `明るいエネルギーと思いやりで、心地よい時間をお約束する${name}マネージャーです。`
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

      {/* ===== 2. 매니저 그리드 (3D 틸트 효과) ===== */}
      <div style={m.grid}>
        {filteredMembers.map((member, idx) => (
          <TiltCard 
            key={idx} 
            index={idx}
            style={m.card} 
            onClick={() => {
              setSelectedMember(member);
              window.history.pushState({ isDetail: true }, ''); 
            }}
          >
            <div style={m.cardImgWrap}>
              {/* ★ 카드 썸네일 - 최적화 파라미터 자동 추가 */}
              <img 
                src={optimizeImage(member.img, { width: 400, crop: "fill" })} 
                style={m.cardImg} 
                alt={getMemberName(member)}
                loading="lazy"
              />
              <div style={m.cardOverlay} />
              <div style={m.cardBadge}>PREMIUM</div>
            </div>
            <div style={m.cardInfo}>
              <div style={m.cardName}>{getMemberName(member)}</div>
              <div style={m.cardSpecs}>
                {getRegionName(member.loc || member.region || tr("지역", "エリア", "LOC"))} · {member.age ? `${member.age}${tr('세', '歳', '')}` : tr('20대', '20代', '20s')}
              </div>
              <div style={{ ...m.cardSpecs, marginTop: '4px' }}>
                {member.height ? member.height + 'cm' : 'cm'} · {member.bust || member.size || "Size"}
              </div>
            </div>
          </TiltCard>
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
              <div style={m.luxTag}>✦ {tr("클릭하여 확대", "クリックで拡大", "CLICK TO ZOOM")}</div>
            </div>

            <div style={m.modalBody}>
              <h2 style={m.modalName}>{getMemberName(selectedMember)}</h2>
              
              <div style={m.specGrid}>
                <div style={m.specItem}>LOC<br/><b style={m.specVal}>{getRegionName(selectedMember.loc || selectedMember.region || tr("미정", "未定", "TBA"))}</b></div>
                <div style={m.specItem}>AGE<br/><b style={m.specVal}>{selectedMember.age ? `${selectedMember.age}${tr('세', '歳', '')}` : '20s'}</b></div>
                <div style={m.specItem}>HEIGHT<br/><b style={m.specVal}>{selectedMember.height ? selectedMember.height + 'cm' : 'cm'}</b></div>
                <div style={m.specItem}>WEIGHT<br/><b style={m.specVal}>{selectedMember.weight ? selectedMember.weight + 'kg' : 'kg'}</b></div>
                <div style={m.specItem}>SIZE<br/><b style={m.specVal}>{selectedMember.bust || selectedMember.size || "Size"}</b></div>
              </div>

              <div style={m.introBox}>
                <div style={m.introTitle}>INTRO</div>
                <p style={m.introText}>{getMemberDesc(selectedMember) || generateIntro(getMemberName(selectedMember))}</p>
              </div>

              {/* ★ 매니저 소개 영상 - 비디오 자동재생 대신 썸네일 이미지로 대체 */}
              {(selectedMember.video || isVideo(selectedMember.img)) && (
                <div style={m.videoArea} onClick={() => openFull('video', selectedMember.video || selectedMember.img)}>
                  <div style={m.introTitle}>PRIVATE MOVIE ({tr("클릭하여 확대", "クリックで拡大", "CLICK TO ENLARGE")})</div>
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
                      <div>{tr("전체화면 재생", "全画面再生", "TAP TO PLAY")}</div>
                    </div>
                  </div>
                </div>
              )}
              <button style={m.closeBtn} onClick={handleClose}>{tr("닫기", "閉じる", "CLOSE")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 4. 풀스크린 뷰어 (URL 최적화 적용) ===== */}
      {fullScreenMedia && (
        <div id="full-screen-view" style={m.fullScreenOverlay} onClick={() => setFullScreenMedia(null)}>
          <button style={m.fullScreenClose} onClick={() => setFullScreenMedia(null)}>✕ {tr("닫기", "閉じる", "CLOSE")}</button>
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