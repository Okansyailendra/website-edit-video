import { useCallback, useRef, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useEditorStore } from './store/useEditorStore';
import { formatTime } from './utils/formatTime';
import { exportVideo } from './utils/ffmpegExport';
import { processWhisperChunks, downloadSubtitleFile } from './utils/subtitleUtils';
import { 
  UploadCloud, Play, Pause, SkipBack, SkipForward, Settings, Video, FileAudio, 
  Subtitles, Download, MonitorPlay, Loader2, Sparkles, Zap, ChevronDown, Check,
  Trash2, Plus, FileDown, RefreshCw, Clock
} from 'lucide-react';

function App() {
  const { 
    videoUrl, videoFile, audioUrl, audioFile, audioVolume, videoVolume,
    isPlaying, togglePlayPause, 
    setVideoFile, setAudioFile, setAudioVolume, setVideoVolume,
    setCurrentTime, setDuration, currentTime, duration,
    brightness, contrast, saturation, sharpness, hdMode,
    setBrightness, setContrast, setSaturation, setSharpness, setHdMode,
    // Subtitles
    subtitles, setSubtitles, updateSubtitle, updateSubtitleTimes, addSubtitle, removeSubtitle,
    isTranscribing, setIsTranscribing,
    transcriptionLanguage, setTranscriptionLanguage,
    transcriptionModel, setTranscriptionModel,
    subtitleStyle, setSubtitleStyle,
    subtitleSize, setSubtitleSize,
    transcriptionProgress, setTranscriptionProgress,
    transcriptionMessage, setTranscriptionMessage,
    activeTab, setActiveTab
  } = useEditorStore();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Web Audio API Refs for >100% volume boost
  const audioCtxRef = useRef<AudioContext | null>(null);
  const videoGainRef = useRef<GainNode | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const isAudioSetup = useRef(false);

  const ensureAudioSetup = useCallback(() => {
    if (!isAudioSetup.current && videoRef.current && audioRef.current) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        
        const videoSource = ctx.createMediaElementSource(videoRef.current);
        const videoGain = ctx.createGain();
        videoSource.connect(videoGain);
        videoGain.connect(ctx.destination);
        videoGainRef.current = videoGain;
        videoGain.gain.value = videoVolume / 100;
        
        const audioSource = ctx.createMediaElementSource(audioRef.current);
        const audioGain = ctx.createGain();
        audioSource.connect(audioGain);
        audioGain.connect(ctx.destination);
        audioGainRef.current = audioGain;
        audioGain.gain.value = audioVolume / 100;
        
        isAudioSetup.current = true;
      } catch (e) {
        console.error("Audio Context setup failed", e);
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, [videoVolume, audioVolume]);

  const handleExport = async () => {
    if (!videoFile) return;
    setIsExporting(true);
    setExportProgress(0);
    try {
      await exportVideo((prog) => {
        setExportProgress(prog);
      });
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export video. See console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateSubtitles = async () => {
    if (!videoFile) return;
    setIsTranscribing(true);
    setTranscriptionProgress(0);
    setTranscriptionMessage("Mempersiapkan audio dari video...");

    try {
      // Decode audio on main thread for the worker at 16kHz (standard Whisper sample rate)
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext({ sampleRate: 16000 });
      const arrayBuffer = await videoFile.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const numChannels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      const audioData = new Float32Array(length);

      // Downmix stereo / multichannel to mono
      if (numChannels === 1) {
        audioData.set(audioBuffer.getChannelData(0));
      } else {
        for (let c = 0; c < numChannels; c++) {
          const chData = audioBuffer.getChannelData(c);
          for (let i = 0; i < length; i++) {
            audioData[i] += chData[i] / numChannels;
          }
        }
      }

      // Peak amplitude normalization to prevent Whisper hallucinating on low-gain audio
      let maxPeak = 0;
      for (let i = 0; i < length; i++) {
        const abs = Math.abs(audioData[i]);
        if (abs > maxPeak) maxPeak = abs;
      }

      if (maxPeak > 0.01 && maxPeak < 0.85) {
        const gain = 0.92 / maxPeak;
        for (let i = 0; i < length; i++) {
          audioData[i] *= gain;
        }
      }

      await ctx.close().catch(() => {});

      // Init worker
      const worker = new Worker(new URL('./workers/whisper.worker.ts', import.meta.url), { type: 'module' });
      
      worker.onmessage = (e) => {
        const { status, progress, result, error, loaded, message } = e.data;
        if (status === 'downloading') {
          setTranscriptionMessage(message || `Mengunduh AI Model... ${Math.round(loaded)}%`);
          setTranscriptionProgress(Math.min(35, loaded * 0.35)); // 0-35% for download
        } else if (status === 'progress') {
          if (message) setTranscriptionMessage(message);
          setTranscriptionProgress(progress);
        } else if (status === 'complete') {
          if (result && result.chunks) {
            // Process and clean raw Whisper chunks (deduplicate, filter hallucinations, split long sentences)
            const processedSubs = processWhisperChunks(result.chunks, duration);
            setSubtitles(processedSubs);
          }
          setIsTranscribing(false);
          worker.terminate();
        } else if (status === 'error') {
          console.error("Transcription error:", error);
          alert("Gagal membuat subtitle: " + error);
          setIsTranscribing(false);
          worker.terminate();
        }
      };

      worker.postMessage({
        action: 'transcribe',
        audioData,
        language: transcriptionLanguage,
        model: transcriptionModel
      });
      
    } catch (err) {
      console.error(err);
      alert("Gagal mengekstrak audio dari video untuk subtitle.");
      setIsTranscribing(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      if (file.type.startsWith('video/')) {
        setVideoFile(file);
      } else if (file.type.startsWith('audio/')) {
        setAudioFile(file);
      }
    });
  }, [setVideoFile, setAudioFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.webm', '.mov', '.mkv'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac']
    },
    multiple: true
  });

  useEffect(() => {
    if (isPlaying) {
      if (videoRef.current) videoRef.current.play().catch(e => console.error(e));
      if (audioRef.current) audioRef.current.play().catch(e => console.error(e));
    } else {
      if (videoRef.current) videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isAudioSetup.current && audioGainRef.current) {
      audioGainRef.current.gain.value = audioVolume / 100;
    } else if (audioRef.current) {
      audioRef.current.volume = Math.min(1, audioVolume / 100);
    }
  }, [audioVolume]);

  useEffect(() => {
    if (isAudioSetup.current && videoGainRef.current) {
      videoGainRef.current.gain.value = videoVolume / 100;
    } else if (videoRef.current) {
      videoRef.current.volume = Math.min(1, videoVolume / 100);
    }
  }, [videoVolume]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      } else if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [setDuration]);

  const syncMedia = useCallback((newTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if (audioRef.current) {
      const aDuration = audioRef.current.duration;
      // Loop the audio if it's shorter than the video!
      if (aDuration && aDuration > 0) {
        audioRef.current.currentTime = newTime % aDuration;
      } else {
        audioRef.current.currentTime = newTime;
      }
    }
    setCurrentTime(newTime);
  }, [setCurrentTime]);

  const updateSeek = useCallback((clientX: number) => {
    if (!timelineRef.current || !duration || isNaN(duration)) return;
    const rect = timelineRef.current.getBoundingClientRect();
    
    // Sidebar tracks (w-24 = 96px)
    const sidebarWidth = 96; 
    const timelineStart = rect.left + sidebarWidth;
    const timelineWidth = rect.width - sidebarWidth;
    
    let x = clientX - timelineStart;
    if (x < 0) x = 0;
    if (x > timelineWidth) x = timelineWidth;
    
    const percentage = x / timelineWidth;
    const newTime = percentage * duration;
    
    syncMedia(newTime);
  }, [duration, syncMedia]);

  const handleWindowPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current) return;
    updateSeek(e.clientX);
  }, [updateSeek]);

  const handleWindowPointerUp = useCallback(() => {
    isDragging.current = false;
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerUp);
    window.removeEventListener('pointercancel', handleWindowPointerUp);
    
    // Resume if it was playing
    if (isPlaying) {
      videoRef.current?.play().catch(e=>console.error(e));
      audioRef.current?.play().catch(e=>console.error(e));
    }
  }, [handleWindowPointerMove, isPlaying]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration || isNaN(duration)) return;
    
    isDragging.current = true;
    updateSeek(e.clientX);
    
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
  };

  const playheadPosition = (duration && duration > 0 && !isNaN(duration)) 
    ? (currentTime / duration) * 100 
    : 0;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#09090b] text-zinc-200 font-sans overflow-hidden selection:bg-indigo-500/30">
      
      {/* HEADER - SCALED DOWN (h-12, text smaller) */}
      <header className="h-12 border-b border-zinc-800/80 flex items-center justify-between px-4 bg-[#09090b]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <MonitorPlay className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="font-semibold text-[15px] tracking-tight">VideoEditor<span className="font-light text-zinc-400">Pro</span></h1>
        </div>
        {/* Export Split Button */}
        <div className="relative flex items-center" ref={exportMenuRef}>
          {/* Quality badge */}
          {hdMode !== 'original' && (
            <span className="absolute -top-2 -left-1 z-10 text-[8px] font-black bg-cyan-500 text-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow">
              {hdMode}
            </span>
          )}
          <button
            onClick={handleExport}
            disabled={!videoFile || isExporting || isTranscribing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white pl-4 pr-3 py-1.5 rounded-l-md text-[11px] uppercase tracking-wider font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center gap-2 border-r border-indigo-800"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
          <button
            onClick={() => setShowExportMenu(v => !v)}
            disabled={!videoFile || isExporting || isTranscribing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-2 py-1.5 rounded-r-md transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center"
            title="Choose export quality"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {showExportMenu && (
            <div className="absolute top-full right-0 mt-2 w-52 bg-[#121216] border border-zinc-700/80 rounded-xl shadow-2xl shadow-black/60 z-[200] overflow-hidden backdrop-blur-md">
              <div className="px-3 pt-3 pb-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Export Quality</p>
              </div>
              {(
                [
                  { mode: 'original', label: 'Original', desc: 'Keep source resolution', color: 'text-zinc-300' },
                  { mode: '720p',     label: '720p HD',   desc: '1280 × 720',           color: 'text-indigo-300' },
                  { mode: '1080p',    label: '1080p FHD', desc: '1920 × 1080',          color: 'text-cyan-300' },
                  { mode: '4k',       label: '4K UHD',    desc: '3840 × 2160',          color: 'text-purple-300' },
                ] as const
              ).map(({ mode, label, desc, color }) => (
                <button
                  key={mode}
                  onClick={() => { setHdMode(mode); setShowExportMenu(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-800/70 transition-colors group ${
                    hdMode === mode ? 'bg-zinc-800/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {mode !== 'original' && <Zap className={`w-3 h-3 ${color}`} />}
                    {mode === 'original' && <div className="w-3 h-3" />}
                    <div className="text-left">
                      <div className={`text-[11px] font-bold ${color}`}>{label}</div>
                      <div className="text-[9px] text-zinc-500 font-mono">{desc}</div>
                    </div>
                  </div>
                  {hdMode === mode && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
              ))}
              <div className="px-3 pt-2 pb-3">
                <button
                  onClick={() => { handleExport(); setShowExportMenu(false); }}
                  disabled={!videoFile || isExporting}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-[10px] uppercase tracking-wider font-black py-2 rounded-lg transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2"
                >
                  <Download className="w-3 h-3" /> Export as {hdMode === 'original' ? 'Original' : hdMode.toUpperCase()}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR */}
        <aside className="w-16 border-r border-zinc-800/80 bg-[#0c0c0e] flex flex-col items-center py-4 gap-4 z-40">
          <div {...getRootProps()} className="cursor-pointer w-full px-2">
            <input {...getInputProps()} />
            <button className="w-full flex flex-col items-center justify-center py-2.5 bg-indigo-500/10 rounded-lg hover:bg-indigo-500/20 transition-all group relative ring-1 ring-indigo-500/30 shadow-sm" title="Add Media">
               <UploadCloud className="w-5 h-5 text-indigo-400 group-hover:text-indigo-300 mb-1" />
               <span className="text-[8px] uppercase tracking-wider font-bold text-indigo-300/80">Add</span>
            </button>
          </div>
          <button className="p-2.5 hover:bg-zinc-800/50 rounded-lg transition-all group" title="Video">
             <Video className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200" />
          </button>
          <button className="p-2.5 hover:bg-zinc-800/50 rounded-lg transition-all group" title="Audio">
             <FileAudio className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200" />
          </button>
          <button className="p-2.5 hover:bg-zinc-800/50 rounded-lg transition-all group" title="Subtitles" onClick={() => setActiveTab('subtitles')}>
             <Subtitles className={`w-5 h-5 transition-colors ${activeTab === 'subtitles' ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-200'}`} />
          </button>
          <button className="p-2.5 hover:bg-zinc-800/50 rounded-lg transition-all group mt-auto" title="Settings">
             <Settings className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200" />
          </button>
        </aside>

        {/* CENTER (Player) */}
        <main className="flex-1 flex flex-col relative p-2 bg-gradient-to-b from-[#09090b] to-[#0f0f13] shadow-inner">
          {(!videoUrl && !audioUrl) ? (
            <div className="flex-1 flex items-center justify-center w-full h-full">
              <div 
                {...getRootProps()} 
                className={`w-full max-w-xl h-64 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-all duration-300 cursor-pointer backdrop-blur-sm ${
                  isDragActive ? 'border-indigo-500 bg-indigo-500/10 scale-105 shadow-2xl shadow-indigo-500/20' : 'border-zinc-700 hover:border-indigo-500/50 hover:bg-zinc-800/30'
                }`}
              >
                <input {...getInputProps()} />
                <div className={`p-3 rounded-full mb-4 transition-colors ${isDragActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  <UploadCloud className="w-8 h-8" />
                </div>
                <p className="text-zinc-200 font-medium text-base tracking-wide text-center">
                  {isDragActive ? "Drop video or audio here to begin..." : "Drag & drop video and audio here"}
                </p>
                <p className="text-zinc-500 text-xs mt-2 text-center">Supports MP4, MOV, MP3, WAV</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col pb-2">
              <div className="flex-1 flex items-center justify-center overflow-hidden relative group w-full h-full rounded-xl">
                {videoUrl ? (
                  <>
                    {/* Hidden SVG filter for sharpness preview */}
                    <svg style={{ display: 'none' }} aria-hidden="true">
                      <defs>
                        <filter id="vid-sharpen" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="linearRGB">
                          {(() => {
                            // sharpness 100-200 → sharpen kernel (amount 0→1)
                            const a = Math.max(0, (sharpness - 100) / 100); // 0 to 1
                            const center = (1 + 4 * a).toFixed(4);
                            const edge   = (-a).toFixed(4);
                            return (
                              <feConvolveMatrix
                                order="3"
                                kernelMatrix={`0 ${edge} 0 ${edge} ${center} ${edge} 0 ${edge} 0`}
                                bias="0"
                                preserveAlpha="true"
                              />
                            );
                          })()}
                        </filter>
                      </defs>
                    </svg>

                    <video 
                      ref={videoRef}
                      src={videoUrl}
                      className="w-full h-full object-contain"
                      style={{
                        filter: [
                          `brightness(${brightness}%)`,
                          `contrast(${contrast}%)`,
                          `saturate(${saturation}%)`,
                          // Sharpness > 100 → SVG convolution sharpen
                          // Sharpness < 100 → CSS blur (softening)
                          sharpness > 100 ? 'url(#vid-sharpen)' : '',
                          sharpness < 100 ? `blur(${((100 - sharpness) / 100 * 3).toFixed(1)}px)` : '',
                        ].filter(Boolean).join(' '),
                      }}
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                      onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                      onCanPlay={(e) => setDuration(e.currentTarget.duration)}
                      onEnded={() => { if(isPlaying) togglePlayPause() }}
                    />
                  </>
                ) : (
                  <div className="text-zinc-600 flex flex-col items-center">
                    <FileAudio className="w-10 h-10 mb-3 opacity-50" />
                    <p className="text-sm">Audio Only Mode</p>
                  </div>
                )}
                
                {/* Hidden Audio */}
                {audioUrl && (
                  <audio 
                    ref={audioRef}
                    src={audioUrl}
                    loop={true}
                    onLoadedMetadata={(e) => { if (!videoUrl) setDuration(e.currentTarget.duration); }}
                    onDurationChange={(e) => { if (!videoUrl) setDuration(e.currentTarget.duration); }}
                    onCanPlay={(e) => { if (!videoUrl) setDuration(e.currentTarget.duration); }}
                  />
                )}

                {/* Overlay Filename */}
                {videoFile && (
                  <div className="absolute top-3 left-3 bg-black/60 px-2.5 py-1 rounded text-[10px] font-medium text-zinc-300 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    {videoFile.name}
                  </div>
                )}

                {/* Subtitle Overlay (Preview) */}
                {subtitles.length > 0 && (
                  <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center justify-end pointer-events-none px-6 sm:px-12 z-20">
                    {subtitles.map(sub => {
                      if (currentTime >= sub.start && currentTime <= sub.end) {
                        const sizeClasses = {
                          sm: 'text-base sm:text-lg md:text-xl',
                          md: 'text-xl sm:text-2xl md:text-3xl',
                          lg: 'text-2xl sm:text-3xl md:text-4xl',
                        }[subtitleSize || 'md'];

                        if (subtitleStyle === 'tiktok') {
                          return (
                            <div 
                              key={sub.id} 
                              className={`font-black text-center tracking-wider text-yellow-300 drop-shadow-[0_4px_8px_rgba(0,0,0,1)] uppercase max-w-3xl leading-snug px-4 py-1 transition-all ${sizeClasses}`}
                              style={{ 
                                textShadow: '3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0 3px 0 #000, 0 -3px 0 #000, 3px 0 0 #000, -3px 0 0 #000' 
                              }}
                            >
                              {sub.text}
                            </div>
                          );
                        } else if (subtitleStyle === 'box') {
                          return (
                            <div 
                              key={sub.id} 
                              className={`font-bold text-center text-white bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl max-w-2xl leading-relaxed transition-all ${sizeClasses}`}
                            >
                              {sub.text}
                            </div>
                          );
                        } else {
                          return (
                            <div 
                              key={sub.id} 
                              className={`font-black text-center text-white drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)] max-w-3xl leading-snug px-4 py-1 transition-all ${sizeClasses}`}
                              style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' }}
                            >
                              {sub.text}
                            </div>
                          );
                        }
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR with Tabs */}
        <aside className="w-64 border-l border-zinc-800/80 bg-[#0c0c0e] flex flex-col z-40 shadow-xl">
          <div className="flex border-b border-zinc-800/80">
            <button 
              className={`flex-1 p-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'adjustments' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
              onClick={() => setActiveTab('adjustments')}
            >
              Adjustments
            </button>
            <button 
              className={`flex-1 p-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'subtitles' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
              onClick={() => setActiveTab('subtitles')}
            >
              Subtitles
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'adjustments' && (
              <div className="p-4 space-y-5">
                <div className="group">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-300 group-hover:text-indigo-400 transition-colors">Brightness</label>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{brightness}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="200" value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                  />
                </div>
                
                <div className="group">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-300 group-hover:text-indigo-400 transition-colors">Contrast</label>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{contrast}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="200" value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                  />
                </div>
                
                <div className="group">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-300 group-hover:text-indigo-400 transition-colors">Saturation</label>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{saturation}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="200" value={saturation}
                    onChange={(e) => setSaturation(Number(e.target.value))}
                  />
                </div>

                <div className="group">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-300 group-hover:text-violet-400 transition-colors">Sharpness</label>
                    <span className="text-[10px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{sharpness}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="200" value={sharpness}
                    onChange={(e) => setSharpness(Number(e.target.value))}
                    style={{ accentColor: '#8b5cf6' }}
                  />
                </div>

                <div className="pt-5 border-t border-zinc-800/80">
                  {/* HD ENHANCE SECTION */}
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">HD Enhance</span>
                    </div>
                    <p className="text-[9px] text-zinc-500 leading-relaxed mb-3">
                      Set output resolution when exporting. Higher = sharper, larger file.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [['original', 'Original', 'Keep source resolution'],
                         ['720p', '720p HD', '1280×720'],
                         ['1080p', '1080p FHD', '1920×1080'],
                         ['4k', '4K UHD', '3840×2160']] as const
                      ).map(([mode, label, sub]) => (
                        <button
                          key={mode}
                          onClick={() => setHdMode(mode)}
                          className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                            hdMode === mode
                              ? 'bg-cyan-500/10 border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                              : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600'
                          }`}
                        >
                          <div className={`flex items-center gap-1.5 mb-0.5 ${
                            hdMode === mode ? 'text-cyan-300' : 'text-zinc-300'
                          }`}>
                            {mode !== 'original' && <Zap className="w-2.5 h-2.5" />}
                            <span className="text-[10px] font-bold">{label}</span>
                          </div>
                          <span className="text-[8px] text-zinc-500 font-mono">{sub}</span>
                        </button>
                      ))}
                    </div>

                    {hdMode !== 'original' && (
                      <div className="mt-3 flex items-center gap-2 bg-cyan-500/5 border border-cyan-500/20 rounded-lg px-3 py-2">
                        <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
                        <p className="text-[9px] text-cyan-300 leading-relaxed">
                          Video will be upscaled to <strong>{hdMode}</strong> on export using Lanczos algorithm for maximum quality.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Volume section */}
                  <div className="group mb-5">
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-medium text-zinc-300 group-hover:text-indigo-400 transition-colors">Video Volume</label>
                      <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{videoVolume}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="200" value={videoVolume}
                      onPointerDown={ensureAudioSetup}
                      onChange={(e) => setVideoVolume(Number(e.target.value))}
                      className={videoFile ? "" : "opacity-50 cursor-not-allowed"}
                      disabled={!videoFile}
                    />
                  </div>

                  <div className="group">
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-medium text-zinc-300 group-hover:text-indigo-400 transition-colors">BGM Volume</label>
                      <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{audioVolume}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="200" value={audioVolume}
                      onPointerDown={ensureAudioSetup}
                      onChange={(e) => setAudioVolume(Number(e.target.value))}
                      className={audioFile ? "" : "opacity-50 cursor-not-allowed"}
                      disabled={!audioFile}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'subtitles' && (
              <div className="p-4 flex flex-col h-full relative">
                {!isTranscribing && subtitles.length === 0 && (
                  <div className="flex flex-col gap-3.5">
                    <div className="bg-gradient-to-br from-indigo-950/40 to-purple-950/20 border border-indigo-500/20 rounded-xl p-3 shadow-inner">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs font-bold text-white">AI Subtitle Generator</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-relaxed">
                        Transkripsi otomatis suara video dengan model neural OpenAI Whisper offline berakurasi tinggi.
                      </p>
                    </div>

                    {/* Spoken Language */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-300 flex items-center justify-between">
                        <span>Bahasa Audio</span>
                        <span className="text-[9px] text-zinc-500">Language</span>
                      </label>
                      <select 
                        className="w-full bg-[#09090b] border border-zinc-700/80 hover:border-zinc-600 text-zinc-200 text-xs rounded-lg px-2.5 py-2 outline-none focus:border-indigo-500 shadow-inner cursor-pointer"
                        value={transcriptionLanguage}
                        onChange={(e) => setTranscriptionLanguage(e.target.value)}
                      >
                        <option value="id">🇮🇩 Bahasa Indonesia</option>
                        <option value="auto">🌐 Deteksi Otomatis (Auto-Detect)</option>
                        <option value="en">🇬🇧 English (Inggris)</option>
                        <option value="ja">🇯🇵 Japanese (Jepang)</option>
                      </select>
                    </div>

                    {/* Model Quality Selection */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-300 flex items-center justify-between">
                        <span>Kualitas AI Whisper</span>
                        <span className="text-[9px] text-indigo-400 font-medium">Model</span>
                      </label>
                      <select 
                        className="w-full bg-[#09090b] border border-zinc-700/80 hover:border-zinc-600 text-zinc-200 text-xs rounded-lg px-2.5 py-2 outline-none focus:border-indigo-500 shadow-inner cursor-pointer"
                        value={transcriptionModel}
                        onChange={(e) => setTranscriptionModel(e.target.value)}
                      >
                        <option value="Xenova/whisper-small">🎯 Whisper Small (~240MB) - Paling Akurat</option>
                        <option value="Xenova/whisper-base">⚖️ Whisper Base (~73MB) - Seimbang & Cepat</option>
                        <option value="Xenova/whisper-tiny">⚡ Whisper Tiny (~39MB) - Super Ringan</option>
                      </select>
                      <p className="text-[9px] text-zinc-500 leading-tight">
                        {transcriptionModel === 'Xenova/whisper-small' 
                          ? 'Akurasi terbaik untuk kosa kata & pelafalan Indonesia tanpa halusinasi.' 
                          : transcriptionModel === 'Xenova/whisper-base'
                          ? 'Ukuran ringan, pas untuk laptop standar atau kuota terbatas.'
                          : 'Proses instan untuk subtitle cepat.'}
                      </p>
                    </div>

                    <button 
                      onClick={handleGenerateSubtitles}
                      disabled={!videoFile}
                      className="mt-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2.5 rounded-lg font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.35)] flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <MonitorPlay className="w-4 h-4 text-white" /> Buat Subtitle Otomatis
                    </button>

                    <div className="flex items-center gap-2 my-0.5">
                      <div className="h-[1px] bg-zinc-800 flex-1"></div>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono">atau</span>
                      <div className="h-[1px] bg-zinc-800 flex-1"></div>
                    </div>

                    <button
                      onClick={() => {
                        const start = Math.round(currentTime * 10) / 10;
                        const end = Math.round(Math.min(duration || 10, start + 3) * 10) / 10;
                        addSubtitle({
                          id: `sub_${Date.now()}`,
                          start,
                          end,
                          text: 'Teks subtitle baru'
                        });
                      }}
                      className="w-full py-2 px-3 border border-zinc-700/80 hover:border-zinc-500 bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-300 hover:text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-zinc-400" /> Tambah Subtitle Manual
                    </button>
                  </div>
                )}
                
                {isTranscribing && (
                  <div className="flex flex-col items-center justify-center py-10 h-full text-center px-2">
                    <div className="relative mb-4">
                      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                      <Sparkles className="w-4 h-4 text-purple-400 absolute -top-1 -right-1 animate-pulse" />
                    </div>
                    <p className="text-xs text-zinc-200 font-bold tracking-wide mb-2 leading-relaxed">{transcriptionMessage}</p>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden shadow-inner relative mb-2">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-300" 
                        style={{ width: `${transcriptionProgress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between w-full text-[9px] text-zinc-500 font-mono">
                      <span>Proses AI Whisper</span>
                      <span>{Math.round(transcriptionProgress)}%</span>
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-4 leading-relaxed">
                      Model diolah langsung secara privat di browser komputer Anda tanpa kirim video ke cloud.
                    </p>
                  </div>
                )}

                {!isTranscribing && subtitles.length > 0 && (
                  <div className="flex flex-col h-full pb-2">
                    {/* Subtitle Header Controls */}
                    <div className="flex justify-between items-center pb-2.5 border-b border-zinc-800/80 mb-2.5">
                      <h3 className="text-[11px] font-bold text-white tracking-wide">
                        Subtitle ({subtitles.length})
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => downloadSubtitleFile(subtitles, 'srt', videoFile?.name || 'subtitles')}
                          title="Download File SRT (Standar Subtitle)"
                          className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2 py-1 rounded flex items-center gap-1 transition-colors border border-zinc-700/50 cursor-pointer"
                        >
                          <FileDown className="w-3 h-3 text-indigo-400" /> SRT
                        </button>
                        <button 
                          onClick={() => {
                            if (window.confirm("Hapus semua subtitle?")) {
                              setSubtitles([]);
                            }
                          }} 
                          title="Hapus Semua Subtitle"
                          className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-1 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>

                    {/* Style & Size Quick Bar */}
                    <div className="bg-[#09090b] border border-zinc-800/90 rounded-lg p-2 mb-2.5 space-y-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-400 font-medium">Gaya Teks:</span>
                        <div className="flex bg-zinc-900 p-0.5 rounded border border-zinc-800">
                          <button
                            onClick={() => setSubtitleStyle('classic')}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${subtitleStyle === 'classic' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                          >
                            Classic
                          </button>
                          <button
                            onClick={() => setSubtitleStyle('tiktok')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${subtitleStyle === 'tiktok' ? 'bg-yellow-500 text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                          >
                            TikTok
                          </button>
                          <button
                            onClick={() => setSubtitleStyle('box')}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${subtitleStyle === 'box' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                          >
                            Pill Box
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-400 font-medium">Ukuran:</span>
                        <div className="flex bg-zinc-900 p-0.5 rounded border border-zinc-800">
                          <button
                            onClick={() => setSubtitleSize('sm')}
                            className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${subtitleSize === 'sm' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                          >
                            Kecil
                          </button>
                          <button
                            onClick={() => setSubtitleSize('md')}
                            className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${subtitleSize === 'md' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                          >
                            Sedang
                          </button>
                          <button
                            onClick={() => setSubtitleSize('lg')}
                            className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${subtitleSize === 'lg' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                          >
                            Besar
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Add Subtitle at Current Time Button */}
                    <div className="flex gap-2 mb-2.5">
                      <button
                        onClick={() => {
                          const start = Math.round(currentTime * 10) / 10;
                          const end = Math.round(Math.min(duration || 10, start + 2.5) * 10) / 10;
                          addSubtitle({
                            id: `sub_${Date.now()}`,
                            start,
                            end,
                            text: ''
                          });
                        }}
                        className="flex-1 py-1.5 px-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah di {formatTime(currentTime)}
                      </button>

                      <button
                        onClick={handleGenerateSubtitles}
                        title="Buat ulang subtitle otomatis dengan AI"
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/50 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Scrollable Subtitles List */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {subtitles.map((sub) => {
                        const isActive = currentTime >= sub.start && currentTime <= sub.end;
                        return (
                          <div 
                            key={sub.id} 
                            className={`p-2.5 rounded-lg border transition-all duration-200 ${
                              isActive 
                                ? 'bg-indigo-500/15 border-indigo-500/60 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                                : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            {/* Header: Clickable timestamps to seek, and Delete icon */}
                            <div className="flex justify-between items-center mb-1">
                              <button
                                onClick={() => syncMedia(sub.start)}
                                className={`text-[10px] font-mono flex items-center gap-1 hover:underline cursor-pointer ${
                                  isActive ? 'text-indigo-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                                title="Klik untuk putar video di titik ini"
                              >
                                <Clock className="w-2.5 h-2.5 opacity-70" />
                                <span>{formatTime(sub.start)} - {formatTime(sub.end)}</span>
                              </button>
                              
                              <button
                                onClick={() => removeSubtitle(sub.id)}
                                title="Hapus subtitle ini"
                                className="text-zinc-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Time Adjusters */}
                            <div className="flex items-center gap-1 mb-1.5 text-[9px] text-zinc-500">
                              <span className="font-mono">In:</span>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={sub.start}
                                onChange={(e) => updateSubtitleTimes(sub.id, parseFloat(e.target.value) || 0, sub.end)}
                                className="w-12 bg-black/60 border border-zinc-800 rounded px-1 py-0.5 text-zinc-300 font-mono text-[9px] focus:border-indigo-500 outline-none"
                              />
                              <span className="font-mono ml-1">Out:</span>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={sub.end}
                                onChange={(e) => updateSubtitleTimes(sub.id, sub.start, parseFloat(e.target.value) || sub.start + 0.5)}
                                className="w-12 bg-black/60 border border-zinc-800 rounded px-1 py-0.5 text-zinc-300 font-mono text-[9px] focus:border-indigo-500 outline-none"
                              />
                            </div>

                            {/* Subtitle Text Content */}
                            <textarea 
                              value={sub.text}
                              onChange={(e) => updateSubtitle(sub.id, e.target.value)}
                              placeholder="Ketik teks subtitle..."
                              className="w-full bg-black/30 border border-zinc-800/80 focus:border-indigo-500/80 rounded p-1.5 text-zinc-100 text-xs font-normal outline-none resize-none leading-relaxed transition-colors placeholder:text-zinc-600"
                              rows={2}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* TIMELINE (Bottom) - SCALED DOWN (h-52) */}
      <div className="h-52 border-t border-zinc-800/80 bg-[#0f0f13] flex flex-col relative z-50">
        
        {/* Timeline Header (h-10) */}
        <div className="h-10 border-b border-zinc-800/80 flex items-center px-4 justify-between bg-[#0c0c0e]">
          <div className="flex items-center gap-4 w-1/3">
             <div className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">Timeline</div>
          </div>
          
          <div className="flex items-center justify-center gap-4 w-1/3">
             <button 
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-all"
                  onClick={() => { 
                    syncMedia(0);
                    if (isPlaying) {
                      videoRef.current?.play().catch(e=>e);
                      audioRef.current?.play().catch(e=>e);
                    }
                  }}
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => { ensureAudioSetup(); togglePlayPause(); }}
                  className="w-7 h-7 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all flex items-center justify-center shadow-lg shadow-indigo-600/30 hover:scale-105"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                </button>
                <button 
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-all"
                  onClick={() => { 
                    syncMedia(duration);
                    if (isPlaying) {
                      videoRef.current?.play().catch(e=>e);
                      audioRef.current?.play().catch(e=>e);
                    }
                  }}
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
          </div>

          <div className="flex justify-end w-1/3">
            <div className="text-[10px] font-mono text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded border border-zinc-700/50 shadow-inner">
               <span className="text-white">{formatTime(currentTime)}</span> / {formatTime(duration)}
            </div>
          </div>
        </div>

        {/* Timeline Tracks */}
        <div 
          className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col relative"
          ref={timelineRef}
        >
           <div 
             className="relative min-w-full min-h-full py-2 cursor-col-resize select-none"
             onPointerDown={handlePointerDown}
           >
             
             {/* Playhead line Wrapper */}
             <div className="absolute top-0 bottom-0 right-0 pointer-events-none z-40" style={{ left: '6rem' }}>
               <div 
                  className="absolute top-0 bottom-0 w-[2px] bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)] transition-all duration-75"
                  style={{ left: `${playheadPosition}%` }}
                >
                  <div className="w-3 h-3 bg-indigo-500 rotate-45 -ml-[5px] mt-1 shadow-sm rounded-[2px]"></div>
               </div>
             </div>

             {/* Track 1: Video */}
             <div className="h-14 bg-[#121216] flex items-center border-y border-zinc-800/50 group relative pointer-events-none">
                <div className="w-24 px-3 shrink-0 border-r border-zinc-800/80 flex items-center h-full text-[10px] font-medium text-zinc-400 bg-[#0c0c0e] z-30 sticky left-0 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.5)]">
                  <Video className="w-3.5 h-3.5 mr-2 opacity-50" />
                  Video 1
                </div>
                <div className="flex-1 relative h-full flex items-center px-2">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTM5IDB2NDBIMHoiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')] opacity-20 pointer-events-none"></div>
                  
                  {videoFile && (
                    <div className="absolute left-2 top-2 bottom-2 bg-gradient-to-r from-indigo-600/40 to-indigo-500/20 border border-indigo-500/50 rounded flex items-center px-2 text-[10px] w-full overflow-hidden shadow-sm backdrop-blur-sm group-hover:border-indigo-400 transition-colors pointer-events-auto">
                      <div className="flex-1 truncate font-medium text-indigo-100">{videoFile.name}</div>
                    </div>
                  )}
                </div>
             </div>
             
             {/* Track 2: Audio */}
             <div className="h-10 bg-[#121216] flex items-center border-b border-zinc-800/50 group mt-1 relative pointer-events-none">
                <div className="w-24 px-3 shrink-0 border-r border-zinc-800/80 flex items-center h-full text-[10px] font-medium text-zinc-400 bg-[#0c0c0e] z-30 sticky left-0 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.5)]">
                  <FileAudio className="w-3.5 h-3.5 mr-2 opacity-50" />
                  Audio 1
                </div>
                <div className="flex-1 relative h-full flex items-center px-2">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTM5IDB2NDBIMHoiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')] opacity-20 pointer-events-none"></div>
                  
                  {audioFile && (
                    <div className="absolute left-2 top-1.5 bottom-1.5 bg-gradient-to-r from-emerald-600/40 to-emerald-500/20 border border-emerald-500/50 rounded flex items-center px-2 text-[10px] w-full overflow-hidden shadow-sm backdrop-blur-sm group-hover:border-emerald-400 transition-colors pointer-events-auto">
                      <div className="flex-1 truncate font-medium text-emerald-100">{audioFile.name}</div>
                    </div>
                  )}
                </div>
             </div>

             {/* Track 3: Subtitles */}
             <div className="h-8 bg-[#121216] flex items-center border-b border-zinc-800/50 group mt-1 relative pointer-events-none">
                <div className="w-24 px-3 shrink-0 border-r border-zinc-800/80 flex items-center h-full text-[10px] font-medium text-zinc-400 bg-[#0c0c0e] z-30 sticky left-0 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.5)]">
                  <Subtitles className="w-3.5 h-3.5 mr-2 opacity-50" />
                  Text
                </div>
                <div className="flex-1 relative h-full">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTM5IDB2NDBIMHoiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')] opacity-20 pointer-events-none"></div>
                  
                  {/* Render Subtitle clips in timeline */}
                  {subtitles.map(sub => {
                    if (!duration) return null;
                    const leftPct = (sub.start / duration) * 100;
                    const widthPct = Math.max(1, ((sub.end - sub.start) / duration) * 100);
                    return (
                      <div 
                        key={sub.id}
                        onClick={(e) => { e.stopPropagation(); syncMedia(sub.start); }}
                        title={`${formatTime(sub.start)} - ${formatTime(sub.end)}: ${sub.text}`}
                        className="absolute top-1 bottom-1 bg-gradient-to-r from-purple-600/50 to-indigo-500/30 border border-purple-500/60 hover:border-purple-400 hover:bg-purple-600/70 rounded flex items-center px-1 text-[8px] overflow-hidden shadow-sm backdrop-blur-sm pointer-events-auto cursor-pointer transition-colors"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      >
                        <div className="truncate font-medium text-purple-100">{sub.text}</div>
                      </div>
                    )
                  })}
                </div>
             </div>
           </div>
        </div>
      </div>

      {/* Export Progress Modal */}
      {isExporting && (
        <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center">
           <div className="bg-[#121216] border border-zinc-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center w-96">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
              <h2 className="text-xl font-semibold text-white mb-2">Rendering Video</h2>
              <p className="text-sm text-zinc-400 text-center mb-6">Please keep this tab open. The video is being processed securely inside your browser.</p>
              
              <div className="w-full bg-zinc-800 rounded-full h-3 mb-2 overflow-hidden shadow-inner relative">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                  style={{ width: `${exportProgress}%` }}
                ></div>
              </div>
              <div className="flex justify-between w-full text-xs font-mono text-zinc-500">
                <span>Progress</span>
                <span className="text-indigo-400 font-bold">{exportProgress}%</span>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;
