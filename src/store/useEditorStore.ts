import { create } from 'zustand';

export interface SubtitleWord {
  word: string;
  start: number;
  end: number;
}

export interface Subtitle {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: SubtitleWord[];
}

export interface MediaItem {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;
  file?: File;
  url?: string;
  size?: string;
  type?: 'video' | 'audio' | 'image';
}

interface EditorState {
  // Project
  projectTitle: string;
  setProjectTitle: (title: string) => void;
  
  // Modals & Active Tools
  activeModal: 'color' | 'sound' | 'ai' | 'export' | null;
  setActiveModal: (modal: 'color' | 'sound' | 'ai' | 'export' | null) => void;

  // Media Gallery
  mediaList: MediaItem[];
  selectedMediaId: string | null;
  setSelectedMediaId: (id: string | null) => void;
  addMediaItem: (item: MediaItem) => void;

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

  // Subtitles & Gemini AI
  subtitles: Subtitle[];
  isTranscribing: boolean;
  transcriptionLanguage: string; // 'id', 'auto', 'en', 'ja'
  geminiApiKey: string;
  geminiModel: string; // 'gemini-2.0-flash' | 'gemini-1.5-flash' | 'gemini-2.5-flash'
  subtitleStyle: 'classic' | 'tiktok' | 'box';
  subtitleSize: 'sm' | 'md' | 'lg';
  subtitleAnimation: 'word-reveal' | 'karaoke' | 'none';
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
  setGeminiApiKey: (key: string) => void;
  setGeminiModel: (model: string) => void;
  setSubtitleStyle: (style: 'classic' | 'tiktok' | 'box') => void;
  setSubtitleSize: (size: 'sm' | 'md' | 'lg') => void;
  setSubtitleAnimation: (anim: 'word-reveal' | 'karaoke' | 'none') => void;
  setTranscriptionProgress: (progress: number) => void;
  setTranscriptionMessage: (msg: string) => void;
  setActiveTab: (tab: 'adjustments' | 'subtitles') => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  projectTitle: 'Untitled Project',
  setProjectTitle: (projectTitle) => set({ projectTitle }),

  activeModal: null,
  setActiveModal: (activeModal) => set({ activeModal }),

  mediaList: [],
  selectedMediaId: null,
  setSelectedMediaId: (selectedMediaId) => set({ selectedMediaId }),
  addMediaItem: (item) => set((state) => ({ mediaList: [item, ...state.mediaList] })),

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
  hdMode: '1080p',

  subtitles: [],
  isTranscribing: false,
  transcriptionLanguage: 'id',
  geminiApiKey: typeof window !== 'undefined' 
    ? (localStorage.getItem('gemini_api_key') || (import.meta as any).env?.VITE_GEMINI_API_KEY || '') 
    : '',
  geminiModel: 'gemini-3.5-transcribe',
  subtitleStyle: 'classic',
  subtitleSize: 'md',
  subtitleAnimation: 'word-reveal',
  transcriptionProgress: 0,
  transcriptionMessage: 'Menyiapkan AI...',
  activeTab: 'adjustments',

  setVideoFile: (file) => {
    set((state) => {
      if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
      const url = URL.createObjectURL(file);
      const newMedia: MediaItem = {
        id: `media_${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        duration: '00:00',
        thumbnail: '',
        file,
        url,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        type: 'video'
      };
      return { 
        videoFile: file, 
        videoUrl: url,
        currentTime: 0,
        isPlaying: false,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        sharpness: 100,
        hdMode: '1080p' as const,
        videoVolume: 100,
        mediaList: [newMedia, ...state.mediaList.filter(m => m.file !== file)],
        selectedMediaId: newMedia.id,
        isTranscribing: false,
        transcriptionProgress: 0,
        transcriptionMessage: 'Menyiapkan AI...'
      };
    });
  },
  
  setAudioFile: (file) => {
    set((state) => {
      if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
      const url = URL.createObjectURL(file);
      const newMedia: MediaItem = {
        id: `media_${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        duration: '00:00',
        thumbnail: '',
        file,
        url,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        type: 'audio'
      };
      return {
        audioFile: file,
        audioUrl: url,
        mediaList: [newMedia, ...state.mediaList.filter(m => m.file !== file)],
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
    subtitles: state.subtitles.map(sub => {
      if (sub.id !== id) return sub;
      const rawWords = newText.trim().split(/\s+/).filter(Boolean);
      const dur = Math.max(0.1, sub.end - sub.start) / Math.max(1, rawWords.length);
      const words: SubtitleWord[] = rawWords.map((word, idx) => ({
        word,
        start: Math.round((sub.start + idx * dur) * 100) / 100,
        end: Math.round((sub.start + (idx + 1) * dur) * 100) / 100
      }));
      return { ...sub, text: newText, words };
    })
  })),
  updateSubtitleTimes: (id, start, end) => set((state) => ({
    subtitles: state.subtitles.map(sub => {
      if (sub.id !== id) return sub;
      const safeStart = Math.max(0, start);
      const safeEnd = Math.max(safeStart + 0.1, end);
      const rawWords = sub.text.trim().split(/\s+/).filter(Boolean);
      const dur = (safeEnd - safeStart) / Math.max(1, rawWords.length);
      const words: SubtitleWord[] = rawWords.map((word, idx) => ({
        word,
        start: Math.round((safeStart + idx * dur) * 100) / 100,
        end: Math.round((safeStart + (idx + 1) * dur) * 100) / 100
      }));
      return { ...sub, start: safeStart, end: safeEnd, words };
    }).sort((a, b) => a.start - b.start)
  })),
  addSubtitle: (sub) => set((state) => ({
    subtitles: [...state.subtitles, sub].sort((a, b) => a.start - b.start)
  })),
  removeSubtitle: (id) => set((state) => ({
    subtitles: state.subtitles.filter(sub => sub.id !== id)
  })),
  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
  setTranscriptionLanguage: (transcriptionLanguage) => set({ transcriptionLanguage }),
  setGeminiApiKey: (geminiApiKey) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('gemini_api_key', geminiApiKey);
    }
    set({ geminiApiKey });
  },
  setGeminiModel: (geminiModel) => set({ geminiModel }),
  setSubtitleStyle: (subtitleStyle) => set({ subtitleStyle }),
  setSubtitleSize: (subtitleSize) => set({ subtitleSize }),
  setSubtitleAnimation: (subtitleAnimation) => set({ subtitleAnimation }),
  setTranscriptionProgress: (transcriptionProgress) => set({ transcriptionProgress }),
  setTranscriptionMessage: (transcriptionMessage) => set({ transcriptionMessage }),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
