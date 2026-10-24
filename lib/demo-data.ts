import { ProjectState } from './types';
import { generateDemoNarrationWav } from './audio-synthesizer';

function createManhwaSvgDataUrl(sceneNumber: number, title: string, prompt: string, color: string) {
  const w = 1280;
  const h = 720;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g_${sceneNumber}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="100%" stop-color="${color}" />
      </linearGradient>
      <radialGradient id="aura_${sceneNumber}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.4" />
        <stop offset="100%" stop-color="transparent" />
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g_${sceneNumber})" />
    <circle cx="${w/2}" cy="${h/2}" r="380" fill="url(#aura_${sceneNumber})" filter="blur(30px)" />
    
    <!-- Manga Speedlines / Action Lines -->
    <g stroke="${color}" stroke-width="1.5" stroke-opacity="0.3">
      <line x1="${w/2}" y1="${h/2}" x2="0" y2="0" />
      <line x1="${w/2}" y1="${h/2}" x2="${w}" y2="0" />
      <line x1="${w/2}" y1="${h/2}" x2="0" y2="${h}" />
      <line x1="${w/2}" y1="${h/2}" x2="${w}" y2="${h}" />
      <line x1="${w/2}" y1="${h/2}" x2="${w/2}" y2="0" />
      <line x1="${w/2}" y1="${h/2}" x2="${w/2}" y2="${h}" />
    </g>

    <!-- Stylized 2D Manhwa Character / Symbol -->
    <g transform="translate(${w/2 - 120}, ${h/2 - 130}) scale(1.2)">
      <circle cx="100" cy="110" r="90" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6 4" opacity="0.6"/>
      <path d="M100 25 L115 65 L100 80 L85 65 Z" fill="${color}" opacity="0.9" />
      <circle cx="100" cy="55" r="22" fill="#e2e8f0" />
      <path d="M60 170 C60 115, 140 115, 140 170 Z" fill="#1e293b" />
      <path d="M70 135 L20 190 L40 200 L85 155 Z" fill="#334155" />
      <path d="M130 135 L180 190 L160 200 L115 155 Z" fill="#334155" />
    </g>

    <!-- Border Framing -->
    <rect x="24" y="24" width="${w - 48}" height="${h - 48}" fill="none" stroke="#475569" stroke-width="2" stroke-opacity="0.4" />
    
    <!-- Scene Badge -->
    <g transform="translate(48, 56)">
      <rect width="210" height="38" rx="8" fill="#030712" fill-opacity="0.9" stroke="#334155" stroke-width="1"/>
      <text x="14" y="24" font-family="system-ui, sans-serif" font-weight="bold" font-size="14" fill="#38bdf8">SCENE 00${sceneNumber}</text>
      <text x="105" y="24" font-family="system-ui, sans-serif" font-weight="600" font-size="12" fill="#94a3b8">${title}</text>
    </g>

    <!-- Subtitle Card -->
    <g transform="translate(48, ${h - 96})">
      <rect width="${w - 96}" height="60" rx="10" fill="#030712" fill-opacity="0.9" stroke="#1e293b" stroke-width="1"/>
      <text x="18" y="24" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#38bdf8">NARRATION &amp; PROMPT:</text>
      <text x="18" y="44" font-family="system-ui, sans-serif" font-size="12" fill="#e2e8f0">${prompt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getSection21DemoProject(): ProjectState {
  return {
    id: 'section-21-acceptance-test',
    name: 'Manhwa Recap: The Shadow Monarch Awakens',
    updatedAt: '2026-10-24T00:00:00.000Z',
    narrationAudioUrl: '',
    narrationAudioName: 'acceptance_test_narration_20s.wav',
    narrationDuration: 20.0,
    baseStylePrompt:
      'STRICT 2D Anime / Modern Manhwa illustration style with clean line art, detailed 2D shading, dramatic anime lighting, hand-drawn manhwa webtoon aesthetic. NO photorealistic humans, NO 3D CGI.',
    storyScript: `In a ruined kingdom at sunrise, the ancient monoliths stood broken under a crimson dawn.
Jin walked silently through the abandoned streets, his gaze fixed on the shattered spires.
He paused, looking up as dark tendrils of energy coiled around his gauntlet.
Drawing his shadow sovereign dagger, a brilliant azure luminescence pulsed from the edge.
Far above in the clouds, the monarch's dormant seal shattered, heralding a new era of shadow.`,
    references: [
      {
        id: 'CHAR_001',
        type: 'character',
        name: 'Jin Woo',
        description: 'Main protagonist, athletic build, sharp eyes with violet-blue glow, dark messy hair, black trench coat with silver buckles.',
        isPrimary: true,
      },
      {
        id: 'LOC_001',
        type: 'location',
        name: 'Ruined Monolith Kingdom',
        description: 'Crumbling gothic towers, obsidian cobblestone streets, misty sunrise horizon with purple-tinted clouds.',
        isPrimary: true,
      },
      {
        id: 'PROP_001',
        type: 'prop',
        name: 'Shadow Sovereign Dagger',
        description: 'Forged from dark dragon bone, etched with glowing cyan runes, emits faint mist.',
        isPrimary: true,
      },
      {
        id: 'STYLE_001',
        type: 'style',
        name: 'Modern Webtoon 2D',
        description: 'High-contrast digital ink, vibrant energy glows, sharp anime character anatomy.',
        isPrimary: true,
      },
    ],
    settings: {
      projectName: 'Manhwa Recap: The Shadow Monarch Awakens',
      aspectRatio: '16:9',
      resolution: '1080p',
      frameRate: 30,
      defaultTransition: 'direct_cut',
      globalAnimationPreset: 'auto_cinematic',
      zoomIntensity: 1.15,
      panDistance: 0.1,
      motionSpeed: 'normal',
    },
    scenes: [
      {
        id: 'demo-scene-1',
        sceneNumber: 1,
        startTime: 0.0,
        endTime: 4.2,
        duration: 4.2,
        narration: 'In a ruined kingdom at sunrise, the ancient monoliths stood broken under a crimson dawn.',
        assetIds: ['LOC_001'],
        prompt: 'Wide cinematic shot of a ruined kingdom at sunrise, towering cracked spires under dramatic red-orange dawn sky, detailed 2D Manhwa background art.',
        imageUrl: createManhwaSvgDataUrl(1, 'RUINED KINGDOM', 'Wide cinematic shot of a ruined kingdom at sunrise with ancient monoliths.', '#1e1b4b'),
        status: 'approved',
        isApproved: true,
        motionEffect: 'smooth_zoom_in',
      },
      {
        id: 'demo-scene-2',
        sceneNumber: 2,
        startTime: 4.2,
        endTime: 9.5,
        duration: 5.3,
        narration: 'Jin walked silently through the abandoned streets, his gaze fixed on the shattered spires.',
        assetIds: ['CHAR_001', 'LOC_001'],
        prompt: 'Full-body medium shot of Jin walking forward down a ruined stone street, wind blowing through black trench coat, determined posture, detailed 2D Manhwa line art.',
        imageUrl: createManhwaSvgDataUrl(2, 'SOLITARY WARRIOR', 'Jin walks through the abandoned streets, examining the broken monuments.', '#172554'),
        status: 'approved',
        isApproved: true,
        motionEffect: 'pan_left_right',
      },
      {
        id: 'demo-scene-3',
        sceneNumber: 3,
        startTime: 9.5,
        endTime: 14.0,
        duration: 4.5,
        narration: 'He paused, looking up as dark tendrils of energy coiled around his gauntlet.',
        assetIds: ['CHAR_001'],
        prompt: 'Intense close-up of Jin\'s face with glowing violet eyes, sharp angular anime facial features, dark energy sparks swirling around cheek, dramatic rim lighting.',
        imageUrl: createManhwaSvgDataUrl(3, 'AWAKENING GLOW', 'Close-up of Jin with glowing violet eyes and dark aura coiling.', '#4a044e'),
        status: 'approved',
        isApproved: true,
        motionEffect: 'smooth_zoom_out',
      },
      {
        id: 'demo-scene-4',
        sceneNumber: 4,
        startTime: 14.0,
        endTime: 17.5,
        duration: 3.5,
        narration: 'Drawing his shadow sovereign dagger, a brilliant azure luminescence pulsed from the edge.',
        assetIds: ['CHAR_001', 'PROP_001'],
        prompt: 'Dynamic action pose of Jin unsheathing a black rune dagger that flares with brilliant cyan plasma energy, speedlines, high contrast 2D webtoon battle art.',
        imageUrl: createManhwaSvgDataUrl(4, 'SHADOW BLADE', 'Dynamic pose unsheathing cyan-flaring runic shadow blade.', '#083344'),
        status: 'approved',
        isApproved: true,
        motionEffect: 'zoom_in_pan',
      },
      {
        id: 'demo-scene-5',
        sceneNumber: 5,
        startTime: 17.5,
        endTime: 20.0,
        duration: 2.5,
        narration: 'Far above in the clouds, the monarch\'s dormant seal shattered, heralding a new era of shadow.',
        assetIds: ['LOC_001', 'CHAR_001'],
        prompt: 'Colossal silhouette of the Shadow Monarch emerging from torn dimensional storm clouds above the horizon, glowing purple celestial glyphs, awe-inspiring 2D anime finale.',
        imageUrl: createManhwaSvgDataUrl(5, 'MONARCH ASCENSION', 'Colossal shadow monarch rises in the clouds as ancient seals break.', '#311042'),
        status: 'approved',
        isApproved: true,
        motionEffect: 'smooth_zoom_in',
      },
    ],
  };
}
