import React, { useRef, useState } from "react";
import { myStyles } from "./MyPage.styles";
import { avatarStyles, getAvatarUrl } from "./MyPage.utils";
import { uploadToCloudinary } from "./CloudinaryService";

/**
 * ★★★ 텔레그램 스타일 아바타 편집기 ★★★
 * 
 * 기능:
 * 1. 기본 아바타 선택 (기존 유지)
 * 2. 사진 업로드 시 → 크롭 UI 표시
 *    - 드래그로 위치 이동 (마우스/터치)
 *    - 슬라이더로 크기 조절 (0.5x ~ 3x)
 *    - 회전 버튼 (90도씩)
 *    - 원형 마스크 실시간 미리보기
 *    - Canvas로 원형 크롭 이미지 생성 → Cloudinary 업로드
 * 3. Firebase 저장 (기존 useMyPageLogic 활용)
 */
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
  const [uploading, setUploading] = useState(false);
  
  // ★★★ [신규] 크롭 관련 상태
  const [rawImageUrl, setRawImageUrl] = useState(null);      // 크롭 전 원본 이미지
  const [showCropper, setShowCropper] = useState(false);      // 크롭 UI 표시 여부
  const [position, setPosition] = useState({ x: 0, y: 0 });   // 이미지 위치
  const [scale, setScale] = useState(1);                       // 크기 (0.5 ~ 3)
  const [rotation, setRotation] = useState(0);                 // 회전 (0, 90, 180, 270)
  
  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // ═══════════════════════════════════════════════════════════
  // 파일 선택 → 크롭 UI 열기
  // ═══════════════════════════════════════════════════════════
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("이미지 크기는 10MB 이하여야 합니다.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // 파일을 Data URL로 읽어서 크롭 UI에 표시
    const reader = new FileReader();
    reader.onload = (event) => {
      setRawImageUrl(event.target.result);
      setShowCropper(true);
      // 초기값 리셋
      setPosition({ x: 0, y: 0 });
      setScale(1);
      setRotation(0);
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ═══════════════════════════════════════════════════════════
  // 드래그 핸들러 - 마우스
  // ═══════════════════════════════════════════════════════════
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // ═══════════════════════════════════════════════════════════
  // 드래그 핸들러 - 터치 (모바일)
  // ═══════════════════════════════════════════════════════════
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  // ═══════════════════════════════════════════════════════════
  // 회전 90도씩
  // ═══════════════════════════════════════════════════════════
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // ═══════════════════════════════════════════════════════════
  // 리셋 (원본 상태로)
  // ═══════════════════════════════════════════════════════════
  const handleReset = () => {
    setPosition({ x: 0, y: 0 });
    setScale(1);
    setRotation(0);
  };

  // ═══════════════════════════════════════════════════════════
  // 크롭 취소
  // ═══════════════════════════════════════════════════════════
  const handleCropCancel = () => {
    setShowCropper(false);
    setRawImageUrl(null);
    handleReset();
  };

  // ═══════════════════════════════════════════════════════════
  // ★★★ 크롭 저장 - Canvas로 원형 크롭 이미지 생성 → Cloudinary 업로드
  // ═══════════════════════════════════════════════════════════
  const handleCropSave = async () => {
    if (!rawImageUrl) return;
    
    setUploading(true);
    try {
      // 1. 이미지 로드
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("이미지 로드 실패"));
        img.src = rawImageUrl;
      });

      // 2. Canvas 생성 (최종 출력 400x400)
      const outputSize = 400;
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");

      // 3. 원형 클리핑
      ctx.save();
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.clip();

      // 4. 배경 검정 (투명 영역 방지)
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, outputSize, outputSize);

      // 5. 크롭 UI 크기 (미리보기) → 출력 크기 스케일 계산
      const cropAreaSize = 280;
      const scaleFactor = outputSize / cropAreaSize;

      // 6. 이미지 그리기 (중심 기준 + 위치 + 크기 + 회전)
      ctx.translate(outputSize / 2, outputSize / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // 이미지 원본 크기 × 사용자 scale
      const drawWidth = img.width * scale * scaleFactor;
      const drawHeight = img.height * scale * scaleFactor;
      // 사용자 드래그 위치 반영
      const drawX = -drawWidth / 2 + position.x * scaleFactor;
      const drawY = -drawHeight / 2 + position.y * scaleFactor;

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();

      // 7. Blob으로 변환
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png", 0.95)
      );
      if (!blob) throw new Error("이미지 변환 실패");

      const file = new File([blob], "avatar.png", { type: "image/png" });

      // 8. Cloudinary 업로드
      const secureUrl = await uploadToCloudinary(file);

      // 9. 결과 저장
      setTempUploadedImg(secureUrl);
      setTempSelectedIdx(-1);
      setShowCropper(false);
      setRawImageUrl(null);
      handleReset();
    } catch (err) {
      console.error("크롭 저장 실패:", err);
      alert("이미지 저장 실패: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 렌더링 - 크롭 UI 모드
  // ═══════════════════════════════════════════════════════════
  if (showCropper) {
    return (
      <div style={styles.cropperContainer}>
        <div style={styles.cropperHeader}>
          <button
            onClick={handleCropCancel}
            style={styles.cropperCancelBtn}
            disabled={uploading}
          >
            취소
          </button>
          <span style={styles.cropperTitle}>사진 편집</span>
          <button
            onClick={handleCropSave}
            style={styles.cropperSaveBtn}
            disabled={uploading}
          >
            {uploading ? "저장 중..." : "저장"}
          </button>
        </div>

        {/* 크롭 영역 - 원형 마스크 */}
        <div style={styles.cropAreaWrapper}>
          <div
            style={styles.cropArea}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={rawImageUrl}
              alt="crop preview"
              style={{
                ...styles.cropImage,
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              }}
              draggable={false}
            />
            {/* 원형 마스크 오버레이 */}
            <div style={styles.circleMask} />
          </div>
          <div style={styles.dragHint}>💡 드래그로 위치 조절</div>
        </div>

        {/* 컨트롤 */}
        <div style={styles.controls}>
          {/* 크기 슬라이더 */}
          <div style={styles.controlRow}>
            <span style={styles.controlLabel}>🔍 크기</span>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              style={styles.slider}
            />
            <span style={styles.controlValue}>{scale.toFixed(1)}x</span>
          </div>

          {/* 버튼들 */}
          <div style={styles.buttonRow}>
            <button
              onClick={handleRotate}
              style={styles.actionBtn}
              disabled={uploading}
            >
              🔄 회전 ({rotation}°)
            </button>
            <button
              onClick={handleReset}
              style={styles.actionBtn}
              disabled={uploading}
            >
              ↺ 리셋
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 렌더링 - 기본 UI 모드 (기본 아바타 + 업로드 버튼)
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={myStyles.avatarPicker}>
      <div style={myStyles.pickerHeader}>
        <span style={{ color: "#fff", fontWeight: "800", fontSize: "18px" }}>
          아바타 에디터
        </span>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onRandom} style={myStyles.randomBtn} disabled={uploading}>
            🎲 랜덤
          </button>
          <button onClick={onClose} style={myStyles.closeBtn} disabled={uploading}>
            ×
          </button>
        </div>
      </div>

      {tempUploadedImg && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            marginBottom: 15,
            background: "rgba(76, 209, 55, 0.08)",
            border: "1px solid rgba(76, 209, 55, 0.3)",
            borderRadius: 14,
          }}
        >
          <img
            src={tempUploadedImg}
            alt="preview"
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #4cd137",
            }}
          />
          <div style={{ flex: 1, color: "#4cd137", fontSize: 12, fontWeight: 700 }}>
            ✓ 사진 편집 완료
            <div
              style={{
                color: "#888",
                fontSize: 10,
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              완료 버튼을 눌러 저장하세요
            </div>
          </div>
          <button
            onClick={() => setTempUploadedImg(null)}
            style={{
              background: "transparent",
              border: "1px solid #444",
              color: "#888",
              padding: "4px 10px",
              borderRadius: 8,
              fontSize: 11,
              cursor: "pointer",
            }}
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
              if (uploading) return;
              setTempUploadedImg(null);
              setTempSelectedIdx(idx);
            }}
            style={{
              ...myStyles.pickerItem,
              border:
                tempSelectedIdx === idx && !tempUploadedImg
                  ? "2px solid #D4AF37"
                  : "1px solid #333",
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.5 : 1,
            }}
          >
            <img src={getAvatarUrl(idx, userId)} alt="char" style={{ width: "85%" }} />
          </div>
        ))}
      </div>

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <button
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{
          ...myStyles.uploadBtn,
          opacity: uploading ? 0.6 : 1,
          cursor: uploading ? "wait" : "pointer",
        }}
        disabled={uploading}
      >
        📷 사진 업로드 & 편집
      </button>

      <button
        onClick={onApply}
        style={{
          ...myStyles.applyBtn,
          opacity: uploading ? 0.6 : 1,
          cursor: uploading ? "wait" : "pointer",
        }}
        disabled={uploading}
      >
        {uploading ? "잠시만요..." : "완료"}
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// 크롭 UI 스타일
// ═══════════════════════════════════════════════════════════
const styles = {
  cropperContainer: {
    background: "#0a0a0a",
    borderRadius: 20,
    padding: 20,
    maxWidth: 400,
    margin: "0 auto",
    color: "#fff",
  },
  cropperHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    padding: "10px 0",
    borderBottom: "1px solid #222",
  },
  cropperTitle: {
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: 1,
  },
  cropperCancelBtn: {
    background: "transparent",
    color: "#888",
    border: "none",
    fontSize: 14,
    cursor: "pointer",
    padding: "6px 12px",
  },
  cropperSaveBtn: {
    background: "linear-gradient(135deg, #D4AF37, #B8941F)",
    color: "#000",
    border: "none",
    padding: "8px 20px",
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  cropAreaWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 25,
  },
  cropArea: {
    position: "relative",
    width: 280,
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    cursor: "move",
    userSelect: "none",
    background: "#000",
    touchAction: "none",
    boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  },
  cropImage: {
    position: "absolute",
    top: "50%",
    left: "50%",
    maxWidth: "none",
    pointerEvents: "none",
    userSelect: "none",
    transition: "none",
  },
  circleMask: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    boxShadow: "0 0 0 200px rgba(0, 0, 0, 0.7)",
    pointerEvents: "none",
    border: "2px solid rgba(212, 175, 55, 0.6)",
  },
  dragHint: {
    marginTop: 12,
    fontSize: 12,
    color: "#666",
    letterSpacing: 1,
  },
  controls: {
    padding: "0 10px",
  },
  controlRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  controlLabel: {
    fontSize: 13,
    color: "#aaa",
    minWidth: 60,
    fontWeight: 600,
  },
  controlValue: {
    fontSize: 13,
    color: "#D4AF37",
    minWidth: 40,
    textAlign: "right",
    fontWeight: 700,
  },
  slider: {
    flex: 1,
    accentColor: "#D4AF37",
    cursor: "pointer",
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    background: "rgba(212, 175, 55, 0.1)",
    color: "#D4AF37",
    border: "1px solid rgba(212, 175, 55, 0.3)",
    padding: "12px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s",
  },
};

export default AvatarEditorModal;