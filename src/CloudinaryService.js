export async function uploadToCloudinary(file) {
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!file) throw new Error("업로드 파일이 없습니다.");

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary env 누락: VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET 확인"
    );
  }

  // ✅ auto/upload → Cloudinary가 영상/이미지 자동 판단
  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  let res;
  try {
    res = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });
  } catch (e) {
    throw new Error(
      "네트워크 차단 또는 브라우저 보안 설정 때문에 업로드 요청이 실패했습니다. (Failed to fetch)"
    );
  }

  let data = {};
  try {
    data = await res.json();
  } catch (_) {}

  if (!res.ok) {
    const msg =
      data?.error?.message || `Cloudinary 업로드 실패 (${res.status})`;
    throw new Error(msg);
  }

  if (!data?.secure_url) {
    throw new Error("Cloudinary 응답에 secure_url이 없습니다.");
  }

  /**
   * ✅ 여기서 핵심
   * Cloudinary 변환 URL 생성
   * - 해상도 제한 (720p)
   * - 비트레이트 자동 제한
   * - mp4(h264)
   * - 용량 대폭 감소
   */
  const optimizedUrl = data.secure_url.replace(
    "/upload/",
    "/upload/" +
      [
        "f_mp4",        // mp4 고정
        "vcodec_h264",  // 호환성 최고
        "q_auto:good",  // 화질/용량 균형
        "w_720",        // 최대 720p
        "fps_30",       // 프레임 제한
      ].join(",") +
      "/"
  );

  return optimizedUrl;
}
