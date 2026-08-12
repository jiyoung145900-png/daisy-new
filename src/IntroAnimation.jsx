import { useEffect, useState } from "react";

/**
 * ★★★ BANADA 인트로 애니메이션 (v2 - 부드러운 화이트 감성) ★★★
 * 
 * 4초 시네마틱 인트로 (랜딩페이지 톤과 통일)
 * [0.0초] 어두운 그라디언트 배경
 * [0.3초] 부드러운 화이트 라인 확장 (━━━━━━)
 * [1.0초] 로고 페이드인 + 심장 박동
 * [1.5초] 눈송이 파티클 낙하 시작 ❄️
 * [2.8초] "시간이 멈추는 곳" 슬로건 (양옆 화이트 라인)
 * [3.5초] 페이드아웃 → 랜딩으로 자연스럽게 전환
 * [4.0초] 완료
 * 
 * @param {string} logo - CMS에서 관리하는 로고 URL
 * @param {function} onComplete - 인트로 완료 시 콜백
 */
export default function IntroAnimation({ logo, onComplete }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 300),
      setTimeout(() => setStage(2), 1000),
      setTimeout(() => setStage(3), 2800),
      setTimeout(() => setStage(4), 3500),
      setTimeout(() => {
        setStage(5);
        onComplete && onComplete();
      }, 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  if (stage === 5) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      // ★ [수정] 부드러운 다크 그라디언트 (완전 검정 X)
      background: 'radial-gradient(ellipse at center, #1a1a1a 0%, #0a0a0a 70%)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      overflow: 'hidden',
      opacity: stage >= 4 ? 0 : 1,
      transform: stage >= 4 ? 'translateY(-20px)' : 'translateY(0)',
      transition: 'opacity 0.5s ease-out, transform 0.5s ease-out',
      pointerEvents: stage >= 4 ? 'none' : 'auto',
    }}>

      {/* ★ 눈송이 파티클 (랜딩과 같은 스타일) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: stage >= 2 ? 1 : 0,
        transition: 'opacity 1s ease',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}>
        {[...Array(25)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: Math.random() > 0.6 ? 4 : 2,
            height: Math.random() > 0.6 ? 4 : 2,
            background: '#fff',
            borderRadius: '50%',
            top: '-10px',
            left: `${Math.random() * 100}%`,
            boxShadow: '0 0 8px rgba(255, 255, 255, 0.9), 0 0 15px rgba(255, 255, 255, 0.4)',
            animation: `introSnowFall ${6 + Math.random() * 8}s linear infinite`,
            animationDelay: `${Math.random() * 4}s`,
            opacity: 0.8,
          }} />
        ))}
      </div>

      {/* ★ 부드러운 화이트 라인 (중앙에서 확장) */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: stage >= 1 && stage < 2 ? '60vw' : (stage >= 2 ? '0' : '0'),
        maxWidth: 500,
        height: 1,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 50%, transparent 100%)',
        transition: 'width 0.8s cubic-bezier(0.19, 1, 0.22, 1)',
        boxShadow: stage >= 1 ? '0 0 20px rgba(255, 255, 255, 0.5)' : 'none',
        opacity: stage >= 2 ? 0 : 1,
      }} />

      {/* ★ 로고 (부드러운 화이트 발광 + 심장 박동) */}
      <div style={{
        position: 'relative',
        opacity: stage >= 2 ? 1 : 0,
        transform: stage >= 2 
          ? 'scale(1) rotate(0deg)' 
          : 'scale(0.5) rotate(-5deg)',
        transition: 'opacity 1.2s cubic-bezier(0.19, 1, 0.22, 1), transform 1.5s cubic-bezier(0.19, 1, 0.22, 1)',
        marginBottom: 45,
      }}>
        {/* 부드러운 발광 효과 */}
        <div style={{
          position: 'absolute',
          inset: -40,
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.25) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: stage >= 2 ? 'introLogoGlow 3s ease-in-out infinite' : 'none',
          pointerEvents: 'none',
        }} />

        {/* 로고 이미지 */}
        {logo ? (
          <img 
            src={logo} 
            alt="BANADA"
            style={{
              width: 'min(280px, 45vw)',
              height: 'min(280px, 45vw)',
              objectFit: 'contain',
              borderRadius: '50%',
              // ★ [수정] 부드러운 화이트 발광 (로즈골드 대신)
              filter: stage >= 2 
                ? 'drop-shadow(0 0 30px rgba(255, 255, 255, 0.5)) drop-shadow(0 4px 12px rgba(0,0,0,0.4))' 
                : 'none',
              animation: stage >= 2 ? 'introLogoBreathe 4s ease-in-out infinite' : 'none',
            }}
          />
        ) : (
          <div style={{
            width: 'min(280px, 45vw)',
            height: 'min(280px, 45vw)',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Cormorant Garamond", "Noto Serif KR", serif',
            fontSize: 'min(60px, 10vw)',
            fontWeight: 300,
            letterSpacing: '0.15em',
            color: '#fff',
            background: 'radial-gradient(circle, #1a1a1a 0%, #000 100%)',
            boxShadow: '0 0 60px rgba(255, 255, 255, 0.3)',
          }}>
            BANADA
          </div>
        )}
      </div>

      {/* ★ 슬로건 with 양옆 화이트 라인 (랜딩과 통일!) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 15,
        opacity: stage >= 3 ? 1 : 0,
        transform: stage >= 3 ? 'translateY(0)' : 'translateY(15px)',
        transition: 'opacity 0.8s ease, transform 0.8s ease',
        marginBottom: 12,
      }}>
        <div style={{
          width: stage >= 3 ? 40 : 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7))',
          transition: 'width 0.8s ease 0.2s',
        }} />
        <div style={{
          fontFamily: '"Cormorant Garamond", "Noto Serif KR", serif',
          fontWeight: 300,
          fontSize: 'min(20px, 4.5vw)',
          letterSpacing: '0.4em',
          color: '#fff',
          textTransform: 'uppercase',
          textShadow: '0 0 20px rgba(255, 255, 255, 0.3), 0 2px 8px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
        }}>
          시간이 멈추는 곳
        </div>
        <div style={{
          width: stage >= 3 ? 40 : 0,
          height: 1,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.7), transparent)',
          transition: 'width 0.8s ease 0.2s',
        }} />
      </div>

      {/* ★ 영문 슬로건 (은은하게) */}
      <div style={{
        fontFamily: 'Italiana, serif',
        fontSize: 'min(11px, 2.5vw)',
        letterSpacing: '0.5em',
        color: 'rgba(255,255,255,0.5)',
        opacity: stage >= 3 ? 1 : 0,
        transition: 'opacity 1s ease 0.5s',
        textTransform: 'uppercase',
      }}>
        Where Time Slows
      </div>

      {/* ★ 애니메이션 CSS */}
      <style>{`
        /* 눈송이 낙하 (랜딩과 동일한 애니메이션) */
        @keyframes introSnowFall {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          90% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(110vh) translateX(30px);
            opacity: 0;
          }
        }

        /* 로고 은은한 발광 */
        @keyframes introLogoGlow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.7;
          }
        }

        /* 로고 심장 박동 (랜딩과 통일) */
        @keyframes introLogoBreathe {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.03);
            opacity: 0.95;
          }
        }
      `}</style>
    </div>
  );
}