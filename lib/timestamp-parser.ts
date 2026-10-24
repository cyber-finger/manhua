export interface SceneData {
  id: string;
  sceneNumber: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  duration: number; // in seconds
  prompt: string;
  narration?: string;
  assetIds?: string[];
  imageUrl?: string;
  status: 'pending' | 'queued' | 'generating' | 'generated' | 'approved' | 'error';
  isApproved?: boolean;
  error?: string;
  motionEffect?: string;
}

export interface ValidationIssue {
  type: 'gap' | 'overlap' | 'empty_prompt' | 'out_of_order' | 'audio_mismatch' | 'invalid_timestamp';
  severity: 'error' | 'warning';
  sceneNumber?: number;
  message: string;
  details?: string;
}

export interface ValidationReport {
  isValid: boolean;
  hasErrors: boolean;
  totalScenes: number;
  totalSceneDuration: number;
  audioDuration?: number;
  coveragePercentage: number;
  firstSceneStart: number;
  lastSceneEnd: number;
  issues: ValidationIssue[];
  statusText: 'Synchronized' | 'Mismatched' | 'Gaps Detected' | 'Overlaps Detected' | 'Needs Attention';
}

/**
 * Parses timestamp string into seconds.
 * Supports:
 * - 00:00:04.200
 * - 00:04.200
 * - 00:00:04
 * - 4.2
 */
export function parseTimestampToSeconds(tsStr: string): number | null {
  if (!tsStr) return null;
  const clean = tsStr.trim().replace(/^\[|\]$/g, '');
  
  // Format: HH:MM:SS.mmm or MM:SS.mmm or SS.mmm
  const parts = clean.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    if (isNaN(minutes) || isNaN(seconds)) return null;
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    const seconds = parseFloat(parts[0]);
    return isNaN(seconds) ? null : seconds;
  }
  return null;
}

/**
 * Format seconds to HH:MM:SS.mmm format
 */
