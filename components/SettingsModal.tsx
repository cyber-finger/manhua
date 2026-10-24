'use client';

import React from 'react';
import { X, Key, Monitor, Sparkles, Sliders, ShieldCheck } from 'lucide-react';
import { ProjectSettings } from '@/lib/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProjectSettings;
  onUpdateSettings: (newSettings: Partial<ProjectSettings>) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-slate-100">Project Settings & Hosting Config</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-6 space-y-5 text-xs sm:text-sm">
          {/* Custom API Key Input (Crucial for GitHub Pages / Subdomain self-hosting) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="custom-gemini-key" className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-400" />
                Custom Gemini API Key (Optional)
              </label>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Saved locally in browser
              </span>
            </div>
            <p className="text-xs text-slate-400">
              When deployed to your personal GitHub Pages, Vercel, or custom subdomain, enter your Gemini API key here so you can generate scene prompts and images directly.
            </p>
            <input
              id="custom-gemini-key"
              type="password"
              value={settings.customApiKey || ''}
              onChange={(e) => onUpdateSettings({ customApiKey: e.target.value })}
              placeholder="AIzaSy..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Video Aspect Ratio</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '16:9', label: '16:9 Landscape', desc: 'YouTube & Desktop' },
                { id: '9:16', label: '9:16 Vertical', desc: 'Shorts & TikTok' },
                { id: '1:1', label: '1:1 Square', desc: 'Instagram & Square' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ aspectRatio: opt.id as any })}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    settings.aspectRatio === opt.id
                      ? 'bg-sky-950/80 border-sky-500 text-sky-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-xs text-white">{opt.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Resolution & Framerate */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="resolution-select" className="font-semibold text-slate-200">Resolution</label>
              <select
                id="resolution-select"
                value={settings.resolution}
                onChange={(e) => onUpdateSettings({ resolution: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="1080p">1080p (Full HD)</option>
                <option value="720p">720p (HD)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="framerate-select" className="font-semibold text-slate-200">Frame Rate</label>
              <select
                id="framerate-select"
                value={settings.frameRate}
                onChange={(e) => onUpdateSettings({ frameRate: parseInt(e.target.value, 10) as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value={30}>30 FPS (Standard)</option>
                <option value={24}>24 FPS (Cinematic)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors"
          >
            Save & Done
          </button>
        </div>
      </div>
    </div>
  );
}
