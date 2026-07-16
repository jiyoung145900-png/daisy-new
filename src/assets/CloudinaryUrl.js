// =========================================================================
// 🎯 CloudinaryUrl.js - Cloudinary URL 최적화 헬퍼
// -------------------------------------------------------------------------
// f_auto,q_auto 파라미터를 자동 삽입해서 Transformation 비용을 절감한다.
// 비디오 → 이미지 썸네일 변환도 지원.
// =========================================================================

/**
 * 비디오 URL 최적화
 * @param {string} url - Cloudinary 비디오 URL
 * @param {object} options - { width, height }
 */
export function optimizeVideo(url, options = {}) {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com")) return url;
  if (url.includes("/upload/f_auto")) return url; // 이미 최적화됨

  const params = ["f_auto", "q_auto"];
  if (options.width) params.push(`w_${options.width}`);
  if (options.height) params.push(`h_${options.height}`);
  return insertParams(url, params.join(","));
}

/**
 * 이미지 URL 최적화
 * @param {string} url - Cloudinary 이미지 URL
 * @param {object} options - { width, height, crop }
 */
export function optimizeImage(url, options = {}) {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com")) return url;
  if (url.includes("/upload/f_auto")) return url;

  const params = ["f_auto", "q_auto"];
  if (options.width) params.push(`w_${options.width}`);
  if (options.height) params.push(`h_${options.height}`);
  if (options.crop) params.push(`c_${options.crop}`);
  return insertParams(url, params.join(","));
}

/**
 * 비디오 → 첫 프레임 이미지 썸네일
 * 갤러리 목록에서 비디오 대신 이미지로 표시할 때 사용.
 * Transformation 을 크게 절감함.
 * @param {string} videoUrl - Cloudinary 비디오 URL
 * @param {object} options - { width, height, crop }
 */
export function videoThumbnail(videoUrl, options = {}) {
  if (!videoUrl || typeof videoUrl !== "string") return videoUrl;
  if (!videoUrl.includes("res.cloudinary.com")) return videoUrl;

  // 확장자를 .jpg 로 변환
  let thumbUrl = videoUrl.replace(/\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i, ".jpg$2");

  const params = ["f_auto", "q_auto", "so_0"]; // so_0 = 0초 지점 프레임
  if (options.width) params.push(`w_${options.width}`);
  if (options.height) params.push(`h_${options.height}`);
  if (options.crop) params.push(`c_${options.crop}`);
  return insertParams(thumbUrl, params.join(","));
}

/**
 * /upload/ 뒤에 파라미터 문자열 삽입
 */
function insertParams(url, paramString) {
  // 첫 번째 /upload/ 를 찾아서 그 뒤에 파라미터 추가
  return url.replace("/upload/", `/upload/${paramString}/`);
}