export function formatSecondsToTimestamp(sec: number): string {
  if (isNaN(sec) || sec < 0) sec = 0;
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);
  const milliseconds = Math.floor((sec % 1) * 1000);

  const pad = (num: number, size: number) => num.toString().padStart(size, '0');

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(milliseconds, 3)}`;
}

/**
 * Format seconds to sanitized filename format with hyphens (Page 13 format: Scene_001_00-00-00.000_to_00-00-04.200.png)
 */
export function formatSanitizedTimestamp(sec: number): string {
  const ts = formatSecondsToTimestamp(sec);
  return ts.replace(/:/g, '-');
}

export function getSceneImageFilename(sceneNumber: number, startSec: number, endSec: number): string {
  const numPad = sceneNumber.toString().padStart(3, '0');
  const startStr = formatSanitizedTimestamp(startSec);
  const endStr = formatSanitizedTimestamp(endSec);
  return `Scene_${numPad}_${startStr}_to_${endStr}.png`;
}

/**
 * Parses multi-scene raw text into SceneData array.
 * Supports:
 * Format A (Standard Section 6 & 21A):
 * Scene 001 | 00:00:00.000 - 00:00:04.200
 * Narration: Some voiceover text
 * Asset IDs: CHAR_001, LOC_001
 * Image Prompt: Full image prompt description
 *
 * Format B:
 * [00:00:00 - 00:00:04] Scene 1: Image prompt text
 */
export function parseTimestampedPrompts(rawText: string): SceneData[] {
  if (!rawText || !rawText.trim()) return [];

  const scenes: SceneData[] = [];
  const lines = rawText.split('\n');
  
  let currentSceneNumber = 1;
  let currentStart = 0;
  let currentEnd = 0;
  let currentPrompt = '';
  let currentNarration = '';
  let currentAssetIds: string[] = [];
  let isCollectingPrompt = false;

  const pushCurrentScene = () => {
    if (currentPrompt.trim()) {
      scenes.push({
        id: `scene-${currentSceneNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sceneNumber: currentSceneNumber,
        startTime: currentStart,
        endTime: Math.max(currentStart + 0.1, currentEnd),
        duration: Math.max(0.1, +(currentEnd - currentStart).toFixed(3)),
        prompt: currentPrompt.trim(),
        narration: currentNarration.trim() || undefined,
        assetIds: currentAssetIds.length > 0 ? currentAssetIds : undefined,
        status: 'pending',
        isApproved: false,
      });
      currentPrompt = '';
      currentNarration = '';
      currentAssetIds = [];
      isCollectingPrompt = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check Format A: Scene 001 | 00:00:00.000 - 00:00:04.200
    const headerMatchA = line.match(/^Scene\s*(\d+)\s*\|\s*([0-9:.]+)\s*(?:-|to)\s*([0-9:.]+)/i);
    // Check Format B: [00:00:00 - 00:00:04] Scene 1: prompt
    const headerMatchB = line.match(/^\[([0-9:.]+)\s*(?:-|to)\s*([0-9:.]+)\]\s*(?:Scene\s*(\d+)[:.]?)?\s*(.*)/i);

    if (headerMatchA) {
      pushCurrentScene();
      currentSceneNumber = parseInt(headerMatchA[1], 10);
      currentStart = parseTimestampToSeconds(headerMatchA[2]) ?? 0;
      currentEnd = parseTimestampToSeconds(headerMatchA[3]) ?? (currentStart + 4);
      continue;
    }

    if (headerMatchB) {
      pushCurrentScene();
      currentStart = parseTimestampToSeconds(headerMatchB[1]) ?? 0;
      currentEnd = parseTimestampToSeconds(headerMatchB[2]) ?? (currentStart + 4);
      currentSceneNumber = headerMatchB[3] ? parseInt(headerMatchB[3], 10) : scenes.length + 1;
      if (headerMatchB[4]) {
        currentPrompt = headerMatchB[4];
      }
      isCollectingPrompt = true;
      continue;
    }

    // Check subfields
    if (line.match(/^Narration\s*:\s*(.*)/i)) {
      const match = line.match(/^Narration\s*:\s*(.*)/i);
      currentNarration = match ? match[1] : '';
      continue;
    }

    if (line.match(/^Asset IDs\s*:\s*(.*)/i)) {
      const match = line.match(/^Asset IDs\s*:\s*(.*)/i);
      if (match && match[1]) {
        currentAssetIds = match[1].split(',').map(s => s.trim()).filter(Boolean);
      }
      continue;
    }

    if (line.match(/^Image Prompt\s*:\s*(.*)/i)) {
      const match = line.match(/^Image Prompt\s*:\s*(.*)/i);
      currentPrompt = match ? match[1] : '';
      isCollectingPrompt = true;
      continue;
    }

    // Continuation line
    if (isCollectingPrompt) {
      currentPrompt += (currentPrompt ? ' ' : '') + line;
    }
  }

  // Push final scene
  pushCurrentScene();

  // If no scenes detected with formal headers, try line-by-line fallback
  if (scenes.length === 0 && rawText.trim().length > 0) {
    const paragraphs = rawText.split(/\n\s*\n/).filter(p => p.trim());
    let runningStart = 0;
    paragraphs.forEach((p, idx) => {
      const dur = 4.0;
      scenes.push({
        id: `scene-${idx + 1}-${Date.now()}`,
        sceneNumber: idx + 1,
        startTime: +(runningStart).toFixed(3),
        endTime: +(runningStart + dur).toFixed(3),
        duration: dur,
        prompt: p.trim(),
        status: 'pending',
        isApproved: false,
      });
      runningStart += dur;
    });
  }

  // Ensure scenes are sorted by scene number & start time
  scenes.sort((a, b) => a.startTime - b.startTime || a.sceneNumber - b.sceneNumber);

  return scenes;
}

/**
 * Validates scene coverage and timestamp continuity
 */
