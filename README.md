# ⚡ Autonomous Neural Copilot (JON OS)

[![Groq LLaMA 3 & Whisper](https://img.shields.io/badge/Groq-LLaMA%203.3%20%7C%20Whisper%20Large%20v3-F55036?style=for-the-badge&logo=fastapi&logoColor=white)](https://groq.com)
[![Firebase Cloud](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

An enterprise-grade, voice-activated autonomous personal AI copilot and executive productivity workspace. Built with ultra-low latency LLM inference via **Groq (LLaMA 3.3 70B & Whisper Large v3 Turbo)**, **Firebase Cloud Firestore**, real-time **Web Audio API** energy/frequency processing, and an **Executive Cyber-Glass Design System**.

Jon OS operates either completely hands-free via continuous wake-word listening and conversational silence-detection or through a unified command HUD interface.

---

## 📑 Table of Contents
- [Key Features & Architecture](#-key-features--architecture)
  - [Dual-Engine Voice Pipeline](#1-dual-engine-voice-pipeline)
  - [Dynamic Speech Energy & Silence Detection](#2-dynamic-speech-energy--silence-detection)
  - [Autonomous Intent Extraction & Tool Execution](#3-autonomous-intent-extraction--tool-execution)
  - [Executive Cyber-Glass Design System](#4-executive-cyber-glass-design-system)
- [System Architecture Flow](#-system-architecture-flow)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Development Server](#development-server)
  - [Production Build](#production-build)
- [Deployment](#-deployment)
- [Voice Commands & Syntax](#-voice-commands--syntax)
- [Project Structure](#-project-structure)
- [Security & Best Practices](#-security--best-practices)
- [License](#-license)

---

## 🌟 Key Features & Architecture

### 1. Dual-Engine Voice Pipeline
- **Passive Wake Word Monitoring:** Employs the browser-native Web Speech engine in the background to detect hotwords (*"Jon"*, *"Hey Jon"*).
- **Auto-Bridging to Cloud Whisper:** As soon as the wake word is triggered, audio capture switches seamlessly to **Groq Whisper Large v3 Turbo** (`whisper-large-v3-turbo`) for high-fidelity, multilingual cloud transcription in under 200ms.
- **Push-to-Talk Fallback:** Manual push-to-talk button integrated in both the floating command bar and central orb.

### 2. Dynamic Speech Energy & Silence Detection
Unlike naive voice assistants that rely on arbitrary fixed timeouts (which cut users off mid-sentence), Jon OS integrates real-time audio energy DSP:
- Utilizes the **Web Audio API** (`AudioContext`, `AnalyserNode`) to compute RMS energy levels continuously.
- Automatically extends recording duration while the user speaks.
- Dispatches speech to the processing pipeline only after observing **1.8 seconds of natural conversational silence**.

### 3. Autonomous Intent Extraction & Tool Execution
- Driven by **LLaMA 3.3 70B Versatile** via the Groq SDK.
- The prompt layer grounds natural language queries into deterministic structured JSON actions:
  - `add_task` &mdash; Parses task description and writes to Firestore.
  - `delete_task` &mdash; Identifies task entities and removes them from the user's ledger.
  - `list_tasks` &mdash; Compiles and verbalizes active tasks.
  - `add_reminder` &mdash; Extracts target time expressions (*"tomorrow at 3 PM"*, *"next Monday"*) and schedules reminders.
  - `daily_briefing` &mdash; Aggregates pending tasks, upcoming reminders, and current time into an executive summary.
- Provides synthesized vocal confirmation and updates the live canvas HUD concurrently.

### 4. Executive Cyber-Glass Design System
- **Obsidian Dark Mesh:** Grounded on deep `#030712` obsidian with floating ambient radial light fields in cyan (`#38bdf8`) and indigo (`#6366f1`).
- **Cinematic Neural Orb & HUD:** Concentric orbiting gyro rings (`orbit-outer` and `orbit-inner`) around a pulsating neural core.
- **Audio Visualizer:** Real-time radial frequency canvas visualizer that mirrors microphone input.
- **Frosted Glass Panels:** Slide-out drawers for Task Ledger, Reminders, Interactive Calendar, and Preferences styled with `backdrop-filter: blur(28px) saturate(190%)`.
- **Hybrid Command Bar:** Floating macOS/iOS-style command bar for simultaneous voice and keyboard control.

---

## 📐 System Architecture Flow

```
 ┌─────────────────────────────────────────────────────────────┐
 │                    User Voice Input                         │
 └──────────────────────────────┬──────────────────────────────┘
                                │
               ┌────────────────▼────────────────┐
               │    Passive Hotword Detection    │
               │        ("Jon" / "Hey Jon")      │
               └────────────────┬────────────────┘
                                │ (Triggered)
               ┌────────────────▼────────────────┐
               │ Web Audio API (AnalyserNode)    │
               │ RMS Energy & Silence Tracking   │
               └────────────────┬────────────────┘
                                │ (1.8s Silence Detected)
               ┌────────────────▼────────────────┐
               │ Groq Whisper Large v3 Turbo     │
               │ Cloud Speech-to-Text (<200ms)   │
               └────────────────┬────────────────┘
                                │ (Transcript)
               ┌────────────────▼────────────────┐
               │ Groq LLaMA 3.3 70B Versatile    │
               │ Semantic Tool & Intent Parser   │
               └───────┬─────────────────┬───────┘
                       │                 │
     ┌─────────────────▼─────────┐     ┌─▼──────────────────────────┐
     │  Firestore Cloud Database │     │ Audio Synthesizer / TTS    │
     │  (Tasks / Reminders CRUD) │     │ (Spoken Response to User)  │
     └───────────────────────────┘     └────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Domain | Technologies |
|---|---|
| **Frontend Framework** | Vanilla Modern JavaScript (ES Modules), HTML5 |
| **Styling & Animation** | Custom Cyber-Glass CSS Tokens, CSS Grid, Ambient Mesh, Keyframe Physics |
| **Typography** | Plus Jakarta Sans & JetBrains Mono |
| **Bundler & Build Tool** | Vite 5 |
| **Audio Processing** | Web Audio API (`AudioContext`, `AnalyserNode`, `MediaStreamTrack`) |
| **Speech-to-Text (STT)**| Groq Whisper Large v3 Turbo (`whisper-large-v3-turbo`) & Web Speech API |
| **LLM Inference** | Groq SDK (`llama-3.3-70b-versatile`) |
| **Cloud Authentication**| Firebase Auth (Email/Password Session Handling) |
| **Cloud Database** | Firebase Cloud Firestore |
| **Deployment Target** | Vercel (Edge-Optimized SPA with `vercel.json`) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- A modern browser with Web Audio and Web Speech support (**Google Chrome** or **Microsoft Edge** recommended).

### Installation
```bash
# Clone the repository
git clone https://github.com/umairulhassancs/Autonomous-Neural-Copilot.git

# Navigate to project directory
cd Autonomous-Neural-Copilot

# Install dependencies
npm install
```

### Environment Variables
Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Populate `.env` with your Firebase and Groq credentials:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Groq API Key
VITE_GROQ_API_KEY=gsk_your_groq_api_key
```

### Development Server
```bash
npm run dev
```
Navigate to `http://localhost:5173` and allow microphone access when prompted.

### Production Build
```bash
npm run build
```
Production assets are generated in the `/dist` directory. To test the build locally:
```bash
npm run preview
```

---

## 🌐 Deployment

### Deploying to Vercel
1. Import the repository into [Vercel](https://vercel.com/new).
2. Set Framework Preset to **Vite**.
3. Under **Project Settings &rarr; Environment Variables**, add the variables defined in your `.env`.
4. Deploy. The included `vercel.json` ensures all routes redirect correctly to `index.html`.

> **Important:** In your **Firebase Console**, navigate to **Authentication &rarr; Settings &rarr; Authorized Domains** and add your Vercel deployment domain (e.g. `your-app.vercel.app`) to authorize login requests.

---

## 🗣️ Voice Commands & Syntax

| Command Goal | Example Voice Utterance | Resulting Action |
|---|---|---|
| **Create Task** | *"Hey Jon, add task finalize Q3 financial review"* | Adds item to Firestore Task Ledger |
| **List Tasks** | *"Jon, what are my pending tasks?"* | Queries ledger and speaks active items |
| **Complete Task** | *"Jon, complete task review roadmap"* | Toggles completion status in Firestore |
| **Schedule Reminder** | *"Remind me to call the architect tomorrow at 10 AM"* | Parses date and writes to Reminders collection |
| **Daily Briefing** | *"Jon, give me my executive briefing"* | Summarizes pending tasks, agenda, and time |
| **General Query** | *"Jon, explain zero-knowledge rollups in simple terms"* | Streams direct AI explanation |

---

## 📂 Project Structure

```
Autonomous-Neural-Copilot/
├── frontend/
│   ├── firebase.js                 # Firebase Client SDK initialization
│   └── services/
│       ├── audioVisualizer.js      # Web Audio canvas frequency visualizer
│       ├── authService.js          # Authentication (Sign In / Sign Up / Sign Out)
│       ├── groqService.js          # LLaMA 3.3 prompt execution & tool dispatch
│       ├── reminderService.js      # Reminders Firestore operations
│       ├── soundEffects.js         # Procedural Web Audio auditory feedback
│       ├── taskService.js          # Tasks Firestore operations
│       ├── voiceService.js         # Voice recognition & silence detection logic
│       └── whisperService.js       # Groq Whisper audio recording & upload
├── styles/
│   └── main.css                    # Cyber-glass design system & keyframe rules
├── index.html                      # Semantic application layout & visualizer canvas
├── main.js                         # Application coordinator & event bindings
├── package.json                    # Project metadata & dependencies
├── vercel.json                     # SPA rewrites for Vercel deployment
├── vite.config.js                  # Vite configuration
└── README.md                       # Documentation
```

---

## 🔒 Security & Best Practices

- **API Key Segregation:** API keys are injected via Vite environment variables (`import.meta.env`) and excluded from version control via `.gitignore`.
- **Firebase Security Rules:** Firestore and Firebase Authentication ensure user data isolation by scoping queries to `currentUser.uid`.
- **HTTPS Enforcement:** Microphone and Web Speech features require an active HTTPS context in production.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

