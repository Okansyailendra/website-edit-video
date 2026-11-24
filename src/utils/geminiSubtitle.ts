import type { Subtitle } from '../store/useEditorStore';
import { cleanAndFormatText } from './subtitleUtils';

/**
 * Encode Float32Array PCM audio into a standard 16-bit mono WAV ArrayBuffer.
 */
export function audioBufferToWav(audioData: Float32Array, sampleRate = 16000): ArrayBuffer {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = audioData.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');

  // fmt chunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat 1 = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeAscii(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Convert ArrayBuffer to base64 string in safe chunks.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export interface GeminiTranscribeOptions {
  apiKey: string;
  model?: string;
  language?: string;
  prompt?: string;
  onProgress?: (progress: number, message: string) => void;
}

interface WordTimestamp {
  word: string;
  start_offset: string | number;
  end_offset: string | number;
}

function parseOffsetSeconds(offset: string | number): number {
  if (typeof offset === 'number') return offset;
  return parseFloat(String(offset).replace('s', '')) || 0;
}

/**
 * Groups word-level timestamps from gemini-3.5-transcribe into natural subtitle phrases.
 */
function groupWordsIntoSubtitles(words: WordTimestamp[], maxDuration = 0, maxWordsPerChunk = 7): Subtitle[] {
  const subtitles: Subtitle[] = [];
  let currentGroup: Array<{ word: string; start: number; end: number }> = [];
  let chunkStart = 0;
  let chunkEnd = 0;
  let subIndex = 0;

  for (let i = 0; i < words.length; i++) {
    const item = words[i];
    const rawWord = (item.word || '').trim();
    if (!rawWord) continue;

    const startSec = parseOffsetSeconds(item.start_offset);
    const endSec = parseOffsetSeconds(item.end_offset);

    if (currentGroup.length === 0) {
      chunkStart = startSec;
      chunkEnd = Math.max(startSec + 0.3, endSec);
      currentGroup.push({ word: rawWord, start: startSec, end: endSec });
    } else {
      const pause = startSec - chunkEnd;
      const prevWord = currentGroup[currentGroup.length - 1].word;
      const hasSentenceEnding = /[.?!]$/.test(prevWord);
      const isTooLong = currentGroup.length >= maxWordsPerChunk;
      const duration = endSec - chunkStart;

      if (pause > 0.6 || isTooLong || (hasSentenceEnding && currentGroup.length >= 3) || duration > 4.5) {
        const text = cleanAndFormatText(currentGroup.map(w => w.word).join(' '));
        if (text) {
          subtitles.push({
            id: `sub_${Date.now()}_${subIndex++}`,
            start: Math.round(chunkStart * 100) / 100,
            end: Math.round(chunkEnd * 100) / 100,
            text,
            words: currentGroup.map(w => ({
              word: w.word,
              start: Math.round(w.start * 100) / 100,
              end: Math.round(w.end * 100) / 100
            }))
          });
        }
        currentGroup = [{ word: rawWord, start: startSec, end: endSec }];
        chunkStart = startSec;
        chunkEnd = Math.max(startSec + 0.3, endSec);
      } else {
        currentGroup.push({ word: rawWord, start: startSec, end: endSec });
        chunkEnd = Math.max(chunkEnd, endSec);
      }
    }
  }

  if (currentGroup.length > 0) {
    const text = cleanAndFormatText(currentGroup.map(w => w.word).join(' '));
    if (text) {
      subtitles.push({
        id: `sub_${Date.now()}_${subIndex++}`,
        start: Math.round(chunkStart * 100) / 100,
        end: Math.round(chunkEnd * 100) / 100,
        text,
        words: currentGroup.map(w => ({
          word: w.word,
          start: Math.round(w.start * 100) / 100,
          end: Math.round(w.end * 100) / 100
        }))
      });
    }
  }

  // Clamp to max duration if needed
  if (maxDuration > 0) {
    return subtitles.filter(s => s.start < maxDuration).map(s => ({
      ...s,
      end: Math.min(s.end, maxDuration)
    }));
  }

  return subtitles;
}

/**
 * Split raw paragraph transcript into timed subtitle chunks across the audio duration.
 */
function splitTextIntoSubtitles(rawText: string, totalDuration: number): Subtitle[] {
  const sentences = rawText
    .split(/(?<=[.?!])\s+|\n+/)
    .map(s => cleanAndFormatText(s))
    .filter(Boolean);

  if (sentences.length === 0) return [];

  const chunks: string[] = [];
  for (const s of sentences) {
    const words = s.split(/\s+/);
    if (words.length <= 8) {
      chunks.push(s);
    } else {
      for (let i = 0; i < words.length; i += 6) {
        chunks.push(words.slice(i, i + 6).join(' '));
      }
    }
  }

  const effectiveDuration = totalDuration > 0 ? totalDuration : chunks.length * 2.8;
  const chunkDuration = effectiveDuration / Math.max(1, chunks.length);

  return chunks.map((text, idx) => {
    const start = Math.round(idx * chunkDuration * 100) / 100;
    const end = Math.round(((idx + 1) * chunkDuration - 0.05) * 100) / 100;
    const wordsList = text.split(/\s+/).filter(Boolean);
    const wordDur = Math.max(0.1, (end - start) / Math.max(1, wordsList.length));
    const words = wordsList.map((word, wIdx) => ({
      word,
      start: Math.round((start + wIdx * wordDur) * 100) / 100,
      end: Math.round((start + (wIdx + 1) * wordDur) * 100) / 100
    }));

    return {
      id: `sub_${Date.now()}_${idx}`,
      start,
      end,
      text,
      words
    };
  });
}

