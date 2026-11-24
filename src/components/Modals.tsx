import React, { useRef } from 'react';
import { 
  X, Sparkles, Volume2, Upload, FileDown, Plus, Trash2, Clock, 
  RotateCcw, Sliders, Music, Loader2
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { formatTime } from '../utils/formatTime';
import { downloadSubtitleFile } from '../utils/subtitleUtils';

interface ModalsProps {
  onGenerateSubtitles: () => void;
  onAudioUpload: (file: File) => void;
  ensureAudioSetup: () => void;
  isExporting: boolean;
  exportProgress: number;
}

export const Modals: React.FC<ModalsProps> = ({
  onGenerateSubtitles,
  onAudioUpload,
  ensureAudioSetup,
  isExporting,
  exportProgress
}) => {
  const {
    activeModal, setActiveModal,
    // Color
    brightness, setBrightness,
    contrast, setContrast,
    saturation, setSaturation,
    sharpness, setSharpness,
    // Sound
    videoVolume, setVideoVolume,
    audioVolume, setAudioVolume,
    audioFile, videoFile,
    // AI & Subtitles
    subtitles, addSubtitle, removeSubtitle, updateSubtitle, updateSubtitleTimes,
    isTranscribing, transcriptionProgress, transcriptionMessage,
    transcriptionLanguage, setTranscriptionLanguage,
    subtitleStyle, setSubtitleStyle,
    subtitleSize, setSubtitleSize,
    subtitleAnimation, setSubtitleAnimation,
    currentTime, duration, setCurrentTime
  } = useEditorStore();

  const audioInputRef = useRef<HTMLInputElement>(null);

  const resetFilters = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setSharpness(100);
  };

  return (
    <>
      {/* 1. COLOR & ADJUSTMENTS MODAL */}
      {activeModal === 'color' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#18181f] border border-[#2e2e3b] rounded-2xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#282835] mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">Color & Adjustments</h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-zinc-400 hover:text-white p-1 hover:bg-[#252530] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sliders */}
            <div className="space-y-4">
              {/* Brightness */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-zinc-300">Brightness</span>
                  <span className="font-mono text-indigo-400 text-[11px] bg-indigo-500/10 px-1.5 py-0.5 rounded">{brightness}%</span>
                </div>
                <input 
                  type="range" min="0" max="200" value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Contrast */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-zinc-300">Contrast</span>
                  <span className="font-mono text-indigo-400 text-[11px] bg-indigo-500/10 px-1.5 py-0.5 rounded">{contrast}%</span>
                </div>
                <input 
                  type="range" min="0" max="200" value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Saturation */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-zinc-300">Saturation</span>
                  <span className="font-mono text-indigo-400 text-[11px] bg-indigo-500/10 px-1.5 py-0.5 rounded">{saturation}%</span>
                </div>
                <input 
                  type="range" min="0" max="200" value={saturation}
                  onChange={(e) => setSaturation(Number(e.target.value))}
                  className="w-full cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Sharpness */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-zinc-300">Sharpness</span>
                  <span className="font-mono text-purple-400 text-[11px] bg-purple-500/10 px-1.5 py-0.5 rounded">{sharpness}%</span>
                </div>
                <input 
                  type="range" min="0" max="200" value={sharpness}
                  onChange={(e) => setSharpness(Number(e.target.value))}
                  className="w-full cursor-pointer accent-purple-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-[#282835] flex items-center justify-between">
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#252530] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All</span>
              </button>

              <button
                onClick={() => setActiveModal(null)}
                className="bg-[#5945ed] hover:bg-[#4b35e0] text-white text-xs font-semibold px-5 py-2 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SOUND / VOLUME MODAL */}
      {activeModal === 'sound' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#18181f] border border-[#2e2e3b] rounded-2xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#282835] mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Volume2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">Audio & Volume</h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-zinc-400 hover:text-white p-1 hover:bg-[#252530] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-5">
              {/* Video Volume */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-zinc-300">Video Sound Volume</span>
                  <span className="font-mono text-emerald-400 text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded">{videoVolume}%</span>
                </div>
                <input 
                  type="range" min="0" max="200" value={videoVolume}
                  onPointerDown={ensureAudioSetup}
                  onChange={(e) => setVideoVolume(Number(e.target.value))}
                  className="w-full cursor-pointer accent-emerald-500"
                />
              </div>

              {/* BGM Audio Volume */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-zinc-300">Background Music (BGM)</span>
                  <span className="font-mono text-emerald-400 text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded">{audioVolume}%</span>
                </div>
                <input 
                  type="range" min="0" max="200" value={audioVolume}
                  onPointerDown={ensureAudioSetup}
                  onChange={(e) => setAudioVolume(Number(e.target.value))}
                  className="w-full cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Upload BGM File */}
              <div className="pt-2">
                <input 
                  type="file" 
                  ref={audioInputRef} 
                  accept="audio/*" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      onAudioUpload(e.target.files[0]);
                    }
                  }} 
                  className="hidden" 
                />
                
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#22222a] border border-[#2d2d38]">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <Music className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="text-left overflow-hidden">
                      <p className="text-xs font-semibold text-zinc-200 truncate">
                        {audioFile ? audioFile.name : 'Voice Over & Music'}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {audioFile ? `${(audioFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Default audio tracks synced'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => audioInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-[#2a2a35] hover:bg-[#343442] text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Upload Audio</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-[#282835] flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="bg-[#5945ed] hover:bg-[#4b35e0] text-white text-xs font-semibold px-5 py-2 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. VIDORA AI & SUBTITLES MODAL */}
      {activeModal === 'ai' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl max-h-[85vh] bg-[#18181f] border border-[#2e2e3b] rounded-2xl flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Header */}
            <div className="h-14 px-5 flex items-center justify-between border-b border-[#282835] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <Sparkles className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Vidora AI Subtitle Generator</span>
                    <span className="text-[10px] bg-gradient-to-r from-emerald-500/20 via-indigo-500/20 to-purple-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
                      <span className="text-emerald-400 font-bold">Google AI Studio</span>
                      <span className="text-zinc-500">•</span>
                      <span>Gemini 3.5 Transcribe</span>
                    </span>
                  </h3>
                  <p className="text-[10px] text-zinc-400">Model resmi Google AI Studio khusus transkripsi audio kata demi kata</p>
                </div>
              </div>

              <button 
                onClick={() => setActiveModal(null)}
                className="text-zinc-400 hover:text-white p-1 hover:bg-[#252530] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {/* Transcribing state */}
              {isTranscribing ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="relative mb-4">
                    <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                    <Sparkles className="w-4 h-4 text-purple-400 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <p className="text-xs text-white font-semibold mb-2">{transcriptionMessage}</p>
                  <div className="w-full max-w-sm bg-zinc-800 rounded-full h-2 overflow-hidden shadow-inner mb-2">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${transcriptionProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between w-full max-w-sm text-[10px] text-zinc-500 font-mono">
                    <span>Gemini 3.5 Transcribe</span>
                    <span>{Math.round(transcriptionProgress)}%</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Language and Dedicated Model Card */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-300 mb-1.5 block">Bahasa Audio (Language)</label>
                      <select 
                        value={transcriptionLanguage}
                        onChange={(e) => setTranscriptionLanguage(e.target.value)}
                        className="w-full bg-[#202029] border border-[#2e2e3b] text-zinc-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="id">🇮🇩 Bahasa Indonesia (id-ID)</option>
                        <option value="auto">🌐 Auto-Detect (85+ Bahasa)</option>
                        <option value="en">🇬🇧 English (en-US)</option>
                        <option value="ja">🇯🇵 Japanese (ja-JP)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-zinc-300 mb-1.5 block">AI Model (Official Transcribe)</label>
                      <div className="w-full bg-[#1e1e28] border border-[#2e2e3e] text-zinc-200 text-xs rounded-xl px-3 py-2 flex items-center justify-between">
                        <span className="font-semibold text-emerald-400 flex items-center gap-1.5 truncate">
                          <span>🎙️</span>
                          <span className="truncate">Gemini 3.5 Transcribe</span>
                        </span>
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-medium shrink-0">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onGenerateSubtitles}
                      disabled={!videoFile}
                      className="flex-1 bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {videoFile 
                          ? 'Auto-Generate Subtitles dengan Gemini 3.5 Transcribe' 
                          : 'Upload Video untuk Auto-Generate Subtitle'}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        const start = Math.round(currentTime * 10) / 10;
                        const end = Math.round(Math.min(duration || 65, start + 3) * 10) / 10;
                        addSubtitle({
                          id: `sub_${Date.now()}`,
                          start,
                          end,
                          text: 'New subtitle text'
                        });
                      }}
                      className="px-3 py-2.5 rounded-xl bg-[#252530] hover:bg-[#2e2e3b] text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-[#30303e]"
                      title="Add manual subtitle"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Manual</span>
                    </button>
                  </div>

                  {/* Subtitle Styling Quick Bar */}
                  <div className="bg-[#1e1e26] border border-[#2d2d38] rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
                    {/* Word-by-word reveal / Animation */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-zinc-400">Efek Suara:</span>
                      <div className="flex bg-[#16161d] p-0.5 rounded-lg border border-[#292934]">
                        <button
                          type="button"
                          onClick={() => setSubtitleAnimation('word-reveal')}
                          className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                            subtitleAnimation === 'word-reveal' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          title="Kata muncul satu per satu bersamaan dengan suara ucapan"
                        >
                          <span>⚡ 1 per 1 Kata</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSubtitleAnimation('karaoke')}
                          className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                            subtitleAnimation === 'karaoke' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          title="Teks penuh terlihat, kata yang sedang dibicarakan disorot"
                        >
                          <span>🎤 Karaoke</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSubtitleAnimation('none')}
                          className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                            subtitleAnimation === 'none' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          title="Kalimat langsung muncul penuh tanpa animasi"
                        >
                          <span>📄 Statis</span>
                        </button>
                      </div>
                    </div>

                    {/* Style */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-zinc-400">Style:</span>
                      <div className="flex bg-[#16161d] p-0.5 rounded-lg border border-[#292934]">
                        {(['classic', 'tiktok', 'box'] as const).map(style => (
                          <button
                            key={style}
                            onClick={() => setSubtitleStyle(style)}
                            className={`px-2.5 py-1 rounded text-[10px] font-semibold capitalize transition-colors cursor-pointer ${
                              subtitleStyle === style ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Size */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-zinc-400">Size:</span>
                      <div className="flex bg-[#16161d] p-0.5 rounded-lg border border-[#292934]">
                        {(['sm', 'md', 'lg'] as const).map(size => (
                          <button
                            key={size}
                            onClick={() => setSubtitleSize(size)}
                            className={`px-2 py-1 rounded text-[10px] font-semibold uppercase transition-colors cursor-pointer ${
                              subtitleSize === size ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => downloadSubtitleFile(subtitles, 'srt', 'subtitles')}
                      disabled={subtitles.length === 0}
                      className="flex items-center gap-1 text-[10px] text-zinc-300 hover:text-white bg-[#252530] hover:bg-[#2f2f3d] px-2.5 py-1 rounded-lg border border-[#333342] transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <FileDown className="w-3 h-3 text-zinc-400" />
                      <span>Export .SRT</span>
                    </button>
                  </div>

                  {/* Subtitle List */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 px-1">
                      <span>Subtitle Clips ({subtitles.length})</span>
                      {subtitles.length > 0 && (
                        <button 
                          onClick={() => {
                            if (window.confirm("Delete all subtitles?")) {
                              useEditorStore.getState().setSubtitles([]);
                            }
                          }}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    {subtitles.map((sub) => {
                      const isActive = currentTime >= sub.start && currentTime <= sub.end;
                      return (
                        <div
                          key={sub.id}
                          className={`p-3 rounded-xl border transition-all ${
                            isActive
                              ? 'bg-indigo-500/10 border-indigo-500/60 shadow-lg'
                              : 'bg-[#1b1b22] border-[#292934] hover:border-[#383848]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={() => setCurrentTime(sub.start)}
                              className={`flex items-center gap-1.5 text-xs font-mono hover:underline cursor-pointer ${
                                isActive ? 'text-indigo-400 font-bold' : 'text-zinc-400'
                              }`}
                            >
                              <Clock className="w-3 h-3 opacity-70" />
                              <span>{formatTime(sub.start)} - {formatTime(sub.end)}</span>
                            </button>

                            <button
                              onClick={() => removeSubtitle(sub.id)}
                              className="text-zinc-500 hover:text-red-400 transition-colors p-0.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 mb-2 text-[10px] text-zinc-500">
                            <span>In:</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={sub.start}
                              onChange={(e) => updateSubtitleTimes(sub.id, parseFloat(e.target.value) || 0, sub.end)}
                              className="w-14 bg-black/40 border border-[#2d2d39] rounded px-1.5 py-0.5 text-zinc-200 font-mono text-[10px] outline-none"
                            />
                            <span>Out:</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={sub.end}
                              onChange={(e) => updateSubtitleTimes(sub.id, sub.start, parseFloat(e.target.value) || sub.start + 0.5)}
                              className="w-14 bg-black/40 border border-[#2d2d39] rounded px-1.5 py-0.5 text-zinc-200 font-mono text-[10px] outline-none"
                            />
                          </div>

                          <textarea
                            value={sub.text}
                            onChange={(e) => updateSubtitle(sub.id, e.target.value)}
                            rows={2}
                            placeholder="Subtitle text..."
                            className="w-full bg-black/30 border border-[#2c2c38] focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none resize-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="h-14 px-5 border-t border-[#282835] flex items-center justify-end shrink-0">
              <button
                onClick={() => setActiveModal(null)}
                className="bg-[#5945ed] hover:bg-[#4b35e0] text-white text-xs font-semibold px-5 py-2 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. EXPORT PROGRESS MODAL */}
      {isExporting && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#16161c] border border-[#2c2c38] p-6 rounded-2xl shadow-2xl flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-[#5945ed] animate-spin mb-4" />
            <h2 className="text-base font-bold text-white mb-1">Exporting Your Video</h2>
            <p className="text-xs text-zinc-400 text-center mb-5">
              Encoding video with high-definition enhancement filters directly in your browser.
            </p>
            
            <div className="w-full bg-zinc-800 rounded-full h-2.5 mb-2 overflow-hidden shadow-inner relative">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(99,102,241,0.5)]" 
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <div className="flex justify-between w-full text-xs font-mono text-zinc-400">
              <span>Rendering</span>
              <span className="text-indigo-400 font-bold">{exportProgress}%</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
