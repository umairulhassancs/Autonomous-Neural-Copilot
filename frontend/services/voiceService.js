/**
 * Voice Service - Handles voice recognition and text-to-speech
 * Now with Whisper integration for better accuracy
 */

import whisperService from './whisperService.js';
import soundEffects from './soundEffects.js';

class VoiceService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.isPaused = false;  // Flag to track pause state
        this.wakeWordActive = false;
        this.wakeWordTimeout = null;
        this.currentUtterance = null; // Guard against Chrome TTS garbage collection
        this.voices = [];
        this.onResultCallback = null;
        this.onWakeWordCallback = null;
        this.useWhisper = true; // Use Groq Whisper by default
        this.isRecordingWhisper = false;

        this.initRecognition();
        this.initTTS();
    }

    initTTS() {
        if ('speechSynthesis' in window) {
            const loadVoices = () => {
                this.voices = window.speechSynthesis.getVoices();
                if (this.voices.length > 0) {
                    console.log(`🔊 ${this.voices.length} TTS voices loaded`);
                }
            };
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    initRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        this.recognition.continuous = true;
        this.recognition.interimResults = true; // Fast detection
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        const WAKE_WORD_REGEX = /\b(jon|john|jan|joan|juan|jaan|jhon|jawn|johnny|jonny|dawn|don|yo\s*jon|hey\s*jon|hi\s*jon|ok\s*jon|okay\s*jon|jarvis|alexa|computer)\b/i;

        this.recognition.onresult = async (event) => {
            let combinedTranscript = '';
            let isFinal = false;

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const item = event.results[i];
                if (item[0]) {
                    combinedTranscript += item[0].transcript + ' ';
                }
                if (item.isFinal) {
                    isFinal = true;
                }
            }

            const transcript = combinedTranscript.trim();
            if (!transcript) return;

            const lowerTranscript = transcript.toLowerCase();

            // Display live feedback for user
            const liveTranscriptEl = document.getElementById('liveTranscript');
            if (liveTranscriptEl && !this.isPaused && !this.isRecordingWhisper) {
                liveTranscriptEl.textContent = `Hearing: "${transcript}"`;
            }

            // Check for stop command
            if (lowerTranscript.includes('stop') || lowerTranscript.includes('cancel')) {
                console.log('⏹️ Stop command detected');
                this.stopSpeaking();
                this.clearWakeWordTimer();
                this.wakeWordActive = false;
                const aiCircle = document.getElementById('aiCircle');
                if (aiCircle) aiCircle.classList.remove('active');
                return;
            }

            const hasWakeWord = WAKE_WORD_REGEX.test(lowerTranscript);

            // Responsive visual feedback as soon as wake word is spoken
            if (hasWakeWord && !this.wakeWordActive) {
                this.activateWakeWordVisual();
            }

            // Case 1: Wake word detected with a command in the same phrase
            if (hasWakeWord) {
                const commandAfterWakeWord = lowerTranscript
                    .replace(WAKE_WORD_REGEX, '')
                    .replace(/^(please|,|\.|\s)+/i, '')
                    .trim();

                // If user said "Jon <command>" together in one sentence
                if (commandAfterWakeWord.length > 2) {
                    console.log('🎯 Combined wake word + command:', commandAfterWakeWord);
                    this.clearWakeWordTimer();
                    this.wakeWordActive = false;
                    this.pauseListening();

                    if (this.onResultCallback) {
                        this.onResultCallback(transcript);
                    }
                    return;
                }

                // If user said ONLY "Jon" or "Hey Jon" -> Automatically start high-accuracy Whisper speech recording
                if (isFinal || !this.wakeWordActive) {
                    console.log('🎯 Wake word alone detected. Automatically switching to Whisper recording...');
                    this.handleWakeWord();
                    return;
                }
            }

            // Case 2: Wake word was already activated, and this is the follow-up command
            if (this.wakeWordActive && this.onResultCallback) {
                // Wait for either a final segment or a solid phrase (> 3 chars)
                if (isFinal || transcript.length > 3) {
                    console.log('✅ Follow-up command captured:', transcript);
                    this.clearWakeWordTimer();
                    this.wakeWordActive = false;
                    this.pauseListening();

                    this.onResultCallback(transcript);
                }
            }
        };

        this.recognition.onerror = (event) => {
            console.error('❌ Speech recognition error:', event.error);

            // Don't restart on certain critical errors
            if (event.error === 'not-allowed') {
                console.error('🚫 Microphone permission denied!');
                this.isListening = false;
                const liveTranscriptEl = document.getElementById('liveTranscript');
                if (liveTranscriptEl) {
                    liveTranscriptEl.textContent = 'Microphone permission denied';
                    liveTranscriptEl.style.color = '#ef4444';
                }
                return;
            }

            if (event.error === 'aborted') {
                console.log('⚠️ Recognition aborted (this is normal during stop/restart)');
                return;
            }

            // Auto-restart on recoverable errors
            const recoverableErrors = ['no-speech', 'audio-capture', 'network'];
            if (this.isListening && recoverableErrors.includes(event.error)) {
                console.log(`🔄 Attempting to recover from ${event.error} error...`);
                setTimeout(() => {
                    if (this.isListening && !this.isPaused) {
                        try {
                            console.log('🎤 Restarting recognition...');
                            this.recognition.start();
                        } catch (e) {
                            if (!e.message.includes('already started')) {
                                console.error('❌ Failed to restart:', e);
                            }
                        }
                    }
                }, 1000);
            }
        };

        this.recognition.onend = () => {
            console.log('🔴 Recognition ended - isListening:', this.isListening, 'isPaused:', this.isPaused);

            // Only auto-restart if we're in continuous listening mode
            // Don't restart if we paused intentionally
            if (this.isListening && !this.isPaused) {
                console.log('🔄 Auto-restarting recognition...');
                setTimeout(() => {
                    if (this.isListening && !this.isPaused) {
                        try {
                            this.recognition.start();
                            console.log('✅ Recognition restarted successfully');
                        } catch (error) {
                            if (error.message && error.message.includes('already started')) {
                                console.log('ℹ️ Recognition already running');
                            } else {
                                console.error('❌ Restart error:', error.message);
                                // Try again after a longer delay
                                setTimeout(() => {
                                    if (this.isListening && !this.isPaused) {
                                        try {
                                            this.recognition.start();
                                            console.log('✅ Recognition restarted on second attempt');
                                        } catch (e) {
                                            console.error('❌ Second restart failed:', e.message);
                                        }
                                    }
                                }, 2000);
                            }
                        }
                    }
                }, 100);
            } else {
                console.log('⏹️ Not restarting - stopped intentionally');
            }
        };
    }

    activateWakeWordVisual() {
        soundEffects.playActivate();
        if (this.onWakeWordCallback) {
            this.onWakeWordCallback();
        }
        const liveTranscriptEl = document.getElementById('liveTranscript');
        if (liveTranscriptEl) {
            liveTranscriptEl.textContent = '⚡ Jon listening... Speak your command';
            liveTranscriptEl.style.color = '#38bdf8';
        }
    }

    async handleWakeWord() {
        console.log('🎯 Wake word activated: Jon');
        this.wakeWordActive = true;
        this.activateWakeWordVisual();
        // Immediately switch to high-precision Whisper recording with silence detection
        await this.startWhisperRecording();
    }

    startWakeWordCountdown() {
        this.clearWakeWordTimer();
        this.wakeWordTimeout = setTimeout(() => {
            if (this.wakeWordActive) {
                console.log('⏰ Wake word window timed out (no command given)');
                this.wakeWordActive = false;
                const aiCircle = document.getElementById('aiCircle');
                if (aiCircle) aiCircle.classList.remove('active');
                const aiStatus = document.getElementById('aiStatus');
                if (aiStatus) aiStatus.textContent = '';
                const liveTranscriptEl = document.getElementById('liveTranscript');
                if (liveTranscriptEl) {
                    liveTranscriptEl.textContent = 'Microphone active - Say "Jon" or click orb';
                    liveTranscriptEl.style.color = '#10b981';
                }
            }
        }, 8000);
    }

    clearWakeWordTimer() {
        if (this.wakeWordTimeout) {
            clearTimeout(this.wakeWordTimeout);
            this.wakeWordTimeout = null;
        }
    }

    /**
     * Start high-precision Push-to-Talk or Wake-Word recording using Groq Whisper
     * With AudioContext silence detection to wait until the user finishes talking!
     */
    async startWhisperRecording() {
        try {
            soundEffects.playActivate();
            this.clearWakeWordTimer();

            // Pause background Web Speech listener while recording raw audio
            if (this.recognition && this.isListening) {
                this.isPaused = true;
                try { this.recognition.stop(); } catch (e) {}
            }

            this.isRecordingWhisper = true;
            if (this.onWakeWordCallback) {
                this.onWakeWordCallback();
            }

            const liveTranscriptEl = document.getElementById('liveTranscript');
            if (liveTranscriptEl) {
                liveTranscriptEl.textContent = '🎙️ Listening... (Speak your command, I will wait until you finish)';
                liveTranscriptEl.style.color = '#38bdf8';
            }

            const started = await whisperService.startRecording();
            if (!started) {
                this.isRecordingWhisper = false;
                throw new Error('Microphone access failed');
            }

            // Silence detection: Monitor volume from the stream
            this.setupSilenceDetection();

            return true;
        } catch (err) {
            console.error('Failed to start Whisper recording:', err);
            this.isRecordingWhisper = false;
            return false;
        }
    }

    /**
     * Monitor audio stream volume: Wait for user speech, then detect silence (1.8s) before stopping
     */
    setupSilenceDetection() {
        if (this.silenceCheckInterval) {
            clearInterval(this.silenceCheckInterval);
            this.silenceCheckInterval = null;
        }
        if (this.whisperAutoTimer) {
            clearTimeout(this.whisperAutoTimer);
            this.whisperAutoTimer = null;
        }

        let hasSpoken = false;
        let silenceStartTime = null;
        const SILENCE_DURATION = 1800; // 1.8 seconds of silence after speaking ends
        const VOLUME_THRESHOLD = 0.02; // Threshold for speech detection

        // Safety fallback: auto stop after 15 seconds if silence detection misses
        this.whisperAutoTimer = setTimeout(async () => {
            if (this.isRecordingWhisper) {
                await this.finishRecordingAndProcess();
            }
        }, 15000);

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioCtx();
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            const source = audioCtx.createMediaStreamSource(whisperService.stream);
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            this.silenceCheckInterval = setInterval(async () => {
                if (!this.isRecordingWhisper) {
                    clearInterval(this.silenceCheckInterval);
                    try { audioCtx.close(); } catch (e) {}
                    return;
                }

                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const averageVolume = sum / (bufferLength * 255);

                if (averageVolume > VOLUME_THRESHOLD) {
                    hasSpoken = true;
                    silenceStartTime = null;
                } else if (hasSpoken) {
                    if (!silenceStartTime) {
                        silenceStartTime = Date.now();
                    } else if (Date.now() - silenceStartTime > SILENCE_DURATION) {
                        console.log('🔇 Silence detected after user speech. Finishing recording...');
                        clearInterval(this.silenceCheckInterval);
                        try { audioCtx.close(); } catch (e) {}
                        await this.finishRecordingAndProcess();
                    }
                }
            }, 100);
        } catch (err) {
            console.warn('Silence detection setup failed, using 8s timer:', err);
            this.whisperAutoTimer = setTimeout(async () => {
                if (this.isRecordingWhisper) {
                    await this.finishRecordingAndProcess();
                }
            }, 8000);
        }
    }

    async finishRecordingAndProcess() {
        if (this.whisperAutoTimer) {
            clearTimeout(this.whisperAutoTimer);
            this.whisperAutoTimer = null;
        }
        if (this.silenceCheckInterval) {
            clearInterval(this.silenceCheckInterval);
            this.silenceCheckInterval = null;
        }

        if (!this.isRecordingWhisper) return;

        try {
            const transcript = await this.stopWhisperAndTranscribe();
            if (transcript && this.onResultCallback) {
                this.onResultCallback(transcript);
            } else {
                this.resumeListening();
            }
        } catch (e) {
            console.warn('Whisper transcription error:', e);
            this.resumeListening();
        }
    }

    /**
     * Stop Whisper recording and transcribe with Groq
     */
    async stopWhisperAndTranscribe() {
        if (this.whisperAutoTimer) {
            clearTimeout(this.whisperAutoTimer);
            this.whisperAutoTimer = null;
        }
        if (this.silenceCheckInterval) {
            clearInterval(this.silenceCheckInterval);
            this.silenceCheckInterval = null;
        }

        if (!this.isRecordingWhisper) return null;

        const liveTranscriptEl = document.getElementById('liveTranscript');
        if (liveTranscriptEl) {
            liveTranscriptEl.textContent = '⚡ Transcribing with Groq Whisper...';
            liveTranscriptEl.style.color = '#f59e0b';
        }

        try {
            const audioBlob = await whisperService.stopRecording();
            this.isRecordingWhisper = false;

            const res = await whisperService.transcribeAudio(audioBlob);
            if (res.success && res.text) {
                return res.text;
            } else {
                throw new Error(res.error || 'No speech recognized');
            }
        } catch (err) {
            this.isRecordingWhisper = false;
            throw err;
        }
    }

    startListening() {
        if (!this.recognition) {
            console.error('Speech recognition not initialized');
            return false;
        }

        try {
            this.clearWakeWordTimer();
            this.wakeWordActive = false;
            this.isPaused = false;
            this.recognition.start();
            this.isListening = true;
            console.log('Voice recognition started - listening for "Jon"');

            setTimeout(() => {
                const liveTranscriptEl = document.getElementById('liveTranscript');
                if (liveTranscriptEl) {
                    liveTranscriptEl.textContent = 'Microphone ready - Click orb or say "Jon"';
                    liveTranscriptEl.style.color = '#10b981';
                }
            }, 100);

            return true;
        } catch (error) {
            if (error.message && error.message.includes('already started')) {
                this.isListening = true;
                return true;
            }
            console.error('Error starting recognition:', error);
            return false;
        }
    }

    stopListening() {
        this.clearWakeWordTimer();
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
            this.isPaused = false;
            this.wakeWordActive = false;
            console.log('Voice recognition stopped');
        }
    }

    pauseListening() {
        this.clearWakeWordTimer();
        if (this.recognition && this.isListening) {
            console.log('⏸️ Pausing voice recognition...');
            this.isPaused = true;
            try {
                this.recognition.stop();
            } catch (e) {}

            const liveTranscriptEl = document.getElementById('liveTranscript');
            if (liveTranscriptEl) {
                liveTranscriptEl.textContent = 'Processing command...';
                liveTranscriptEl.style.color = '#f59e0b';
            }
        }
    }

    resumeListening() {
        console.log('▶️ Resuming voice recognition...');
        this.clearWakeWordTimer();
        this.wakeWordActive = false;
        this.isPaused = false;
        this.isListening = true;
        this.isRecordingWhisper = false;

        try {
            this.recognition.start();
            console.log('✅ Voice recognition resumed');

            const liveTranscriptEl = document.getElementById('liveTranscript');
            if (liveTranscriptEl) {
                liveTranscriptEl.textContent = 'Microphone ready - Click orb or say "Jon"';
                liveTranscriptEl.style.color = '#10b981';
            }
        } catch (error) {
            if (error.message && error.message.includes('already started')) {
                this.isListening = true;
            } else {
                console.error('❌ Error resuming recognition:', error);
            }
        }
    }

    onResult(callback) {
        this.onResultCallback = callback;
    }

    onWakeWord(callback) {
        this.onWakeWordCallback = callback;
    }

    /**
     * Toggle Push-to-Talk via clicking orb or mic button
     */
    async toggleManualListening() {
        console.log('🎤 Manual toggle clicked. Current isRecordingWhisper:', this.isRecordingWhisper);
        if (this.isRecordingWhisper) {
            // Already recording -> stop and transcribe
            try {
                const transcript = await this.stopWhisperAndTranscribe();
                if (transcript && this.onResultCallback) {
                    this.onResultCallback(transcript);
                }
            } catch (err) {
                console.error('Error during manual stop:', err);
                const aiStatus = document.getElementById('aiStatus');
                if (aiStatus) aiStatus.textContent = err.message;
                this.resumeListening();
            }
        } else {
            // Start recording audio
            await this.startWhisperRecording();
        }
    }

    /**
     * Text-to-Speech using Web Speech API (robust with Chrome GC protection)
     */
    speak(text, options = {}) {
        return new Promise((resolve) => {
            if (!('speechSynthesis' in window)) {
                console.warn('Speech synthesis not supported in this browser');
                resolve();
                return;
            }

            if (!text || !text.trim()) {
                resolve();
                return;
            }

            try {
                window.speechSynthesis.cancel();
                window.speechSynthesis.resume(); // Unfreeze Chrome audio pipeline
            } catch (e) {}

            const utterance = new SpeechSynthesisUtterance(text);
            this.currentUtterance = utterance; // Prevent garbage collection in Chromium
            window._activeUtterance = utterance;

            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            const voicesList = (this.voices && this.voices.length) ? this.voices : window.speechSynthesis.getVoices();
            const preferredVoice = voicesList.find(v =>
                (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Microsoft') || v.lang.startsWith('en'))
            );

            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }

            let resolved = false;
            const finish = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(safetyTimer);
                    this.currentUtterance = null;
                    window._activeUtterance = null;
                    resolve();
                }
            };

            // Safety timeout: prevents application from hanging if Chrome drops onend
            const estimatedDuration = Math.max(3000, text.length * 90);
            const safetyTimer = setTimeout(() => {
                console.warn('Speech timeout reached, releasing lock');
                finish();
            }, estimatedDuration);

            utterance.onend = () => {
                console.log('🔊 Speech synthesis finished');
                finish();
            };

            utterance.onerror = (error) => {
                console.warn('Speech synthesis error or cancelled:', error);
                finish();
            };

            setTimeout(() => {
                try {
                    window.speechSynthesis.speak(utterance);
                } catch (err) {
                    console.error('Failed to speak utterance:', err);
                    finish();
                }
            }, 50);
        });
    }

    /**
     * Alternative: Use ElevenLabs for premium voice
     */
    async speakWithElevenLabs(text) {
        const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

        if (!apiKey || apiKey === 'your_elevenlabs_api_key_here') {
            console.log('ElevenLabs not configured, falling back to Web Speech API');
            return this.speak(text);
        }

        try {
            const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.5
                    }
                })
            });

            if (!response.ok) {
                throw new Error('ElevenLabs API error');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            return new Promise((resolve, reject) => {
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };
                audio.onerror = reject;
                audio.play();
            });

        } catch (error) {
            console.error('ElevenLabs error, falling back to Web Speech API:', error);
            return this.speak(text);
        }
    }

    /**
     * One-time speech recognition (for manual activation)
     */
    listenOnce() {
        return new Promise((resolve, reject) => {
            if (!this.recognition) {
                reject(new Error('Speech recognition not supported'));
                return;
            }

            // Pause background listening to release mic
            this.clearWakeWordTimer();
            this.wakeWordActive = false;
            if (this.isListening) {
                this.isPaused = true;
                try {
                    this.recognition.stop();
                } catch (e) {}
            }

            const tempRecognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            tempRecognition.continuous = true; // Changed to true to keep listening
            tempRecognition.interimResults = true;
            tempRecognition.lang = 'en-US';
            tempRecognition.maxAlternatives = 3;

            let finalTranscript = '';
            let timeoutId = null;
            let speechStarted = false;
            let silenceTimeoutId = null;

            // Set a longer timeout (15 seconds)
            timeoutId = setTimeout(() => {
                tempRecognition.stop();
                if (!finalTranscript) {
                    reject(new Error('no-speech'));
                }
            }, 15000);

            // Detect when speech starts
            tempRecognition.onspeechstart = () => {
                console.log('🎤 Speech detected, listening...');
                speechStarted = true;
                clearTimeout(timeoutId); // Clear the initial timeout
            };

            // Detect when speech ends
            tempRecognition.onspeechend = () => {
                console.log('🔇 Speech ended, processing...');
                // Give a short delay before stopping to catch any final words
                silenceTimeoutId = setTimeout(() => {
                    tempRecognition.stop();
                }, 1000);
            };

            tempRecognition.onresult = (event) => {
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                        console.log('Final transcript:', finalTranscript);
                    } else {
                        interimTranscript += transcript;
                        console.log('Interim:', interimTranscript);
                    }
                }

                // If we have a final result with actual content, resolve
                if (finalTranscript.trim().length > 0) {
                    clearTimeout(timeoutId);
                    clearTimeout(silenceTimeoutId);

                    // Wait a bit to see if more speech is coming
                    setTimeout(() => {
                        tempRecognition.stop();
                        resolve(finalTranscript.trim());
                    }, 500);
                }
            };

            tempRecognition.onerror = (event) => {
                clearTimeout(timeoutId);
                clearTimeout(silenceTimeoutId);
                console.error('Speech recognition error:', event.error);

                // Don't reject on 'aborted' - it's normal when we stop manually
                if (event.error === 'aborted') {
                    if (finalTranscript.trim().length > 0) {
                        resolve(finalTranscript.trim());
                    } else {
                        reject(new Error('Recognition aborted'));
                    }
                    return;
                }

                // Provide more specific error messages
                if (event.error === 'no-speech') {
                    reject(new Error('No speech detected. Please speak clearly and try again.'));
                } else if (event.error === 'audio-capture') {
                    reject(new Error('Microphone not accessible. Please check permissions.'));
                } else if (event.error === 'not-allowed') {
                    reject(new Error('Microphone permission denied. Please allow microphone access.'));
                } else {
                    reject(new Error(event.error));
                }
            };

            tempRecognition.onend = () => {
                clearTimeout(timeoutId);
                clearTimeout(silenceTimeoutId);
                console.log('Recognition ended. Final transcript:', finalTranscript);

                // If we have any transcript, resolve with it
                if (finalTranscript.trim().length > 0) {
                    resolve(finalTranscript.trim());
                } else if (speechStarted) {
                    // Speech was detected but no transcript captured
                    reject(new Error('Speech detected but could not understand. Please speak more clearly.'));
                } else {
                    // No speech detected at all
                    reject(new Error('No speech detected. Please try again and speak clearly.'));
                }
            };

            try {
                tempRecognition.start();
                console.log('🎤 Listening... Speak now!');
            } catch (error) {
                clearTimeout(timeoutId);
                clearTimeout(silenceTimeoutId);
                reject(error);
            }
        });
    }

    /**
     * Enable or disable Whisper for command transcription
     */
    setUseWhisper(enabled) {
        this.useWhisper = enabled && whisperService.isAvailable();
        console.log(`Whisper ${this.useWhisper ? 'enabled' : 'disabled'} for command transcription`);
        return this.useWhisper;
    }

    /**
     * Check if recognition is healthy and restart if needed
     */
    checkHealth() {
        console.log('🏥 Health check - isListening:', this.isListening, 'isPaused:', this.isPaused, 'wakeWordActive:', this.wakeWordActive);

        if (this.isListening && !this.isPaused) {
            return { healthy: true, message: 'Recognition is active' };
        } else if (this.isPaused) {
            return { healthy: true, message: 'Recognition is paused (normal during command processing)' };
        } else {
            return { healthy: false, message: 'Recognition is not running' };
        }
    }

    /**
     * Force restart recognition (useful after errors)
     */
    forceRestart() {
        console.log('🔧 Force restarting recognition...');

        try {
            // Stop first
            if (this.recognition) {
                this.recognition.stop();
            }

            // Reset state
            this.isListening = false;
            this.isPaused = false;
            this.wakeWordActive = false;

            // Wait a bit then restart
            setTimeout(() => {
                this.startListening();
            }, 500);

            return true;
        } catch (error) {
            console.error('❌ Force restart failed:', error);
            return false;
        }
    }
}

export default new VoiceService();
