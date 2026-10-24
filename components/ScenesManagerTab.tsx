'use client';

import React, { useState } from 'react';
import JSZip from 'jszip';
import {
  Sparkles,
  Upload,
  Download,
  Play,
  Pause,
  RotateCw,
  CheckCircle,
  AlertTriangle,
  Image as ImageIcon,
  Check,
  Edit2,
  Trash2,
  Layers,
  Sliders,
  Filter,
  RefreshCw,
  Clock,
  Eye,
  FileArchive,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ProjectState, ReferenceItem } from '@/lib/types';
import {
  SceneData,
  parseTimestampedPrompts,
  validateSceneSequence,
  rippleAdjustScenes,
  formatSecondsToTimestamp,
  getSceneImageFilename,
} from '@/lib/timestamp-parser';
import { generateSceneImage } from '@/lib/gemini-client';

interface ScenesManagerTabProps {
  project: ProjectState;
  onUpdateProject: (updates: Partial<ProjectState>) => void;
  onOpenTimeline: () => void;
}

export function ScenesManagerTab({
  project,
  onUpdateProject,
  onOpenTimeline,
}: ScenesManagerTabProps) {
  const [importerText, setImporterText] = useState('');
  const [showImporter, setShowImporter] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingPromptText, setEditingPromptText] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [activeRefTab, setActiveRefTab] = useState<'character' | 'location' | 'prop' | 'style'>('character');

  // New reference form state
  const [newRefName, setNewRefName] = useState('');
  const [newRefDesc, setNewRefDesc] = useState('');
  const [newRefId, setNewRefId] = useState('');

  // Validate scenes with audio duration
  const validationReport = validateSceneSequence(project.scenes, project.narrationDuration);

  // Parse and import prompts from text area
  const handleImportPrompts = () => {
    if (!importerText.trim()) return;
    const parsed = parseTimestampedPrompts(importerText);
    if (parsed.length > 0) {
      onUpdateProject({ scenes: parsed });
      setShowImporter(false);
    }
  };

  // Auto fix gaps and overlaps
  const handleAutoRippleFix = () => {
    const adjusted = rippleAdjustScenes(project.scenes);
    onUpdateProject({ scenes: adjusted });
  };

  // Generate image for a single scene
  const generateSingleSceneImage = async (sceneId: string) => {
    const sceneIndex = project.scenes.findIndex((s) => s.id === sceneId);
    if (sceneIndex === -1) return;

    const scene = project.scenes[sceneIndex];
    const updatedScenes = [...project.scenes];
    updatedScenes[sceneIndex] = { ...scene, status: 'generating' };
    onUpdateProject({ scenes: updatedScenes });

    try {
      const data = await generateSceneImage({
        prompt: scene.prompt,
        sceneNumber: scene.sceneNumber,
        baseStyle: project.baseStylePrompt,
        aspectRatio: project.settings.aspectRatio,
        customApiKey: project.settings.customApiKey,
      });

      const currentList = [...project.scenes];
      currentList[sceneIndex] = {
        ...scene,
        imageUrl: data.imageUrl,
        status: 'generated',
        error: undefined,
      };
      onUpdateProject({ scenes: currentList });
    } catch (err: any) {
      const currentList = [...project.scenes];
      currentList[sceneIndex] = {
        ...scene,
        status: 'error',
        error: err.message || 'Image generation failed',
      };
      onUpdateProject({ scenes: currentList });
    }
  };

  // Batch generate all images sequentially
  const handleGenerateAllImages = async () => {
    if (project.scenes.length === 0 || isGeneratingBatch) return;

    setIsGeneratingBatch(true);
    setIsPaused(false);

    for (let i = 0; i < project.scenes.length; i++) {
      // Check if paused or unmounted
      const currentScene = project.scenes[i];
      if (currentScene.isApproved && currentScene.imageUrl) {
        continue; // preserve approved images as required by Section 10 & 12
      }

      await generateSingleSceneImage(currentScene.id);

      // Brief delay to prevent hitting aggressive rate limits
      await new Promise((r) => setTimeout(r, 600));
    }

    setIsGeneratingBatch(false);
  };

  // Download all images as ZIP archive with Section 11 naming format
  const handleDownloadAllZip = async () => {
    const zip = new JSZip();
    let count = 0;

    for (const scene of project.scenes) {
      if (scene.imageUrl) {
        const filename = getSceneImageFilename(scene.sceneNumber, scene.startTime, scene.endTime);
        if (scene.imageUrl.startsWith('data:image/svg+xml;charset=utf-8,')) {
          const svgText = decodeURIComponent(scene.imageUrl.replace('data:image/svg+xml;charset=utf-8,', ''));
          zip.file(filename.replace('.png', '.svg'), svgText);
          count++;
        } else if (scene.imageUrl.startsWith('data:image/svg+xml;base64,')) {
          const base64Data = scene.imageUrl.replace('data:image/svg+xml;base64,', '');
          zip.file(filename.replace('.png', '.svg'), base64Data, { base64: true });
          count++;
        } else if (scene.imageUrl.startsWith('data:image/png;base64,')) {
          const base64Data = scene.imageUrl.replace('data:image/png;base64,', '');
          zip.file(filename, base64Data, { base64: true });
          count++;
        } else if (scene.imageUrl.startsWith('data:image/jpeg;base64,')) {
          const base64Data = scene.imageUrl.replace('data:image/jpeg;base64,', '');
          zip.file(filename.replace('.png', '.jpg'), base64Data, { base64: true });
          count++;
        } else {
          try {
            const resp = await fetch(scene.imageUrl);
            const blob = await resp.blob();
            zip.file(filename, blob);
            count++;
          } catch (e) {
            console.error('Failed to add image to zip', e);
          }
        }
      }
    }

    if (count === 0) {
      alert('No generated images available to download yet. Click "Generate All Images" first!');
      return;
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_all_scene_images.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Upload custom replacement image
  const handleUploadReplacementImage = (sceneId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const updated = project.scenes.map((s) =>
        s.id === sceneId ? { ...s, imageUrl: result, status: 'generated' as const, error: undefined } : s
      );
      onUpdateProject({ scenes: updated });
    };
    reader.readAsDataURL(file);
  };

  // Add reference item
  const handleAddReference = () => {
    if (!newRefName.trim()) return;
    const prefix = activeRefTab === 'character' ? 'CHAR' : activeRefTab === 'location' ? 'LOC' : activeRefTab === 'prop' ? 'PROP' : 'STYLE';
    const autoId = newRefId.trim() || `${prefix}_${String(project.references.length + 1).padStart(3, '0')}`;

    const newRef: ReferenceItem = {
      id: autoId,
      type: activeRefTab,
      name: newRefName.trim(),
      description: newRefDesc.trim(),
      isPrimary: false,
    };

    onUpdateProject({ references: [...project.references, newRef] });
    setNewRefName('');
    setNewRefDesc('');
    setNewRefId('');
  };

  // Filter scenes
  const filteredScenes = project.scenes.filter((scene) => {
    if (filterStatus === 'pending') return scene.status === 'pending' || scene.status === 'queued';
    if (filterStatus === 'generated') return scene.status === 'generated';
    if (filterStatus === 'approved') return scene.isApproved;
    if (filterStatus === 'error') return scene.status === 'error';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-6 h-6 text-sky-400" />
            Scene Cards, References & Image Queue
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Import timestamped prompts, organize continuity references, and generate scene illustrations with automatic timestamp filenames.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImporter(!showImporter)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>{showImporter ? 'Hide Prompt Importer' : 'Paste & Import Prompts'}</span>
          </button>

          <button
            onClick={() => setShowReferences(!showReferences)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>References ({project.references.length})</span>
          </button>

          <button
            onClick={onOpenTimeline}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Open Timeline & Render</span>
          </button>
        </div>
      </div>

      {/* Timestamped Prompt Importer Panel */}
      {showImporter && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <label htmlFor="scene-prompts-textarea" className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Upload className="w-4 h-4 text-sky-400" />
              Paste Timestamped Scene Prompts (Accepts 100, 200, 500+ Scenes)
            </label>
            <span className="text-[11px] text-slate-400 font-mono">Format: Scene 001 | 00:00:00.000 - 00:00:04.200</span>
          </div>

          <textarea
            id="scene-prompts-textarea"
            rows={8}
            value={importerText}
            onChange={(e) => setImporterText(e.target.value)}
            placeholder={`Scene 001 | 00:00:00.000 - 00:00:04.200\nNarration: Jin awoke amidst shattered spires.\nAsset IDs: CHAR_001, LOC_001\nImage Prompt: Wide cinematic shot of a ruined kingdom at sunrise, detailed 2D Manhwa illustration.\n\nScene 002 | 00:00:04.200 - 00:00:09.500\nNarration: The shadow blade hummed with forbidden energy.\nAsset IDs: CHAR_001, PROP_001\nImage Prompt: Close-up of Jin holding a glowing shadowy dagger with blue energy crackling.`}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-sky-500/80 resize-y"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs text-slate-400">
              {importerText ? `${importerText.split('\n\n').filter(Boolean).length} prompt blocks detected` : 'Ready to parse'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setImporterText('')}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleImportPrompts}
                disabled={!importerText.trim()}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-40"
              >
                Parse & Import All Scenes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reference Manager Drawer (Section 8) */}
      {showReferences && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-200">Reference Image Manager (Section 8)</h3>
            </div>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {(['character', 'location', 'prop', 'style'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveRefTab(t)}
                  className={`px-2.5 py-1 rounded capitalize transition-all ${
                    activeRefTab === t ? 'bg-sky-500 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>

          {/* Add New Reference Form */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
            <input
              type="text"
              placeholder="Asset ID (e.g. CHAR_001)"
              value={newRefId}
              onChange={(e) => setNewRefId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <input
              type="text"
              placeholder="Name (e.g. Jin, Monarch Blade)"
              value={newRefName}
              onChange={(e) => setNewRefName(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <input
              type="text"
              placeholder="Visual details / description"
              value={newRefDesc}
              onChange={(e) => setNewRefDesc(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 sm:col-span-1"
            />
            <button
              type="button"
              onClick={handleAddReference}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
            >
              Add {activeRefTab}
            </button>
          </div>

          {/* Reference Items List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {project.references
              .filter((r) => r.type === activeRefTab)
              .map((ref) => (
                <div
                  key={ref.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                      {ref.id}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-200 mt-1 truncate">{ref.name}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{ref.description || 'No description'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateProject({
                        references: project.references.filter((r) => r.id !== ref.id),
                      })
                    }
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Remove reference"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            {project.references.filter((r) => r.type === activeRefTab).length === 0 && (
              <div className="col-span-full py-4 text-center text-xs text-slate-500">
                No {activeRefTab} references defined yet. Add one above or let the AI prompt engine detect them.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Synchronization & Validation Banner (Section 7, 8, 9) */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            {validationReport.isValid ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-semibold">
                <CheckCircle className="w-3.5 h-3.5" />
                {validationReport.statusText}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950 text-amber-300 border border-amber-800 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                {validationReport.statusText}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300 font-mono">
            <span>Scenes: <strong className="text-white">{project.scenes.length}</strong></span>
            <span>•</span>
            <span>Duration: <strong className="text-white">{formatSecondsToTimestamp(validationReport.totalSceneDuration)}</strong></span>
            {project.narrationDuration && (
              <>
                <span>•</span>
                <span>Audio: <strong className="text-sky-400">{formatSecondsToTimestamp(project.narrationDuration)}</strong></span>
                <span>•</span>
                <span>Coverage: <strong className="text-emerald-400">{validationReport.coveragePercentage}%</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Action: Auto-Ripple Adjust */}
        {validationReport.issues.some((i) => i.type === 'gap' || i.type === 'overlap') && (
          <button
            type="button"
            onClick={handleAutoRippleFix}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 text-xs font-semibold transition-colors self-start md:self-auto"
            title="Automatically align timestamps sequentially without gaps or overlaps"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Auto-Fix Continuity (Ripple Adjust)</span>
          </button>
        )}
      </div>

      {/* Global Base Style Prompt & Generation Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label htmlFor="base-style-input" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Global Base Visual Style & Quality Lock (Section 9)
          </label>
          <span className="text-[11px] text-slate-400">Applied automatically to every scene prompt</span>
        </div>
        <input
          id="base-style-input"
          type="text"
          value={project.baseStylePrompt}
          onChange={(e) => onUpdateProject({ baseStylePrompt: e.target.value })}
          placeholder="STRICT 2D Anime / Modern Manhwa illustration style, clean line art, detailed 2D shading, dramatic anime lighting, hand-drawn manhwa webtoon aesthetic. NO photorealistic humans, NO 3D CGI."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
        />

        {/* Generation Queue Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateAllImages}
              disabled={isGeneratingBatch || project.scenes.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-sky-500/20 disabled:opacity-50 transition-all"
            >
              {isGeneratingBatch ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating Scene Images in Queue...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate All Images</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadAllZip}
              disabled={!project.scenes.some((s) => s.imageUrl)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-40"
              title="Download all generated images as a ZIP archive with Section 11 timestamp filenames"
            >
              <FileArchive className="w-3.5 h-3.5 text-sky-400" />
              <span>Download All Images ZIP</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 mr-1 hidden sm:inline">Filter:</span>
            {['all', 'pending', 'generated', 'approved', 'error'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-2 py-1 rounded capitalize text-xs transition-colors ${
                  filterStatus === st
                    ? 'bg-slate-700 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scene Cards Grid (Section 12) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {filteredScenes.length} of {project.scenes.length} scenes
          </span>
          <span className="font-mono text-[11px]">
            {project.scenes.filter((s) => s.isApproved).length} approved /{' '}
            {project.scenes.filter((s) => s.imageUrl).length} generated
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredScenes.map((scene) => (
            <div
              key={scene.id}
              className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden ${
                scene.isApproved
                  ? 'bg-slate-900/90 border-emerald-800/80 ring-1 ring-emerald-500/30'
                  : scene.status === 'error'
                  ? 'bg-slate-900/90 border-rose-900/60'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-sky-400">
                    Scene {String(scene.sceneNumber).padStart(3, '0')}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                    {scene.duration.toFixed(1)}s
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <span
                    className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                      scene.status === 'generated'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : scene.status === 'generating'
                        ? 'bg-sky-950 text-sky-400 animate-pulse border border-sky-800'
                        : scene.status === 'error'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {scene.status}
                  </span>
                </div>
              </div>

              {/* Thumbnail / Image Area */}
              <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden group">
                {scene.imageUrl ? (
                  <>
                    <img
                      src={scene.imageUrl}
                      alt={`Scene ${scene.sceneNumber}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                      onClick={() => setPreviewImageUrl(scene.imageUrl!)}
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewImageUrl(scene.imageUrl!)}
                      aria-label="Enlarge Image"
                      className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
                    >
                      <Eye className="w-5 h-5 drop-shadow" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center text-slate-600">
                    <ImageIcon className="w-8 h-8 mb-1 stroke-1" />
                    <span className="text-[11px]">No Image Generated</span>
                  </div>
                )}
              </div>

              {/* Timestamp & Narration Quote */}
              <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                    <Clock className="w-3 h-3 text-sky-400 shrink-0" />
                    <span>
                      {formatSecondsToTimestamp(scene.startTime)} - {formatSecondsToTimestamp(scene.endTime)}
                    </span>
                  </div>

                  {scene.narration && (
                    <p className="text-xs text-slate-300 italic mt-1 line-clamp-2 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/60">
                      &ldquo;{scene.narration}&rdquo;
                    </p>
                  )}

                  {/* Prompt Text / Edit View */}
                  {editingSceneId === scene.id ? (
                    <div className="mt-2 space-y-1.5">
                      <textarea
                        rows={3}
                        value={editingPromptText}
                        onChange={(e) => setEditingPromptText(e.target.value)}
                        className="w-full bg-slate-950 border border-sky-500 rounded-lg p-2 text-xs text-slate-200 focus:outline-none"
                      />
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingSceneId(null)}
                          className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = project.scenes.map((s) =>
                              s.id === scene.id ? { ...s, prompt: editingPromptText } : s
                            );
                            onUpdateProject({ scenes: updated });
                            setEditingSceneId(null);
                          }}
                          className="px-2 py-0.5 rounded bg-sky-600 text-white text-[11px] font-medium"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-3 font-sans">
                      {scene.prompt}
                    </p>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => generateSingleSceneImage(scene.id)}
                      disabled={scene.status === 'generating'}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                      title={scene.imageUrl ? 'Regenerate this image' : 'Generate image'}
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${scene.status === 'generating' ? 'animate-spin' : ''}`} />
                    </button>

                    <label
                      aria-label="Upload Replacement Image"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                      title="Upload custom replacement image"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadReplacementImage(scene.id, e)}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingSceneId(scene.id);
                        setEditingPromptText(scene.prompt);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                      title="Edit scene prompt"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Approval Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = project.scenes.map((s) =>
                        s.id === scene.id ? { ...s, isApproved: !s.isApproved } : s
                      );
                      onUpdateProject({ scenes: updated });
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      scene.isApproved
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Lock and approve image"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span className="text-[11px]">{scene.isApproved ? 'Approved' : 'Approve'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredScenes.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-slate-300">No scenes found matching the current filter.</p>
              <p className="text-xs text-slate-500 mt-1">Import scene prompts or click Section 21 Demo in the top bar.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal image preview */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={previewImageUrl} alt="Full view" className="w-full h-auto max-h-[80vh] object-contain" />
            <div className="p-3 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-400">Generated Manhwa Scene Image</span>
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
