import type { Subtitle } from '../store/useEditorStore';

/**
 * Filter and remove common Whisper hallucination artifacts,
 * noise markers, and YouTube outro spam.
 */
export function cleanAndFormatText(rawText: string): string {
  if (!rawText) return '';

  let text = rawText.trim();

  // 1. Remove music / sound effect notations: [Musik], (music), ♪, ♫, [Tawa], etc.
  text = text.replace(/\[\s*(musik|music|tawa|applause|tepuk tangan|laughter|noise|suara)\s*\]/gi, '');
  text = text.replace(/\(\s*(musik|music|tawa|applause|tepuk tangan|laughter|noise|suara)\s*\)/gi, '');
  text = text.replace(/[*_~]\s*(musik|music)\s*[*_~]/gi, '');
  text = text.replace(/[♪♫♬♩]+/g, '');

  // 2. Remove common Whisper hallucination / outro spam from training corpus
  const hallucinationPatterns = [
    /terima kasih telah menonton[.!?,]*/gi,
    /terima kasih sudah menonton[.!?,]*/gi,
    /terima kasih sudah menyaksikan[.!?,]*/gi,
    /thank you for watching[.!?,]*/gi,
    /thanks for watching[.!?,]*/gi,
    /subtitles? by[^\n.]+[.!?,]*/gi,
    /subtitle (dibuat|oleh)[^\n.]+[.!?,]*/gi,
    /jangan lupa (like|komen|subscribe|share)[^\n.]+[.!?,]*/gi,
    /please (like|comment|subscribe|share)[^\n.]+[.!?,]*/gi,
  ];

  for (const pattern of hallucinationPatterns) {
    text = text.replace(pattern, '');
  }

  // 3. Clean up multiple spaces, weird symbols, and trim
  text = text.replace(/\s+/g, ' ').trim();

  // 4. Remove stutter repetitions caused by hallucination loops (e.g. "saya saya saya saya" -> "saya")
  text = text.replace(/\b(\w+)(?:\s+\1\b){3,}/gi, '$1');

  // 5. Capitalize first letter if it's a valid sentence
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text;
}

/**
 * Robust processing of Whisper output chunks:
 * - Fixes null or missing timestamps
 * - Removes consecutive duplicate text
 * - Prevents timestamp overlapping
 * - Splits excessively long chunks into readable segments
 */
