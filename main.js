import { onAuthChange, signIn, signUp, signOut, getUserProfile, updateUserProfile } from './frontend/services/authService.js';
import { addTask, getTasks, toggleTaskCompletion, deleteTask, renameTask } from './frontend/services/taskService.js';
import { addReminder, getReminders, deleteReminder, sendReminderNotification } from './frontend/services/reminderService.js';
import { processVoiceCommand } from './frontend/services/groqService.js';
import voiceService from './frontend/services/voiceService.js';
import audioVisualizer from './frontend/services/audioVisualizer.js';
import soundEffects from './frontend/services/soundEffects.js';

// ===== STATE =====
let currentUser = null;
let userProfile = null;
let tasks = [];
let reminders = [];
let currentCalendarDate = new Date();

// ===== DOM ELEMENTS =====
const authScreen = document.getElementById('authScreen');
const dashboard = document.getElementById('dashboard');
const loadingOverlay = document.getElementById('loadingOverlay');

// Auth elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const authError = document.getElementById('authError');

// Dashboard elements
const aiCircle = document.getElementById('aiCircle');
const aiStatus = document.getElementById('aiStatus');
const tasksPanel = document.getElementById('tasksPanel');
const remindersPanel = document.getElementById('remindersPanel');
const calendarPanel = document.getElementById('calendarPanel');
const settingsPanel = document.getElementById('settingsPanel');

// ===== INITIALIZATION =====
function init() {
    setupAuthListeners();
    setupDashboardListeners();
    setupVoiceService();

    // Attach audio visualizer to canvas
    const canvas = document.getElementById('audioVisualizerCanvas');
    if (canvas) {
        audioVisualizer.attachCanvas(canvas);
    }

    // Listen for auth state changes
    onAuthChange(async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData();
            showDashboard();

            // Start voice recognition after user is authenticated and DOM is ready
            setTimeout(() => {
                try {
                    console.log('Attempting to start voice recognition...');
                    const started = voiceService.startListening();
                    if (started) {
                        console.log('✅ Voice recognition started successfully - listening for "Jon"');

                        // Using FREE Web Speech API only (no Whisper)

                        // Update UI to confirm listening
                        const liveTranscriptEl = document.getElementById('liveTranscript');
                        if (liveTranscriptEl) {
                            liveTranscriptEl.textContent = 'Microphone active - Say "Jon" to activate';
                            liveTranscriptEl.style.color = '#10b981';
                        }

                        // Set up periodic health check (every 10 seconds)
                        const healthCheckInterval = setInterval(() => {
                            if (!currentUser) {
                                // User logged out, stop health check
                                clearInterval(healthCheckInterval);
                                return;
                            }

                            const health = voiceService.checkHealth();
                            if (!health.healthy) {
                                console.warn('⚠️ Voice recognition is not running! Attempting restart...');
                                voiceService.forceRestart();
                            }
                        }, 10000); // Check every 10 seconds
                    } else {
                        console.error('❌ Failed to start voice recognition');
                        const liveTranscriptEl = document.getElementById('liveTranscript');
                        if (liveTranscriptEl) {
                            liveTranscriptEl.textContent = 'Microphone error - Please check permissions';
                            liveTranscriptEl.style.color = '#ef4444';
                        }
                    }
                } catch (error) {
                    console.error('❌ Error starting voice service:', error);
                }
            }, 1000);
        } else {
            currentUser = null;
            voiceService.stopListening();
            showAuth();
        }
    });
}

