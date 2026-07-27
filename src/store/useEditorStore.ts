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

  // Subtitles
  subtitles: Subtitle[];
  isTranscribing: boolean;
  transcriptionLanguage: string; // 'en', 'id', 'ja'
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

  setSubtitles: (subs: Subtitle[]) => void;
  updateSubtitle: (id: string, newText: string) => void;
  setIsTranscribing: (isTranscribing: boolean) => void;
  setTranscriptionLanguage: (lang: string) => void;
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

  subtitles: [],
  isTranscribing: false,
  transcriptionLanguage: 'id',
  transcriptionProgress: 0,
  transcriptionMessage: 'Initializing AI...',
  activeTab: 'adjustments',

  setVideoFile: (file) => {
    set((state) => {
      if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
      return { 
        videoFile: file, 
        videoUrl: URL.createObjectURL(file),
        currentTime: 0,
        isPlaying: false,
        // Reset effects when new video is added
        brightness: 100,
        contrast: 100,
        saturation: 100,
        videoVolume: 100,
        subtitles: [],
        isTranscribing: false,
        transcriptionProgress: 0,
        transcriptionMessage: 'Initializing AI...'
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

  setSubtitles: (subtitles) => set({ subtitles }),
  updateSubtitle: (id, newText) => set((state) => ({
    subtitles: state.subtitles.map(sub => 
      sub.id === id ? { ...sub, text: newText } : sub
    )
  })),
  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
  setTranscriptionLanguage: (transcriptionLanguage) => set({ transcriptionLanguage }),
  setTranscriptionProgress: (transcriptionProgress) => set({ transcriptionProgress }),
  setTranscriptionMessage: (transcriptionMessage) => set({ transcriptionMessage }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
