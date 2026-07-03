import React, { useRef, useState } from "react";
import { myStyles } from "./MyPage.styles";
import { avatarStyles, getAvatarUrl } from "./MyPage.utils";
// ★ [신규] Cloudinary 업로드 서비스 - 이미 프로젝트에 있는 CloudinaryService.js 활용
import { uploadToCloudinary } from "./CloudinaryService";

const AvatarEditorModal = ({ 
  userId,
  tempSelectedIdx, 
  tempUploadedImg, 
  setTempSelectedIdx, 
  setTempUploadedImg, 
  onClose, 
  onApply, 
  onRandom 
}) => {
  const fileInputRef = useRef(null);
  // ★ [신규] 업로드 진행 상태 - 사용자에게 로딩 표시하고 중복 클릭 방지
  const [uploading, setUploading] = useState(false);

  // ★ [수정] 파일 업로드 처리
  // 기존: FileReader로 Base64 dataURL 변환 → Firestore에 그대로 저장
  //   → 문제: 이미지가 크면 1MB 제한 초과로 저장 실패 / 성공해도 앱 로딩 느려짐
  // 신규: Cloudinary에 업로드 → secure_url(짧은 URL)만 Firestore에 저장
  //   → 안정적이고 다른 페이지(EventSection 등)에서도 즉시 표시됨
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 파일 크기 사전 체크 (Cloudinary 무료 플랜 안전 마진: 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("이미지 크기는 10MB 이하여야 합니다.");
      // input value 초기화 (같은 파일 다시 선택 가능하게)
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // 이미지 파일 타입인지 한번 더 체크 (accept="image/*" 우회 방지)
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const secureUrl = await uploadToCloudinary(file);
      // 업로드 성공 → 저장된 CDN URL을 임시 선택 상태로 세팅
      setTempUploadedImg(secureUrl);
      setTempSelectedIdx(-1); // 캐릭터 선택은 해제 (사진이 우선)
    } catch (err) {
      console.error("Cloudinary 업로드 실패:", err);
      alert("이미지 업로드 실패: " + err.message);
    } finally {
      setUploading(false);
      // input value 초기화 - 같은 파일을 다시 선택했을 때도 onChange가 발생하도록
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div style={myStyles.avatarPicker}>
      <div style={myStyles.pickerHeader}>
        <span style={{color: '#fff', fontWeight: '800', fontSize: '18px'}}>아바타 에디터</span>
        <div style={{display:'flex', gap: '10px'}}>
          <button onClick={onRandom} style={myStyles.randomBtn} disabled={uploading}>🎲 랜덤</button>
          <button onClick={onClose} style={myStyles.closeBtn} disabled={uploading}>×</button>
        </div>
      </div>

      {/* ★ [신규] 업로드된 사진 미리보기 - 성공적으로 업로드된 CDN 이미지 확인용 */}
      {tempUploadedImg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          marginBottom: 15,
          background: 'rgba(76, 209, 55, 0.08)',
          border: '1px solid rgba(76, 209, 55, 0.3)',
          borderRadius: 14,
        }}>
          <img src={tempUploadedImg} alt="preview" style={{
            width: 48, height: 48, borderRadius: 12, objectFit: 'cover', border: '2px solid #4cd137',
          }}/>
          <div style={{flex: 1, color: '#4cd137', fontSize: 12, fontWeight: 700}}>
            ✓ 사진 업로드 완료
            <div style={{color: '#888', fontSize: 10, fontWeight: 500, marginTop: 2}}>
              완료 버튼을 눌러 저장하세요
            </div>
          </div>
          <button
            onClick={() => setTempUploadedImg(null)}
            style={{background: 'transparent', border: '1px solid #444', color: '#888', padding: '4px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer'}}
          >
            제거
          </button>
        </div>
      )}

      <div style={myStyles.charGrid}>
        {avatarStyles.map((_, idx) => (
          <div 
            key={idx} 
            onClick={() => { 
              if (uploading) return; // 업로드 중에는 캐릭터 선택 방지
              setTempUploadedImg(null); 
              setTempSelectedIdx(idx); 
            }}
            style={{ 
              ...myStyles.pickerItem, 
              border: (tempSelectedIdx === idx && !tempUploadedImg) ? '2px solid #D4AF37' : '1px solid #333',
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.5 : 1,
            }}
          >
            <img src={getAvatarUrl(idx, userId)} alt="char" style={{width:'85%'}} />
          </div>
        ))}
      </div>

      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileChange}
        style={{display: 'none'}} 
      />

      {/* ★ [수정] 업로드 버튼 - 로딩 상태 표시 및 중복 클릭 방지 */}
      <button 
        onClick={() => !uploading && fileInputRef.current?.click()} 
        style={{
          ...myStyles.uploadBtn, 
          opacity: uploading ? 0.6 : 1,
          cursor: uploading ? 'wait' : 'pointer',
        }}
        disabled={uploading}
      >
        {uploading ? "⏳ 업로드 중..." : "📷 커스텀 사진 업로드"}
      </button>

      <button 
        onClick={onApply} 
        style={{
          ...myStyles.applyBtn,
          opacity: uploading ? 0.6 : 1,
          cursor: uploading ? 'wait' : 'pointer',
        }}
        disabled={uploading}
      >
        {uploading ? "잠시만요..." : "완료"}
      </button>
    </div>
  );
};

export default AvatarEditorModal;