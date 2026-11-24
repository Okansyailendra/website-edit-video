import React, { useState } from 'react';
import { Home, Undo2, Redo2, Scissors, Link2, Palette, Music2, Sparkles } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';

export const BottomToolbar: React.FC = () => {
  const { activeModal, setActiveModal } = useEditorStore();
  const [activeTool, setActiveTool] = useState<'cut' | 'edit' | 'color' | 'sound'>('cut');

  const handleToolClick = (tool: 'cut' | 'edit' | 'color' | 'sound') => {
    setActiveTool(tool);
    if (tool === 'color') {
      setActiveModal(activeModal === 'color' ? null : 'color');
    } else if (tool === 'sound') {
      setActiveModal(activeModal === 'sound' ? null : 'sound');
    }
  };

  return (
    <div className="h-14 px-6 flex items-center justify-between select-none relative z-30">
      {/* Left: Home, Undo, Redo */}
      <div className="flex items-center gap-1.5">
        <button 
          onClick={() => {}} 
          className="w-9 h-9 rounded-xl bg-[#1c1c22] hover:bg-[#26262e] text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#2b2b35]"
          title="Home"
        >
          <Home className="w-4 h-4" />
        </button>
        <button 
          onClick={() => {}} 
          className="w-9 h-9 rounded-xl bg-[#1c1c22] hover:bg-[#26262e] text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#2b2b35]"
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button 
          onClick={() => {}} 
          className="w-9 h-9 rounded-xl bg-[#1c1c22] hover:bg-[#26262e] text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#2b2b35]"
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Center: Floating action pill */}
      <div className="flex items-center bg-[#1c1c22] border border-[#2b2b35] p-1 rounded-2xl shadow-xl gap-1">
        {/* Cut */}
        <button
          onClick={() => handleToolClick('cut')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTool === 'cut'
              ? 'bg-[#5945ed] text-white shadow-md shadow-indigo-600/30'
              : 'text-zinc-400 hover:text-white hover:bg-[#262630]'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Cut</span>
        </button>

        {/* Edit */}
        <button
          onClick={() => handleToolClick('edit')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTool === 'edit'
              ? 'bg-[#5945ed] text-white shadow-md shadow-indigo-600/30'
              : 'text-zinc-400 hover:text-white hover:bg-[#262630]'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>

        {/* Color */}
        <button
          onClick={() => handleToolClick('color')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeModal === 'color' || activeTool === 'color'
              ? 'bg-[#5945ed] text-white shadow-md shadow-indigo-600/30'
              : 'text-zinc-400 hover:text-white hover:bg-[#262630]'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Color</span>
        </button>

        {/* Sound */}
        <button
          onClick={() => handleToolClick('sound')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeModal === 'sound' || activeTool === 'sound'
              ? 'bg-[#5945ed] text-white shadow-md shadow-indigo-600/30'
              : 'text-zinc-400 hover:text-white hover:bg-[#262630]'
          }`}
        >
          <Music2 className="w-3.5 h-3.5" />
          <span>Sound</span>
        </button>
      </div>

      {/* Right: Vidora AI button */}
      <div className="flex items-center">
        <button
          onClick={() => setActiveModal(activeModal === 'ai' ? null : 'ai')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
            activeModal === 'ai'
              ? 'bg-[#4b35e0] text-white ring-2 ring-white/20'
              : 'bg-[#5945ed] hover:bg-[#4b35e0] text-white shadow-indigo-600/30 active:scale-95'
          }`}
        >
          <span>Vidora AI</span>
          <Sparkles className="w-3.5 h-3.5 fill-current" />
        </button>
      </div>
    </div>
  );
};
