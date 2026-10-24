import { ProjectState, AnimationPreset } from './types';
import { SceneData } from './timestamp-parser';

export interface RenderProgress {
  progress: number; // 0 to 100
  currentScene: number;
  totalScenes: number;
  currentTimeFormatted: string;
  status: string;
}

export async function renderVideoProject(
  project: ProjectState,
  onProgress?: (info: RenderProgress) => void
): Promise<{ videoBlob: Blob; videoUrl: string; duration: number; format: string }> {
  if (!project.scenes || project.scenes.length === 0) {
    throw new Error('Cannot render video: Project contains no scenes.');
  }

  const scenes = [...project.scenes].sort((a, b) => a.startTime - b.startTime);
  const totalDuration = project.narrationDuration && project.narrationDuration > 0
    ? project.narrationDuration
    : scenes[scenes.length - 1].endTime;

  if (totalDuration <= 0) {
    throw new Error('Cannot render video: Total duration is 0 seconds.');
  }

  // Determine canvas resolution based on settings
  let width = 1280;
  let height = 720;
  if (project.settings.aspectRatio === '9:16') {
    width = 720;
    height = 1280;
  } else if (project.settings.aspectRatio === '1:1') {
    width = 1080;
    height = 1080;
  }

  // Pre-load all scene images
  onProgress?.({
    progress: 5,
    currentScene: 0,
    totalScenes: scenes.length,
    currentTimeFormatted: '00:00:00.000',
    status: 'Preloading image assets...',
  });

  const loadedImages: { [sceneId: string]: HTMLImageElement } = {};
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const loadPromise = new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => {
        // If image fails to load, create dynamic fallback SVG
        img.src = createFallbackSvg(scene.sceneNumber, scene.prompt, width, height);
        resolve();
      };
    });

    img.src = scene.imageUrl || createFallbackSvg(scene.sceneNumber, scene.prompt, width, height);
    await loadPromise;
    loadedImages[scene.id] = img;
  }

  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize 2D canvas context for video rendering.');

  // Set up AudioContext and Audio elements if audio exists
  let audioContext: AudioContext | null = null;
  let audioSource: AudioNode | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  let audioElement: HTMLAudioElement | null = null;

  if (project.narrationAudioUrl) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioCtx();
      audioDest = audioContext.createMediaStreamDestination();
      audioElement = new Audio(project.narrationAudioUrl);
      audioElement.crossOrigin = 'anonymous';
      audioSource = audioContext.createMediaElementSource(audioElement);
      audioSource.connect(audioDest);
      audioSource.connect(audioContext.destination);
    } catch (e) {
      console.warn('Audio graph initialization error, proceeding without direct audio mix:', e);
    }
  }

  // Setup Canvas Stream and combined tracks
  const fps = project.settings.frameRate || 30;
  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream();

  canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));
  if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
    audioDest.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
  }

  // Select optimal container/codec supported by browser
  let selectedMimeType = 'video/webm;codecs=vp9,opus';
  let fileExtension = 'webm';

  const preferredCodecs = [
    { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4;codecs=avc1,aac', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];

  for (const option of preferredCodecs) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(option.mime)) {
      selectedMimeType = option.mime;
      fileExtension = option.ext;
      break;
    }
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: selectedMimeType,
    videoBitsPerSecond: 4500000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const renderPromise = new Promise<{ videoBlob: Blob; videoUrl: string; duration: number; format: string }>(
    (resolve, reject) => {
      recorder.onstop = () => {
        try {
          const finalBlob = new Blob(chunks, { type: selectedMimeType });
          const finalUrl = URL.createObjectURL(finalBlob);
          if (audioElement) {
            audioElement.pause();
          }
          if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
          }
          resolve({
            videoBlob: finalBlob,
            videoUrl: finalUrl,
            duration: totalDuration,
            format: fileExtension,
          });
        } catch (err) {
          reject(err);
        }
      };

      recorder.onerror = (err) => reject(err);
    }
  );

  recorder.start(100);

  // If audio is present, begin playing audio in sync
  if (audioElement && audioContext) {
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    audioElement.currentTime = 0;
    try {
      await audioElement.play();
    } catch (e) {
      console.warn('Auto audio play blocked or error:', e);
    }
  }

  // Real-time animation loop
  const startTimeMs = performance.now();
  const totalDurationMs = totalDuration * 1000;

  return new Promise((resolve, reject) => {
    function frame(nowMs: number) {
      const elapsedMs = nowMs - startTimeMs;
      const currentSec = Math.min(totalDuration, elapsedMs / 1000);
      const progressPct = Math.min(99, +( (currentSec / totalDuration) * 100 ).toFixed(1));

      // Find active scene
      let activeSceneIndex = scenes.findIndex(
        (s) => currentSec >= s.startTime && currentSec < s.endTime
      );
      if (activeSceneIndex === -1) {
        activeSceneIndex = currentSec >= totalDuration ? scenes.length - 1 : 0;
      }
      const activeScene = scenes[activeSceneIndex];
      const activeImg = loadedImages[activeScene.id];

      // Calculate scene progress (0 to 1)
      const sceneDuration = Math.max(0.1, activeScene.endTime - activeScene.startTime);
      const sceneElapsed = Math.max(0, currentSec - activeScene.startTime);
      const sceneProgress = Math.min(1, Math.max(0, sceneElapsed / sceneDuration));

      // Render scene with Camera Motion
      if (ctx && activeImg) {
        ctx.clearRect(0, 0, width, height);

        const motionType = resolveMotionType(
          activeScene.motionEffect || project.settings.globalAnimationPreset,
          activeSceneIndex
        );

        drawWithKenBurns(ctx, activeImg, width, height, sceneProgress, motionType, project.settings.zoomIntensity || 1.15);
      }

      onProgress?.({
        progress: progressPct,
        currentScene: activeSceneIndex + 1,
        totalScenes: scenes.length,
        currentTimeFormatted: formatTimestamp(currentSec),
        status: `Rendering Scene ${activeSceneIndex + 1} of ${scenes.length} (${activeScene.prompt.slice(0, 30)}...)`,
      });

      if (elapsedMs < totalDurationMs) {
        requestAnimationFrame(frame);
      } else {
        // Final frame rendered, finalize recording
        onProgress?.({
          progress: 100,
          currentScene: scenes.length,
          totalScenes: scenes.length,
          currentTimeFormatted: formatTimestamp(totalDuration),
          status: 'Encoding final video container...',
        });
        setTimeout(() => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }, 300);

        renderPromise.then(resolve).catch(reject);
      }
    }

    requestAnimationFrame(frame);
  });
}