// ===== AUTH FUNCTIONS =====
function setupAuthListeners() {
    // Show signup form
    document.getElementById('showSignup').addEventListener('click', () => {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        authError.classList.remove('show');
    });

    // Show login form
    document.getElementById('showLogin').addEventListener('click', () => {
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        authError.classList.remove('show');
    });

    // Login
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            showError('Please fill in all fields');
            return;
        }

        showLoading(true);
        const result = await signIn(email, password);
        showLoading(false);

        if (!result.success) {
            showError(result.error);
        }
    });

    // Signup
    document.getElementById('signupBtn').addEventListener('click', async () => {
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const whatsapp = document.getElementById('signupWhatsApp').value;

        if (!name || !email || !password) {
            showError('Please fill in all required fields');
            return;
        }

        showLoading(true);
        const result = await signUp(email, password, name, whatsapp);
        showLoading(false);

        if (!result.success) {
            showError(result.error);
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await signOut();
        voiceService.stopListening();
    });
}

function showError(message) {
    authError.textContent = message;
    authError.classList.add('show');
}

function showAuth() {
    authScreen.classList.remove('hidden');
    dashboard.classList.add('hidden');
}

function showDashboard() {
    authScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
}

function showLoading(show) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

// ===== DASHBOARD FUNCTIONS =====
function setupDashboardListeners() {
    // Panel toggles
    document.getElementById('toggleTasksBtn')?.addEventListener('click', () => {
        togglePanel(tasksPanel);
    });

    document.getElementById('toggleRemindersBtn')?.addEventListener('click', () => {
        togglePanel(remindersPanel);
    });

    document.getElementById('toggleCalendarBtn')?.addEventListener('click', () => {
        renderCalendar();
        togglePanel(calendarPanel);
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
        loadSettings();
        togglePanel(settingsPanel);
    });

    // Close panel buttons
    document.querySelectorAll('.close-panel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const panelId = e.target.dataset.panel;
            const panel = document.getElementById(panelId);
            panel.classList.remove('open');
        });
    });

    // Add task
    document.getElementById('addTaskBtn').addEventListener('click', handleAddTask);
    document.getElementById('newTaskInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddTask();
    });

    // Add reminder
    document.getElementById('addReminderBtn').addEventListener('click', handleAddReminder);
    document.getElementById('newReminderInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddReminder();
    });

    // Save settings
    document.getElementById('saveSettingsBtn').addEventListener('click', handleSaveSettings);

    // Calendar navigation
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    // AI Circle click - manual voice activation (Groq Whisper Push-to-Talk)
    aiCircle.addEventListener('click', handleManualVoiceActivation);

    // Hybrid Command Bar
    const commandInput = document.getElementById('commandInput');
    const sendCommandBtn = document.getElementById('sendCommandBtn');
    const micBtn = document.getElementById('micBtn');

    const submitCommand = () => {
        if (!commandInput) return;
        const text = commandInput.value.trim();
        if (text) {
            commandInput.value = '';
            processUserCommand(text);
        }
    };

    if (sendCommandBtn) {
        sendCommandBtn.addEventListener('click', submitCommand);
    }
    if (commandInput) {
        commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitCommand();
        });
    }
    if (micBtn) {
        micBtn.addEventListener('click', handleManualVoiceActivation);
    }

    // Quick Action Chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const action = chip.dataset.action;
            if (action === 'briefing') {
                processUserCommand("Give me my daily briefing and summarize my agenda for today");
            } else if (action === 'tasks') {
                togglePanel(tasksPanel);
            } else if (action === 'reminders') {
                togglePanel(remindersPanel);
            } else if (action === 'calendar') {
                renderCalendar();
                togglePanel(calendarPanel);
            }
        });
    });
}

function togglePanel(panel) {
    // Close all other panels
    document.querySelectorAll('.side-panel').forEach(p => {
        if (p !== panel) {
            p.classList.remove('open');
        }
    });

    // Toggle current panel
    panel.classList.toggle('open');
}

