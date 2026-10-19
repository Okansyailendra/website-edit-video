import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { useEditorStore } from '../store/useEditorStore';

let ffmpeg: FFmpeg | null = null;

export const exportVideo = async (onProgress: (progress: number) => void) => {
  const state = useEditorStore.getState();
  const { videoFile, audioFile, audioVolume, videoVolume, brightness, contrast, saturation, sharpness, hdMode } = state;

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

  // ─── VIDEO FILTER PIPELINE ────────────────────────────────────────────────
  // Order matters: denoise source first → colour grade → scale up → sharpen
  // This prevents source compression artifacts from being amplified by upscaling.

  const filterSteps: string[] = [];

  // STEP 1 – Pre-denoise: remove block/mosquito noise from compressed source
  // (especially important for WhatsApp/social-media compressed videos)
  // hqdn3d: luma_spatial, chroma_spatial, luma_temporal, chroma_temporal
  if (hdMode !== 'original') {
    // Stronger denoise when upscaling so artefacts aren't stretched
    filterSteps.push('hqdn3d=2:2:3:3');
  }

  // STEP 2 – Colour grading (eq filter)
  const f_brightness = (brightness / 100 - 1).toFixed(2);
  const f_contrast   = (contrast   / 100).toFixed(2);
  const f_saturation = (saturation / 100).toFixed(2);
  filterSteps.push(`eq=brightness=${f_brightness}:contrast=${f_contrast}:saturation=${f_saturation}`);

  // STEP 3 – Upscale / downscale to target resolution (Lanczos = best quality)
  const resolutionMap: Record<string, string> = {
    '720p':  'scale=-2:720:flags=lanczos+accurate_rnd',
    '1080p': 'scale=-2:1080:flags=lanczos+accurate_rnd',
    '4k':    'scale=-2:2160:flags=lanczos+accurate_rnd',
  };
  if (hdMode !== 'original' && resolutionMap[hdMode]) {
    filterSteps.push(resolutionMap[hdMode]);
  }

  // STEP 4 – Post-scale sharpening (applied AFTER upscale for true HD detail)
  // Cap at ±1.0 – values beyond this create haloing/ringing ("pecah") artefacts.
  // Slider 0-200 → amount -1.0 to +1.0
  const rawSharp = ((sharpness - 100) / 100).toFixed(2); // -1.0 … +1.0
  if (sharpness !== 100) {
    filterSteps.push(
      `unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${rawSharp}` +
      `:chroma_msize_x=3:chroma_msize_y=3:chroma_amount=${(parseFloat(rawSharp) * 0.5).toFixed(2)}`
    );
  }

  let videoFilter = filterSteps.join(',');

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

      const sizeMap = { sm: 36, md: 48, lg: 60 };
      const fontSize = sizeMap[state.subtitleSize || 'md'] || 48;
      const style = state.subtitleStyle || 'classic';

      const drawtexts = state.subtitles.map(sub => {
        const text = escapeDrawtext(sub.text);
        if (style === 'tiktok') {
          return `drawtext=fontfile=font.ttf:text='${text}':fontcolor=yellow:fontsize=${fontSize}:borderw=4:bordercolor=black:shadowcolor=black@0.8:shadowx=3:shadowy=3:x=(w-text_w)/2:y=h-(h/6):enable='between(t,${sub.start},${sub.end})'`;
        } else if (style === 'box') {
          return `drawtext=fontfile=font.ttf:text='${text}':fontcolor=white:fontsize=${fontSize}:box=1:boxcolor=black@0.65:boxborderw=10:x=(w-text_w)/2:y=h-(h/6):enable='between(t,${sub.start},${sub.end})'`;
        } else {
          return `drawtext=fontfile=font.ttf:text='${text}':fontcolor=white:fontsize=${fontSize}:borderw=3:bordercolor=black:shadowcolor=black:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-(h/6):enable='between(t,${sub.start},${sub.end})'`;
        }
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
  
  // Encoding quality: CRF lower = better quality (0=lossless, 51=worst).
  // 'medium' preset: significantly better quality than 'fast' with moderate extra time.
  const crfMap: Record<string, string> = {
    '4k':      '16', // Near-lossless for 4K UHD
    '1080p':   '17', // High quality Full HD (visually lossless)
    '720p':    '19', // Good quality HD
    'original':'22', // Balanced for original resolution
  };
  const crf = crfMap[hdMode] ?? '22';
  const qualitySuffix = hdMode === 'original' ? '' : `_${hdMode}`;

  args.push(
    '-c:v', 'libx264',
    '-preset', 'medium',       // much better quality/compression vs 'fast'
    '-crf', crf,               // per-resolution quality target
    '-tune', 'film',           // optimised for natural video (not animation/grain)
    '-pix_fmt', 'yuv420p',    // universal browser/player compatibility
    '-movflags', '+faststart', // streamable immediately on download
    '-c:a', 'aac',
    '-b:a', '192k',            // good audio bitrate
    '-y',
    'output.mp4'
  );

  // Update filename to reflect quality
  const outputFilename = `VideoEditorPro_Export${qualitySuffix}.mp4`;

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile('output.mp4');
  const url = URL.createObjectURL(new Blob([data as any], { type: 'video/mp4' }));
  
  // Trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = outputFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  
  // Clean up memory
  URL.revokeObjectURL(url);
};