function resolveMotionType(preset: string | AnimationPreset, sceneIndex: number): string {
  if (preset === 'auto_cinematic') {
    const sequence = [
      'smooth_zoom_in',
      'pan_left_right',
      'smooth_zoom_out',
      'pan_right_left',
      'zoom_in_pan',
      'pan_bottom_top',
    ];
    return sequence[sceneIndex % sequence.length];
  }
  return preset;
}

function drawWithKenBurns(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  t: number, // 0 to 1
  motion: string,
  zoomIntensity: number = 1.15
) {
  ctx.save();

  // Base scale to cover canvas completely without letterboxing
  const imgAspect = img.width / img.height;
  const canvasAspect = w / h;
  let baseScale = 1;

  if (imgAspect > canvasAspect) {
    baseScale = h / img.height;
  } else {
    baseScale = w / img.width;
  }

  // Margin buffer to allow panning and zooming without edge bleeding
  const safeMargin = 1.08;
  const effectiveBaseScale = baseScale * safeMargin;

  let currentScale = 1.0;
  let offsetX = 0;
  let offsetY = 0;

  const maxZoom = zoomIntensity;
  const maxPanX = w * 0.06;
  const maxPanY = h * 0.05;

  // Eased progress (easeInOutQuad)
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  switch (motion) {
    case 'smooth_zoom_in':
      currentScale = 1.0 + (maxZoom - 1.0) * eased;
      break;
    case 'smooth_zoom_out':
      currentScale = maxZoom - (maxZoom - 1.0) * eased;
      break;
    case 'pan_left_right':
      offsetX = (eased - 0.5) * maxPanX * 2;
      currentScale = 1.05;
      break;
    case 'pan_right_left':
      offsetX = (0.5 - eased) * maxPanX * 2;
      currentScale = 1.05;
      break;
    case 'pan_bottom_top':
      offsetY = (0.5 - eased) * maxPanY * 2;
      currentScale = 1.05;
      break;
    case 'pan_top_bottom':
      offsetY = (eased - 0.5) * maxPanY * 2;
      currentScale = 1.05;
      break;
    case 'zoom_in_pan':
      currentScale = 1.0 + (maxZoom - 1.0) * eased;
      offsetX = (eased - 0.5) * maxPanX;
      break;
    case 'zoom_out_pan':
      currentScale = maxZoom - (maxZoom - 1.0) * eased;
      offsetX = (0.5 - eased) * maxPanX;
      break;
    case 'no_motion':
    default:
      currentScale = 1.0;
      offsetX = 0;
      offsetY = 0;
      break;
  }

  // Center transformation on canvas
  ctx.translate(w / 2 + offsetX, h / 2 + offsetY);
  ctx.scale(effectiveBaseScale * currentScale, effectiveBaseScale * currentScale);
  ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);

  ctx.restore();
}

function createFallbackSvg(sceneNum: number, prompt: string, w: number, h: number): string {
  const safePrompt = prompt.slice(0, 50).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#0f172a" />
    <circle cx="${w/2}" cy="${h/2}" r="${w*0.3}" fill="#3b82f6" opacity="0.15" />
    <text x="${w/2}" y="${h/2 - 20}" fill="#38bdf8" font-size="28" font-family="sans-serif" font-weight="bold" text-anchor="middle">SCENE ${sceneNum}</text>
    <text x="${w/2}" y="${h/2 + 20}" fill="#94a3b8" font-size="16" font-family="sans-serif" text-anchor="middle">${safePrompt}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
