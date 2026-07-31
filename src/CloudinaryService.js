// =========================================================================
// 🎯 CloudinaryService.js - Cloudinary 업로드 헬퍼
// -------------------------------------------------------------------------
// 프론트엔드에서 직접 Cloudinary에 파일 업로드.
// 크레딧 낭비 방지를 위해 클라이언트 사이드 검증 포함.
// =========================================================================

// 업로드 제한 설정 (Cloudinary preset이랑 동일하게 유지)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime", // .mov
  "video/webm",
];

export async function uploadToCloudinary(file) {
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // ===== 1. 기본 검증 =====
  if (!file) throw new Error("업로드 파일이 없습니다.");
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary env 누락");
  }

  // ===== 2. 파일 크기 검증 =====
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`파일이 너무 큽니다 (${sizeMB}MB). 최대 10MB까지 업로드 가능합니다.`);
  }

  // ===== 3. 파일 타입 검증 =====
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      `지원하지 않는 파일 형식입니다 (${file.type}). JPG, PNG, WebP, GIF, MP4, MOV, WebM만 업로드 가능합니다.`
    );
  }

  // ===== 4. 업로드 실행 =====
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  let res;
  try {
    res = await fetch(url, { method: "POST", body: formData });
  } catch (e) {
    throw new Error("Failed to fetch (네트워크 차단/확장프로그램 가능)");
  }

  const rawText = await res.text();

  // dev 환경에서만 로그 출력 (프로덕션 콘솔 오염 방지)
  if (import.meta.env.DEV) {
    console.log("Cloudinary RAW RESPONSE:", res.status, rawText);
  }

  let data = {};
  try {
    data = JSON.parse(rawText);
  } catch (_) {}

  if (!res.ok) {
    throw new Error(data?.error?.message || `업로드 실패 (${res.status})`);
  }

  if (!data?.secure_url) {
    throw new Error("secure_url 없음");
  }

  return data.secure_url;
}