// ===== USER DATA =====
async function loadUserData() {
    showLoading(true);

    // Load profile
    const profileResult = await getUserProfile(currentUser.uid);
    if (profileResult.success) {
        userProfile = profileResult.profile;
    }

    // Load tasks
    const tasksResult = await getTasks(currentUser.uid);
    if (tasksResult.success) {
        tasks = tasksResult.tasks;
        renderTasks();
    }

    // Load reminders
    const remindersResult = await getReminders(currentUser.uid);
    if (remindersResult.success) {
        reminders = remindersResult.reminders;
        renderReminders();
    }

    showLoading(false);
}

// ===== TASKS =====
function renderTasks() {
    const tasksList = document.getElementById('tasksList');
    tasksList.innerHTML = '';

    if (tasks.length === 0) {
        tasksList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No tasks yet. Add one above!</p>';
        return;
    }

    tasks.forEach(task => {
        const taskEl = document.createElement('div');
        taskEl.className = 'item';
        taskEl.innerHTML = `
      <div class="item-checkbox ${task.completed ? 'checked' : ''}" data-id="${task.id}"></div>
      <div class="item-text ${task.completed ? 'completed' : ''}">${task.description}</div>
      <button class="item-delete" data-id="${task.id}">🗑️</button>
    `;

        // Toggle completion
        taskEl.querySelector('.item-checkbox').addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const task = tasks.find(t => t.id === id);
            await toggleTaskCompletion(id, task.completed);
            await loadUserData();
        });

        // Delete task
        taskEl.querySelector('.item-delete').addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            await deleteTask(id);
            await loadUserData();
        });

        tasksList.appendChild(taskEl);
    });
}

async function handleAddTask() {
    const input = document.getElementById('newTaskInput');
    const description = input.value.trim();

    if (!description) return;

    showLoading(true);
    await addTask(currentUser.uid, description);
    input.value = '';
    await loadUserData();
    showLoading(false);

    // Voice feedback
    voiceService.speak('Task added successfully');
}

// ===== REMINDERS =====
function renderReminders() {
    const remindersList = document.getElementById('remindersList');
    remindersList.innerHTML = '';

    if (reminders.length === 0) {
        remindersList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No reminders yet. Add one above!</p>';
        return;
    }

    reminders.forEach(reminder => {
        const reminderEl = document.createElement('div');
        reminderEl.className = 'item';

        // Format date if available
        let dateText = '';
        if (reminder.reminderDate) {
            const date = reminder.reminderDate.toDate ? reminder.reminderDate.toDate() : new Date(reminder.reminderDate);
            dateText = ` <span style="color: var(--text-muted); font-size: 0.75rem;">(${date.toLocaleDateString()})</span>`;
        }

        reminderEl.innerHTML = `
      <div class="item-text">${reminder.description}${dateText}</div>
      <button class="item-delete" data-id="${reminder.id}">🗑️</button>
    `;

        // Delete reminder
        reminderEl.querySelector('.item-delete').addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            await deleteReminder(id);
            await loadUserData();
        });

        remindersList.appendChild(reminderEl);
    });
}

async function handleAddReminder() {
    const input = document.getElementById('newReminderInput');
    const dateInput = document.getElementById('reminderDate');
    const description = input.value.trim();
    const dateValue = dateInput.value;

    if (!description) {
        voiceService.speak('Please enter a reminder description');
        return;
    }

    if (!dateValue) {
        voiceService.speak('Please select a date for the reminder');
        return;
    }

    // Validate date is not in the past
    const selectedDate = new Date(dateValue);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
        voiceService.speak('Cannot set reminder for a past date');
        return;
    }

    showLoading(true);
    const result = await addReminder(currentUser.uid, description, dateValue);

    // Send WhatsApp notification if number is provided
    if (result.success && userProfile?.whatsappNumber) {
        await sendReminderNotification(
            currentUser.uid,
            description,
            userProfile.whatsappNumber
        );
    }

    input.value = '';
    dateInput.value = '';
    await loadUserData();
    showLoading(false);

    // Voice feedback
    voiceService.speak('Reminder added successfully');
}

