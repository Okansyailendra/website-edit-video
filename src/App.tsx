import { useCallback, useRef, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useEditorStore } from './store/useEditorStore';
import { formatTime } from './utils/formatTime';
import { exportVideo } from './utils/ffmpegExport';
import { UploadCloud, Play, Pause, SkipBack, SkipForward, Settings, Video, FileAudio, Subtitles, Download, MonitorPlay, Loader2 } from 'lucide-react';

function App() {
  const { 
    videoUrl, videoFile, audioUrl, audioFile, audioVolume, videoVolume,
    isPlaying, togglePlayPause, 
    setVideoFile, setAudioFile, setAudioVolume, setVideoVolume,
    setCurrentTime, setDuration, currentTime, duration,
    brightness, contrast, saturation,
    setBrightness, setContrast, setSaturation,
    // Subtitles
    subtitles, setSubtitles, updateSubtitle,
    isTranscribing, setIsTranscribing,
    transcriptionLanguage, setTranscriptionLanguage,
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

    try {
      // Decode audio on main thread for the worker
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext({ sampleRate: 16000 });
      const arrayBuffer = await videoFile.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const audioData = audioBuffer.getChannelData(0); // Float32Array at 16kHz

      // Init worker
      const worker = new Worker(new URL('./workers/whisper.worker.ts', import.meta.url), { type: 'module' });
      
      worker.onmessage = (e) => {
        const { status, progress, result, error, loaded } = e.data;
        if (status === 'downloading') {
           setTranscriptionMessage(`Downloading AI Model... ${Math.round(loaded)}%`);
           setTranscriptionProgress(loaded * 0.5); // 0-50% for download
        } else if (status === 'progress') {
          setTranscriptionMessage("Analyzing Audio...");
          setTranscriptionProgress(50 + (progress * 0.5)); // 50-100% for transcribing
        } else if (status === 'complete') {
          if (result && result.chunks) {
            const subs = result.chunks.map((chunk: any, i: number) => ({
              id: `sub_${i}`,
              start: chunk.timestamp[0],
              end: chunk.timestamp[1] || chunk.timestamp[0] + 5,
              text: chunk.text.trim(),
            }));
            setSubtitles(subs);
          }
          setIsTranscribing(false);
          worker.terminate();
        } else if (status === 'error') {
          console.error("Transcription error:", error);
          alert("Transcription failed. " + error);
          setIsTranscribing(false);
          worker.terminate();
        }
      };

      worker.postMessage({
        action: 'transcribe',
        audioData,
        language: transcriptionLanguage
      });
      
    } catch (err) {
      console.error(err);
      alert("Failed to extract audio from video for transcription.");
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
        <button 
          onClick={handleExport}
          disabled={!videoFile || isExporting || isTranscribing}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-md text-[11px] uppercase tracking-wider font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center gap-2"
        >
          {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
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
                  <video 
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-contain"
                    style={{
                      filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`
                    }}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                    onCanPlay={(e) => setDuration(e.currentTarget.duration)}
                    onEnded={() => { if(isPlaying) togglePlayPause() }}
                  />
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
                  <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center justify-end pointer-events-none px-10">
                    {subtitles.map(sub => {
                      if (currentTime >= sub.start && currentTime <= sub.end) {
                        return (
                          <div 
                            key={sub.id} 
                            className="text-white text-2xl font-black text-center shadow-black drop-shadow-[0_4px_4px_rgba(0,0,0,1)]"
                            style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' }}
                          >
                            {sub.text}
                          </div>
                        );
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

                <div className="pt-5 border-t border-zinc-800/80">
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
                  <div className="flex flex-col gap-4">
                    <label className="text-xs font-medium text-zinc-300">Spoken Language</label>
                    <select 
                      className="bg-[#09090b] border border-zinc-700 text-zinc-200 text-xs rounded-lg px-3 py-2.5 outline-none focus:border-indigo-500 shadow-inner"
                      value={transcriptionLanguage}
                      onChange={(e) => setTranscriptionLanguage(e.target.value)}
                    >
                      <option value="id">Indonesian (Indonesia)</option>
                      <option value="en">English (Inggris)</option>
                      <option value="ja">Japanese (Jepang)</option>
                    </select>
                    
                    <button 
                      onClick={handleGenerateSubtitles}
                      disabled={!videoFile}
                      className="mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs py-3 rounded-lg font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2"
                    >
                      <MonitorPlay className="w-4 h-4" /> Auto-Generate AI
                    </button>
                    <p className="text-[10px] text-zinc-500 text-center leading-relaxed mt-2">
                      First time using AI? It will download a ~150MB neural model to your browser.
                    </p>
                  </div>
                )}
                
                {isTranscribing && (
                  <div className="flex flex-col items-center justify-center py-10 h-full">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4 shadow-indigo-500/50" />
                    <p className="text-xs text-zinc-300 font-bold tracking-wide mb-2 text-center">{transcriptionMessage}</p>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden shadow-inner relative">
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${transcriptionProgress}%` }}></div>
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-2 font-mono">{Math.round(transcriptionProgress)}%</p>
                  </div>
                )}

                {!isTranscribing && subtitles.length > 0 && (
                  <div className="flex flex-col h-full pb-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Subtitle Editor</h3>
                      <button onClick={() => setSubtitles([])} className="text-[10px] text-red-400 hover:text-red-300 font-medium px-2 py-1 hover:bg-red-500/10 rounded transition-colors">Clear All</button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                      {subtitles.map((sub) => {
                        const isActive = currentTime >= sub.start && currentTime <= sub.end;
                        return (
                          <div 
                            key={sub.id} 
                            className={`p-3 rounded-lg border transition-all duration-300 ${isActive ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
                          >
                            <div className="flex justify-between text-[9px] text-zinc-500 font-mono mb-2">
                              <span className={isActive ? 'text-indigo-400' : ''}>{formatTime(sub.start)}</span>
                              <span className={isActive ? 'text-indigo-400' : ''}>{formatTime(sub.end)}</span>
                            </div>
                            <textarea 
                              value={sub.text}
                              onChange={(e) => updateSubtitle(sub.id, e.target.value)}
                              className="w-full bg-transparent text-zinc-200 text-xs font-medium outline-none resize-none leading-relaxed"
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
                    const widthPct = ((sub.end - sub.start) / duration) * 100;
                    return (
                      <div 
                        key={sub.id}
                        className="absolute top-1 bottom-1 bg-gradient-to-r from-purple-600/40 to-purple-500/20 border border-purple-500/50 rounded flex items-center px-1 text-[8px] overflow-hidden shadow-sm backdrop-blur-sm pointer-events-auto"
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
