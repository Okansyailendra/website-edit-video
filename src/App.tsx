import { useCallback, useRef, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useEditorStore } from './store/useEditorStore';
import { exportVideo } from './utils/ffmpegExport';
import { transcribeWithGemini } from './utils/geminiSubtitle';

import { WindowHeader } from './components/WindowHeader';
import { EditorHeader } from './components/EditorHeader';
import { MediaPanel } from './components/MediaPanel';
import { PlaybackPanel } from './components/PlaybackPanel';
import { TimelinePanel } from './components/TimelinePanel';
import { BottomToolbar } from './components/BottomToolbar';
import { Modals } from './components/Modals';

export default function App() {
  const { 
    videoUrl, videoFile, audioVolume, videoVolume,
    isPlaying,
    setVideoFile, setAudioFile,
    setCurrentTime, setDuration, duration,
    setSubtitles,
    setIsTranscribing,
    transcriptionLanguage, geminiApiKey, geminiModel,
    setTranscriptionProgress, setTranscriptionMessage,
    selectedMediaId, mediaList
  } = useEditorStore();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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
    if (!videoFile) {
      alert("Please upload a video file to export!");
      return;
    }
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
    if (!videoFile) {
      alert("Silakan upload file video terlebih dahulu!");
      return;
    }

    if (!geminiApiKey || !geminiApiKey.trim()) {
      alert("Google Gemini API Key belum terkonfigurasi. Silakan periksa file .env Anda.");
      return;
    }

    setIsTranscribing(true);
    setTranscriptionProgress(10);
    setTranscriptionMessage("Mengekstrak audio dari video...");

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext({ sampleRate: 16000 });
      const arrayBuffer = await videoFile.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const numChannels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      const audioData = new Float32Array(length);

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

      const generatedSubtitles = await transcribeWithGemini(
        audioData,
        16000,
        {
          apiKey: geminiApiKey,
          model: geminiModel,
          language: transcriptionLanguage,
          onProgress: (prog, msg) => {
            setTranscriptionProgress(prog);
            setTranscriptionMessage(msg);
          }
        },
        duration
      );

      setSubtitles(generatedSubtitles);
      setTranscriptionProgress(100);
      setTranscriptionMessage("Subtitle berhasil dibuat dengan Gemini 3.5 Transcribe!");
      setTimeout(() => {
        setIsTranscribing(false);
      }, 600);

    } catch (err: any) {
      console.error("Gemini Transcription error:", err);
      alert(err.message || "Gagal membuat subtitle dengan Gemini 3.5 Transcribe.");
      setIsTranscribing(false);
    }
  };

  const handleUploadFiles = useCallback((files: File[]) => {
    files.forEach(file => {
      if (file.type.startsWith('video/')) {
        setVideoFile(file);
      } else if (file.type.startsWith('audio/')) {
        setAudioFile(file);
      }
    });
  }, [setVideoFile, setAudioFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleUploadFiles,
    noClick: true,
    accept: {
      'video/*': ['.mp4', '.webm', '.mov', '.mkv'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac']
    }
  });

  // Switch active video if a custom uploaded item in media list is selected
  useEffect(() => {
    if (selectedMediaId) {
      const item = mediaList.find(m => m.id === selectedMediaId);
      if (item && item.file && item.file !== videoFile) {
        setVideoFile(item.file);
      }
    }
  }, [selectedMediaId, mediaList, videoFile, setVideoFile]);

  // Video & Audio Playback Sync
  useEffect(() => {
    if (isPlaying) {
      if (videoRef.current) {
        videoRef.current.play().catch(e => console.error(e));
      }
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.error(e));
      }
    } else {
      if (videoRef.current) videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
    }
  }, [isPlaying]);

  // Video duration listener
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const updateDur = () => {
      if (v.duration && !isNaN(v.duration)) {
        setDuration(v.duration);
      }
    };
    v.addEventListener('loadedmetadata', updateDur);
    v.addEventListener('durationchange', updateDur);
    return () => {
      v.removeEventListener('loadedmetadata', updateDur);
      v.removeEventListener('durationchange', updateDur);
    };
  }, [videoUrl, setDuration]);

  // Video time update listener
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [videoUrl, setCurrentTime]);

  // Seek handler
  const handleSeek = useCallback((newTime: number) => {
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = newTime % audioRef.current.duration;
    }
  }, [setCurrentTime]);

  return (
    <div 
      {...getRootProps()} 
      className="h-screen w-screen bg-[#111115] text-zinc-100 font-sans flex flex-col overflow-hidden select-none relative"
    >
      <input {...getInputProps()} />

      {/* Drag Overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-50 bg-[#5945ed]/20 border-2 border-dashed border-[#5945ed] backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-[#18181f] border border-[#2e2e3b] p-6 rounded-2xl shadow-2xl flex flex-col items-center">
            <p className="text-sm font-bold text-white mb-1">Drop video or audio here</p>
            <p className="text-xs text-zinc-400">Files will be added directly into your media library</p>
          </div>
        </div>
      )}

      {/* Safari Window Header */}
      <WindowHeader />

      {/* Editor Header: Back, Project Title, Resolution, Export */}
      <EditorHeader onExport={handleExport} isExporting={isExporting} />

      {/* Workspace Area */}
      <main className="flex-1 flex flex-col p-3 gap-3 overflow-hidden bg-[#111115]">
        {/* Top Half: Media Panel + Playback Viewport */}
        <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
          {/* Left: Media Panel */}
          <MediaPanel onUploadMedia={handleUploadFiles} />

          {/* Right: Playback Viewport */}
          <PlaybackPanel 
            videoRef={videoRef} 
            audioRef={audioRef} 
            onSeek={handleSeek} 
          />
        </div>

        {/* Bottom Half: Multi-track Timeline */}
        <div className="h-60 shrink-0">
          <TimelinePanel onSeek={handleSeek} />
        </div>
      </main>

      {/* Bottom Floating Bar */}
      <BottomToolbar />

      {/* Modals & Popovers */}
      <Modals 
        onGenerateSubtitles={handleGenerateSubtitles}
        onAudioUpload={setAudioFile}
        ensureAudioSetup={ensureAudioSetup}
        isExporting={isExporting}
        exportProgress={exportProgress}
      />
    </div>
  );
}
