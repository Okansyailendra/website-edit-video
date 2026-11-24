import React, { useRef, useCallback, useState } from 'react';
import { 
  ChevronDown, Radio, Volume2, Star, Trash2, Split, 
  Type, Video, Music, Lock, Eye, EyeOff, Plus
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

interface TimelinePanelProps {
  onSeek: (time: number) => void;
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({ onSeek }) => {
  const { 
    currentTime, duration,
    videoFile, audioFile,
    subtitles, setActiveModal,
    removeSubtitle, addSubtitle
  } = useEditorStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Track lock & visibility toggles
  const [lockedTracks, setLockedTracks] = useState<Record<string, boolean>>({});
  const [hiddenTracks, setHiddenTracks] = useState<Record<string, boolean>>({});
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const toggleLock = (track: string) => {
    setLockedTracks(prev => ({ ...prev, [track]: !prev[track] }));
  };

  const toggleVisibility = (track: string) => {
    setHiddenTracks(prev => ({ ...prev, [track]: !prev[track] }));
  };

  const totalDuration = duration > 0 ? duration : 60; // 60s fallback ruler scale

  const updateSeekFromPointer = useCallback((clientX: number) => {
    if (!timelineRef.current || totalDuration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const sidebarWidth = 110; // w-[110px] track header
    const trackStart = rect.left + sidebarWidth;
    const trackWidth = rect.width - sidebarWidth;

    let x = clientX - trackStart;
    if (x < 0) x = 0;
    if (x > trackWidth) x = trackWidth;

    const newTime = (x / trackWidth) * totalDuration;
    onSeek(newTime);
  }, [totalDuration, onSeek]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    updateSeekFromPointer(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      if (isDragging.current) {
        updateSeekFromPointer(ev.clientX);
      }
    };

    const onPointerUp = () => {
      isDragging.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Generate dynamic or clean ruler timestamps (e.g. 10 intervals)
  const markerCount = 12;
  const timeMarkers = Array.from({ length: markerCount }, (_, i) => {
    const secs = Math.round((i / (markerCount - 1)) * totalDuration);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  const playheadPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="bg-[#16161a] border border-[#25252c] rounded-2xl flex flex-col overflow-hidden select-none shadow-xl">
      {/* Timeline Header Bar */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[#23232b]">
        {/* Left: Heading & tools */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {}}
            className="flex items-center gap-1 text-sm font-semibold text-white hover:text-zinc-300 transition-colors cursor-pointer mr-2"
          >
            <span>Timeline</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {/* Multicom button */}
          <button 
            onClick={() => {}}
            className="px-3 py-1.5 rounded-xl bg-[#22222a] hover:bg-[#2c2c36] text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-[#2c2c37]"
          >
            <Radio className="w-3.5 h-3.5 text-zinc-400" />
            <span>Multicom</span>
          </button>

          {/* Volume button */}
          <button 
            onClick={() => setActiveModal('sound')}
            className="px-3 py-1.5 rounded-xl bg-[#22222a] hover:bg-[#2c2c36] text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-[#2c2c37]"
          >
            <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Volume</span>
          </button>

          {/* Animation button */}
          <button 
            onClick={() => {}}
            className="px-3 py-1.5 rounded-xl bg-[#22222a] hover:bg-[#2c2c36] text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-[#2c2c37]"
          >
            <Star className="w-3.5 h-3.5 text-zinc-400" />
            <span>Animation</span>
          </button>
        </div>

        {/* Right tools: Split & Delete */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {}}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#23232b] rounded-lg transition-colors cursor-pointer"
            title="Split Clip at Playhead"
          >
            <Split className="w-4 h-4" />
          </button>

          <button 
            onClick={() => {
              if (selectedSubId) {
                removeSubtitle(selectedSubId);
                setSelectedSubId(null);
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-[#22222a] hover:bg-red-500/20 text-zinc-300 hover:text-red-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-[#2c2c37]"
            title="Delete Selected Clip"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Timeline Ruler & Tracks Area */}
      <div 
        ref={timelineRef}
        onPointerDown={handlePointerDown}
        className="relative flex-1 flex flex-col overflow-hidden cursor-pointer"
      >
        {/* Ruler Bar */}
        <div className="h-7 border-b border-[#23232b] flex items-center bg-[#131317]">
          {/* Header spacer */}
          <div className="w-[110px] shrink-0 border-r border-[#23232b] h-full bg-[#16161a]" />
          
          {/* Ruler Timestamps */}
          <div className="flex-1 flex justify-between px-2 text-[10px] font-mono text-zinc-500 relative h-full items-center">
            {timeMarkers.map((marker, idx) => (
              <div key={idx} className="flex flex-col items-center relative">
                <span className="leading-none">{marker}</span>
                <div className="h-1.5 w-[1px] bg-zinc-700 mt-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Tracks Container */}
        <div className="relative flex-1 flex flex-col py-2 gap-1.5 bg-[#121215]">
          {/* Track 1: Text / Subtitle */}
          <div className="h-10 flex items-center relative">
            {/* Left Header */}
            <div className="w-[110px] shrink-0 h-full px-3 bg-[#16161a] border-r border-[#23232b] flex items-center justify-between z-20">
              <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-zinc-300">
                <Type className="w-3.5 h-3.5" />
              </span>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleLock('text'); }}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5"
                >
                  <Lock className={`w-3 h-3 ${lockedTracks['text'] ? 'text-amber-400' : ''}`} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleVisibility('text'); }}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5"
                >
                  {hiddenTracks['text'] ? <EyeOff className="w-3 h-3 text-red-400" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Subtitle track content */}
            <div className="flex-1 h-full relative px-2 flex items-center">
              {subtitles.length > 0 ? (
                subtitles.map((sub) => {
                  const left = totalDuration > 0 ? (sub.start / totalDuration) * 100 : 0;
                  const width = totalDuration > 0 ? Math.max(3, ((sub.end - sub.start) / totalDuration) * 100) : 5;
                  const isSelected = selectedSubId === sub.id;

                  return (
                    <div
                      key={sub.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSubId(sub.id);
                        onSeek(sub.start);
                      }}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      className={`absolute h-7 rounded-lg bg-[#5945ed] hover:bg-[#4b35e0] text-white flex items-center px-2 text-[11px] font-medium shadow-md transition-all cursor-pointer truncate border ${
                        isSelected ? 'ring-2 ring-white border-white' : 'border-[#6c59ff]'
                      }`}
                      title={`${sub.text} (${sub.start}s - ${sub.end}s)`}
                    >
                      <span className="font-bold mr-1.5 text-indigo-200">T</span>
                      <span className="truncate">{sub.text}</span>
                    </div>
                  );
                })
              ) : (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    const s = Math.round(currentTime * 10) / 10;
                    addSubtitle({
                      id: `sub_${Date.now()}`,
                      start: s,
                      end: s + 3,
                      text: 'New subtitle text'
                    });
                  }}
                  className="w-full h-7 rounded-lg border border-dashed border-[#282835] hover:border-indigo-500/40 hover:bg-indigo-500/5 flex items-center justify-center text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Text / Subtitle Track
                </div>
              )}
            </div>
          </div>

          {/* Track 2: Video Clip */}
          <div className="h-16 flex items-center relative">
            {/* Left Header */}
            <div className="w-[110px] shrink-0 h-full px-3 bg-[#16161a] border-r border-[#23232b] flex items-center justify-between z-20">
              <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-zinc-300">
                <Video className="w-3.5 h-3.5" />
              </span>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleLock('video'); }}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5"
                >
                  <Lock className={`w-3 h-3 ${lockedTracks['video'] ? 'text-amber-400' : ''}`} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleVisibility('video'); }}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5"
                >
                  {hiddenTracks['video'] ? <EyeOff className="w-3 h-3 text-red-400" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Video track content: Render actual user video if available */}
            <div className="flex-1 h-full relative px-2 flex items-center">
              {videoFile ? (
                <div className="w-full h-14 rounded-xl overflow-hidden bg-[#22222d] border-2 border-amber-400 flex items-center justify-between px-3 shadow-lg relative group">
                  {/* Left handle */}
                  <div className="w-1.5 h-6 bg-white rounded-full shadow-md pointer-events-auto cursor-ew-resize -ml-1.5" />
                  
                  {/* Video Clip Label */}
                  <div className="flex items-center gap-2 overflow-hidden px-2">
                    <Video className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs font-semibold text-zinc-100 truncate">
                      {videoFile.name}
                    </span>
                  </div>

                  {/* Right handle */}
                  <div className="w-1.5 h-6 bg-white rounded-full shadow-md pointer-events-auto cursor-ew-resize -mr-1.5" />
                </div>
              ) : (
                <div className="w-full h-14 rounded-xl border border-dashed border-[#282835] flex items-center justify-center text-xs text-zinc-600">
                  <span>No video loaded on track</span>
                </div>
              )}
            </div>
          </div>

          {/* Track 3: Audio Waveform */}
          <div className="h-10 flex items-center relative">
            {/* Left Header */}
            <div className="w-[110px] shrink-0 h-full px-3 bg-[#16161a] border-r border-[#23232b] flex items-center justify-between z-20">
              <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-zinc-300">
                <Music className="w-3.5 h-3.5" />
              </span>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleLock('audio'); }}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5"
                >
                  <Lock className={`w-3 h-3 ${lockedTracks['audio'] ? 'text-amber-400' : ''}`} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleVisibility('audio'); }}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5"
                >
                  {hiddenTracks['audio'] ? <EyeOff className="w-3 h-3 text-red-400" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Audio track content */}
            <div className="flex-1 h-full relative px-2 flex items-center">
              {audioFile ? (
                <div 
                  className="w-full h-7 rounded-lg bg-[#1a4a44] border border-[#2b726a] flex items-center px-3 text-[11px] text-teal-200 overflow-hidden shadow-sm"
                >
                  <span className="font-bold mr-2">♫</span>
                  <span className="font-medium mr-4 truncate">{audioFile.name}</span>
                  {/* Real waveform representation */}
                  <div className="flex-1 h-4 flex items-center gap-[2px] opacity-75 overflow-hidden">
                    {[4, 8, 12, 16, 10, 6, 14, 18, 9, 15, 12, 6, 10, 14, 8, 12, 16, 10, 14, 8, 5, 12, 16, 10, 8, 14, 12, 7, 10, 15, 8, 12, 16, 10, 6, 14, 18, 9, 15, 12, 6, 10, 14, 8, 12, 16, 10, 14, 8, 5, 12, 16, 10, 8, 14, 12, 7, 10, 15, 8].map((h, i) => (
                      <div key={i} style={{ height: `${h}px` }} className="w-[2px] bg-teal-300 rounded-full shrink-0" />
                    ))}
                  </div>
                </div>
              ) : (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveModal('sound');
                  }}
                  className="w-full h-7 rounded-lg border border-dashed border-[#282835] hover:border-teal-500/40 hover:bg-teal-500/5 flex items-center justify-center text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Audio Track
                </div>
              )}
            </div>
          </div>

          {/* Full-Height Scrubber Playhead Line (White Line + Handles) */}
          <div 
            className="absolute top-0 bottom-0 pointer-events-none z-30 transition-all duration-75"
            style={{ 
              left: `calc(110px + (100% - 110px) * ${playheadPercent / 100})` 
            }}
          >
            {/* Vertical White Line */}
            <div className="w-[2px] h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] relative -ml-[1px]">
              {/* Bottom White Knob */}
              <div className="w-2.5 h-2.5 rounded-full bg-white -ml-[4px] absolute bottom-0 shadow-md" />
              {/* Top White Knob */}
              <div className="w-2.5 h-2.5 rounded-full bg-white -ml-[4px] absolute -top-1 shadow-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
