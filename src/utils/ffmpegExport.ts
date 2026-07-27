import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { useEditorStore } from '../store/useEditorStore';

let ffmpeg: FFmpeg | null = null;

export const exportVideo = async (onProgress: (progress: number) => void) => {
  const state = useEditorStore.getState();
  const { videoFile, audioFile, audioVolume, videoVolume, brightness, contrast, saturation } = state;

  if (!videoFile) throw new Error("Video file is required");

  // Load FFmpeg if not already loaded
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress }) => {
      // Progress goes from 0 to 1
      onProgress(Math.round(progress * 100));
    });
    
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }

  // Write files to virtual FS
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

  let complexFilter = '';
  const inputs = ['-i', 'input.mp4'];

  // 1. Calculate Video Filters (Color Grading & Subtitles)
  const f_brightness = (brightness / 100 - 1).toFixed(2);
  const f_contrast = (contrast / 100).toFixed(2);
  const f_saturation = (saturation / 100).toFixed(2);
  
  let videoFilter = `eq=brightness=${f_brightness}:contrast=${f_contrast}:saturation=${f_saturation}`;

  if (state.subtitles && state.subtitles.length > 0) {
    try {
      // Download font for drawtext
      const fontUrl = 'https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf';
      const fontResponse = await fetch(fontUrl);
      const fontData = await fontResponse.arrayBuffer();
      await ffmpeg.writeFile('font.ttf', new Uint8Array(fontData));

      const escapeDrawtext = (text: string) => {
        // Escape special chars for ffmpeg drawtext inside single quotes
        return text.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "'\\''").replace(/%/g, '\\%');
      };

      const drawtexts = state.subtitles.map(sub => {
        const text = escapeDrawtext(sub.text);
        // Using a fixed fontsize (e.g. 48) and drawing it near the bottom
        return `drawtext=fontfile=font.ttf:text='${text}':fontcolor=white:fontsize=48:borderw=3:bordercolor=black:shadowcolor=black:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-(h/6):enable='between(t,${sub.start},${sub.end})'`;
      });
      
      videoFilter += `,${drawtexts.join(',')}`;
    } catch (err) {
      console.warn("Subtitle export failed", err);
    }
  }

  complexFilter += `[0:v]${videoFilter}[v]`;

  const f_video_vol = (videoVolume / 100).toFixed(2);

  // 2. Calculate Audio Mixing
  if (audioFile) {
    // Format could be anything, let's name it input_audio with extension
    const ext = audioFile.name.split('.').pop() || 'mp3';
    await ffmpeg.writeFile(`audio.${ext}`, await fetchFile(audioFile));
    inputs.push('-i', `audio.${ext}`);
    
    const f_bgm_vol = (audioVolume / 100).toFixed(2);
    
    // amix combines both audio streams. duration=first ensures it stops when video stops.
    complexFilter += `;[0:a]volume=${f_video_vol}[a1];[1:a]volume=${f_bgm_vol}[a2];[a1][a2]amix=inputs=2:duration=first[a]`;
  }

  const args = [
    ...inputs, 
    '-filter_complex', complexFilter, 
    '-map', '[v]'
  ];
  
  if (audioFile) {
    args.push('-map', '[a]');
  } else {
    // If no external audio, map original audio (if it exists)
    if (videoVolume !== 100) {
      args.push('-af', `volume=${f_video_vol}`);
    }
    args.push('-map', '0:a?');
  }
  
  // Fast encoding preset
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', '-y', 'output.mp4');

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile('output.mp4');
  const url = URL.createObjectURL(new Blob([data as any], { type: 'video/mp4' }));
  
  // Trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = `VideoEditorPro_Export.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  
  // Clean up memory
  URL.revokeObjectURL(url);
};