export function processWhisperChunks(rawChunks: any[], maxVideoDuration: number = 0): Subtitle[] {
  if (!rawChunks || !Array.isArray(rawChunks) || rawChunks.length === 0) {
    return [];
  }

  const validChunks: { start: number; end: number; text: string }[] = [];

  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];
    const cleanedText = cleanAndFormatText(chunk.text || '');

    // Discard empty text, pure punctuation, or single junk chars
    if (!cleanedText || cleanedText.length < 2 || /^[,.\-_?!:;'"\s]+$/.test(cleanedText)) {
      continue;
    }

    let start = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] : 0;
    let end = Array.isArray(chunk.timestamp) ? chunk.timestamp[1] : null;

    // Fallback for null start
    if (start === null || start === undefined || isNaN(start)) {
      const prev = validChunks[validChunks.length - 1];
      start = prev ? prev.end + 0.1 : 0;
    }

    // Estimate duration based on word count (~0.35s per word, clamped 1.2s - 4.5s)
    const wordCount = cleanedText.split(/\s+/).length;
    const estimatedDuration = Math.max(1.2, Math.min(4.5, wordCount * 0.35));

    // Handle null or invalid end timestamp
    if (end === null || end === undefined || isNaN(end) || end <= start) {
      // Look ahead to next chunk's start if available
      const nextChunk = rawChunks[i + 1];
      const nextStart = nextChunk && Array.isArray(nextChunk.timestamp) ? nextChunk.timestamp[0] : null;

      if (nextStart !== null && nextStart !== undefined && nextStart > start) {
        end = Math.min(start + estimatedDuration, nextStart);
      } else {
        end = start + estimatedDuration;
      }
    }

    // Deduplicate: If identical or nearly identical to the previous chunk within a 2-second window
    const prev = validChunks[validChunks.length - 1];
    if (prev) {
      const prevLower = prev.text.toLowerCase().trim();
      const currLower = cleanedText.toLowerCase().trim();

      if (prevLower === currLower || (currLower.length > 5 && prevLower.includes(currLower))) {
        // Extend previous chunk's end time instead of duplicating
        prev.end = Math.max(prev.end, end);
        continue;
      }

      // Avoid overlapping with previous chunk
      if (start < prev.end) {
        if (start < prev.start + 0.5) {
          // Both started almost at the same time, adjust
          start = prev.end + 0.05;
          end = Math.max(end, start + 0.8);
        } else {
          // Adjust previous chunk's end to meet this start
          prev.end = Math.max(prev.start + 0.5, start - 0.05);
        }
      }
    }

    // Clamp to video duration if provided
    if (maxVideoDuration > 0) {
      if (start >= maxVideoDuration) break;
      end = Math.min(end, maxVideoDuration);
    }

    validChunks.push({
      start: Math.round(start * 100) / 100,
      end: Math.round(end * 100) / 100,
      text: cleanedText
    });
  }

  // Second pass: Split chunks that are excessively long (> 14 words or > 6.5s) for optimal screen reading
  const finalSubtitles: Subtitle[] = [];
  let subIndex = 0;

  for (const item of validChunks) {
    const words = item.text.split(' ');
    const duration = item.end - item.start;

    if (words.length > 14 && duration > 4.5) {
      // Find midpoint split near punctuation or conjunction
      const mid = Math.floor(words.length / 2);
      let splitIdx = mid;

      // Look for punctuation nearby
      for (let offset = 0; offset <= 3; offset++) {
        if (words[mid + offset] && /[,.?!]/.test(words[mid + offset])) {
          splitIdx = mid + offset + 1;
          break;
        }
        if (words[mid - offset] && /[,.?!]/.test(words[mid - offset])) {
          splitIdx = mid - offset + 1;
          break;
        }
      }

      const part1 = words.slice(0, splitIdx).join(' ').trim();
      const part2 = words.slice(splitIdx).join(' ').trim();

      if (part1 && part2) {
        const midTime = item.start + (duration * (splitIdx / words.length));
        
        finalSubtitles.push({
          id: `sub_${subIndex++}`,
          start: item.start,
          end: Math.round((midTime - 0.05) * 100) / 100,
          text: part1
        });

        finalSubtitles.push({
          id: `sub_${subIndex++}`,
          start: Math.round(midTime * 100) / 100,
          end: item.end,
          text: part2
        });
        continue;
      }
    }

    finalSubtitles.push({
      id: `sub_${subIndex++}`,
      start: item.start,
      end: item.end,
      text: item.text
    });
  }

  return finalSubtitles;
}

/**
 * Format seconds to SRT timestamp: HH:MM:SS,mmm
 */
export function formatToSrtTime(totalSeconds: number): string {
  const safeSec = Math.max(0, totalSeconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const ms = Math.floor((safeSec % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

/**
 * Format seconds to VTT timestamp: HH:MM:SS.mmm
 */
export function formatToVttTime(totalSeconds: number): string {
  const safeSec = Math.max(0, totalSeconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const ms = Math.floor((safeSec % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
}

/**
 * Generate standard SRT subtitle format content
 */
export function exportToSRT(subtitles: Subtitle[]): string {
  return subtitles
    .map((sub, index) => {
      const start = formatToSrtTime(sub.start);
      const end = formatToSrtTime(sub.end);
      return `${index + 1}\n${start} --> ${end}\n${sub.text.trim()}\n`;
    })
    .join('\n');
}

/**
 * Generate standard WebVTT format content
 */
export function exportToVTT(subtitles: Subtitle[]): string {
  const header = 'WEBVTT\n\n';
  const body = subtitles
    .map((sub, index) => {
      const start = formatToVttTime(sub.start);
      const end = formatToVttTime(sub.end);
      return `${index + 1}\n${start} --> ${end}\n${sub.text.trim()}\n`;
    })
    .join('\n');
  return header + body;
}

/**
 * Trigger file download of subtitles in browser
 */
export function downloadSubtitleFile(
  subtitles: Subtitle[],
  format: 'srt' | 'vtt' = 'srt',
  baseFilename: string = 'subtitles'
): void {
  if (!subtitles || subtitles.length === 0) return;

  const content = format === 'srt' ? exportToSRT(subtitles) : exportToVTT(subtitles);
  const mimeType = format === 'srt' ? 'text/plain;charset=utf-8' : 'text/vtt;charset=utf-8';
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const cleanName = baseFilename.replace(/\.[^/.]+$/, '');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanName}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
