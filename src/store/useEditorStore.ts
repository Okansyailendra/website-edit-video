import { create } from 'zustand';

export interface Subtitle {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface EditorState {
  // Video
  videoFile: File | null;
  videoUrl: string | null;
  
  // Audio
  audioFile: File | null;
  audioUrl: string | null;
  audioVolume: number; // 0 to 100
  videoVolume: number; // 0 to 100

  currentTime: number;
  duration: number; // For now, sync with video duration
  isPlaying: boolean;
  
  // Video properties (100 = default)
  brightness: number;
  contrast: number;
  saturation: number; // 0 to 200
  sharpness: number; // 0 to 200, 100 = default (no sharpen)
  hdMode: 'original' | '720p' | '1080p' | '4k'; // Output resolution preset

  // Subtitles
  subtitles: Subtitle[];
  isTranscribing: boolean;
  transcriptionLanguage: string; // 'id', 'auto', 'en', 'ja'
  transcriptionModel: string; // 'Xenova/whisper-small' | 'Xenova/whisper-base' | 'Xenova/whisper-tiny'
  subtitleStyle: 'classic' | 'tiktok' | 'box';
  subtitleSize: 'sm' | 'md' | 'lg';
  transcriptionProgress: number;
  transcriptionMessage: string;
  activeTab: 'adjustments' | 'subtitles';

  // Actions
  setVideoFile: (file: File) => void;
  setAudioFile: (file: File) => void;
  setAudioVolume: (volume: number) => void;
  setVideoVolume: (volume: number) => void;

  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  togglePlayPause: () => void;
  
  setBrightness: (val: number) => void;
  setContrast: (val: number) => void;
  setSaturation: (val: number) => void;
  setSharpness: (val: number) => void;
  setHdMode: (mode: 'original' | '720p' | '1080p' | '4k') => void;

  setSubtitles: (subs: Subtitle[]) => void;
  updateSubtitle: (id: string, newText: string) => void;
  updateSubtitleTimes: (id: string, start: number, end: number) => void;
  addSubtitle: (sub: Subtitle) => void;
  removeSubtitle: (id: string) => void;
  setIsTranscribing: (isTranscribing: boolean) => void;
  setTranscriptionLanguage: (lang: string) => void;
  setTranscriptionModel: (model: string) => void;
  setSubtitleStyle: (style: 'classic' | 'tiktok' | 'box') => void;
  setSubtitleSize: (size: 'sm' | 'md' | 'lg') => void;
  setTranscriptionProgress: (progress: number) => void;
  setTranscriptionMessage: (msg: string) => void;
  setActiveTab: (tab: 'adjustments' | 'subtitles') => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  videoFile: null,
  videoUrl: null,
  
  audioFile: null,
  audioUrl: null,
  audioVolume: 100,
  videoVolume: 100,

  currentTime: 0,
  duration: 0,
  isPlaying: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpness: 100,
  hdMode: 'original',

  subtitles: [],
  isTranscribing: false,
  transcriptionLanguage: 'id',
  transcriptionModel: 'Xenova/whisper-small',
  subtitleStyle: 'classic',
  subtitleSize: 'md',
  transcriptionProgress: 0,
  transcriptionMessage: 'Menyiapkan AI...',
  activeTab: 'adjustments',

  setVideoFile: (file) => {
    set((state) => {
      if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
      return { 
        videoFile: file, 
        videoUrl: URL.createObjectURL(file),
        currentTime: 0,
        isPlaying: false,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        sharpness: 100,
        hdMode: 'original' as const,
        videoVolume: 100,
        subtitles: [],
        isTranscribing: false,
        transcriptionProgress: 0,
        transcriptionMessage: 'Menyiapkan AI...'
      };
    });
  },
  
  setAudioFile: (file) => {
    set((state) => {
      if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
      return {
        audioFile: file,
        audioUrl: URL.createObjectURL(file)
      };
    });
  },
  
  setAudioVolume: (audioVolume) => set({ audioVolume }),
  setVideoVolume: (videoVolume) => set({ videoVolume }),

  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set((state) => ({ duration: Math.max(state.duration, duration) })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setBrightness: (brightness) => set({ brightness }),
  setContrast: (contrast) => set({ contrast }),
  setSaturation: (saturation) => set({ saturation }),
  setSharpness: (sharpness) => set({ sharpness }),
  setHdMode: (hdMode) => set({ hdMode }),

  setSubtitles: (subtitles) => set({ subtitles }),
  updateSubtitle: (id, newText) => set((state) => ({
    subtitles: state.subtitles.map(sub => 
      sub.id === id ? { ...sub, text: newText } : sub
    )
  })),
  updateSubtitleTimes: (id, start, end) => set((state) => ({
    subtitles: state.subtitles.map(sub => 
      sub.id === id ? { ...sub, start: Math.max(0, start), end: Math.max(start + 0.1, end) } : sub
    ).sort((a, b) => a.start - b.start)
  })),
  addSubtitle: (sub) => set((state) => ({
    subtitles: [...state.subtitles, sub].sort((a, b) => a.start - b.start)
  })),
  removeSubtitle: (id) => set((state) => ({
    subtitles: state.subtitles.filter(sub => sub.id !== id)
  })),
  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
  setTranscriptionLanguage: (transcriptionLanguage) => set({ transcriptionLanguage }),
  setTranscriptionModel: (transcriptionModel) => set({ transcriptionModel }),
  setSubtitleStyle: (subtitleStyle) => set({ subtitleStyle }),
  setSubtitleSize: (subtitleSize) => set({ subtitleSize }),
  setTranscriptionProgress: (transcriptionProgress) => set({ transcriptionProgress }),
  setTranscriptionMessage: (transcriptionMessage) => set({ transcriptionMessage }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
