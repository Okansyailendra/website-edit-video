import { pipeline, env } from '@xenova/transformers';

// Disable local models since we are running in browser and want to fetch from HuggingFace
env.allowLocalModels = false;

let transcriber: any = null;
let loadedModelName: string = '';

self.onmessage = async (e: MessageEvent) => {
  const { action, audioData, language, model = 'Xenova/whisper-small', prompt } = e.data;

  if (action === 'transcribe') {
    try {
      self.postMessage({ status: 'progress', progress: 10, message: 'Menyiapkan AI Speech Recognition...' });

      // Load or re-load model if model changed or not loaded yet
      if (!transcriber || loadedModelName !== model) {
        self.postMessage({ status: 'loading', message: `Mengunduh model AI (${model.replace('Xenova/', '')})...` });
        
        transcriber = await pipeline('automatic-speech-recognition', model, {
          progress_callback: (info: any) => {
            if (info.status === 'progress' && info.progress) {
              self.postMessage({ 
                status: 'downloading', 
                loaded: info.progress,
                message: `Mengunduh model AI... ${Math.round(info.progress)}%`
              });
            }
          }
        });
        loadedModelName = model;
      }

      self.postMessage({ status: 'progress', progress: 35, message: 'Menganalisis audio & transkripsi...' });

      // Determine language & initial prompt for natural Indonesian / English transcription
      const transcriberOptions: any = {
        chunk_length_s: 30,
        stride_length_s: 5,
        task: 'transcribe',
        return_timestamps: true,
      };

      // Set language (null = auto detect)
      if (language && language !== 'auto') {
        transcriberOptions.language = language;
      }

      // Initial prompt anchors Whisper's vocabulary, capitalization, and punctuation.
      // This dramatically reduces hallucinations without introducing harmful ngram penalties.
      if (prompt) {
        transcriberOptions.initial_prompt = prompt;
      } else if (!language || language === 'id' || language === 'indonesian') {
        transcriberOptions.initial_prompt = "Transkripsi video berbahasa Indonesia dengan tanda baca, ejaan yang benar, dan jelas.";
      } else if (language === 'en' || language === 'english') {
        transcriberOptions.initial_prompt = "English video transcription with accurate spelling, punctuation, and capitalization.";
      }

      // Progress reporting during chunk processing
      let processedChunks = 0;
      transcriberOptions.chunk_callback = (_chunk: any) => {
        processedChunks++;
        // Gradually increment progress between 35% and 95%
        const simulatedProgress = Math.min(95, 35 + processedChunks * 10);
        self.postMessage({ 
          status: 'progress', 
          progress: simulatedProgress,
          message: `Mentranskrip audio... (Bagian ${processedChunks})`
        });
      };

      // NOTE: We intentionally DO NOT use `no_repeat_ngram_size` or `repetition_penalty`.
      // Those parameters severely break speech recognition by banning legitimate repeated words
      // (such as Indonesian reduplication: orang-orang, jalan-jalan, terima kasih) and forcing
      // Whisper to hallucinate bizarre, nonsensical words ("nyeleneh").

      const output = await transcriber(audioData, transcriberOptions);

      self.postMessage({ status: 'progress', progress: 100, message: 'Transkripsi selesai!' });
      self.postMessage({ status: 'complete', result: output });

    } catch (error) {
      console.error("Worker Transcription Error:", error);
      self.postMessage({ status: 'error', error: (error as Error).message });
    }
  }
};
