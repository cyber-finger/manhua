import { SceneData, ValidationReport } from './timestamp-parser';

export type ReferenceType = 'character' | 'location' | 'prop' | 'style';

export interface ReferenceItem {
  id: string; // e.g. CHAR_001, LOC_001, PROP_001
  type: ReferenceType;
  name: string;
  description: string;
  imageUrl?: string;
  isPrimary?: boolean;
}

export type AnimationPreset =
  | 'smooth_zoom_in'
  | 'smooth_zoom_out'
  | 'pan_left_right'
  | 'pan_right_left'
  | 'pan_bottom_top'
  | 'pan_top_bottom'
  | 'zoom_in_pan'
  | 'zoom_out_pan'
  | 'auto_cinematic'
  | 'no_motion';

export interface ProjectSettings {
  projectName: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  resolution: '1080p' | '720p';
  frameRate: 24 | 30;
  defaultTransition: 'direct_cut';
  globalAnimationPreset: AnimationPreset;
  zoomIntensity: number; // e.g., 1.15
  panDistance: number; // e.g., 0.1
  motionSpeed: 'slow' | 'normal' | 'fast';
  customApiKey?: string;
}

export interface ProjectState {
  id: string;
  name: string;
  updatedAt: string;
  narrationAudioUrl?: string;
  narrationAudioName?: string;
  narrationDuration?: number;
  baseStylePrompt: string;
  storyScript: string;
  scenes: SceneData[];
  references: ReferenceItem[];
  settings: ProjectSettings;
  finalVideoUrl?: string;
}
