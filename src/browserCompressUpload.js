import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// ✅ Cloudinary 업로드 (auto/upload 권장)
export async function uploadToCloudinary(file) {
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary env 누락: VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET");
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(url, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error?.message || `Cloudinary 업로드 실패 (${res.status})`);
  }
  if (!data?.secure_url) throw new Error("업로드 성공했지만 secure_url이 없습니다.");

  return data.secure_url;
}

// ===============================
// 브라우저에서 FFmpeg로 “압축 후 업로드”
// 목표: 50~80MB 수준(화질 유지)
// ===============================

let _ffmpegInstance = null;
async function getFFmpeg(onLog) {
  if (_ffmpegInstance) return _ffmpegInstance;

  const ffmpeg = new FFmpeg();

  // ✅ Vite에서 core 로드(최신 권장 방식)
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpeg.on("log", ({ message }) => onLog?.(message));
  _ffmpegInstance = ffmpeg;
  return ffmpeg;
}

// ✅ 타겟 용량(MB)에 맞춰 bitrate 계산
function estimateVideoBitrateKbps({
  targetMB,
  durationSec,
  audioKbps = 160, // 오디오 고정 (화질 유지)
  safety = 0.92,   // 여유분 (컨테이너 오버헤드)
}) {
  // MB → bits
  const targetBits = targetMB * 1024 * 1024 * 8 * safety;
  // 전체 비트레이트(bps)
  const totalBps = targetBits / Math.max(durationSec, 1);
  // 비디오 비트레이트(bps) = total - audio
  const videoBps = Math.max(totalBps - audioKbps * 1000, 300_000); // 최소 300kbps
  return Math.floor(videoBps / 1000); // kbps
}

// ✅ 비디오 길이(초) 읽기: <video> 메타로 빠르게
async function getVideoDurationSec(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      if (!isFinite(d) || d <= 0) return reject(new Error("영상 길이를 읽지 못했습니다."));
      resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("영상 메타데이터 로드 실패"));
    };
  });
}

/**
 * @param {File} file 원본 영상
 * @param {object} opts
 * @param {number} opts.targetMB 목표 용량(MB) - 예: 70
 * @param {number} opts.maxWidth 최대 가로 - 예: 1280(720p 느낌) / 1920(1080p 유지)
 * @param {(p:{stage:string,progress:number,text?:string})=>void} opts.onProgress 진행 콜백
 */
export async function compressAndUploadVideo(file, opts = {}) {
  const {
    targetMB = 70,        // ✅ 50~80MB 중간값
    maxWidth = 1920,      // ✅ 화질 유지: 1080p 최대 유지
    onProgress,
    onLog,
  } = opts;

  if (!file) throw new Error("파일이 없습니다.");
  if (!file.type?.startsWith("video/")) throw new Error("영상 파일만 업로드 가능합니다.");

  onProgress?.({ stage: "inspect", progress: 0, text: "영상 정보 확인 중..." });

  // 1) 길이 측정
  const durationSec = await getVideoDurationSec(file);

  // 2) 목표 용량에 맞는 비트레이트 계산
  // 50~80MB면 길이에 따라 자동 조절됨
  const videoKbps = estimateVideoBitrateKbps({
    targetMB,
    durationSec,
    audioKbps: 160,
  });

  // 3) FFmpeg 로드
  onProgress?.({ stage: "load_ffmpeg", progress: 0.05, text: "압축 엔진 준비 중..." });
  const ffmpeg = await getFFmpeg(onLog);

  // 4) 입력 쓰기
  const inName = `input_${Date.now()}.mp4`;
  const outName = `output_${Date.now()}.mp4`;

  onProgress?.({ stage: "write", progress: 0.1, text: "파일 로딩 중..." });
  await ffmpeg.writeFile(inName, await fetchFile(file));

  // 5) 압축 실행
  // ✅ 설정 포인트:
  // - scale: 최대 가로 maxWidth (원본이 작으면 그대로)
  // - b:v: 계산된 videoKbps
  // - aac 160k
  // - faststart
  // - preset: veryfast(브라우저에서 현실적) / slow는 너무 느림
  // - fps 30 고정은 선택; 원본이 60fps면 용량 커서 30으로 줄이는게 이득
  onProgress?.({ stage: "compress", progress: 0.15, text: "압축 중...(PC 성능에 따라 몇 분 걸릴 수 있음)" });

  ffmpeg.on("progress", ({ progress }) => {
    // progress: 0~1
    const p = 0.15 + progress * 0.65; // 15%~80%
    onProgress?.({ stage: "compress", progress: Math.min(p, 0.8) });
  });

  const vf = `scale='min(${maxWidth},iw)':-2`; // 가로 제한
  await ffmpeg.exec([
    "-i", inName,
    "-vf", vf,
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-b:v", `${videoKbps}k`,
    "-maxrate", `${Math.floor(videoKbps * 1.3)}k`,
    "-bufsize", `${Math.floor(videoKbps * 2)}k`,
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-c:a", "aac",
    "-b:a", "160k",
    outName
  ]);

  // 6) 결과 읽기 → File로 만들기 (로컬 저장 안 함)
  onProgress?.({ stage: "read", progress: 0.82, text: "압축 결과 준비 중..." });
  const outData = await ffmpeg.readFile(outName);

  // 메모리 Blob
  const outBlob = new Blob([outData.buffer], { type: "video/mp4" });
  const compressedFile = new File([outBlob], `compressed_${file.name.replace(/\.[^.]+$/, "")}.mp4`, { type: "video/mp4" });

  // 7) Cloudinary 업로드
  const mb = (compressedFile.size / (1024 * 1024)).toFixed(1);
  onProgress?.({ stage: "upload", progress: 0.86, text: `업로드 중... (${mb}MB)` });

  const url = await uploadToCloudinary(compressedFile);

  // 8) 정리 (메모리)
  try { await ffmpeg.deleteFile(inName); } catch {}
  try { await ffmpeg.deleteFile(outName); } catch {}

  onProgress?.({ stage: "done", progress: 1, text: "완료!" });

  return { url, compressedFile };
}
