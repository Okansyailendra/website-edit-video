import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ChevronDown, Check, Zap, Loader2 } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

interface EditorHeaderProps {
  onExport: () => void;
  isExporting: boolean;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({ onExport, isExporting }) => {
  const { projectTitle, setProjectTitle, hdMode, setHdMode, isTranscribing } = useEditorStore();
  const [showResMenu, setShowResMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowResMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resolutions = [
    { mode: '720p', label: '720P - 30fps', desc: '1280 × 720 (Fast)' },
    { mode: '1080p', label: '1080P - 60fps', desc: '1920 × 1080 (Recommended)' },
    { mode: '4k', label: '4K - 60fps', desc: '3840 × 2160 (Ultra HD)' },
    { mode: 'original', label: 'Original', desc: 'Keep Source Resolution' },
  ] as const;

  const currentLabel = resolutions.find(r => r.mode === hdMode)?.label || '1080P - 60fps';

  return (
    <header className="h-14 px-6 flex items-center justify-between bg-[#16161a] border-b border-[#25252c] z-30 select-none">
      {/* Back button */}
      <div className="flex items-center">
        <button 
          onClick={() => {
            if (window.confirm("Return to home? Any unsaved edits will remain in cache.")) {
              // Reset or back
            }
          }}
          className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-[#23232b] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Project Title and Resolution selector */}
      <div className="flex items-center gap-3">
        {isEditingTitle ? (
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
            autoFocus
            className="bg-[#24242e] border border-indigo-500/80 rounded px-2.5 py-0.5 text-sm font-semibold text-white outline-none"
          />
        ) : (
          <h1 
            onClick={() => setIsEditingTitle(true)}
            className="text-sm font-semibold text-white cursor-pointer hover:text-indigo-300 transition-colors flex items-center gap-1.5"
            title="Click to rename project"
          >
            {projectTitle}
          </h1>
        )}

        <span className="text-zinc-600 font-bold text-xs">•</span>

        {/* Resolution selector */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setShowResMenu(prev => !prev)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-[#23232b]"
          >
            <span>{currentLabel}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showResMenu ? 'rotate-180' : ''}`} />
          </button>

          {showResMenu && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-[#1b1b22] border border-[#2f2f3d] rounded-xl shadow-2xl shadow-black/80 z-50 overflow-hidden py-1.5 backdrop-blur-md">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-[#282834]">
                Export Preset
              </div>
              {resolutions.map((res) => (
                <button
                  key={res.mode}
                  onClick={() => {
                    setHdMode(res.mode);
                    setShowResMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#282835] transition-colors text-left ${
                    hdMode === res.mode ? 'bg-[#252533] text-indigo-400' : 'text-zinc-300'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold flex items-center gap-1.5">
                      {res.mode !== 'original' && <Zap className="w-3 h-3 text-indigo-400" />}
                      <span>{res.label}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">{res.desc}</div>
                  </div>
                  {hdMode === res.mode && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Export button */}
      <div className="flex items-center">
        <button
          onClick={onExport}
          disabled={isExporting || isTranscribing}
          className="bg-[#5945ed] hover:bg-[#4b35e0] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-[0_4px_14px_rgba(89,69,237,0.35)] flex items-center gap-2 cursor-pointer"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Exporting...</span>
            </>
          ) : (
            <span>Export</span>
          )}
        </button>
      </div>
    </header>
  );
};