// ===== SETTINGS =====
function loadSettings() {
    if (userProfile) {
        document.getElementById('settingsName').value = userProfile.displayName || '';
        document.getElementById('settingsEmail').value = userProfile.email || '';
        document.getElementById('settingsWhatsApp').value = userProfile.whatsappNumber || '';
    }
}

async function handleSaveSettings() {
    const name = document.getElementById('settingsName').value;
    const whatsapp = document.getElementById('settingsWhatsApp').value;

    showLoading(true);
    await updateUserProfile(currentUser.uid, {
        displayName: name,
        whatsappNumber: whatsapp
    });

    await loadUserData();
    showLoading(false);

    voiceService.speak('Settings saved successfully');
}

// ===== CALENDAR =====
function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // Update header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Get calendar days container
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendarDays.appendChild(emptyDay);
    }

    // Add days of the month
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';

        // Create day number
        const dayNumber = document.createElement('span');
        dayNumber.textContent = day;
        dayEl.appendChild(dayNumber);

        // Check for reminders on this day
        const currentDate = new Date(year, month, day);
        currentDate.setHours(0, 0, 0, 0);

        const dayReminders = reminders.filter(reminder => {
            if (!reminder.reminderDate) return false;
            const reminderDate = reminder.reminderDate.toDate ? reminder.reminderDate.toDate() : new Date(reminder.reminderDate);
            reminderDate.setHours(0, 0, 0, 0);
            return reminderDate.getTime() === currentDate.getTime();
        });

        // Add reminder indicators
        if (dayReminders.length > 0) {
            const indicatorContainer = document.createElement('div');
            indicatorContainer.className = 'reminder-indicators';

            dayReminders.forEach(reminder => {
                const indicator = document.createElement('div');
                indicator.className = currentDate < today ? 'reminder-indicator past' : 'reminder-indicator upcoming';
                indicator.title = reminder.description;
                indicatorContainer.appendChild(indicator);
            });

            dayEl.appendChild(indicatorContainer);
        }

        // Highlight today
        if (year === today.getFullYear() &&
            month === today.getMonth() &&
            day === today.getDate()) {
            dayEl.classList.add('today');
        }

        calendarDays.appendChild(dayEl);
    }
}

// ===== VOICE SERVICE & COMMAND PROCESSING =====
async function processUserCommand(commandText) {
    if (!commandText || !commandText.trim()) return;

    aiCircle.classList.add('active');
    aiStatus.textContent = `Processing: "${commandText}"`;
    soundEffects.playNotice();

    // Show what user asked in live transcript
    const liveTranscriptEl = document.getElementById('liveTranscript');
    if (liveTranscriptEl) {
        liveTranscriptEl.textContent = `"${commandText}"`;
        liveTranscriptEl.style.color = '#38bdf8';
    }

    const pendingTasks = tasks.filter(t => !t.completed).length;
    const taskDetails = tasks.slice(0, 5).map(t => `${t.description} (${t.completed ? 'completed' : 'pending'})`).join(', ');
    const reminderDetails = reminders.slice(0, 5).map(r => r.description).join(', ');

    const context = {
        taskCount: tasks.length,
        pendingTaskCount: pendingTasks,
        reminderCount: reminders.length,
        summaryContext: `User tasks: [${taskDetails || 'none'}]. Reminders: [${reminderDetails || 'none'}].`
    };

    try {
        const response = await processVoiceCommand(commandText, context);
        await handleAIResponse(response, commandText);
    } catch (err) {
        console.error('Command processing error:', err);
        aiStatus.textContent = 'Error processing command';
        await voiceService.speak('Sorry, I encountered an issue processing that.');
    } finally {
        aiCircle.classList.remove('active');
        aiStatus.textContent = '';
        voiceService.resumeListening();
    }
}

