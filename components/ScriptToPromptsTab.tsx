'use client';

import React, { useState } from 'react';
import {
  FileText,
  Mic,
  Play,
  Pause,
  Copy,
  Check,
  Download,
  ArrowRight,
  Sparkles,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ProjectState } from '@/lib/types';
import { formatSecondsToTimestamp, parseTimestampedPrompts } from '@/lib/timestamp-parser';
import { generateDemoNarrationWav } from '@/lib/audio-synthesizer';

interface ScriptToPromptsTabProps {
  project: ProjectState;
  onUpdateProject: (updates: Partial<ProjectState>) => void;
  onTransferToScenes: (promptsText: string) => void;
}

export function ScriptToPromptsTab({
  project,
  onUpdateProject,
  onTransferToScenes,
}: ScriptToPromptsTabProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [outputPromptsText, setOutputPromptsText] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAtlasPanels, setShowAtlasPanels] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Handle narration audio file upload
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);

      audio.onloadedmetadata = () => {
        onUpdateProject({
          narrationAudioUrl: audioUrl,
          narrationAudioName: file.name,
          narrationDuration: audio.duration,
        });
      };
    } catch (err: any) {
      setErrorMsg('Failed to read audio file: ' + err.message);
    }
  };

  const handleUseDemoAudio = () => {
    const demoWav = generateDemoNarrationWav(20);
    onUpdateProject({
      narrationAudioUrl: demoWav,
      narrationAudioName: 'manhwa_demo_narration_20s.wav',
      narrationDuration: 20.0,
    });
  };

  const toggleAudioPlayback = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(console.error);
    }
  };

  // Generate timestamped prompts via Gemini API
  const handleAnalyzeAndGenerate = async () => {
    if (!project.storyScript || !project.storyScript.trim()) {
      setErrorMsg('Please enter or paste your story or recap script first.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/gemini/analyze-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: project.storyScript,
          audioDuration: project.narrationDuration,
          customApiKey: project.settings.customApiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate prompts');
      }

      setOutputPromptsText(data.rawText || '');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Generation failed. Please verify your Gemini API key.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyAll = () => {
    if (!outputPromptsText) return;
    navigator.clipboard.writeText(outputPromptsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportTxt = () => {
    if (!outputPromptsText) return;
    const blob = new Blob([outputPromptsText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_prompts.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Intro Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-sky-400" />
            Story & Voiceover to Timestamped Prompts
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Section 21A Engine: Convert full story text and voiceover audio into precision timestamped 2D Manhwa scene prompts.
          </p>
        </div>

        {/* Audio status pill */}
        <div className="flex items-center gap-2">
          {project.narrationAudioUrl ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-950/70 border border-sky-800 text-sky-300 text-xs">
              <button
                onClick={toggleAudioPlayback}
                aria-label={isPlayingAudio ? 'Pause Narration' : 'Play Narration'}
                className="p-1 rounded bg-sky-600 hover:bg-sky-500 text-white transition-colors"
              >
                {isPlayingAudio ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <audio
                ref={audioRef}
                src={project.narrationAudioUrl}
                onEnded={() => setIsPlayingAudio(false)}
                className="hidden"
              />
              <span className="font-mono font-medium">
                {formatSecondsToTimestamp(project.narrationDuration || 0)}
              </span>
              <span className="text-slate-400 truncate max-w-[120px]">
                {project.narrationAudioName || 'Audio'}
              </span>
            </div>
          ) : (
            <div className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900/50 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>No audio uploaded (Timestamps will be estimated)</span>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Inputs on Left, Output on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Script and Voiceover Inputs */}
        <div className="space-y-5">
          {/* Audio Upload Box */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Mic className="w-4 h-4 text-sky-400" />
                Narration Voiceover (Master Clock)
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {project.narrationDuration
                  ? `Duration: ${formatSecondsToTimestamp(project.narrationDuration)}`
                  : 'Authority for Timing'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
              >
                <Mic className="w-3.5 h-3.5 text-sky-400" />
                <span>{project.narrationAudioUrl ? 'Change Audio File' : 'Upload MP3 / WAV'}</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAudioUpload}
                accept="audio/*"
                className="hidden"
              />

              <button
                type="button"
                onClick={handleUseDemoAudio}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Use 20s Demo Narration</span>
              </button>
            </div>
          </div>

          {/* Story / Script Text Area */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="story-script-input"
                className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-indigo-400" />
                Story / Narration Script Text
              </label>
              <span className="text-[11px] text-slate-400">
                {project.storyScript ? `${project.storyScript.split(/\s+/).length} words` : 'Paste Full Story'}
              </span>
            </div>

            <textarea
              id="story-script-input"
              rows={9}
              value={project.storyScript}
              onChange={(e) => onUpdateProject({ storyScript: e.target.value })}
              placeholder="Paste your Manhwa story, chapter summary, or recap voiceover script here... (e.g. 'In a ruined kingdom at the dawn of time, Jin awoke alone amidst shattered spires. With his fractured shadow blade, he vowed to challenge the monarchs...')"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/50 transition-all font-sans leading-relaxed resize-y"
            />
          </div>

          {/* Collapsible Atlas Guidelines (Page 1 of PDF) */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <button
              onClick={() => setShowAtlasPanels(!showAtlasPanels)}
              className="w-full flex items-center justify-between text-left text-xs sm:text-sm font-semibold text-slate-300 hover:text-slate-100"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Character, Location & Props Atlas Directives (PDF Page 1)
              </span>
              {showAtlasPanels ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAtlasPanels && (
              <div className="pt-2 text-xs text-slate-400 space-y-3">
                <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <div className="font-semibold text-sky-300 mb-1">1. Character Atlas Standard</div>
                  <div>
                    16:9 landscape CHARACTER ATLAS with full-body front, side, and back views, facial expressions. Stable IDs: CHAR_001, CHAR_002. STRICT 2D Anime/Modern Manhwa line art.
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <div className="font-semibold text-emerald-300 mb-1">2. Location Atlas Standard</div>
                  <div>
                    16:9 landscape LOCATION ATLAS showing terrain, architecture, landmarks, lighting. Stable IDs: LOC_001, LOC_002. STRICT 2D Anime/Modern Manhwa background art.
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <div className="font-semibold text-amber-300 mb-1">3. Props Atlas Standard</div>
                  <div>
                    16:9 landscape PROPS ATLAS with weapon, artifact, tool shapes and markings. Stable IDs: PROP_001, PROP_002.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Big Action Button */}
          <button
            onClick={handleAnalyzeAndGenerate}
            disabled={isAnalyzing || !project.storyScript.trim()}
            className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Analyzing Story & Generating Precision Timestamps...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>ANALYZE STORY + GENERATE TIMESTAMPED PROMPTS</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Output Copy-Ready Block */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 flex flex-col h-full min-h-[500px]">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <label
                htmlFor="copy-ready-prompts"
                className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                Copy-Ready Output Format (Section 21A & 6)
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  disabled={!outputPromptsText}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-40"
                  title="Copy formatted prompts to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy All'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportTxt}
                  disabled={!outputPromptsText}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors disabled:opacity-40"
                  title="Export prompts as .txt file"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Display */}
            <textarea
              id="copy-ready-prompts"
              rows={14}
              value={outputPromptsText}
              onChange={(e) => setOutputPromptsText(e.target.value)}
              placeholder="Your timestamped scene prompt blocks will appear here automatically:&#10;&#10;Scene 001 | 00:00:00.000 - 00:00:04.200&#10;Narration: Jin woke up in the ruins.&#10;Asset IDs: CHAR_001, LOC_001&#10;Image Prompt: Wide cinematic shot of a ruined kingdom at sunrise, detailed 2D Manhwa illustration..."
              className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-200 font-mono leading-relaxed placeholder-slate-600 focus:outline-none focus:border-sky-500/80 resize-none"
            />

            {/* Transfer to Scene Importer Button */}
            {outputPromptsText.trim().length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onTransferToScenes(outputPromptsText)}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
                >
                  <span>TRANSFER TO SCENE IMPORTER & STUDIO TIMELINE</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
