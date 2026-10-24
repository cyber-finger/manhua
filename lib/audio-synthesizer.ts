/**
 * Generates an in-memory 20-second WAV narration audio file for the Acceptance Test
 * and demo testing without requiring an external audio file upload.
 */
export function generateDemoNarrationWav(durationSeconds: number = 20): string {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length minus RIFF header
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate
  view.setUint32(28, byteRate, true);
  // block align
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataSize, true);

  // Generate pleasant rhythmic voiceover-like modulation frequencies across 5 scenes
  // Scene 1: 0.0 - 4.2s (190Hz voice tone)
  // Scene 2: 4.2 - 9.5s (210Hz)
  // Scene 3: 9.5 - 14.0s (180Hz)
  // Scene 4: 14.0 - 17.5s (220Hz)
  // Scene 5: 17.5 - 20.0s (195Hz)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let baseFreq = 200;
    if (t < 4.2) baseFreq = 190;
    else if (t < 9.5) baseFreq = 210;
    else if (t < 14.0) baseFreq = 180;
    else if (t < 17.5) baseFreq = 220;
    else baseFreq = 195;

    // Speech cadence envelope (voice pulsing at 3 words per sec)
    const cadence = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3.5 * t);
    // Voice fundamental and harmonics
    const voice =
      0.6 * Math.sin(2 * Math.PI * baseFreq * t) +
      0.25 * Math.sin(2 * Math.PI * (baseFreq * 2) * t) +
      0.15 * Math.sin(2 * Math.PI * (baseFreq * 3) * t);

    // Occasional natural pauses between beats
    let pause = 1.0;
    if ((t > 4.0 && t < 4.2) || (t > 9.3 && t < 9.5) || (t > 13.8 && t < 14.0) || (t > 17.3 && t < 17.5)) {
      pause = 0.05;
    }

    const sample = Math.max(-1, Math.min(1, voice * cadence * pause * 0.35));
    // 16-bit PCM integer
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
