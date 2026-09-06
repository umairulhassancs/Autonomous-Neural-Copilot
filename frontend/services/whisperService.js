/**
 * Groq Whisper Cloud Speech-to-Text Service
 * Uses Groq's free, ultra-fast whisper-large-v3-turbo model (<150ms latency)
 */

import audioVisualizer from './audioVisualizer.js';

class WhisperService {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.apiKey = import.meta.env.VITE_GROQ_API_KEY;
        this.apiUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
        this.model = 'whisper-large-v3-turbo';
        this.stream = null;
    }

    isAvailable() {
        return !!this.apiKey && !this.apiKey.includes('your_');
    }

    /**
     * Start recording audio from the user microphone with real-time waveform
     */
    async startRecording() {
        try {
            this.apiKey = import.meta.env.VITE_GROQ_API_KEY;

            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            // Connect live audio to canvas visualizer
            audioVisualizer.start(this.stream);

            // Determine best mimeType supported by the browser
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                if (MediaRecorder.isTypeSupported('audio/webm')) {
                    mimeType = 'audio/webm';
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4';
                } else {
                    mimeType = '';
                }
            }

            this.mediaRecorder = mimeType ? new MediaRecorder(this.stream, { mimeType }) : new MediaRecorder(this.stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start(100); // chunk every 100ms
            this.isRecording = true;
            console.log('🎙️ Whisper MediaRecorder started with mimeType:', mimeType);
            return true;
        } catch (error) {
            console.error('❌ Error starting microphone recording:', error);
            audioVisualizer.stop();
            return false;
        }
    }

    /**
     * Stop recording, stop tracks, and return the recorded audio blob
     */
    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || !this.isRecording) {
                audioVisualizer.stop();
                reject(new Error('Not currently recording'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(this.audioChunks, { type: mimeType });

                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                    this.stream = null;
                }

                audioVisualizer.stop();
                this.isRecording = false;
                console.log('⏹️ Audio recorded. Size:', audioBlob.size, 'bytes');
                resolve(audioBlob);
            };

            try {
                this.mediaRecorder.stop();
            } catch (err) {
                audioVisualizer.stop();
                this.isRecording = false;
                reject(err);
            }
        });
    }

    /**
     * Transcribe audio blob using Groq Cloud Whisper API
     */
    async transcribeAudio(audioBlob) {
        if (!this.isAvailable()) {
            throw new Error('Groq API key not configured');
        }

        try {
            console.log('🚀 Sending audio to Groq Whisper (whisper-large-v3-turbo)...');
            const ext = (audioBlob.type && audioBlob.type.includes('mp4')) ? 'm4a' : 'webm';
            const formData = new FormData();
            formData.append('file', audioBlob, `speech.${ext}`);
            formData.append('model', this.model);
            formData.append('temperature', '0.0');
            formData.append('language', 'en');

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Groq Whisper error (${response.status}): ${errText}`);
            }

            const result = await response.json();
            const transcript = (result.text || '').trim();
            console.log('✅ Groq Whisper transcription:', transcript);

            return {
                success: true,
                text: transcript
            };
        } catch (error) {
            console.error('❌ Groq Whisper transcription failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default new WhisperService();
