'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { ScriptToPromptsTab } from '@/components/ScriptToPromptsTab';
import { ScenesManagerTab } from '@/components/ScenesManagerTab';
import { TimelineAndRenderTab } from '@/components/TimelineAndRenderTab';
import { SettingsModal } from '@/components/SettingsModal';
import { ProjectState } from '@/lib/types';
import { getSection21DemoProject } from '@/lib/demo-data';
import { parseTimestampedPrompts } from '@/lib/timestamp-parser';
import { generateDemoNarrationWav } from '@/lib/audio-synthesizer';

export function ManhwaStudioApp() {
  const [activeTab, setActiveTab] = useState<'prompts' | 'scenes' | 'timeline'>('prompts');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initial default project with localStorage restoration
  const [project, setProject] = useState<ProjectState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('manhwa_studio_project');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.scenes && Array.isArray(parsed.scenes)) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Could not restore project from localStorage:', e);
      }
    }
    const defaultProj = getSection21DemoProject();
    if (typeof window !== 'undefined') {
      defaultProj.narrationAudioUrl = generateDemoNarrationWav(20);
    }
    return defaultProj;
  });


  // Save to localStorage whenever project changes
  useEffect(() => {
    try {
      localStorage.setItem('manhwa_studio_project', JSON.stringify(project));
    } catch (e) {
      console.warn('Could not persist project to localStorage:', e);
    }
  }, [project]);

  // Partial update helper
  const handleUpdateProject = (updates: Partial<ProjectState>) => {
    setProject((prev) => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  };

  // Quick load 5-Scene Section 21 Acceptance Test
  const handleLoadAcceptanceTest = () => {
    const demo = getSection21DemoProject();
    demo.narrationAudioUrl = generateDemoNarrationWav(20);
    setProject(demo);
    setActiveTab('scenes');
  };

  // Transfer prompts from Tab 1 to Tab 2
  const handleTransferToScenes = (rawPromptsText: string) => {
    const parsed = parseTimestampedPrompts(rawPromptsText);
    if (parsed.length > 0) {
      handleUpdateProject({ scenes: parsed });
      setActiveTab('scenes');
    }
  };

  // Export project to JSON
  const handleExportProject = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_project.json`;
    a.click();
  };

  // Import project from JSON
  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.scenes)) {
          setProject(parsed);
          setActiveTab('scenes');
        } else {
          alert('Invalid project JSON structure.');
        }
      } catch (err) {
        alert('Failed to parse project JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        project={project}
        onUpdateProjectName={(name) =>
          handleUpdateProject({
            name,
            settings: { ...project.settings, projectName: name },
          })
        }
        onLoadAcceptanceTest={handleLoadAcceptanceTest}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExportProject={handleExportProject}
        onImportProject={handleImportProject}
      />

      {/* Main Content Body */}
      <main className="flex-1 pb-16">
        {activeTab === 'prompts' && (
          <ScriptToPromptsTab
            project={project}
            onUpdateProject={handleUpdateProject}
            onTransferToScenes={handleTransferToScenes}
          />
        )}

        {activeTab === 'scenes' && (
          <ScenesManagerTab
            project={project}
            onUpdateProject={handleUpdateProject}
            onOpenTimeline={() => setActiveTab('timeline')}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineAndRenderTab
            project={project}
            onUpdateProject={handleUpdateProject}
          />
        )}
      </main>

      {/* Settings & Custom API Key Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={project.settings}
        onUpdateSettings={(newSettings) =>
          handleUpdateProject({
            settings: { ...project.settings, ...newSettings },
          })
        }
      />
    </div>
  );
}
export default ManhwaStudioApp;
