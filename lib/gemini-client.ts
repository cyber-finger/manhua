import { parseTimestampedPrompts, SceneData } from './timestamp-parser';

export async function analyzeStoryWithGemini(params: {
  story: string;
  audioDuration?: number;
  customApiKey?: string;
  characterAtlas?: string;
  locationAtlas?: string;
  propsAtlas?: string;
}): Promise<{ rawText: string; scenes: SceneData[] }> {
  const { story, audioDuration, customApiKey, characterAtlas, locationAtlas, propsAtlas } = params;

  // 1. Try Next.js server route first (if running on Node.js/Cloud Run/Vercel)
  try {
    const res = await fetch('/api/gemini/analyze-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        story,
        audioDuration,
        customApiKey,
        characterAtlas,
        locationAtlas,
        propsAtlas,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        rawText: data.rawText || '',
        scenes: data.scenes || parseTimestampedPrompts(data.rawText || ''),
      };
    }
  } catch (err) {
    // Server route unavailable (e.g. static hosting on GitHub Pages)
  }

  // 2. Direct browser fallback using user's Gemini API key (for GitHub Pages / static subdomains)
  if (!customApiKey) {
    throw new Error(
      'When running on GitHub Pages or a static host, please click the Settings icon and enter your Gemini API key.'
    );
  }

  const timingInstruction =
    audioDuration && audioDuration > 0
      ? `The voiceover narration lasts EXACTLY ${audioDuration.toFixed(3)} seconds. You MUST ensure the sequence of scenes starts at 00:00:00.000 and ends exactly at ${audioDuration.toFixed(3)} seconds. Divide the full story chronologically across this duration into meaningful visual beats.`
      : `No voiceover audio was uploaded. Estimate pacing at approximately 3.5 to 5.0 seconds per visual beat in chronological order, starting at 00:00:00.000.`;

  const systemPrompt = `You are a professional audiovisual director and Manhwa / Anime recap producer specialized in creating timestamped image prompts for video generation.
Follow these STRICT rules:
1. Divide the provided story into sequential visual scenes. Never combine unrelated story beats into one scene.
2. Every scene MUST follow this exact format:
Scene ### | HH:MM:SS.mmm - HH:MM:SS.mmm
Narration: [exact short line from the story or voiceover excerpt]
Asset IDs: [comma-separated IDs like CHAR_001, LOC_001, PROP_001 if applicable]
Image Prompt: [Comprehensive, ready-to-use 2D Manhwa / Anime illustration prompt. Include camera angle, subject pose, facial expression, background environment, dramatic lighting, and crisp 2D line art style. NO photorealism, NO 3D CGI.]

3. ${timingInstruction}
4. Ensure consecutive scenes have contiguous timestamps.
5. Output ONLY the copy-ready scene blocks. Avoid Markdown tables or conversational text.`;

  const userPrompt = `Story/Script:
${story}

${characterAtlas ? `Character Database / Atlas:\n${characterAtlas}\n` : ''}
${locationAtlas ? `Location Database / Atlas:\n${locationAtlas}\n` : ''}
${propsAtlas ? `Props Database / Atlas:\n${propsAtlas}\n` : ''}

Generate the complete timestamped scene prompts now:`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${customApiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Gemini API request failed with status ${response.status}`
    );
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const scenes = parseTimestampedPrompts(rawText);

  return { rawText, scenes };
}

export async function generateSceneImage(params: {
  prompt: string;
  sceneNumber: number;
  baseStyle?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  customApiKey?: string;
}): Promise<{ imageUrl: string; isRealGeneration: boolean }> {
  const { prompt, sceneNumber, baseStyle, aspectRatio = '16:9', customApiKey } = params;

  // 1. Try server route first
  try {
    const res = await fetch('/api/gemini/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        sceneNumber,
        baseStyle,
        aspectRatio,
        customApiKey,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        imageUrl: data.imageUrl,
        isRealGeneration: !!data.isRealGeneration,
      };
    }
  } catch (err) {
    // Server unavailable
  }

  // 2. High quality stylized Manhwa SVG Canvas generator (client-side fallback)
  const width = aspectRatio === '9:16' ? 720 : aspectRatio === '1:1' ? 1080 : 1280;
  const height = aspectRatio === '9:16' ? 1280 : aspectRatio === '1:1' ? 1080 : 720;

  const isDark =
    prompt.toLowerCase().includes('night') ||
    prompt.toLowerCase().includes('dark') ||
    prompt.toLowerCase().includes('ruin');
  const isAction =
    prompt.toLowerCase().includes('sword') ||
    prompt.toLowerCase().includes('battle') ||
    prompt.toLowerCase().includes('fight') ||
    prompt.toLowerCase().includes('magic');

  const bg1 = isDark ? '#0f172a' : isAction ? '#180e29' : '#111827';
  const bg2 = isDark ? '#1e1b4b' : isAction ? '#450a0a' : '#1e293b';
  const accent = isAction ? '#f43f5e' : isDark ? '#6366f1' : '#06b6d4';

  const safePrompt = prompt
    .slice(0, 105)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg_${sceneNumber}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}" />
        <stop offset="100%" stop-color="${bg2}" />
      </linearGradient>
      <linearGradient id="glow_${sceneNumber}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.35" />
        <stop offset="100%" stop-color="transparent" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg_${sceneNumber})" />
    <g stroke="${accent}" stroke-width="1.5" stroke-opacity="0.25">
      <line x1="${width / 2}" y1="${height / 2}" x2="0" y2="0" />
      <line x1="${width / 2}" y1="${height / 2}" x2="${width}" y2="0" />
      <line x1="${width / 2}" y1="${height / 2}" x2="0" y2="${height}" />
      <line x1="${width / 2}" y1="${height / 2}" x2="${width}" y2="${height}" />
    </g>
    <circle cx="${width / 2}" cy="${height / 2}" r="${width * 0.35}" fill="url(#glow_${sceneNumber})" filter="blur(40px)" />
    <g transform="translate(${width / 2 - 120}, ${height / 2 - 140}) scale(1.2)">
      <circle cx="100" cy="120" r="90" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="8 6" opacity="0.6"/>
      <path d="M100 20 L115 65 L100 80 L85 65 Z" fill="${accent}" opacity="0.8" />
      <circle cx="100" cy="50" r="22" fill="#e2e8f0" />
      <path d="M60 180 C60 110, 140 110, 140 180 Z" fill="#334155" />
      <path d="M70 140 L20 200 L40 210 L85 160 Z" fill="#1e293b" />
      <path d="M130 140 L180 200 L160 210 L115 160 Z" fill="#1e293b" />
    </g>
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="#475569" stroke-width="2" stroke-opacity="0.4" />
    <g transform="translate(48, 56)">
      <rect width="180" height="34" rx="6" fill="#030712" fill-opacity="0.85" stroke="#334155" stroke-width="1"/>
      <text x="14" y="22" font-family="system-ui, sans-serif" font-weight="bold" font-size="14" fill="#38bdf8" letter-spacing="1">SCENE ${String(sceneNumber).padStart(3, '0')}</text>
      <text x="105" y="22" font-family="system-ui, sans-serif" font-weight="600" font-size="12" fill="#94a3b8">MANHWA 2D</text>
    </g>
    <g transform="translate(48, ${height - 90})">
      <rect width="${width - 96}" height="56" rx="8" fill="#030712" fill-opacity="0.85" stroke="#1e293b" stroke-width="1"/>
      <text x="18" y="24" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#f8fafc" opacity="0.9">PROMPT:</text>
      <text x="18" y="42" font-family="system-ui, sans-serif" font-size="12" fill="#cbd5e1" opacity="0.85">${safePrompt}</text>
    </g>
  </svg>`;

  return {
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    isRealGeneration: false,
  };
}
