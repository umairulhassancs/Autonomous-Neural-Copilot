import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: import.meta.env.VITE_GROQ_API_KEY,
    dangerouslyAllowBrowser: true
});

/**
 * Process user voice command with Groq AI
 * @param {string} userMessage - The user's voice command
 * @param {Object} context - Context data (tasks, reminders, user info)
 * @returns {Promise<Object>} AI response with action and reply
 */
export async function processVoiceCommand(userMessage, context = {}) {
    try {
        const systemPrompt = `You are Jon, a helpful personal AI assistant. You help users manage their tasks, reminders, and calendar.

IMPORTANT: User commands will START with your name "Jon" (or variations like "john", "jan", "joan").
You must IGNORE the wake word and extract the actual command from the rest of the sentence.

Examples:
- "jon add task buy milk" → Extract and process: "add task buy milk"
- "john show my tasks" → Extract and process: "show my tasks"
- "jan remind me to call mom tomorrow" → Extract and process: "remind me to call mom tomorrow"

CAPABILITIES:
- Add tasks: "add task [description]" or "create task [description]"
- Add reminders with dates: "remind me to [description] on [date]" or "set reminder [description] for [date]"
- Complete tasks: "complete task [description]" or "mark [description] as done"
- Delete tasks/reminders: "delete task/reminder [description]" or "remove [description]"
- Rename tasks: "rename task [old name] to [new name]" or "change task [old] to [new]"
- List tasks: "show my tasks" or "what are my tasks"
- List reminders: "show my reminders" or "what reminders do I have"
- Show calendar: "open calendar" or "show calendar" or "show me the calendar"
- Daily briefing / agenda: "what's on my agenda today", "summarize my day", "daily briefing", "what do I have scheduled"

CONTEXT:
- Tasks count: ${context.taskCount || 0} (${context.pendingTaskCount || 0} pending)
- Reminders count: ${context.reminderCount || 0}
- Current time: ${new Date().toLocaleString()}
${context.summaryContext ? `- Details: ${context.summaryContext}` : ''}

RESPONSE FORMAT:
You must respond in JSON format with this structure:
{
  "action": "add_task" | "add_reminder" | "complete_task" | "delete_task" | "delete_reminder" | "rename_task" | "list_tasks" | "list_reminders" | "show_calendar" | "daily_briefing" | "general",
  "data": {
    "description": "task or reminder description",
    "newDescription": "new description for rename",
    "date": "YYYY-MM-DD format for reminders",
    "type": "task" | "reminder"
  },
  "reply": "Your friendly, concise spoken response to the user"
}

DATE PARSING:
- Extract dates from natural language: "tomorrow", "next Monday", "January 15", etc.
- Convert to YYYY-MM-DD format
- If no date mentioned for reminder, use tomorrow's date
- Today's date: ${new Date().toISOString().split('T')[0]}

EXAMPLES:
User: "Add task buy groceries"
Response: {"action": "add_task", "data": {"description": "buy groceries", "type": "task"}, "reply": "I've added 'buy groceries' to your tasks."}

User: "What's on my agenda today?"
Response: {"action": "daily_briefing", "data": {}, "reply": "You have ${context.pendingTaskCount || context.taskCount || 0} pending tasks and ${context.reminderCount || 0} reminders on your schedule. Keep up the great momentum!"}

User: "Remind me to call mom tomorrow"
Response: {"action": "add_reminder", "data": {"description": "call mom", "date": "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}", "type": "reminder"}, "reply": "I'll remind you to call mom tomorrow."}

User: "Show calendar" or "Open calendar"
Response: {"action": "show_calendar", "data": {}, "reply": "Opening your calendar now."}

User: "Rename task buy groceries to buy vegetables"
Response: {"action": "rename_task", "data": {"description": "buy groceries", "newDescription": "buy vegetables"}, "reply": "I've renamed the task to 'buy vegetables'."}

User: "Remove reminder call mom"
Response: {"action": "delete_reminder", "data": {"description": "call mom", "type": "reminder"}, "reply": "I've removed the reminder to call mom."}

User: "How are you doing today?"
Response: {"action": "general", "data": {}, "reply": "I'm doing great and ready to help you manage your day! How can I assist you?"}

Be conversational, friendly, and helpful. Always respond in valid JSON.`;

        const modelsToTry = [
            import.meta.env.VITE_GROQ_MODEL,
            'openai/gpt-oss-20b',
            'groq/compound-mini',
            'qwen/qwen3.8-27b'
        ].filter(Boolean);

        let completion = null;
        let lastError = null;

        for (const model of modelsToTry) {
            try {
                console.log(`🤖 Attempting Groq parsing with model: ${model}`);
                completion = await groq.chat.completions.create({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    model: model,
                    temperature: 0.3,
                    max_tokens: 250, // Safe limit to prevent OTPM 429 rate limit
                    response_format: { type: 'json_object' }
                });
                if (completion?.choices?.[0]?.message?.content) {
                    console.log(`✅ Groq success with model: ${model}`);
                    break;
                }
            } catch (err) {
                console.warn(`⚠️ Model ${model} failed: ${err.message}, trying fallback...`);
                lastError = err;
            }
        }

        if (!completion) {
            throw lastError || new Error('All Groq models failed');
        }

        console.log('✅ Groq API response received');
        const responseText = completion.choices[0]?.message?.content || '{}';
        console.log('📝 Raw Groq response:', responseText);

        const aiResponse = JSON.parse(responseText);
        console.log('🤖 Parsed AI response:', aiResponse);

        return {
            success: true,
            action: aiResponse.action || 'general',
            data: aiResponse.data || {},
            reply: aiResponse.reply || "I'm here to help!",
            rawResponse: responseText
        };

    } catch (error) {
        console.error('❌ Groq AI Error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);

        return {
            success: false,
            action: 'error',
            data: {},
            reply: "Sorry, I'm having trouble understanding that. Could you try again?",
            error: error.message
        };
    }
}

/**
 * Get AI response for general conversation
 * @param {string} message - User message
 * @returns {Promise<string>} AI response
 */
export async function getAIResponse(message) {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are Jon, a friendly and helpful AI assistant. Keep responses concise and conversational.'
                },
                { role: 'user', content: message }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.8,
            max_tokens: 300
        });

        return completion.choices[0]?.message?.content || "I'm here to help!";

    } catch (error) {
        console.error('Groq AI Error:', error);
        return "Sorry, I'm having trouble right now. Please try again.";
    }
}

export default { processVoiceCommand, getAIResponse };