function setupVoiceService() {
    // Wake word detected
    voiceService.onWakeWord(() => {
        console.log('Wake word detected!');
        aiCircle.classList.add('active');
        aiStatus.textContent = 'Listening...';
    });

    // Process voice command (from either Web Speech or Groq Whisper)
    voiceService.onResult(async (transcript) => {
        console.log('Voice result received:', transcript);
        await processUserCommand(transcript);
    });
}

async function handleAIResponse(response, originalCommand) {
    // Show AI speech bubble
    const speechBubble = document.getElementById('aiSpeechBubble');
    const speechText = document.getElementById('aiSpeechText');
    if (speechBubble && speechText && response.reply) {
        speechText.textContent = response.reply;
        speechBubble.classList.remove('hidden');
        speechBubble.classList.add('visible');

        // Auto hide after 8 seconds
        setTimeout(() => {
            speechBubble.classList.remove('visible');
            setTimeout(() => speechBubble.classList.add('hidden'), 400);
        }, 8000);
    }

    if (!response.success) {
        await voiceService.speak(response.reply || 'I encountered an issue processing that.');
        return;
    }

    soundEffects.playSuccess();

    // Execute action
    switch (response.action) {
        case 'add_task': {
            const taskDesc = response.data.description || response.data.task || response.data.title;
            if (taskDesc) {
                await addTask(currentUser.uid, taskDesc);
                await loadUserData();
                if (!tasksPanel.classList.contains('open')) {
                    togglePanel(tasksPanel);
                }
            }
            break;
        }

        case 'add_reminder': {
            const reminderDesc = response.data.description || response.data.reminder || response.data.title;
            if (reminderDesc) {
                // Use provided date or default to tomorrow
                const reminderDate = response.data.date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
                const result = await addReminder(currentUser.uid, reminderDesc, reminderDate);
                if (result.success && userProfile?.whatsappNumber) {
                    await sendReminderNotification(
                        currentUser.uid,
                        reminderDesc,
                        userProfile.whatsappNumber
                    );
                }
                await loadUserData();
                renderCalendar();
                if (!remindersPanel.classList.contains('open')) {
                    togglePanel(remindersPanel);
                }
            }
            break;
        }

        case 'delete_reminder':
            if (response.data.description) {
                const reminderToDelete = reminders.find(r =>
                    r.description.toLowerCase().includes(response.data.description.toLowerCase())
                );
                if (reminderToDelete) {
                    await deleteReminder(reminderToDelete.id);
                    await loadUserData();
                    renderCalendar();
                }
            }
            break;

        case 'delete_task':
            if (response.data.description) {
                const taskToDelete = tasks.find(t =>
                    t.description.toLowerCase().includes(response.data.description.toLowerCase())
                );
                if (taskToDelete) {
                    await deleteTask(taskToDelete.id);
                    await loadUserData();
                }
            }
            break;

        case 'rename_task':
            if (response.data.description && response.data.newDescription) {
                const taskToRename = tasks.find(t =>
                    t.description.toLowerCase().includes(response.data.description.toLowerCase())
                );
                if (taskToRename) {
                    await renameTask(taskToRename.id, response.data.newDescription);
                    await loadUserData();
                }
            }
            break;

        case 'list_tasks':
            togglePanel(tasksPanel);
            break;

        case 'list_reminders':
            togglePanel(remindersPanel);
            break;

        case 'show_calendar':
            renderCalendar();
            togglePanel(calendarPanel);
            break;

        case 'daily_briefing':
            // Open tasks or calendar for visual context during briefing
            if (!tasksPanel.classList.contains('open')) {
                togglePanel(tasksPanel);
            }
            break;

        case 'general':
            // Conversational reply
            break;
    }

    // Speak reply and wait for audio to finish before resuming mic
    await voiceService.speak(response.reply);
}

async function handleManualVoiceActivation() {
    console.log('🎤 Manual voice activation triggered via click');
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
        micBtn.classList.toggle('recording');
    }
    await voiceService.toggleManualListening();
}

// ===== START APP =====
init();
