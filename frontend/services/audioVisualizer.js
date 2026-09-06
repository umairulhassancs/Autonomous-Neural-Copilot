/**
 * Real-time Audio Waveform & Frequency Visualizer using Web Audio API
 */

class AudioVisualizer {
    constructor() {
        this.audioCtx = null;
        this.analyser = null;
        this.source = null;
        this.animId = null;
        this.canvas = null;
        this.ctx = null;
        this.isRunning = false;
    }

    attachCanvas(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
    }

    start(stream) {
        if (!this.canvas) return;

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!this.audioCtx) {
                this.audioCtx = new AudioCtx();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 128;
            this.analyser.smoothingTimeConstant = 0.8;

            this.source = this.audioCtx.createMediaStreamSource(stream);
            this.source.connect(this.analyser);

            this.isRunning = true;
            this.draw();
        } catch (err) {
            console.warn('Could not start audio visualizer:', err);
        }
    }

    stop() {
        this.isRunning = false;
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        if (this.source) {
            try { this.source.disconnect(); } catch (e) {}
            this.source = null;
        }
    }

    draw() {
        if (!this.isRunning || !this.analyser || !this.ctx) return;

        this.animId = requestAnimationFrame(() => this.draw());

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.38;

        this.ctx.clearRect(0, 0, width, height);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const avg = sum / bufferLength;

        // Draw radial wave particles around the orb
        const numBars = 48;
        const angleStep = (Math.PI * 2) / numBars;

        for (let i = 0; i < numBars; i++) {
            const dataIndex = Math.floor((i / numBars) * (bufferLength / 2));
            const val = dataArray[dataIndex] || 0;
            const barHeight = Math.max(4, (val / 255) * 45);

            const angle = i * angleStep;
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);

            const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0.9)');

            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 3;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        }

        // Inner glowing ring
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius + (avg / 255) * 10, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(56, 189, 248, ${Math.min(0.8, 0.2 + (avg / 255) * 0.6)})`;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }
}

export default new AudioVisualizer();
