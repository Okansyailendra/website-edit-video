import { pipeline, env } from '@xenova/transformers';

// Disable local models since we are running in browser and want to fetch from HuggingFace
env.allowLocalModels = false;

let transcriber: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { action, audioData, language } = e.data;

  if (action === 'transcribe') {
    try {
      self.postMessage({ status: 'progress', progress: 10 });
      
      if (!transcriber) {
        self.postMessage({ status: 'loading' });
        // Menggunakan whisper-small (Akurasi tinggi untuk bahasa Indonesia, ukuran ~240MB)
        transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
          progress_callback: (info: any) => {
            if (info.status === 'progress' && info.progress) {
              self.postMessage({ status: 'downloading', loaded: info.progress });
            }
          }
        });
      }
      
      self.postMessage({ status: 'progress', progress: 30 });

      // Run transcription
      // The audioData is a 16kHz Float32Array prepared by the main thread
      const output = await transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: language,
        task: 'transcribe',
        return_timestamps: true,
        // Parameter tambahan untuk mencegah AI berhalusinasi/mengulang kata
        no_repeat_ngram_size: 3,
        repetition_penalty: 1.1,
      });

      self.postMessage({ status: 'progress', progress: 100 });
      self.postMessage({ status: 'complete', result: output });

    } catch (error) {
      console.error("Worker Transcription Error:", error);
      self.postMessage({ status: 'error', error: (error as Error).message });
    }
  }
};
