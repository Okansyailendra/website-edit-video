import React from 'react';
import { ChevronLeft, ChevronRight, Share, Plus, Copy, Lock, RotateCw, LayoutGrid } from 'lucide-react';

export const WindowHeader: React.FC = () => {
  return (
    <div className="h-10 bg-[#16161a] border-b border-[#25252c] flex items-center justify-between px-3 select-none text-zinc-400">
      {/* Window Controls (Traffic Lights) + Nav */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] cursor-pointer hover:opacity-80 transition-opacity" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] cursor-pointer hover:opacity-80 transition-opacity" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] cursor-pointer hover:opacity-80 transition-opacity" />
        </div>
        
        <button className="p-1 hover:bg-[#26262e] rounded text-zinc-400 hover:text-zinc-200 transition-colors" title="Toggle Sidebar">
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-[#26262e] rounded text-zinc-400 hover:text-zinc-200 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 hover:bg-[#26262e] rounded text-zinc-500 cursor-not-allowed">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Safari-style Address Bar */}
      <div className="flex-1 max-w-md mx-4">
        <div className="h-6 bg-[#212127] border border-[#2b2b35] rounded-md px-3 flex items-center justify-center gap-2 text-[11px] text-zinc-300 shadow-inner group">
          <Lock className="w-2.5 h-2.5 text-zinc-400" />
          <span className="font-medium tracking-wide">vidora.com</span>
          <RotateCw className="w-2.5 h-2.5 text-zinc-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-zinc-300" />
        </div>
      </div>

      {/* Right browser actions */}
      <div className="flex items-center gap-1">
        <button className="p-1.5 hover:bg-[#26262e] rounded text-zinc-400 hover:text-zinc-200 transition-colors" title="Share">
          <Share className="w-3.5 h-3.5" />
        </button>
        <button className="p-1.5 hover:bg-[#26262e] rounded text-zinc-400 hover:text-zinc-200 transition-colors" title="New Tab">
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button className="p-1.5 hover:bg-[#26262e] rounded text-zinc-400 hover:text-zinc-200 transition-colors" title="Show All Tabs">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
