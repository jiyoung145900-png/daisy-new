import { useEffect, useState } from "react";

/**
 * ★★★ BANADA 웰컴 애니메이션 ★★★
 * 
 * 로그인 성공 후 1.5초 개인화 웰컴 화면
 * [0.0초] 다크 배경 페이드인 + 눈송이 시작
 * [0.2초] "Welcome" 라인 확장 + 텍스트 등장
 * [0.6초] 회원 아이디 등장 (크게, stagger)
 * [0.9초] 시간대별 인사말 페이드인
 * [1.2초] 페이드아웃 시작
 * [1.5초] 완료 → Dashboard 진입
 */
export default function WelcomeAnimation({ user, onComplete }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // ★ [수정] 2.5초로 확장 - 감성 충분히 느낄 수 있게 여유있는 타이밍
    const timers = [
      setTimeout(() => setStage(1), 400),    // Welcome 라인 (조금 늦게)
      setTimeout(() => setStage(2), 1000),    // 아이디 등장
      setTimeout(() => setStage(3), 1700),   // 시간대별 인사말
      setTimeout(() => setStage(4), 2500),   // 페이드아웃 시작 (400ms 감상 시간)
      setTimeout(() => {
        setStage(5);
        onComplete && onComplete();
      }, 2500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  if (stage === 5) return null;

  // 시간대별 인사말
  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 6) {
      return { korean: "시간이 멈춘 새벽입니다", english: "In the Silent Dawn" };
    } else if (hour >= 6 && hour < 12) {
      return { korean: "우아한 아침이 시작됩니다", english: "An Elegant Morning Begins" };
    } else if (hour >= 12 && hour < 18) {
      return { korean: "특별한 오후를 준비했어요", english: "A Special Afternoon Awaits" };
    } else if (hour >= 18 && hour < 22) {
      return { korean: "감성적인 저녁이네요", english: "An Enchanting Evening" };
    } else {
      return { korean: "시간이 멈추는 밤입니다", english: "Where Time Stops Tonight" };
    }
  };

  const greeting = getTimeGreeting();
  const userName = user?.id || "Guest";
  const userNameChars = userName.split("");

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: `
        radial-gradient(ellipse at 20% 30%, rgba(45, 40, 50, 0.6) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 70%, rgba(50, 45, 55, 0.5) 0%, transparent 50%),
        radial-gradient(ellipse at center, #1a1a1e 0%, #0a0a0c 70%)
      `,
      zIndex: 99998,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      overflow: 'hidden',
      opacity: stage >= 4 ? 0 : 1,
      transform: stage >= 4 ? 'scale(1.05)' : 'scale(1)',
      transition: 'opacity 0.4s cubic-bezier(0.19, 1, 0.22, 1), transform 0.4s cubic-bezier(0.19, 1, 0.22, 1)',
      pointerEvents: stage >= 4 ? 'none' : 'auto',
    }}>

      {/* Vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* 눈송이 파티클 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'hidden',
      }}>
        {[...Array(12)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: Math.random() > 0.5 ? 3 : 2,
            height: Math.random() > 0.5 ? 3 : 2,
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '50%',
            top: '-10px',
            left: `${Math.random() * 100}%`,
            boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)',
            animation: `welcomeSnow ${5 + Math.random() * 4}s linear infinite`,
            animationDelay: `${Math.random() * 3}s`,
            opacity: 0.7,
          }} />
        ))}
      </div>

      {/* 발광 링 */}
      <div style={{
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%)',
        animation: 'welcomeGlow 3s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 3,
      }} />

      {/* Welcome 상단 라인 + 텍스트 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        marginBottom: 30,
        zIndex: 10,
      }}>
        <div style={{
          width: stage >= 1 ? 40 : 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7))',
          transition: 'width 0.8s cubic-bezier(0.19, 1, 0.22, 1)',
        }} />
        <div style={{
          fontFamily: '"Cormorant Garamond", "Noto Serif KR", serif',
          fontWeight: 300,
          fontSize: 'min(18px, 4vw)',
          letterSpacing: '0.4em',
          color: 'rgba(255,255,255,0.9)',
          textTransform: 'uppercase',
          textShadow: '0 0 15px rgba(255, 255, 255, 0.4)',
          opacity: stage >= 1 ? 1 : 0,
          transform: stage >= 1 ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.19, 1, 0.22, 1)',
        }}>
          Welcome
        </div>
        <div style={{
          width: stage >= 1 ? 40 : 0,
          height: 1,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.7), transparent)',
          transition: 'width 0.8s cubic-bezier(0.19, 1, 0.22, 1)',
        }} />
      </div>

      {/* 회원 아이디 (크게, stagger 등장) */}
      <div style={{
        fontFamily: '"Cormorant Garamond", "Noto Serif KR", serif',
        fontWeight: 400,
        fontSize: 'min(48px, 10vw)',
        color: '#fff',
        letterSpacing: '0.05em',
        marginBottom: 24,
        display: 'flex',
        gap: '0.02em',
        textShadow: '0 0 40px rgba(255, 255, 255, 0.4), 0 4px 20px rgba(0,0,0,0.5)',
        zIndex: 10,
      }}>
        {userNameChars.map((char, idx) => (
          <span 
            key={idx}
            style={{
              opacity: stage >= 2 ? 1 : 0,
              transform: stage >= 2 ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
              transition: `opacity 0.5s ease ${idx * 0.05 + 0.1}s, transform 0.6s cubic-bezier(0.19, 1, 0.22, 1) ${idx * 0.05 + 0.1}s`,
              display: 'inline-block',
              filter: stage >= 2 ? 'blur(0)' : 'blur(4px)',
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </div>

      {/* 얇은 구분선 */}
      <div style={{
        width: stage >= 3 ? 60 : 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
        transition: 'width 0.8s ease',
        marginBottom: 16,
        zIndex: 10,
      }} />

      {/* 시간대별 한국어 인사말 */}
      <div style={{
        fontFamily: '"Cormorant Garamond", "Noto Serif KR", serif',
        fontWeight: 300,
        fontSize: 'min(16px, 3.8vw)',
        letterSpacing: '0.2em',
        color: 'rgba(255,255,255,0.85)',
        opacity: stage >= 3 ? 1 : 0,
        transform: stage >= 3 ? 'translateY(0)' : 'translateY(15px)',
        transition: 'opacity 0.7s ease, transform 0.7s cubic-bezier(0.19, 1, 0.22, 1)',
        textShadow: '0 0 15px rgba(255, 255, 255, 0.3)',
        marginBottom: 8,
        zIndex: 10,
        textAlign: 'center',
      }}>
        {greeting.korean}
      </div>

      {/* 영문 인사말 */}
      <div style={{
        fontFamily: 'Italiana, serif',
        fontSize: 'min(11px, 2.5vw)',
        letterSpacing: '0.4em',
        color: 'rgba(255,255,255,0.5)',
        opacity: stage >= 3 ? 1 : 0,
        transition: 'opacity 0.8s ease 0.3s',
        textTransform: 'uppercase',
        zIndex: 10,
      }}>
        {greeting.english}
      </div>

      {/* CSS 애니메이션 */}
      <style>{`
        @keyframes welcomeSnow {
          0% {
            transform: translateY(0) translateX(0) rotate(0deg);
            opacity: 0;
          }
          10% { opacity: 0.7; }
          90% { opacity: 0.7; }
          100% {
            transform: translateY(110vh) translateX(20px) rotate(180deg);
            opacity: 0;
          }
        }
        @keyframes welcomeGlow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
}