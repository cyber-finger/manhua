import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt, sceneNumber, baseStyle, aspectRatio = "16:9", customApiKey } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Image prompt is required." }, { status: 400 });
    }

    const apiKey = customApiKey || process.env.GEMINI_API_KEY;

    const fullPrompt = `${baseStyle ? baseStyle + ". " : ""}STRICT 2D Anime / Modern Manhwa illustration style, clean line art, detailed 2D shading, dramatic anime lighting, hand-drawn manhwa webtoon aesthetic. NO photorealistic humans, NO 3D CGI. Scene details: ${prompt}`;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        // Attempt using generateImages if available
        if (typeof (ai.models as any).generateImages === "function") {
          const result = await (ai.models as any).generateImages({
            model: "imagen-3.0-generate-002",
            prompt: fullPrompt,
            config: {
              numberOfImages: 1,
              aspectRatio: aspectRatio === "9:16" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9",
              outputMimeType: "image/png",
            },
          });

          if (result.generatedImages && result.generatedImages[0]?.image?.imageBytes) {
            const base64 = result.generatedImages[0].image.imageBytes;
            return NextResponse.json({
              imageUrl: `data:image/png;base64,${base64}`,
              isRealGeneration: true,
              source: "imagen-3.0-generate-002",
            });
          }
        }
      } catch (genError: any) {
        console.warn("Imagen API generation failed, providing styled manhwa artwork fallback:", genError?.message);
        // Fall through to styled anime illustration fallback
      }
    }

    // High quality stylized Manhwa SVG Canvas fallback
    const width = aspectRatio === "9:16" ? 720 : aspectRatio === "1:1" ? 1080 : 1280;
    const height = aspectRatio === "9:16" ? 1280 : aspectRatio === "1:1" ? 1080 : 720;
    
    // Pick an evocative anime color palette based on prompt keywords
    const isDark = prompt.toLowerCase().includes("night") || prompt.toLowerCase().includes("dark") || prompt.toLowerCase().includes("ruin");
    const isAction = prompt.toLowerCase().includes("sword") || prompt.toLowerCase().includes("battle") || prompt.toLowerCase().includes("fight") || prompt.toLowerCase().includes("magic");
    
    const bg1 = isDark ? "#0f172a" : isAction ? "#180e29" : "#111827";
    const bg2 = isDark ? "#1e1b4b" : isAction ? "#450a0a" : "#1e293b";
    const accent = isAction ? "#f43f5e" : isDark ? "#6366f1" : "#06b6d4";

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${bg1}" />
            <stop offset="100%" stop-color="${bg2}" />
          </linearGradient>
          <linearGradient id="glow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${accent}" stop-opacity="0.35" />
            <stop offset="100%" stop-color="transparent" />
          </linearGradient>
          <pattern id="manhwa-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="#ffffff" fill-opacity="0.04" />
          </pattern>
        </defs>

        <!-- Base Background -->
        <rect width="${width}" height="${height}" fill="url(#bg)" />
        <rect width="${width}" height="${height}" fill="url(#manhwa-dots)" />

        <!-- Manga Speedlines / Action Rays -->
        <g stroke="${accent}" stroke-width="1.5" stroke-opacity="0.25">
          <line x1="${width/2}" y1="${height/2}" x2="0" y2="0" />
          <line x1="${width/2}" y1="${height/2}" x2="${width/4}" y2="0" />
          <line x1="${width/2}" y1="${height/2}" x2="${width*3/4}" y2="0" />
          <line x1="${width/2}" y1="${height/2}" x2="${width}" y2="0" />
          <line x1="${width/2}" y1="${height/2}" x2="0" y2="${height/3}" />
          <line x1="${width/2}" y1="${height/2}" x2="${width}" y2="${height/3}" />
          <line x1="${width/2}" y1="${height/2}" x2="0" y2="${height*2/3}" />
          <line x1="${width/2}" y1="${height/2}" x2="${width}" y2="${height*2/3}" />
          <line x1="${width/2}" y1="${height/2}" x2="${width/3}" y2="${height}" />
          <line x1="${width/2}" y1="${height/2}" x2="${width*2/3}" y2="${height}" />
        </g>

        <!-- Dramatic Atmospheric Vignette / Aura -->
        <circle cx="${width/2}" cy="${height/2}" r="${width*0.35}" fill="url(#glow)" filter="blur(40px)" />

        <!-- Manhwa Silhouette / Central Composition -->
        <g transform="translate(${width/2 - 120}, ${height/2 - 140}) scale(1.2)">
          <!-- Dynamic Aura Rings -->
          <circle cx="100" cy="120" r="90" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="8 6" opacity="0.6"/>
          <!-- Anime Character Silhouette / Blade / Portal -->
          <path d="M100 20 L115 65 L100 80 L85 65 Z" fill="${accent}" opacity="0.8" />
          <circle cx="100" cy="50" r="22" fill="#e2e8f0" />
          <path d="M60 180 C60 110, 140 110, 140 180 Z" fill="#334155" />
          <path d="M70 140 L20 200 L40 210 L85 160 Z" fill="#1e293b" />
          <path d="M130 140 L180 200 L160 210 L115 160 Z" fill="#1e293b" />
        </g>

        <!-- Cinematic Framing Borders -->
        <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="#475569" stroke-width="2" stroke-opacity="0.4" />
        <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="${accent}" stroke-width="1" stroke-opacity="0.3" />

        <!-- HUD & Scene Information Badge -->
        <g transform="translate(48, 56)">
          <rect width="180" height="34" rx="6" fill="#030712" fill-opacity="0.85" stroke="#334155" stroke-width="1"/>
          <text x="14" y="22" font-family="system-ui, sans-serif" font-weight="bold" font-size="14" fill="#38bdf8" letter-spacing="1">SCENE ${String(sceneNumber || 1).padStart(3, '0')}</text>
          <text x="105" y="22" font-family="system-ui, sans-serif" font-weight="600" font-size="12" fill="#94a3b8">MANHWA 2D</text>
        </g>

        <!-- Prompt Text Overlay on Bottom -->
        <g transform="translate(48, ${height - 90})">
          <rect width="${width - 96}" height="56" rx="8" fill="#030712" fill-opacity="0.85" stroke="#1e293b" stroke-width="1"/>
          <text x="18" y="24" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#f8fafc" opacity="0.9">VISUAL PROMPT:</text>
          <text x="18" y="42" font-family="system-ui, sans-serif" font-size="12" fill="#cbd5e1" opacity="0.85">${prompt.length > 110 ? prompt.substring(0, 107) + '...' : prompt}</text>
        </g>
      </svg>
    `;

    const base64Svg = Buffer.from(svg).toString('base64');
    const dataUri = `data:image/svg+xml;base64,${base64Svg}`;

    return NextResponse.json({
      imageUrl: dataUri,
      isRealGeneration: false,
      note: "Generated using Manhwa Canvas Renderer. To enable Imagen 3 AI generation, configure an Imagen-enabled Gemini API key.",
    });
  } catch (error: any) {
    console.error("Error in generate-image route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate image." },
      { status: 500 }
    );
  }
}