/**
 * Transcribe audio using Google Gemini 3.5 Transcribe model (https://aistudio.google.com/docs/transcribe).
 */
export async function transcribeWithGemini(
  audioData: Float32Array,
  sampleRate = 16000,
  options: GeminiTranscribeOptions,
  maxVideoDuration = 0
): Promise<Subtitle[]> {
  const { apiKey, model = 'gemini-3.5-transcribe', language = 'id', onProgress } = options;

  if (!apiKey || !apiKey.trim()) {
    throw new Error('Google Gemini API Key belum terkonfigurasi. Silakan periksa file .env Anda.');
  }

  const audioSeconds = audioData.length / sampleRate;
  const effectiveDuration = maxVideoDuration > 0 ? maxVideoDuration : audioSeconds;

  onProgress?.(25, 'Mengonversi audio video ke 16kHz PCM WAV...');
  const wavBuffer = audioBufferToWav(audioData, sampleRate);

  onProgress?.(40, 'Menyiapkan payload audio untuk Gemini 3.5 Transcribe...');
  const base64Audio = arrayBufferToBase64(wavBuffer);

  onProgress?.(60, 'Menganalisis suara & transkripsi dengan Google Gemini 3.5 Transcribe...');

  const languageCodeMap: Record<string, string> = {
    id: 'id-ID',
    indonesian: 'id-ID',
    en: 'en-US',
    english: 'en-US',
    ja: 'ja-JP',
    japanese: 'ja-JP'
  };

  const selectedCode = language && language !== 'auto' ? languageCodeMap[language] || language : '';
  const languageCodes = selectedCode ? [selectedCode] : [];

  // Call gemini-3.5-transcribe
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: 'audio/wav',
              data: base64Audio
            }
          }
        ]
      }
    ],
    generationConfig: {
      audioTranscriptionConfig: {
        languageCodes,
        mode: 'VERBATIM'
      }
    }
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
  } catch (netErr: any) {
    throw new Error(`Koneksi internet bermasalah saat memanggil Gemini: ${netErr.message}`);
  }

  // If gemini-3.5-transcribe fails or model not supported in region, provide intelligent fallback
  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || response.statusText;
    } catch {
      errorDetail = response.statusText;
    }

    if (response.status === 400 || response.status === 403) {
      throw new Error(`Google Gemini API Error: API Key tidak valid atau izin ditolak (${errorDetail}).`);
    } else if (response.status === 429) {
      throw new Error('Google Gemini API Error: Batas kuota (Rate limit) terlampaui. Tunggu beberapa detik lalu coba lagi.');
    } else {
      throw new Error(`Google Gemini Error (${response.status}): ${errorDetail}`);
    }
  }

  onProgress?.(85, 'Mengekstrak kata demi kata & menyinkronkan timestamp...');
  const jsonResponse = await response.json();
  const candidate = jsonResponse.candidates?.[0];
  const part = candidate?.content?.parts?.[0];

  if (!candidate || !part) {
    // Audio might be silent
    return [];
  }

  // 1. Check for native word-level timestamps in audio_transcription
  const audioTranscription = (part as any).audio_transcription || (part as any).audioTranscription;
  if (audioTranscription) {
    if (Array.isArray(audioTranscription.words) && audioTranscription.words.length > 0) {
      const subs = groupWordsIntoSubtitles(audioTranscription.words, effectiveDuration);
      if (subs.length > 0) {
        onProgress?.(100, 'Subtitle selesai dibuat!');
        return subs;
      }
    }

    if (audioTranscription.text) {
      const subs = splitTextIntoSubtitles(audioTranscription.text, effectiveDuration);
      onProgress?.(100, 'Subtitle selesai dibuat!');
      return subs;
    }
  }

  // 2. Check for text in part.text
  const rawText = part.text;
  if (rawText && typeof rawText === 'string') {
    // If output is json formatted:
    try {
      let cleanJson = rawText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
      }
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
        return parsed.map((item: any, idx: number) => ({
          id: `sub_${Date.now()}_${idx}`,
          start: typeof item.start === 'number' ? item.start : parseFloat(item.start) || 0,
          end: typeof item.end === 'number' ? item.end : parseFloat(item.end) || (item.start + 2),
          text: cleanAndFormatText(item.text)
        }));
      }
    } catch {
      // Plain text transcript
      return splitTextIntoSubtitles(rawText, effectiveDuration);
    }
  }

  return [];
}
