// ============================================================
// 🔥 Firestore users 컬렉션에서 IP/위치 데이터 일괄 삭제 스크립트
// ============================================================
// 
// 사용법:
//   1. 이 파일을 daisy-new-main 폴더 루트에 저장
//   2. cd C:\Users\Administrator\Desktop\daisy-new-main
//   3. node delete-ip-data.mjs
//
// 지우는 필드:
//   - signupIp        (가입 시 IP)
//   - currentIp       (현재 IP)
//   - currentCountry, currentCountryCode
//   - currentRegion, currentCity
//   - currentUA       (User Agent)
//   - loginHistory    (로그인 이력 배열)
//
// ⚠️ 주의:
//   - 되돌릴 수 없음! 실행 전 5초 대기
//   - Ctrl+C로 취소 가능
// ============================================================

import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteField 
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// ✅ daisy-club 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyC9iOPeIpzeBP-Y1fP-Tmqvo6ynjcR_nSI",
  authDomain: "daisy-club.firebaseapp.com",
  projectId: "daisy-club",
  storageBucket: "daisy-club.firebasestorage.app",
  messagingSenderId: "1074568055038",
  appId: "1:1074568055038:web:6723e1fd3b9d2cd435bdaf",
  measurementId: "G-TH9WM3YXGJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function deleteAllIpData() {
  console.log("🚀 시작: users 컬렉션에서 IP/위치 데이터 삭제");
  console.log("=" .repeat(60));
  
  try {
    // 0. 익명 로그인 (보안 규칙 통과용)
    console.log("🔐 익명 인증 중...");
    await signInAnonymously(auth);
    console.log("✅ 인증 완료");
    console.log("");
    
    // 1. 모든 users 문서 가져오기
    console.log("📥 유저 목록 조회 중...");
    const usersSnapshot = await getDocs(collection(db, "users"));
    const total = usersSnapshot.size;
    console.log(`📊 총 유저 수: ${total}명`);
    console.log("");
    
    if (total === 0) {
      console.log("⚠️ 유저가 없습니다.");
      process.exit(0);
      return;
    }
    
    // 2. 각 유저의 IP 관련 필드 삭제
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      processed++;
      const data = userDoc.data();
      const userId = userDoc.id;
      
      // IP 관련 필드가 하나라도 있는지 확인
      const hasIpData = 
        data.signupIp !== undefined ||
        data.currentIp !== undefined ||
        data.currentCountry !== undefined ||
        data.currentCountryCode !== undefined ||
        data.currentRegion !== undefined ||
        data.currentCity !== undefined ||
        data.currentUA !== undefined ||
        data.loginHistory !== undefined;
      
      if (!hasIpData) {
        skipped++;
        if (processed % 20 === 0) {
          console.log(`  진행: ${processed}/${total} (건드릴 것 없음: ${skipped})`);
        }
        continue;
      }
      
      // 필드 삭제 요청
      try {
        await updateDoc(doc(db, "users", userId), {
          signupIp: deleteField(),
          currentIp: deleteField(),
          currentCountry: deleteField(),
          currentCountryCode: deleteField(),
          currentRegion: deleteField(),
          currentCity: deleteField(),
          currentUA: deleteField(),
          loginHistory: deleteField(),
        });
        updated++;
        console.log(`  ✅ [${processed}/${total}] ${userId} - IP 데이터 삭제 완료`);
      } catch (e) {
        errors++;
        console.error(`  ❌ [${processed}/${total}] ${userId} - 실패:`, e.message);
      }
      
      // 100건마다 잠깐 쉬어주기 (rate limit 방지)
      if (processed % 100 === 0) {
        console.log(`  💤 1초 대기 (rate limit 방지)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 3. 결과 요약
    console.log("");
    console.log("=".repeat(60));
    console.log("🎉 완료!");
    console.log(`📊 총 처리: ${processed}명`);
    console.log(`✅ 삭제 완료: ${updated}명`);
    console.log(`⏭️  스킵 (이미 없음): ${skipped}명`);
    console.log(`❌ 실패: ${errors}명`);
    console.log("=".repeat(60));
    
    if (errors === 0) {
      console.log("");
      console.log("🎯 모든 유저의 IP/위치 데이터가 완전히 삭제되었습니다!");
      console.log("   Firestore에는 이제 IP 흔적이 남아있지 않습니다.");
    } else {
      console.log("");
      console.log("⚠️ 일부 실패가 있습니다. 로그를 확인하고 재실행하세요.");
    }
    
  } catch (e) {
    console.error("");
    console.error("❌ 치명적 에러:", e.message);
    console.error("");
    console.error("💡 확인 사항:");
    console.error("   1. 네트워크 연결 상태");
    console.error("   2. Firestore 보안 규칙이 write 허용하는지");
    console.error("   3. VPN 켜져있는지 (사이트 접속 시와 동일 환경 권장)");
  }
  
  process.exit(0);
}

// 실행 전 5초 카운트다운 (실수 방지)
console.log("");
console.log("⚠️".repeat(30));
console.log("");
console.log("🔥 users 컬렉션의 IP/위치 데이터를 삭제합니다.");
console.log("   이 작업은 되돌릴 수 없습니다!");
console.log("");
console.log("   5초 후 시작... (Ctrl+C로 취소 가능)");
console.log("");
console.log("⚠️".repeat(30));

setTimeout(() => {
  deleteAllIpData();
}, 5000);
