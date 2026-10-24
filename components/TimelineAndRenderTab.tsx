'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Volume2,
  VolumeX,
  Video,
  Download,
  Sparkles,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Film,
  Camera,
  Maximize2,
} from 'lucide-react';
import { ProjectState, AnimationPreset } from '@/lib/types';
import { formatSecondsToTimestamp } from '@/lib/timestamp-parser';
import { renderVideoProject, RenderProgress } from '@/lib/video-renderer';

interface TimelineAndRenderTabProps {
  project: ProjectState;
  onUpdateProject: (updates: Partial<ProjectState>) => void;
}

export function TimelineAndRenderTab({
  project,
  onUpdateProject,
}: TimelineAndRenderTabProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [renderedVideo, setRenderedVideo] = useState<{
    url: string;
    duration: number;
    format: string;
  } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const scenes = [...project.scenes].sort((a, b) => a.startTime - b.startTime);
  const totalDuration =
    project.narrationDuration && project.narrationDuration > 0
      ? project.narrationDuration
      : scenes.length > 0
      ? scenes[scenes.length - 1].endTime
      : 20;

  // Find active scene at currentTime
  const activeSceneIndex = scenes.findIndex(
    (s) => currentTime >= s.startTime && currentTime < s.endTime
  );
  const activeScene =
    activeSceneIndex !== -1 ? scenes[activeSceneIndex] : scenes.length > 0 ? scenes[0] : null;

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioRef.current && project.narrationAudioUrl) return;

    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (currentTime >= totalDuration) {
        setCurrentTime(0);
        if (audioRef.current) audioRef.current.currentTime = 0;
      }
      if (audioRef.current) {
        audioRef.current.play().catch(console.error);
      }
      setIsPlaying(true);
    }
  };

  // Sync animation timer when playing without audio or alongside audio
  useEffect(() => {
    let lastTimestamp = performance.now();

    const loop = (now: number) => {
      const delta = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      setCurrentTime((prev) => {
        const nextTime = prev + delta;
        if (nextTime >= totalDuration) {
          setIsPlaying(false);
          if (audioRef.current) audioRef.current.pause();
          return totalDuration;
        }
        return nextTime;
      });

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(loop);
      }
    };

    if (isPlaying) {
      lastTimestamp = performance.now();
      animationFrameRef.current = requestAnimationFrame(loop);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, totalDuration]);

  // Sync audio element time
  const handleAudioTimeUpdate = () => {
    if (audioRef.current && isPlaying) {
      // Keep audio tightly in sync
      const audioTime = audioRef.current.currentTime;
      if (Math.abs(audioTime - currentTime) > 0.3) {
        setCurrentTime(audioTime);
      }
    }
  };

  // Seek timeline
  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, newTime));
    setCurrentTime(clamped);
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
  };

  // Draw active preview onto canvas with Ken Burns camera motion
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !activeScene) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const drawFrame = () => {
      ctx.clearRect(0, 0, w, h);

      // Scene normalized progress (0 to 1)
      const sceneDur = Math.max(0.1, activeScene.endTime - activeScene.startTime);
      const sceneElapsed = Math.max(0, currentTime - activeScene.startTime);
      const t = Math.min(1, Math.max(0, sceneElapsed / sceneDur));

      // Calculate Ken Burns scale & offsets
      const imgAspect = img.width / img.height;
      const canvasAspect = w / h;
      let baseScale = 1;
      if (imgAspect > canvasAspect) {
        baseScale = h / img.height;
      } else {
        baseScale = w / img.width;
      }
      const safeScale = baseScale * 1.08;

      const motion = activeScene.motionEffect || project.settings.globalAnimationPreset;
      const zoomIntensity = project.settings.zoomIntensity || 1.15;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      let currentScale = 1.0;
      let offsetX = 0;
      let offsetY = 0;
      const maxPanX = w * 0.05;
      const maxPanY = h * 0.04;

      if (motion === 'smooth_zoom_in') {
        currentScale = 1.0 + (zoomIntensity - 1.0) * eased;
      } else if (motion === 'smooth_zoom_out') {
        currentScale = zoomIntensity - (zoomIntensity - 1.0) * eased;
      } else if (motion === 'pan_left_right') {
        offsetX = (eased - 0.5) * maxPanX * 2;
        currentScale = 1.05;
      } else if (motion === 'pan_right_left') {
        offsetX = (0.5 - eased) * maxPanX * 2;
        currentScale = 1.05;
      } else if (motion === 'zoom_in_pan') {
        currentScale = 1.0 + (zoomIntensity - 1.0) * eased;
        offsetX = (eased - 0.5) * maxPanX;
      }

      ctx.save();
      ctx.translate(w / 2 + offsetX, h / 2 + offsetY);
      ctx.scale(safeScale * currentScale, safeScale * currentScale);
      ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
      ctx.restore();
    };

    img.onload = drawFrame;
    if (activeScene.imageUrl) {
      img.src = activeScene.imageUrl;
    } else {
      // Draw placeholder
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Scene ${activeScene.sceneNumber}`, w / 2, h / 2 - 10);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.fillText(activeScene.prompt.slice(0, 45), w / 2, h / 2 + 20);
    }
  }, [currentTime, activeScene, project.settings]);

  // Execute full video rendering (Section 16)
  const handleRenderFullVideo = async () => {
    if (scenes.length === 0) {
      alert('Please import or generate scenes first!');
      return;
    }

    setIsRendering(true);
    setRenderError(null);
    setRenderedVideo(null);

    try {
      const result = await renderVideoProject(project, (progress) => {
        setRenderProgress(progress);
      });

      setRenderedVideo({
        url: result.videoUrl,
        duration: result.duration,
        format: result.format,
      });
      onUpdateProject({ finalVideoUrl: result.videoUrl });
    } catch (err: any) {
      console.error('Video render error:', err);
      setRenderError(err.message || 'Video rendering failed');
    } finally {
      setIsRendering(false);
      setRenderProgress(null);
    }
  };

  const handleDownloadRenderedVideo = () => {
    if (!renderedVideo) return;
    const a = document.createElement('a');
    a.href = renderedVideo.url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_rendered.${renderedVideo.format}`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Audio Element Hidden */}
      {project.narrationAudioUrl && (
        <audio
          ref={audioRef}
          src={project.narrationAudioUrl}
          muted={isMuted}
          onTimeUpdate={handleAudioTimeUpdate}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Film className="w-6 h-6 text-sky-400" />
            Synchronized Timeline & Video Renderer
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Section 13-16 Engine: Synchronize narration with scene images, preview cinematic camera movement, and render the final video.
          </p>
        </div>

        {/* Big Render Button */}
        <button
          onClick={handleRenderFullVideo}
          disabled={isRendering || scenes.length === 0}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/20 disabled:opacity-50 transition-all self-start sm:self-auto"
        >
          {isRendering ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Rendering Full Video...</span>
            </>
          ) : (
            <>
              <Video className="w-4 h-4 fill-current" />
              <span>RENDER FULL VIDEO</span>
            </>
          )}
        </button>
      </div>

      {/* Main Grid: Player on Left, Motion Settings on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Synchronized Player Canvas (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
            <canvas
              ref={previewCanvasRef}
              width={1280}
              height={720}
              className="w-full h-full object-contain"
            />

            {/* Overlay Scene Badge */}
            {activeScene && (
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur border border-slate-800 text-xs font-mono text-slate-200 flex items-center gap-2">
                <span className="font-bold text-sky-400">
                  SCENE {String(activeScene.sceneNumber).padStart(3, '0')}
                </span>
                <span className="text-slate-400">|</span>
                <span>{activeScene.duration.toFixed(1)}s</span>
              </div>
            )}

            {/* Current Camera Motion Badge */}
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur border border-slate-800 text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span className="capitalize">
                {(activeScene?.motionEffect || project.settings.globalAnimationPreset).replace(/_/g, ' ')}
              </span>
            </div>

            {/* Prompt Subtitle at bottom of player */}
            {activeScene && (
              <div className="absolute bottom-3 inset-x-3 px-3 py-2 rounded-xl bg-slate-950/85 backdrop-blur border border-slate-800/80 text-xs text-slate-200 text-center">
                {activeScene.narration ? (
                  <p className="font-medium text-sky-300">&ldquo;{activeScene.narration}&rdquo;</p>
                ) : (
                  <p className="text-slate-300 truncate">{activeScene.prompt}</p>
                )}
              </div>
            )}
          </div>

          {/* Player Transport Controls */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSeek(0)}
                aria-label="Rewind to start"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Rewind to start"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleSeek(currentTime - 5)}
                aria-label="Skip backward 5 seconds"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Back 5s"
              >
                <Rewind className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="p-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold transition-colors shadow-md shadow-sky-500/20"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>

              <button
                type="button"
                onClick={() => handleSeek(currentTime + 5)}
                aria-label="Skip forward 5 seconds"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Forward 5s"
              >
                <FastForward className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors ml-1"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Time Display */}
            <div className="font-mono text-xs sm:text-sm text-slate-200 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-sky-400 font-bold">{formatSecondsToTimestamp(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-slate-400">{formatSecondsToTimestamp(totalDuration)}</span>
            </div>
          </div>
        </div>

        {/* Camera Motion & Export Settings (Right Col) */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-400" />
              Global Camera Movement (Section 14)
            </h3>

            {/* Preset Selector */}
            <div className="space-y-1.5">
              <label htmlFor="global-motion-preset" className="text-xs text-slate-400">Motion Preset</label>
              <select
                id="global-motion-preset"
                value={project.settings.globalAnimationPreset}
                onChange={(e) =>
                  onUpdateProject({
                    settings: {
                      ...project.settings,
                      globalAnimationPreset: e.target.value as AnimationPreset,
                    },
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="auto_cinematic">Automatic Cinematic (Alternating)</option>
                <option value="smooth_zoom_in">Smooth Zoom In (Ken Burns)</option>
                <option value="smooth_zoom_out">Smooth Zoom Out</option>
                <option value="pan_left_right">Pan Left to Right</option>
                <option value="pan_right_left">Pan Right to Left</option>
                <option value="pan_bottom_top">Pan Bottom to Top</option>
                <option value="pan_top_bottom">Pan Top to Bottom</option>
                <option value="zoom_in_pan">Zoom In + Pan</option>
                <option value="zoom_out_pan">Zoom Out + Pan</option>
                <option value="no_motion">No Motion (Static Cut)</option>
              </select>
            </div>

            {/* Zoom Intensity Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="zoom-intensity-slider" className="text-slate-400">Zoom Intensity</label>
                <span className="font-mono text-slate-200">{project.settings.zoomIntensity || 1.15}x</span>
              </div>
              <input
                id="zoom-intensity-slider"
                type="range"
                min="1.05"
                max="1.35"
                step="0.02"
                value={project.settings.zoomIntensity || 1.15}
                onChange={(e) =>
                  onUpdateProject({
                    settings: {
                      ...project.settings,
                      zoomIntensity: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full accent-sky-500"
              />
            </div>

            {/* Export Settings summary */}
            <div className="pt-3 border-t border-slate-800 space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Aspect Ratio:</span>
                <span className="font-mono text-slate-200">{project.settings.aspectRatio}</span>
              </div>
              <div className="flex justify-between">
                <span>Frame Rate:</span>
                <span className="font-mono text-slate-200">{project.settings.frameRate} FPS</span>
              </div>
              <div className="flex justify-between">
                <span>Video Codec:</span>
                <span className="font-mono text-slate-200">H.264 / VP9</span>
              </div>
              <div className="flex justify-between">
                <span>Audio Track:</span>
                <span className="font-mono text-sky-400 truncate max-w-[150px]">
                  {project.narrationAudioName || 'Original Voiceover'}
                </span>
              </div>
            </div>
          </div>

          {/* Rendered Video Playable Card */}
          {renderedVideo && (
            <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-800/80 shadow-lg space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs sm:text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Video Render Complete!</span>
              </div>
              <video
                src={renderedVideo.url}
                controls
                className="w-full aspect-video rounded-xl bg-black border border-slate-800"
              />
              <button
                type="button"
                onClick={handleDownloadRenderedVideo}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Final MP4 / Video</span>
              </button>
            </div>
          )}

          {renderError && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{renderError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Visual 2-Track Editing Timeline (Section 13) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            2-Track Synchronized Workspace (Section 13)
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">
            Click any scene clip or scrub slider to jump playhead
          </span>
        </div>

        {/* Global Timeline Scrubber */}
        <div className="relative pt-2">
          <input
            type="range"
            min="0"
            max={totalDuration}
            step="0.05"
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            aria-label="Timeline position scrubber"
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
        </div>

        {/* TRACK 1: Video Scene Clips */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Track 1: Video Scene Clips
          </div>
          <div className="flex w-full overflow-x-auto pb-2 gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800/80 min-h-[90px]">
            {scenes.map((scene) => {
              const widthPct = Math.max(5, (scene.duration / totalDuration) * 100);
              const isActive = activeScene?.id === scene.id;

              return (
                <div
                  key={scene.id}
                  onClick={() => handleSeek(scene.startTime)}
                  style={{ minWidth: `${Math.max(80, widthPct * 6)}px`, flex: `${scene.duration}` }}
                  className={`h-20 rounded-lg p-1.5 cursor-pointer transition-all border flex flex-col justify-between overflow-hidden shrink-0 relative ${
                    isActive
                      ? 'bg-sky-950/80 border-sky-400 ring-2 ring-sky-500/50'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800'
                  }`}
                  title={`Scene ${scene.sceneNumber}: ${formatSecondsToTimestamp(scene.startTime)} - ${formatSecondsToTimestamp(scene.endTime)}`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="font-bold text-sky-300">SC {scene.sceneNumber}</span>
                    <span className="text-slate-400">{scene.duration.toFixed(1)}s</span>
                  </div>

                  {scene.imageUrl ? (
                    <img
                      src={scene.imageUrl}
                      alt={`Scene ${scene.sceneNumber}`}
                      className="w-full h-8 object-cover rounded opacity-80"
                    />
                  ) : (
                    <div className="w-full h-8 bg-slate-950 rounded flex items-center justify-center text-[9px] text-slate-600">
                      Prompt
                    </div>
                  )}

                  <div className="text-[9px] text-slate-400 truncate">
                    {formatSecondsToTimestamp(scene.startTime)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TRACK 2: Narration Audio Track */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Track 2: Voiceover Narration</span>
            <span className="font-mono text-sky-400 text-[10px]">
              {project.narrationAudioName || 'Audio Waveform Track'}
            </span>
          </div>
          <div className="relative w-full h-12 bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden flex items-center px-2">
            {/* Synthetic simulated audio waveforms */}
            <div className="w-full flex items-center justify-between gap-[2px] h-8 opacity-70">
              {Array.from({ length: 64 }).map((_, idx) => {
                const height = 15 + Math.sin(idx * 0.4) * 20 + Math.cos(idx * 0.7) * 15;
                const progressPoint = (idx / 64) * totalDuration;
                const isPast = progressPoint <= currentTime;

                return (
                  <div
                    key={idx}
                    style={{ height: `${Math.max(6, Math.min(30, height))}px` }}
                    className={`flex-1 rounded-full transition-colors ${
                      isPast ? 'bg-sky-400' : 'bg-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            {/* Playhead Marker */}
            <div
              style={{ left: `${(currentTime / totalDuration) * 100}%` }}
              className="absolute top-0 bottom-0 w-[2px] bg-rose-500 shadow-md shadow-rose-500/80 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Rendering Modal Overlay */}
      {isRendering && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-sky-950 border border-sky-800 text-sky-400 mx-auto flex items-center justify-center">
              <Film className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-100">Rendering Full Manhwa Video</h3>
              <p className="text-xs text-slate-400 mt-1">{renderProgress?.status || 'Processing scenes...'}</p>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
              <div
                style={{ width: `${renderProgress?.progress || 0}%` }}
                className="bg-gradient-to-r from-sky-500 to-emerald-500 h-full transition-all duration-200"
              />
            </div>

            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>{renderProgress?.currentTimeFormatted || '00:00:00.000'}</span>
              <span className="text-white font-bold">{renderProgress?.progress.toFixed(0) || 0}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
