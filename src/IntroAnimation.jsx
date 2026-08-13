import { useEffect, useState } from "react";

/**
 * ★★★ BANADA 인트로 애니메이션 v3 - 프리미엄 시네마틱 ★★★
 * 
 * 4초 프리미엄 인트로:
 * [0.0초] 부드러운 그라디언트 배경 페이드인
 * [0.3초] 이중 화이트 라인 확장 (━━━━━━)
 * [1.0초] 로고 회전 페이드인 + shimmer 빛 스캔
 * [1.2초] 로고 뒤 회전 조명 링 시작
 * [1.5초] 3단계 파티클 레이어 활성화 (원거리~근거리)
 * [2.8초] 슬로건 글자 stagger 등장 (한 글자씩)
 * [3.5초] 페이드아웃 → 랜딩으로 자연스러운 전환
 * [4.0초] 완료
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

  // "시간이 멈추는 곳" 글자 배열 (stagger 등장용)
  const sloganChars = "시간이 멈추는 곳".split("");

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      // ★ 다층 그라디언트 배경 (부드러운 다크)
      background: `
        radial-gradient(ellipse at 20% 30%, rgba(45, 40, 50, 0.6) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 70%, rgba(50, 45, 55, 0.5) 0%, transparent 50%),
        radial-gradient(ellipse at center, #1a1a1e 0%, #0a0a0c 70%)
      `,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      overflow: 'hidden',
      opacity: stage >= 4 ? 0 : 1,
      transform: stage >= 4 ? 'translateY(-30px) scale(1.02)' : 'translateY(0) scale(1)',
      transition: 'opacity 0.6s cubic-bezier(0.19, 1, 0.22, 1), transform 0.6s cubic-bezier(0.19, 1, 0.22, 1)',
      pointerEvents: stage >= 4 ? 'none' : 'auto',
    }}>

      {/* ★ 부드러운 vignette (화면 가장자리 어둡게) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* ★ [레이어 1] 원거리 파티클 - 작고 느림 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: stage >= 2 ? 0.6 : 0,
        transition: 'opacity 1.2s ease',
        pointerEvents: 'none',
        zIndex: 2,
      }}>
        {[...Array(30)].map((_, i) => (
          <div key={`far-${i}`} style={{
            position: 'absolute',
            width: 1,
            height: 1,
            background: '#fff',
            borderRadius: '50%',
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            boxShadow: '0 0 3px rgba(255, 255, 255, 0.8)',
            animation: `farTwinkle ${4 + Math.random() * 6}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 4}s`,
          }} />
        ))}
      </div>

      {/* ★ [레이어 2] 중거리 눈송이 - 중간 크기 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: stage >= 2 ? 1 : 0,
        transition: 'opacity 1s ease',
        pointerEvents: 'none',
        zIndex: 3,
        overflow: 'hidden',
      }}>
        {[...Array(15)].map((_, i) => (
          <div key={`mid-${i}`} style={{
            position: 'absolute',
            width: 3,
            height: 3,
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '50%',
            top: '-10px',
            left: `${Math.random() * 100}%`,
            boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)',
            animation: `midSnowFall ${8 + Math.random() * 6}s linear infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }} />
        ))}
      </div>

      {/* ★ [레이어 3] 근거리 큰 눈송이 - 빠르고 큰 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: stage >= 2 ? 0.9 : 0,
        transition: 'opacity 1s ease',
        pointerEvents: 'none',
        zIndex: 4,
        overflow: 'hidden',
        filter: 'blur(0.5px)',
      }}>
        {[...Array(8)].map((_, i) => (
          <div key={`near-${i}`} style={{
            position: 'absolute',
            width: 5 + Math.random() * 3,
            height: 5 + Math.random() * 3,
            background: 'radial-gradient(circle, rgba(255, 255, 255, 1) 30%, transparent 70%)',
            borderRadius: '50%',
            top: '-15px',
            left: `${Math.random() * 100}%`,
            boxShadow: '0 0 15px rgba(255, 255, 255, 0.9), 0 0 30px rgba(255, 255, 255, 0.4)',
            animation: `nearSnowFall ${5 + Math.random() * 4}s linear infinite`,
            animationDelay: `${Math.random() * 3}s`,
          }} />
        ))}
      </div>

      {/* ★ 이중 확장 라인 (상단 얇은 + 하단 얇은) */}
      <div style={{
        position: 'absolute',
        top: 'calc(50% - 8px)',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: stage >= 1 && stage < 2 ? '55vw' : '0',
        maxWidth: 480,
        height: 1,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 50%, transparent 100%)',
        transition: 'width 0.9s cubic-bezier(0.19, 1, 0.22, 1)',
        boxShadow: stage >= 1 ? '0 0 20px rgba(255, 255, 255, 0.5)' : 'none',
        opacity: stage >= 2 ? 0 : 1,
        zIndex: 5,
      }} />
      <div style={{
        position: 'absolute',
        top: 'calc(50% + 8px)',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: stage >= 1 && stage < 2 ? '35vw' : '0',
        maxWidth: 300,
        height: 1,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
        transition: 'width 0.9s cubic-bezier(0.19, 1, 0.22, 1) 0.15s',
        opacity: stage >= 2 ? 0 : 1,
        zIndex: 5,
      }} />

      {/* ★ 로고 컨테이너 */}
      <div style={{
        position: 'relative',
        opacity: stage >= 2 ? 1 : 0,
        transform: stage >= 2 
          ? 'scale(1) rotate(0deg)' 
          : 'scale(0.4) rotate(-8deg)',
        transition: 'opacity 1.4s cubic-bezier(0.19, 1, 0.22, 1), transform 1.6s cubic-bezier(0.19, 1, 0.22, 1)',
        marginBottom: 50,
        zIndex: 10,
      }}>
        {/* 회전하는 조명 링 (로고 뒤) */}
        <div style={{
          position: 'absolute',
          inset: -50,
          borderRadius: '50%',
          background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.15) 20%, transparent 40%, transparent 60%, rgba(255,255,255,0.1) 80%, transparent 100%)',
          animation: stage >= 2 ? 'rotateRing 8s linear infinite' : 'none',
          opacity: stage >= 2 ? 1 : 0,
          transition: 'opacity 1.5s ease 0.5s',
          pointerEvents: 'none',
        }} />

        {/* 부드러운 발광 layer 1 */}
        <div style={{
          position: 'absolute',
          inset: -60,
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 60%)',
          borderRadius: '50%',
          animation: stage >= 2 ? 'introLogoGlow 3s ease-in-out infinite' : 'none',
          pointerEvents: 'none',
        }} />

        {/* 발광 layer 2 (더 넓게) */}
        <div style={{
          position: 'absolute',
          inset: -100,
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: stage >= 2 ? 'introLogoGlow 4s ease-in-out infinite reverse' : 'none',
          pointerEvents: 'none',
        }} />

        {/* 로고 이미지 (shimmer 효과 포함) */}
        <div style={{
          position: 'relative',
          width: 'min(280px, 45vw)',
          height: 'min(280px, 45vw)',
          borderRadius: '50%',
          overflow: 'hidden',
        }}>
          {logo ? (
            <img 
              src={logo} 
              alt="BANADA"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: '50%',
                filter: stage >= 2 
                  ? 'drop-shadow(0 0 30px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 60px rgba(255, 255, 255, 0.2)) drop-shadow(0 4px 12px rgba(0,0,0,0.4))' 
                  : 'none',
                animation: stage >= 2 ? 'introLogoBreathe 4s ease-in-out infinite' : 'none',
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: '"Cormorant Garamond", "Noto Serif KR", serif',
              fontSize: 'min(60px, 10vw)',
              fontWeight: 300,
              letterSpacing: '0.15em',
              color: '#fff',
              background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
              boxShadow: '0 0 60px rgba(255, 255, 255, 0.4), inset 0 0 30px rgba(255,255,255,0.1)',
            }}>
              BANADA
            </div>
          )}

          {/* Shimmer 효과 (빛이 로고 위를 스캔) */}
          {stage >= 2 && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
              animation: 'shimmerScan 3.5s ease-in-out infinite',
              animationDelay: '0.8s',
              pointerEvents: 'none',
              mixBlendMode: 'overlay',
            }} />
          )}
        </div>
      </div>

      {/* ★ 슬로건 with 양옆 라인 + 글자 stagger 등장 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        marginBottom: 14,
        zIndex: 10,
      }}>
        <div style={{
          width: stage >= 3 ? 50 : 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8))',
          transition: 'width 1s cubic-bezier(0.19, 1, 0.22, 1) 0.1s',
        }} />
        <div style={{
          fontFamily: '"Cormorant Garamond", "Noto Serif KR", serif',
          fontWeight: 300,
          fontSize: 'min(20px, 4.5vw)',
          letterSpacing: '0.4em',
          color: '#fff',
          textTransform: 'uppercase',
          textShadow: '0 0 25px rgba(255, 255, 255, 0.4), 0 2px 12px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
          display: 'flex',
          gap: '0.05em',
        }}>
          {sloganChars.map((char, idx) => (
            <span 
              key={idx}
              style={{
                opacity: stage >= 3 ? 1 : 0,
                transform: stage >= 3 ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.6s ease ${idx * 0.08 + 0.3}s, transform 0.7s cubic-bezier(0.19, 1, 0.22, 1) ${idx * 0.08 + 0.3}s`,
                display: 'inline-block',
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </div>
        <div style={{
          width: stage >= 3 ? 50 : 0,
          height: 1,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.8), transparent)',
          transition: 'width 1s cubic-bezier(0.19, 1, 0.22, 1) 0.1s',
        }} />
      </div>

      {/* ★ 영문 슬로건 (얇은 라인 위) */}
      <div style={{
        width: stage >= 3 ? 80 : 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
        transition: 'width 1s ease 0.6s',
        marginBottom: 12,
        zIndex: 10,
      }} />
      
      <div style={{
        fontFamily: 'Italiana, serif',
        fontSize: 'min(11px, 2.5vw)',
        letterSpacing: '0.6em',
        color: 'rgba(255,255,255,0.55)',
        opacity: stage >= 3 ? 1 : 0,
        transform: stage >= 3 ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 1s ease 0.9s, transform 1s cubic-bezier(0.19, 1, 0.22, 1) 0.9s',
        textTransform: 'uppercase',
        textShadow: '0 0 15px rgba(255,255,255,0.2)',
        zIndex: 10,
      }}>
        Where Time Slows
      </div>

      {/* ★ CSS 애니메이션 */}
      <style>{`
        /* 원거리 별 반짝임 */
        @keyframes farTwinkle {
          0%, 100% { 
            opacity: 0.2; 
            transform: scale(1);
          }
          50% { 
            opacity: 1; 
            transform: scale(1.5); 
          }
        }

        /* 중거리 눈송이 낙하 */
        @keyframes midSnowFall {
          0% {
            transform: translateY(0) translateX(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.9;
          }
          90% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(110vh) translateX(30px) rotate(360deg);
            opacity: 0;
          }
        }

        /* 근거리 큰 눈송이 낙하 */
        @keyframes nearSnowFall {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) translateX(-20px);
            opacity: 0;
          }
        }

        /* 로고 은은한 발광 맥동 */
        @keyframes introLogoGlow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.8;
          }
        }

        /* 로고 심장 박동 */
        @keyframes introLogoBreathe {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.04);
            opacity: 0.95;
          }
        }

        /* 조명 링 회전 */
        @keyframes rotateRing {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Shimmer 빛 스캔 */
        @keyframes shimmerScan {
          0% { left: -100%; }
          100% { left: 200%; }
        }
      `}</style>
    </div>
  );
}