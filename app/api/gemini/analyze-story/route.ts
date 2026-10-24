import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { parseTimestampedPrompts } from "@/lib/timestamp-parser";

export async function POST(req: NextRequest) {
  try {
    const { story, audioDuration, characterAtlas, locationAtlas, propsAtlas, customApiKey } = await req.json();

    if (!story || !story.trim()) {
      return NextResponse.json({ error: "Story or script content is required." }, { status: 400 });
    }

    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured. Please provide an API key in settings." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const timingInstruction = audioDuration && audioDuration > 0
      ? `The uploaded voiceover narration lasts EXACTLY ${audioDuration.toFixed(3)} seconds. You MUST ensure that the sequence of scenes starts at 00:00:00.000 and ends exactly at ${audioDuration.toFixed(3)} seconds (or within 0.5s). Divide the full story chronologically across this duration into meaningful visual beats.`
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
4. Ensure consecutive scenes have contiguous timestamps (e.g. Scene 1 ends at 00:00:04.200, Scene 2 begins at 00:00:04.200).
5. Output ONLY the copy-ready scene blocks. Avoid Markdown tables or extra conversational text before or after the scenes.`;

    const userPrompt = `Story/Script:
${story}

${characterAtlas ? `Character Database / Atlas:\n${characterAtlas}\n` : ''}
${locationAtlas ? `Location Database / Atlas:\n${locationAtlas}\n` : ''}
${propsAtlas ? `Props Database / Atlas:\n${propsAtlas}\n` : ''}

Generate the complete timestamped scene prompts now:`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
      ],
      config: {
        temperature: 0.4,
      }
    });

    const rawOutput = response.text || "";
    const parsedScenes = parseTimestampedPrompts(rawOutput);

    return NextResponse.json({
      rawText: rawOutput,
      scenes: parsedScenes,
      count: parsedScenes.length,
    });
  } catch (error: any) {
    console.error("Error in analyze-story API route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze story and generate prompts." },
      { status: 500 }
    );
  }
}
