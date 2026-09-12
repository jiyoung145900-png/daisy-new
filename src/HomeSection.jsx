import React, { useState, useEffect, useMemo, useRef } from "react";

const LEFT_TAGS = ["BANADA VIP", "PURE LUXURY", "SWEET BLOOM", "GOLDEN CLASS", "ELITE SELECT"];

// ★ 지역명 번역 매핑 (ManagerSection과 동일)
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

export default function HomeSection({
  members = [],
  slideImages = [],
  innerLogo,
  topAdImage,
  topAdImage2,
  handleTelegram,
  setActiveTab,
  openDetail,
  matchingCount = 0,
  noticeText = "",
  t,
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!slideImages || slideImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((p) => (p + 1) % slideImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slideImages]);

  // ★ [수정] 무한 캐러셀용: 정확히 2배 복제 (translateX(-50%)로 완벽 무한 루프)
  const loopMembers = useMemo(() => {
    if (!members || members.length === 0) return [];
    return [...members, ...members];
  }, [members]);

  // ★ 언어 헬퍼
  const isKo = t.home === "홈페이지";
  const isJa = t.home === "ホーム";
  const tr = (ko, ja, en) => isKo ? ko : isJa ? ja : en;
  
  const getMemberName = (member) => {
    if (!member) return "";
    if (isJa) return member.name_ja || member.name;
    if (!isKo) return member.name_en || member.name;
    return member.name_ko || member.name;
  };
  
  const getLocName = (loc) => {
    if (!loc) return "";
    if (isKo) return loc;
    const mapped = LOC_MAP[loc];
    if (!mapped) return loc;
    return isJa ? mapped.ja : mapped.en;
  };

  const scrollByButton = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 300; 
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleMouseDown = (e) => {
    const slider = scrollRef.current;
    if (!slider) return;
    let isDown = true;
    let startX = e.pageX - slider.offsetLeft;
    let scrollLeft = slider.scrollLeft;

    const handleMouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 2;
      slider.scrollLeft = scrollLeft - walk;
    };

    const handleMouseUp = () => {
      isDown = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div style={h.container}>
      {/* ===== BACKGROUND ===== */}
      <div className="bg-glow" />
      <div className="bg-pattern" />

      {/* ===== HEADER ===== */}
      <header style={h.header}>
        <div style={h.logoArea}>
          {innerLogo ? (
            <img src={innerLogo} style={h.logoImg} alt="logo" />
          ) : (
            <h1 style={h.defaultLogo}>
              BANADA<br />
              <span>LOUNGE</span>
            </h1>
          )}
        </div>

        {/* ===== ★ LIVE CONNECTED 배지 (로고 바로 밑) ===== */}
        <div style={h.statusBadge}>
          <div className="dot-pulse-wrap">
            <span className="dot-pulse" />
          </div>
          <span style={{ opacity: 0.8 }}>LIVE CONNECTED :</span>
          <b style={h.countText}>{matchingCount} MEMBERS</b>
        </div>
      </header>

      {/* ===== ★ INTRO TEXT (LIVE CONNECTED 밑) ===== */}
      <div style={h.introTextArea}>
        <div style={h.introSub}>WELCOME TO THE PRIVATE</div>
        <div style={h.introMain}>
          {t.welcome.replace("📢 ", "")} 
          <span style={h.introSparkle}>✦</span>
        </div>
      </div>

      {/* ===== ★ [이동] 슬라이드 (WELCOME 문구 아래로) ===== */}
      {slideImages && slideImages.length > 0 && (
        <div style={{ ...h.sliderContainer, marginTop: 10, marginBottom: 22 }}>
          <div style={h.sliderWrap}>
            {slideImages.map((img, idx) => {
              const imgUrl = img.url || img;
              const active = idx === currentSlide;
              return (
                <div
                  key={idx}
                  style={{
                    ...h.slide,
                    opacity: active ? 1 : 0,
                    visibility: active ? "visible" : "hidden",
                  }}
                >
                  <div style={h.imageBorderWrapper}>
                    <img src={imgUrl} style={h.actualImg} alt="slide" draggable="false" />
                    <div style={h.slideOverlay} />
                    <div style={h.adTag}>PREMIUM PICK</div>
                  </div>
                </div>
              );
            })}
            <div style={h.indicatorWrap}>
              {slideImages.map((_, i) => (
                <div
                  key={i}
                  style={{
                    ...h.dot,
                    width: i === currentSlide ? 20 : 6,
                    backgroundColor: i === currentSlide ? "#FFD700" : "rgba(255,255,255,0.3)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== ★ [이동] 광고 1 (슬라이드 밑) ===== */}
      {topAdImage && (
        <div style={h.topAdWrap}>
          <img src={topAdImage} style={h.topAdImg} alt="ad" draggable="false" />
        </div>
      )}

      {/* ===== ★ [이동] 광고 2 (광고 1 밑) ===== */}
      {topAdImage2 && (
        <div style={h.topAdWrap}>
          <img src={topAdImage2} style={h.topAdImg} alt="ad2" draggable="false" />
        </div>
      )}

      {/* ===== 매니저 섹션 라벨 ===== */}
      <div style={h.sectionLabel}>
        <div style={h.labelLeft}>
          <span style={h.labelIcon}>✦</span>
          <span style={h.labelText}>
            BANADA {t.manager.toUpperCase()}
          </span>
        </div>
        <div onClick={() => setActiveTab && setActiveTab("manager")} style={h.moreBtn}>
          VIEW ALL ❯
        </div>
      </div>

      {/* ===== 매니저 카드 리스트 - ★★ 무한 자동 캐러셀 ★★ ===== */}
      {/*
        ★ [신규] 안전한 CSS 애니메이션 기반 무한 슬라이드
        - React state 없음 (리렌더 X, 안정적)
        - CSS transform + GPU 가속 (부드러움)
        - Hover 시 자동 pause (사진 자세히 보기)
        - 매니저 수에 따라 속도 자동 조정
        - 예전 오류 원인들 완전 회피
      */}
      {members && members.length > 0 && (
        <div className="infinite-carousel-container">
          <div 
            className="infinite-carousel-track"
            style={{
              // ★ 매니저 수에 따라 duration 자동 조정 (한 명당 약 3.5초)
              animationDuration: `${Math.max(20, members.length * 3.5)}s`
            }}
          >
            {loopMembers.map((m, i) => (
              <div 
                key={`carousel-${m.id || 'noid'}-${i}`}
                style={h.card} 
                onClick={() => openDetail && openDetail(m)}
              >
                <div style={h.cardImgWrap}>
                  <img src={m.img} style={h.cardImg} alt={getMemberName(m) || "member"} draggable="false" />
                  <div style={h.cardOverlay} />
                  <div style={h.cardBadge}>
                    {LEFT_TAGS[i % LEFT_TAGS.length]}
                  </div>
                </div>
                
                <div style={h.cardInfo}>
                  <div style={h.cardName}>{getMemberName(m)}</div>
                  
                  <div style={h.cardSpecs}>
                    <span style={h.specText}>
                      {getLocName(m.loc || m.region) || tr("지역", "エリア", "Area")}
                    </span>
                    <span style={h.specDivider}>·</span>
                    <span style={h.specText}>
                      {m.age ? `${m.age}${tr('세', '歳', '')}` : tr('20대', '20代', '20s')}
                    </span>
                  </div>
                  
                  <div style={{ ...h.cardSpecs, marginTop: '5px' }}>
                    <span style={h.specText}>{m.height ? m.height + 'cm' : 'cm'}</span>
                    <span style={h.specDivider}>·</span>
                    <span style={h.specText}>{m.weight ? m.weight + 'kg' : 'kg'}</span>
                    <span style={h.specDivider}>·</span>
                    <span style={h.specText}>{m.bust || m.size || "Size"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div style={h.footerBtnArea}>
        <button onClick={handleTelegram} className="shimmer-btn" style={h.teleBtn}>
          💬 {t.home === "홈페이지" ? "실시간 상담 연결하기" : t.home === "ホーム" ? "リアルタイム相談を接続" : "Connect Real-time Chat"}
        </button>
        <p style={h.footerNotice}>24/7 PRIVATE CONCIERGE SERVICE</p>
      </div>

      <style>{`
        .bg-pattern { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,215,0,0.05) 1px, transparent 1px); background-size: 30px 30px; z-index: -1; }
        .bg-glow { position: absolute; top: -100px; left: 50%; transform: translateX(-50%); width: 150%; height: 600px; background: radial-gradient(circle, rgba(255,215,0,0.07) 0%, transparent 70%); z-index: -1; }

        .notice-track { display: flex; width: max-content; white-space: nowrap; animation: noticeScroll 18s linear infinite; }
        @keyframes noticeScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        
        .snap-container::-webkit-scrollbar { display: none; }
        
        .pc-arrows-wrap { position: absolute; top: 40%; left: 0; right: 0; display: flex; justify-content: space-between; pointer-events: none; padding: 0 5px; z-index: 100; }
        .arrow-btn { width: 40px; height: 40px; border-radius: 50%; background: #FFD700; color: #000; border: 2px solid #fff; font-size: 18px; font-weight: bold; cursor: pointer; pointer-events: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; transition: 0.2s; opacity: 0.9; }
        .arrow-btn:hover { background: #fff; transform: scale(1.1); }
        @media (max-width: 768px) { .pc-arrows-wrap { display: none; } }

        .dot-pulse-wrap { width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; margin-right: 5px; }
        .dot-pulse { width: 6px; height: 6px; background: #00ff00; border-radius: 50%; box-shadow: 0 0 10px #00ff00; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }
        .shine-text { animation: textShine 2s infinite alternate; }
        @keyframes textShine { from { opacity: .5; text-shadow: none; } to { opacity: 1; text-shadow: 0 0 10px #FFD700; } }
        .shimmer-btn { position: relative; overflow: hidden; outline: none; border: none; }
        .shimmer-btn::after { content: ''; position: absolute; top: -50%; left: -100%; width: 200%; height: 200%; background: linear-gradient(45deg, transparent, rgba(255,255,255,0.2), transparent); transform: rotate(45deg); animation: shimmer 3s infinite; }
        @keyframes shimmer { 0% { left: -100%; } 100% { left: 100%; } }

        /* ★★★ 무한 자동 캐러셀 스타일 (매니저 카드) ★★★ */
        .infinite-carousel-container {
          width: 100%;
          overflow: hidden;
          padding: 10px 0 40px;
          box-sizing: border-box;
          position: relative;
          /* 좌우 페이드 효과 (자연스러운 흘러감) */
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
          mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
        }

        .infinite-carousel-track {
          display: flex;
          width: max-content;
          animation-name: scrollLeftInfinite;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
          padding-left: 20px;
        }

        /* Hover 시 자동 pause */
        .infinite-carousel-track:hover {
          animation-play-state: paused;
        }

        @keyframes scrollLeftInfinite {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        /* 모바일에서 hover 대신 활성 스타일 */
        @media (hover: none) {
          .infinite-carousel-track {
            /* 모바일: 터치 시 pause (선택적, animation-play-state는 CSS만으로 어려움) */
          }
        }

        /* 접근성: 모션 줄이기 설정한 사용자 배려 */
        @media (prefers-reduced-motion: reduce) {
          .infinite-carousel-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

const h = {
  container: { position: 'relative', overflow: 'hidden', backgroundColor: '#0a0a0a', paddingBottom: 20, minHeight: '100vh', color: '#fff' },
  header: { padding: '4px 0 10px', textAlign: 'center' },
  logoArea: { marginBottom: 10 },
  logoImg: { maxWidth: '350px', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.3))' },
  topAdWrap: { padding: '0 12px', marginBottom: 22, display: 'flex', justifyContent: 'center' },
  topAdImg: { width: '100%', height: 'auto', display: 'block', borderRadius: '14px', border: '1px solid rgba(255,215,0,0.35)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' },
  defaultLogo: { fontSize: 36, color: '#fff', fontWeight: 900, letterSpacing: -1, lineHeight: 0.8 },
  statusBadge: { fontSize: 10, color: '#eee', background: 'rgba(255,255,255,0.07)', padding: '8px 16px', borderRadius: '30px', display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(255,255,255,0.1)' },
  countText: { color: '#FFD700', letterSpacing: 1 },
  noticeTicker: { width: '100%', overflow: 'hidden', background: 'rgba(255,215,0,0.06)', borderTop: '1px solid rgba(255,215,0,0.15)', borderBottom: '1px solid rgba(255,215,0,0.15)', padding: '10px 0', marginTop: 18 },
  noticeText: { fontSize: 12, fontWeight: 700, color: '#FFD700', letterSpacing: 0.5, paddingRight: 60 },
  introTextArea: { textAlign: 'center', marginTop: 30, marginBottom: 15 },
  introSub: { fontSize: 10, color: '#FFD700', letterSpacing: 2, fontWeight: 600, opacity: 0.8, marginBottom: 5 },
  introMain: { fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.5 },
  introSparkle: { color: '#FFD700', marginLeft: 5, fontSize: 14 },
  welcomeBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 15, margin: '35px 0' },
  welcomeLine: { width: 30, height: 1, background: 'linear-gradient(90deg, transparent, #FFD700, transparent)' },
  welcomeText: { color: '#bbb', fontSize: 13, fontWeight: 300, letterSpacing: 0.5, textAlign: 'center' },
  sliderContainer: { padding: '0 20px' },
  sliderWrap: { width: '100%', height: '260px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  slide: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 1s ease-in-out' },
  imageBorderWrapper: { position: 'relative', display: 'inline-flex', borderRadius: '15px', border: '1.5px solid rgba(255,215,0,0.5)', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.9)', zIndex: 2, maxWidth: '100%', maxHeight: '240px' },
  actualImg: { display: 'block', maxWidth: '100%', maxHeight: '240px', width: 'auto', height: 'auto', objectFit: 'contain' },
  slideOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.7) 100%)', zIndex: 3 },
  adTag: { position: 'absolute', top: 12, left: 12, background: 'linear-gradient(135deg, #FFD700, #B8860B)', color: '#000', fontSize: 9, fontWeight: 900, padding: '4px 8px', borderRadius: 4, zIndex: 4 },
  indicatorWrap: { position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 5 },
  dot: { height: 6, borderRadius: 3, transition: 'all 0.3s' },
  sectionLabel: { padding: '40px 24px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  labelLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  labelIcon: { color: '#FFD700', fontSize: 18 },
  labelText: { color: '#fff', fontSize: 17, fontWeight: 800 },
  moreBtn: { fontSize: 11, color: '#FFD700', opacity: 0.8, cursor: 'pointer' },

  scrollArea: { 
    display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', overflowX: 'auto', 
    scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', 
    padding: '10px 20px 40px', width: '100%', boxSizing: 'border-box',
    scrollbarWidth: 'none', msOverflowStyle: 'none'
  },
  card: { 
    width: '210px', minWidth: '210px', flexShrink: 0, background: '#1a1a1a', 
    borderRadius: '20px', overflow: 'hidden', border: '1px solid #333', 
    boxShadow: '0 10px 25px rgba(0,0,0,0.6)', scrollSnapAlign: 'center', 
    marginRight: '15px', cursor: 'pointer'
  },
  cardImgWrap: { position: 'relative', height: '280px' },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, #1a1a1a 100%)' },
  cardBadge: { position: 'absolute', top: 12, right: 12, background: 'rgba(255,215,0,0.9)', color: '#000', fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 6 },
  
  cardInfo: { padding: '15px 10px 22px', textAlign: 'center' },
  cardName: { color: '#fff', fontSize: '20px', fontWeight: 900, marginBottom: 8, letterSpacing: '-0.5px' },
  
  cardSpecs: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 },
  specText: { fontSize: '13px', color: '#bbb', fontWeight: 400 },
  specDivider: { fontSize: '12px', color: '#555' },

  footerBtnArea: { 
    padding: '20px 24px 12px',
    textAlign: 'center',
  },
  teleBtn: { width: '100%', padding: '16px', borderRadius: '12px', background: 'linear-gradient(135deg, #0088cc, #005588)', color: '#fff', fontSize: '15px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  footerNotice: { fontSize: 10, color: '#444', marginTop: 6, letterSpacing: 2 }
};