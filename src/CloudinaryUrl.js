// =========================================================================
// 🎯 CloudinaryUrl.js - Cloudinary URL 최적화 헬퍼
// -------------------------------------------------------------------------
// f_auto,q_auto 파라미터를 자동 삽입해서 Transformation 비용을 절감한다.
// 비디오 → 이미지 썸네일 변환도 지원.
//
// ⚠️ 크레딧 절약을 위해 width/height는 프리셋만 허용.
//    자유 입력 시 각 조합마다 새 transformation 발생 → 크레딧 폭발.
// =========================================================================

// 허용된 width 프리셋 (이 값들만 사용)
const ALLOWED_WIDTHS = [200, 400, 800, 1200, 1920];
// 허용된 crop 프리셋
const ALLOWED_CROPS = ["fill", "fit", "limit", "thumb", "scale"];

/**
 * 요청 width를 가장 가까운 허용 프리셋으로 스냅
 * 예: 350 → 400, 900 → 1200
 */
function snapWidth(requestedWidth) {
  if (!requestedWidth) return null;
  const w = Number(requestedWidth);
  if (isNaN(w)) return null;

  // 요청값보다 크거나 같은 첫 프리셋 사용 (화질 유지 우선)
  for (const preset of ALLOWED_WIDTHS) {
    if (preset >= w) return preset;
  }
  // 요청이 최대값보다 크면 최대값 사용
  return ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1];
}

/**
 * URL이 이미 변환 파라미터를 포함하는지 검사
 * /upload/ 다음에 오는 세그먼트에 f_ 또는 q_ 등 변환 접두사가 있으면 true
 */
function hasTransformation(url) {
  const match = url.match(/\/upload\/([^/]+)\//);
  if (!match) return false;
  const segment = match[1];
  // 변환 파라미터 특징: 언더스코어 포함 (f_, q_, w_, h_, c_, so_ 등)
  // 버전 (v1234567) 이나 폴더명은 언더스코어 없음
  return /^[a-z]_/.test(segment) || segment.includes(",");
}

/**
 * 비디오 URL 최적화
 * @param {string} url - Cloudinary 비디오 URL
 * @param {object} options - { width, height }
 */
export function optimizeVideo(url, options = {}) {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com")) return url;
  if (hasTransformation(url)) return url; // 이미 최적화됨

  const params = ["f_auto", "q_auto"];

  const w = snapWidth(options.width);
  if (w) params.push(`w_${w}`);

  return insertParams(url, params.join(","));
}

/**
 * 이미지 URL 최적화
 * @param {string} url - Cloudinary 이미지 URL
 * @param {object} options - { width, crop }
 */
export function optimizeImage(url, options = {}) {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com")) return url;
  if (hasTransformation(url)) return url;

  const params = ["f_auto", "q_auto"];

  const w = snapWidth(options.width);
  if (w) params.push(`w_${w}`);

  if (options.crop && ALLOWED_CROPS.includes(options.crop)) {
    params.push(`c_${options.crop}`);
  }

  return insertParams(url, params.join(","));
}

/**
 * 비디오 → 첫 프레임 이미지 썸네일
 * 갤러리 목록에서 비디오 대신 이미지로 표시할 때 사용.
 * Transformation 을 크게 절감함.
 * @param {string} videoUrl - Cloudinary 비디오 URL
 * @param {object} options - { width, crop }
 */
export function videoThumbnail(videoUrl, options = {}) {
  if (!videoUrl || typeof videoUrl !== "string") return videoUrl;
  if (!videoUrl.includes("res.cloudinary.com")) return videoUrl;

  // 확장자를 .jpg 로 변환
  let thumbUrl = videoUrl.replace(
    /\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i,
    ".jpg$2"
  );

  if (hasTransformation(thumbUrl)) return thumbUrl;

  const params = ["f_auto", "q_auto", "so_0"]; // so_0 = 0초 지점 프레임

  const w = snapWidth(options.width);
  if (w) params.push(`w_${w}`);

  if (options.crop && ALLOWED_CROPS.includes(options.crop)) {
    params.push(`c_${options.crop}`);
  }

  return insertParams(thumbUrl, params.join(","));
}

/**
 * /upload/ 뒤에 파라미터 문자열 삽입
 */
function insertParams(url, paramString) {
  return url.replace("/upload/", `/upload/${paramString}/`);
}