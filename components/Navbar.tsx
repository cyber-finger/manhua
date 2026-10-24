'use client';

import React from 'react';
import { Film, PlaySquare, Settings, Upload, Download, Sparkles, Smartphone, Monitor } from 'lucide-react';
import { ProjectState } from '@/lib/types';

interface NavbarProps {
  activeTab: 'prompts' | 'scenes' | 'timeline';
  setActiveTab: (tab: 'prompts' | 'scenes' | 'timeline') => void;
  project: ProjectState;
  onUpdateProjectName: (name: string) => void;
  onLoadAcceptanceTest: () => void;
  onOpenSettings: () => void;
  onExportProject: () => void;
  onImportProject: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function Navbar({
  activeTab,
  setActiveTab,
  project,
  onUpdateProjectName,
  onLoadAcceptanceTest,
  onOpenSettings,
  onExportProject,
  onImportProject,
}: NavbarProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Main Bar */}
        <div className="h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Logo and Project Name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-600 to-rose-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Film className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs sm:text-base text-slate-100 tracking-tight truncate">
                  MANHWA STUDIO
                </span>
                <span className="text-[9px] uppercase font-semibold px-1 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                  PROD
                </span>
              </div>
              <input
                type="text"
                value={project.name}
                onChange={(e) => onUpdateProjectName(e.target.value)}
                aria-label="Project Name"
                className="bg-transparent text-[11px] sm:text-xs text-slate-400 hover:text-slate-200 focus:text-slate-100 focus:bg-slate-900 px-1 py-0.5 rounded outline-none w-28 sm:w-56 truncate transition-colors"
                title="Click to rename project"
              />
            </div>
          </div>

          {/* Desktop Navigation Tabs (Hidden on small mobile) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs sm:text-sm font-medium">
            <button
              onClick={() => setActiveTab('prompts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'prompts'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title="Step 1: Convert Story & Voiceover to Timestamps"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>1. Script & Prompts</span>
            </button>

            <button
              onClick={() => setActiveTab('scenes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'scenes'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title="Step 2: Scene Importer & AI Image Generator"
            >
              <PlaySquare className="w-3.5 h-3.5" />
              <span>2. Scenes & Images ({project.scenes.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'timeline'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title="Step 3: Synchronized Timeline, Motion & Render Video"
            >
              <Film className="w-3.5 h-3.5" />
              <span>3. Timeline & Render</span>
            </button>
          </nav>

          {/* Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Acceptance Test button */}
            <button
              onClick={onLoadAcceptanceTest}
              className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 transition-colors shadow-sm"
              title="Load 5-Scene 20-Second Acceptance Test (Section 21)"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Demo</span>
            </button>

            {/* Project Backup / Restore */}
            <button
              onClick={onExportProject}
              aria-label="Export Project JSON"
              className="p-1.5 sm:p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
              title="Export Project JSON"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Import Project JSON"
              className="p-1.5 sm:p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
              title="Import Project JSON"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImportProject}
              accept=".json"
              className="hidden"
            />

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              aria-label="Open Studio Settings"
              className="p-1.5 sm:p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
              title="Project Settings & API Key"
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Tabs */}
        <div className="md:hidden pb-2.5 pt-1">
          <nav className="grid grid-cols-3 gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-center text-xs font-medium">
            <button
              onClick={() => setActiveTab('prompts')}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all ${
                activeTab === 'prompts'
                  ? 'bg-sky-500 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>1. Script</span>
            </button>

            <button
              onClick={() => setActiveTab('scenes')}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all ${
                activeTab === 'scenes'
                  ? 'bg-sky-500 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlaySquare className="w-3 h-3" />
              <span>2. Scenes ({project.scenes.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all ${
                activeTab === 'timeline'
                  ? 'bg-sky-500 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-3 h-3" />
              <span>3. Render</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
