export async function uploadToCloudinary(file) {
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!file) throw new Error("업로드 파일이 없습니다.");

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary env 누락: VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET 확인");
  }

  // ✅ 가장 안정적인 엔드포인트: auto/upload
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  let res;
  try {
    res = await fetch(url, { method: "POST", body: formData });
  } catch (e) {
    // ✅ 여기로 오면 Cloudinary 응답도 못 받은 상태 = 네트워크/확장프로그램/차단 문제
    throw new Error("네트워크 차단/확장프로그램/보안설정 때문에 업로드 요청이 막혔습니다. (Failed to fetch)");
  }

  let data = {};
  try {
    data = await res.json();
  } catch (_) {
    // json 파싱 실패해도 에러 메시지 제공
  }

  if (!res.ok) {
    const msg = data?.error?.message || `Cloudinary 업로드 실패 (${res.status})`;
    throw new Error(msg);
  }

  if (!data?.secure_url) {
    throw new Error("Cloudinary 업로드 응답에 secure_url이 없습니다.");
  }

  return data.secure_url;
}