export function validateSceneSequence(scenes: SceneData[], audioDuration?: number): ValidationReport {
  const issues: ValidationIssue[] = [];

  if (scenes.length === 0) {
    return {
      isValid: false,
      hasErrors: true,
      totalScenes: 0,
      totalSceneDuration: 0,
      audioDuration,
      coveragePercentage: 0,
      firstSceneStart: 0,
      lastSceneEnd: 0,
      issues: [{
        type: 'empty_prompt',
        severity: 'error',
        message: 'No scenes found. Please import or create scene prompts.',
      }],
      statusText: 'Needs Attention',
    };
  }

  let totalDuration = 0;
  const firstSceneStart = scenes[0].startTime;
  const lastSceneEnd = scenes[scenes.length - 1].endTime;

  if (firstSceneStart > 0.5) {
    issues.push({
      type: 'gap',
      severity: 'warning',
      sceneNumber: 1,
      message: `Scene 1 starts at ${formatSecondsToTimestamp(firstSceneStart)} instead of 00:00:00.000.`,
      details: 'There is a silence/uncovered gap at the start of the video.',
    });
  }

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const duration = scene.endTime - scene.startTime;
    totalDuration += Math.max(0, duration);

    if (scene.startTime >= scene.endTime) {
      issues.push({
        type: 'invalid_timestamp',
        severity: 'error',
        sceneNumber: scene.sceneNumber,
        message: `Scene ${scene.sceneNumber} has invalid start (${formatSecondsToTimestamp(scene.startTime)}) and end (${formatSecondsToTimestamp(scene.endTime)}).`,
      });
    }

    if (!scene.prompt || scene.prompt.trim().length === 0) {
      issues.push({
        type: 'empty_prompt',
        severity: 'error',
        sceneNumber: scene.sceneNumber,
        message: `Scene ${scene.sceneNumber} has an empty image prompt.`,
      });
    }

    if (i > 0) {
      const prevScene = scenes[i - 1];
      const gap = scene.startTime - prevScene.endTime;

      if (gap > 0.1) {
        issues.push({
          type: 'gap',
          severity: 'warning',
          sceneNumber: scene.sceneNumber,
          message: `Gap of ${gap.toFixed(2)}s between Scene ${prevScene.sceneNumber} (${formatSecondsToTimestamp(prevScene.endTime)}) and Scene ${scene.sceneNumber} (${formatSecondsToTimestamp(scene.startTime)}).`,
        });
      } else if (gap < -0.1) {
        issues.push({
          type: 'overlap',
          severity: 'error',
          sceneNumber: scene.sceneNumber,
          message: `Overlap of ${Math.abs(gap).toFixed(2)}s between Scene ${prevScene.sceneNumber} and Scene ${scene.sceneNumber}.`,
        });
      }
    }
  }

  // Audio duration checks
  let coveragePct = 100;
  if (audioDuration && audioDuration > 0) {
    coveragePct = Math.min(100, +((totalDuration / audioDuration) * 100).toFixed(1));
    const diff = Math.abs(lastSceneEnd - audioDuration);
    if (diff > 1.0) {
      if (lastSceneEnd < audioDuration) {
        issues.push({
          type: 'audio_mismatch',
          severity: 'warning',
          message: `Scenes cover ${formatSecondsToTimestamp(lastSceneEnd)}, but audio is ${formatSecondsToTimestamp(audioDuration)} (${(audioDuration - lastSceneEnd).toFixed(1)}s uncovered at end).`,
        });
      } else {
        issues.push({
          type: 'audio_mismatch',
          severity: 'warning',
          message: `Scenes extend ${diff.toFixed(1)}s past the audio duration.`,
        });
      }
    }
  }

  const hasErrors = issues.some(issue => issue.severity === 'error');
  const hasGaps = issues.some(issue => issue.type === 'gap');
  const hasOverlaps = issues.some(issue => issue.type === 'overlap');

  let statusText: ValidationReport['statusText'] = 'Synchronized';
  if (hasErrors) {
    statusText = 'Needs Attention';
  } else if (hasOverlaps) {
    statusText = 'Overlaps Detected';
  } else if (hasGaps) {
    statusText = 'Gaps Detected';
  } else if (issues.length > 0) {
    statusText = 'Mismatched';
  }

  return {
    isValid: !hasErrors,
    hasErrors,
    totalScenes: scenes.length,
    totalSceneDuration: +totalDuration.toFixed(3),
    audioDuration,
    coveragePercentage: coveragePct,
    firstSceneStart,
    lastSceneEnd,
    issues,
    statusText,
  };
}

/**
 * Ripple-adjusts scenes so that they are strictly continuous without gaps or overlaps
 */
export function rippleAdjustScenes(scenes: SceneData[]): SceneData[] {
  if (scenes.length === 0) return [];
  const adjusted: SceneData[] = [];
  let currentStart = 0;

  for (let i = 0; i < scenes.length; i++) {
    const originalDur = Math.max(1, scenes[i].endTime - scenes[i].startTime);
    const start = currentStart;
    const end = +(start + originalDur).toFixed(3);
    adjusted.push({
      ...scenes[i],
      sceneNumber: i + 1,
      startTime: start,
      endTime: end,
      duration: originalDur,
    });
    currentStart = end;
  }

  return adjusted;
}
