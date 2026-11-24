import React, { useState, useRef } from 'react';
import { 
  Plus, LayoutGrid, SlidersHorizontal, Search, Video, Music,
  CheckCircle2, MoreHorizontal, X, UploadCloud, Film
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

interface MediaPanelProps {
  onUploadMedia: (files: File[]) => void;
}

export const MediaPanel: React.FC<MediaPanelProps> = ({ onUploadMedia }) => {
  const { mediaList, selectedMediaId, setSelectedMediaId } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredMedia = mediaList.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadMedia(Array.from(e.target.files));
    }
  };

  // Calculate total size in MB
  const totalSizeMB = mediaList.reduce((acc, item) => {
    if (item.file) {
      return acc + (item.file.size / (1024 * 1024));
    }
    return acc;
  }, 0);

  const formattedTotalSize = totalSizeMB > 1024 
    ? `${(totalSizeMB / 1024).toFixed(1)} GB`
    : `${totalSizeMB.toFixed(1)} MB`;

  return (
    <div className="w-[380px] bg-[#16161a] border border-[#25252c] rounded-2xl flex flex-col overflow-hidden select-none shadow-xl">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="video/*,audio/*,image/*" 
        multiple 
        className="hidden" 
      />

      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[#23232b]">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-white tracking-tight">Media</h2>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-5 h-5 rounded-full bg-[#23232c] hover:bg-[#2e2e3a] text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-xs font-bold"
            title="Upload Media"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={() => {}} 
            className="p-1.5 hover:bg-[#23232b] rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {}} 
            className="p-1.5 hover:bg-[#23232b] rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Filter Media"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setShowSearch(prev => !prev)} 
            className={`p-1.5 rounded-lg transition-colors ${showSearch ? 'bg-[#23232b] text-indigo-400' : 'hover:bg-[#23232b] text-zinc-400 hover:text-zinc-200'}`}
            title="Search Media"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Optional Search Bar */}
      {showSearch && (
        <div className="px-3 pt-2 pb-1 border-b border-[#23232b] flex items-center gap-2">
          <div className="flex-1 bg-[#1e1e26] rounded-lg flex items-center px-2 py-1 text-xs border border-[#2d2d38]">
            <Search className="w-3.5 h-3.5 text-zinc-500 mr-2" />
            <input
              type="text"
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white outline-none w-full text-xs placeholder:text-zinc-500"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Media Grid or Empty State */}
      <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
        {filteredMedia.length === 0 ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="h-full min-h-[220px] rounded-xl border border-dashed border-[#2f2f3d] hover:border-indigo-500/60 bg-[#1a1a21]/50 hover:bg-[#1f1f2a]/60 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#242430] group-hover:bg-indigo-500/10 flex items-center justify-center mb-3 transition-colors">
              <UploadCloud className="w-6 h-6 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
            </div>
            <p className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors mb-1">
              Add Video or Audio
            </p>
            <p className="text-[10px] text-zinc-500 max-w-[200px] leading-relaxed">
              Drag and drop media files here, or click to browse from computer
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {filteredMedia.map((item) => {
              const isSelected = selectedMediaId === item.id;
              return (
                <div 
                  key={item.id}
                  onClick={() => setSelectedMediaId(item.id)}
                  className={`group flex flex-col cursor-pointer transition-all ${
                    isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'
                  }`}
                >
                  {/* Thumbnail card */}
                  <div 
                    className={`relative aspect-[16/10] rounded-xl overflow-hidden bg-[#22222a] border transition-all flex items-center justify-center ${
                      isSelected 
                        ? 'border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.3)] ring-1 ring-indigo-500' 
                        : 'border-[#2d2d37] hover:border-[#424250]'
                    }`}
                  >
                    {item.thumbnail ? (
                      <img 
                        src={item.thumbnail} 
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : item.type === 'audio' ? (
                      <div className="flex flex-col items-center justify-center text-teal-400">
                        <Music className="w-6 h-6 mb-1 opacity-70" />
                        <span className="text-[8px] text-zinc-400 font-mono">AUDIO</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-indigo-400">
                        <Film className="w-6 h-6 mb-1 opacity-70" />
                        <span className="text-[8px] text-zinc-400 font-mono">VIDEO</span>
                      </div>
                    )}
                    
                    {/* Subtle Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                    {/* Duration Badge */}
                    <div className="absolute bottom-1 right-1.5 flex items-center gap-1 text-[9px] font-mono text-zinc-300 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                      <Video className="w-2.5 h-2.5 opacity-80" />
                      <span>{item.duration || '00:00'}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <p 
                    className={`mt-1.5 text-[10px] leading-tight line-clamp-1 transition-colors ${
                      isSelected ? 'text-indigo-300 font-semibold' : 'text-zinc-400 group-hover:text-zinc-200'
                    }`}
                    title={item.title}
                  >
                    {item.title}
                  </p>
                </div>
              );
            })}

            {/* Quick upload tile */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-[16/10] rounded-xl border border-dashed border-[#343442] hover:border-indigo-500/60 bg-[#1b1b22]/50 hover:bg-indigo-500/5 flex flex-col items-center justify-center cursor-pointer transition-all group"
              title="Import video or audio"
            >
              <Plus className="w-4 h-4 text-zinc-500 group-hover:text-indigo-400 transition-colors mb-1" />
              <span className="text-[9px] font-medium text-zinc-500 group-hover:text-indigo-300">Add File</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="h-10 px-4 border-t border-[#23232b] flex items-center justify-between text-xs text-zinc-400">
        <button 
          onClick={() => {}} 
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Select all"
        >
          <CheckCircle2 className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-medium text-zinc-400">
          Total {mediaList.length}, {formattedTotalSize}
        </span>

        <button 
          onClick={() => {}} 
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 hover:bg-[#23232b] rounded"
          title="More options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
