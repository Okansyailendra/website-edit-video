import React, { useRef } from 'react';
import { 
  Wand2, Scissors, Palette, Play, Pause, SkipBack, SkipForward, 
  Maximize2, Sparkles, ChevronRight, ChevronDown, Video
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { formatTime } from '../utils/formatTime';

interface PlaybackPanelProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onSeek: (time: number) => void;
}

export const PlaybackPanel: React.FC<PlaybackPanelProps> = ({ videoRef, audioRef, onSeek }) => {
  const {
    videoUrl, audioUrl, isPlaying, togglePlayPause,
    currentTime, duration,
    brightness, contrast, saturation, sharpness,
    subtitles, subtitleStyle, subtitleSize, subtitleAnimation,
    setActiveModal, activeModal
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen().catch(err => console.error(err));
    }
  };

  const isFilterModified = brightness !== 100 || contrast !== 100 || saturation !== 100 || sharpness !== 100;
  const currentFormatted = formatTime(currentTime);

  return (
    <div 
      ref={containerRef}
      className="flex-1 bg-[#16161a] border border-[#25252c] rounded-2xl flex flex-col overflow-hidden select-none shadow-xl relative"
    >
      {/* Hidden SVG Filter for Sharpen Preview */}
      <svg style={{ display: 'none' }} aria-hidden="true">
        <defs>
          <filter id="vid-sharpen" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="linearRGB">
            {(() => {
              const a = Math.max(0, (sharpness - 100) / 100);
              const center = (1 + 4 * a).toFixed(4);
              const edge = (-a).toFixed(4);
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

      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[#23232b]">
        <button 
          onClick={() => {}}
          className="flex items-center gap-1 text-sm font-semibold text-white hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <span>Playback</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>

        {/* Toolbar icons on right */}
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setActiveModal(activeModal === 'ai' ? null : 'ai')}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              activeModal === 'ai' ? 'bg-[#5945ed] text-white' : 'hover:bg-[#23232b] text-zinc-300 hover:text-white'
            }`}
            title="Vidora AI Magic Tools"
          >
            <Wand2 className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => setActiveModal(activeModal === 'color' ? null : 'color')}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              activeModal === 'color' ? 'bg-[#5945ed] text-white' : 'hover:bg-[#23232b] text-zinc-300 hover:text-white'
            }`}
            title="Transform & Adjust"
          >
            <Scissors className="w-4 h-4" />
          </button>

          <button 
            onClick={() => setActiveModal(activeModal === 'color' ? null : 'color')}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              activeModal === 'color' ? 'bg-[#5945ed] text-white' : 'hover:bg-[#23232b] text-zinc-300 hover:text-white'
            }`}
            title="Color Adjustments"
          >
            <Palette className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video / Preview Viewport */}
      <div className="flex-1 bg-[#101014] relative flex items-center justify-center overflow-hidden group">
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              style={{
                filter: [
                  `brightness(${brightness}%)`,
                  `contrast(${contrast}%)`,
                  `saturate(${saturation}%)`,
                  sharpness > 100 ? 'url(#vid-sharpen)' : '',
                  sharpness < 100 ? `blur(${((100 - sharpness) / 100 * 3).toFixed(1)}px)` : '',
                ].filter(Boolean).join(' '),
              }}
              onClick={togglePlayPause}
            />

            {/* Big Center Play Button Overlay */}
            <button
              onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
              className={`absolute w-16 h-16 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all duration-200 cursor-pointer shadow-2xl hover:scale-105 ${
                isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100 scale-100'
              }`}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 fill-white" />
              ) : (
                <Play className="w-7 h-7 fill-white translate-x-0.5" />
              )}
            </button>
          </>
        ) : (
          /* Clean Empty Viewport */
          <div className="flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="w-16 h-16 rounded-2xl bg-[#1b1b22] border border-[#2b2b36] flex items-center justify-center mb-3 text-zinc-500 shadow-inner">
              <Video className="w-7 h-7 opacity-60" />
            </div>
            <p className="text-xs font-semibold text-zinc-300 mb-1">No Video Loaded</p>
            <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
              Import a video file using the Media panel or drag and drop a file anywhere into the window
            </p>
          </div>
        )}

        {/* Hidden Audio Element */}
        {audioUrl && (
          <audio ref={audioRef} src={audioUrl} loop={true} />
        )}

        {/* Floating Overlay Badges */}
        {videoUrl && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 z-20 pointer-events-auto">
            {/* Filter Applied Badge (if adjusted) */}
            {isFilterModified && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveModal('color');
                }}
                className="bg-[#5945ed] hover:bg-[#4d3ad8] text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>Filter applied</span>
              </button>
            )}

            {/* Start Position Badge */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSeek(0);
              }}
              className="bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white text-xs font-medium px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Start position</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        )}

        {/* Subtitle Overlay */}
        {subtitles.length > 0 && (
          <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center justify-end pointer-events-none px-6 z-20">
            {subtitles.map(sub => {
              if (currentTime >= sub.start && currentTime <= sub.end) {
                const sizeClasses = {
                  sm: 'text-sm sm:text-base',
                  md: 'text-base sm:text-xl',
                  lg: 'text-xl sm:text-2xl',
                }[subtitleSize || 'md'];

                const wordsList = (sub.words && sub.words.length > 0)
                  ? sub.words
                  : sub.text.trim().split(/\s+/).filter(Boolean).map((word, wIdx, arr) => {
                      const dur = Math.max(0.1, sub.end - sub.start) / Math.max(1, arr.length);
                      return {
                        word,
                        start: sub.start + wIdx * dur,
                        end: sub.start + (wIdx + 1) * dur
                      };
                    });

                const renderContent = () => {
                  if (subtitleAnimation === 'word-reveal') {
                    // Cumulative reveal: words appear 1 by 1 following speech
                    const visibleWords = wordsList.filter(w => currentTime >= w.start);
                    const displayedWords = visibleWords.length > 0 ? visibleWords : [wordsList[0]];

                    return (
                      <>
                        {displayedWords.map((w, wIdx) => {
                          const isCurrent = currentTime >= w.start && currentTime <= w.end;
                          return (
                            <span 
                              key={wIdx} 
                              className={`inline-block mr-1.5 transition-all duration-150 ${
                                isCurrent 
                                  ? (subtitleStyle === 'tiktok' 
                                      ? 'text-white scale-110 drop-shadow-[0_0_12px_rgba(255,255,0,0.9)]' 
                                      : 'text-amber-300 scale-105') 
                                  : ''
                              }`}
                            >
                              {w.word}
                            </span>
                          );
                        })}
                      </>
                    );
                  } else if (subtitleAnimation === 'karaoke') {
                    return (
                      <>
                        {wordsList.map((w, wIdx) => {
                          const isPast = currentTime > w.end;
                          const isCurrent = currentTime >= w.start && currentTime <= w.end;
                          return (
                            <span
                              key={wIdx}
                              className={`inline-block mr-1.5 transition-all duration-150 ${
                                isCurrent
                                  ? (subtitleStyle === 'tiktok' 
                                      ? 'text-white scale-115 bg-black/50 px-1 rounded drop-shadow-[0_0_15px_rgba(255,255,0,0.9)]' 
                                      : 'text-amber-300 scale-110 font-black')
                                  : isPast
                                  ? 'opacity-100'
                                  : 'opacity-35'
                              }`}
                            >
                              {w.word}
                            </span>
                          );
                        })}
                      </>
                    );
                  }

                  // Default static / none
                  return sub.text;
                };

                if (subtitleStyle === 'tiktok') {
                  return (
                    <div 
                      key={sub.id} 
                      className={`font-black text-center tracking-wider text-yellow-300 drop-shadow-[0_4px_8px_rgba(0,0,0,1)] uppercase max-w-xl leading-snug px-4 py-1 transition-all ${sizeClasses}`}
                      style={{ 
                        textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000' 
                      }}
                    >
                      {renderContent()}
                    </div>
                  );
                } else if (subtitleStyle === 'box') {
                  return (
                    <div 
                      key={sub.id} 
                      className={`font-bold text-center text-white bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl max-w-xl leading-relaxed transition-all ${sizeClasses}`}
                    >
                      {renderContent()}
                    </div>
                  );
                } else {
                  return (
                    <div 
                      key={sub.id} 
                      className={`font-bold text-center text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] max-w-xl leading-snug px-4 py-1 transition-all ${sizeClasses}`}
                      style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000' }}
                    >
                      {renderContent()}
                    </div>
                  );
                }
              }
              return null;
            })}
          </div>
        )}
      </div>

      {/* Playback Controls Footer */}
      <div className="h-12 px-4 border-t border-[#23232b] flex items-center justify-between">
        {/* Left: Time indicator */}
        <div className="text-xs font-mono font-medium text-zinc-300">
          <span>{currentFormatted}</span>
        </div>

        {/* Center: Playback buttons */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onSeek(0)}
            disabled={!videoUrl && !audioUrl}
            className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Beginning"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button 
            onClick={togglePlayPause}
            disabled={!videoUrl && !audioUrl}
            className="w-8 h-8 rounded-full bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center cursor-pointer shadow-md hover:scale-105 active:scale-95"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-black" />
            ) : (
              <Play className="w-4 h-4 fill-black translate-x-0.5" />
            )}
          </button>

          <button 
            onClick={() => onSeek(duration)}
            disabled={!videoUrl && !audioUrl}
            className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="End"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Fullscreen */}
        <div className="flex items-center">
          <button 
            onClick={toggleFullscreen}
            className="p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
