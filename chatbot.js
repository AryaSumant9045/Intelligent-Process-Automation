
import {
    CONFIG,
    loadApiKey,
    callOpenRouter,
    callGroq,
    getChatSession,
    readFileContent,
    executeInsuranceSubmission,
    resetSessions
} from './chatbot-logic.js';

// Global State
let currentInputType = 'text';
let selectedFile = null;

// DOM elements
const textOption = document.getElementById('text-option');
const fileOption = document.getElementById('file-option');
const textInputContainer = document.getElementById('text-input-container');
const fileInputContainer = document.getElementById('file-input-container');
const textInput = document.getElementById('text-input');
const fileInput = document.getElementById('file-input');
const fileFileName = document.getElementById('file-name');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const messagesContainer = document.getElementById('chatbot-messages');

// Form Submission Handler (Prevents Page Reload & Sends to Backend)
const carInsuranceForm = document.getElementById('car-insurance-form');
if (carInsuranceForm) {
    carInsuranceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = carInsuranceForm.querySelector('button[type="submit"]');

        const formData = new FormData(carInsuranceForm);

        // Extract Fields
        const data = {
            firstName: formData.get('firstName') ? formData.get('firstName').trim() : '',
            lastName: formData.get('lastName') ? formData.get('lastName').trim() : '',
            email: formData.get('email') ? formData.get('email').trim() : '',
            phone: formData.get('phone') ? formData.get('phone').trim() : '',
            driverFirstName: formData.get('driverFirstName') ? formData.get('driverFirstName').trim() : '',
            driverLastName: formData.get('driverLastName') ? formData.get('driverLastName').trim() : '',
            commute: formData.get('commute'),
            parking: formData.get('parking'),
            coverage: formData.get('coverage'),
            ownership: formData.get('ownership'),
            state: formData.get('state') ? formData.get('state').trim() : ''
        };

        // 1. Missing fields check
        if (!data.firstName || !data.lastName) {
            alert('Validation Error: Name is required.');
            return;
        }

        // Visual feedback state
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';

        try {
            const response = await fetch('http://localhost:3000/api/insurance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Server Error (${response.status}): ${text.slice(0, 100)}...`); // Limit error length
            }

            const result = await response.json();

            submitBtn.textContent = 'Sent!';
            submitBtn.style.backgroundColor = '#4ade80';
        } catch (error) {
            console.error('Error submitting form:', error);
            submitBtn.textContent = 'Failed';
            submitBtn.style.backgroundColor = '#f87171';
            alert(`Submission Failed: ${error.message}`);
        }

        // Reset button state
        setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.style.backgroundColor = '';
        }, 1000);
    });
}

// Input type toggle
textOption.addEventListener('click', () => {
    currentInputType = 'text';
    textOption.classList.add('active');
    fileOption.classList.remove('active');
    textInputContainer.classList.remove('hidden');
    fileInputContainer.classList.add('hidden');
    selectedFile = null;
    fileFileName.textContent = '';
});

fileOption.addEventListener('click', () => {
    currentInputType = 'file';
    fileOption.classList.add('active');
    textOption.classList.remove('active');
    textInputContainer.classList.add('hidden');
    fileInputContainer.classList.remove('hidden');
    textInput.value = '';
});

// File selection
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json', 'text/plain'];
        const validExtensions = ['.csv', '.xls', '.xlsx', '.json', '.txt'];
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (validTypes.includes(file.type) || validExtensions.includes(fileExtension)) {
            selectedFile = file;
            fileFileName.textContent = `Selected: ${file.name}`;
            fileFileName.style.color = 'var(--text)';
        } else {
            alert('Please select a valid file (.csv, .xls, .xlsx, .json, .txt)');
            fileInput.value = '';
            selectedFile = null;
            fileFileName.textContent = '';
        }
    }
});

// Helper to handle AI response and tools
async function handleResponse(result, session) {
    const response = await result.response;

    try {
        const text = response.text();
        if (text) {
            addMessage('bot', text);
        }
    } catch (e) { }

    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
        const functionResponses = [];
        for (const call of functionCalls) {
            if (call.name === "submitInsuranceApplication") { // Updated Tool Name
                addMessage('bot', `🤖 Activating Car Insurance Agent...`);
                // Updated Executor
                const apiResponse = await executeInsuranceSubmission(call.args);

                functionResponses.push({
                    functionResponse: {
                        name: "submitInsuranceApplication",
                        response: { result: apiResponse }
                    }
                });
            }
        }

        if (functionResponses.length > 0) {
            const nextResult = await session.sendMessage(functionResponses);
            await handleResponse(nextResult, session);
        }
    }
}

// Send message
sendBtn.addEventListener('click', async () => {
    if (!CONFIG.GEMINI_API_KEY || !CONFIG.OPENROUTER_API_KEY) {
        await loadApiKey();
    }

    const selectedModel = document.getElementById('model-select').value;

    // --- DEEPSEEK (OPENROUTER) LOGIC ---
    if (selectedModel === 'deepseek') {
        if (!CONFIG.OPENROUTER_API_KEY) {
            addMessage('bot', 'Error: OpenRouter API Key is missing in .env');
            return;
        }

        if (currentInputType === 'text') {
            const message = textInput.value.trim();
            if (message) {
                addMessage('user', message);
                textInput.value = '';

                try {
                    addMessage('bot', 'Thinking (DeepSeek)...');
                    const reply = await callOpenRouter(message);
                    messagesContainer.lastElementChild.remove();
                    addMessage('bot', reply);
                } catch (error) {
                    if (messagesContainer.lastElementChild.textContent.includes('Thinking')) {
                        messagesContainer.lastElementChild.remove();
                    }
                    addMessage('bot', "Error: " + error.message);
                }
            }
        } else if (currentInputType === 'file') {
            if (selectedFile) {
                addMessage('user', `Uploaded File: ${selectedFile.name}`);

                try {
                    addMessage('bot', 'Reading file (DeepSeek)...');
                    const content = await readFileContent(selectedFile);

                    // Enhanced prompt for Car Insurance
                    const prompt = `I have uploaded a file named "${selectedFile.name}". 
                    
                    1. Analyze this content briefly.
                    2. IMPORTANT: If the file contains list of Insurance Applications, you MUST extract them and provide a JSON array at the very end of your response inside a strictly formatted block like this:
                    
                    \`\`\`json_submit
                    [
                        {
                            "firstName": "John",
                            "lastName": "Doe",
                            "email": "john@example.com",
                            "phone": "555 123 4567",
                            "driverFirstName": "John",
                            "driverLastName": "Doe",
                            "commute": "Less than 3 miles",
                            "parking": "A private garage",
                            "coverage": "Yes",
                            "ownership": "Owned",
                            "state": "California"
                        }
                    ]
                    \`\`\`
                    
                    If no data is found, do not provide this block.`;

                    const reply = await callOpenRouter(prompt, content);
                    messagesContainer.lastElementChild.remove();

                    const displayReply = reply.replace(/```json_submit[\s\S]*```/, '').trim();
                    addMessage('bot', displayReply || "Processing data...");

                    const match = reply.match(/```json_submit\s*([\s\S]*?)\s*```/);
                    if (match && match[1]) {
                        try {
                            const applications = JSON.parse(match[1]);
                            if (Array.isArray(applications) && applications.length > 0) {
                                addMessage('bot', `🤖 DeepSeek identified ${applications.length} applications. Starting submission...`);
                                // Corrected executor
                                const result = await executeInsuranceSubmission({ applications });
                                addMessage('bot', result);
                            }
                        } catch (e) {
                            console.error("DeepSeek JSON Parse Error", e);
                            addMessage('bot', "Error parsing data from DeepSeek response.");
                        }
                    }

                    selectedFile = null;
                    fileFileName.textContent = '';
                    fileInput.value = '';
                } catch (error) {
                    if (messagesContainer.lastElementChild.textContent.includes('Reading')) {
                        messagesContainer.lastElementChild.remove();
                    }
                    addMessage('bot', "Error: " + error.message);
                }
            } else {
                alert('Please select a file first.');
            }
        }
        return;
    }

    // --- GROQ LOGIC ---
    if (selectedModel === 'groq') {
        if (!CONFIG.GROQ_API_KEY) {
            addMessage('bot', 'Error: Groq API Key is missing in .env');
            return;
        }

        if (currentInputType === 'text') {
            const message = textInput.value.trim();
            if (message) {
                addMessage('user', message);
                textInput.value = '';

                try {
                    addMessage('bot', 'Thinking (Groq)...');
                    const reply = await callGroq(message);
                    messagesContainer.lastElementChild.remove();
                    addMessage('bot', reply);
                } catch (error) {
                    if (messagesContainer.lastElementChild.textContent.includes('Thinking')) {
                        messagesContainer.lastElementChild.remove();
                    }
                    addMessage('bot', "Error: " + error.message);
                }
            }
        } else if (currentInputType === 'file') {
            if (selectedFile) {
                addMessage('user', `Uploaded File: ${selectedFile.name}`);

                try {
                    addMessage('bot', 'Reading file (Groq)...');
                    const content = await readFileContent(selectedFile);

                    // Reusing the same prompt pattern for consistency
                    const prompt = `I have uploaded a file named "${selectedFile.name}". 
                    
                    1. Analyze this content briefly.
                    2. IMPORTANT: If the file contains list of Insurance Applications, you MUST extract them and provide a JSON array at the very end of your response inside a strictly formatted block like this:
                    
                    \`\`\`json_submit
                    [
                        {
                            "firstName": "John",
                            "lastName": "Doe",
                            "email": "john@example.com",
                            "phone": "555 123 4567",
                            "driverFirstName": "John",
                            "driverLastName": "Doe",
                            "commute": "Less than 3 miles",
                            "parking": "A private garage",
                            "coverage": "Yes",
                            "ownership": "Owned",
                            "state": "California"
                        }
                    ]
                    \`\`\`
                    
                    If no data is found, do not provide this block.`;

                    const reply = await callGroq(prompt, content);
                    messagesContainer.lastElementChild.remove();

                    const displayReply = reply.replace(/```json_submit[\s\S]*```/, '').trim();
                    addMessage('bot', displayReply || "Processing data...");

                    const match = reply.match(/```json_submit\s*([\s\S]*?)\s*```/);
                    if (match && match[1]) {
                        try {
                            const applications = JSON.parse(match[1]);
                            if (Array.isArray(applications) && applications.length > 0) {
                                addMessage('bot', `🤖 Groq identified ${applications.length} applications. Starting submission...`);
                                const result = await executeInsuranceSubmission({ applications });
                                addMessage('bot', result);
                            }
                        } catch (e) {
                            console.error("Groq JSON Parse Error", e);
                            addMessage('bot', "Error parsing data from Groq response.");
                        }
                    }

                    selectedFile = null;
                    fileFileName.textContent = '';
                    fileInput.value = '';
                } catch (error) {
                    if (messagesContainer.lastElementChild.textContent.includes('Reading')) {
                        messagesContainer.lastElementChild.remove();
                    }
                    addMessage('bot', "Error: " + error.message);
                }
            } else {
                alert('Please select a file first.');
            }
        }
        return;
    }

    // --- GEMINI LOGIC (Existing) ---
    const session = await getChatSession();
    if (!session) {
        addMessage('bot', 'Error: Gemini API Key is required to chat.');
        return;
    }

    if (currentInputType === 'text') {
        const message = textInput.value.trim();
        if (message) {
            addMessage('user', message);
            textInput.value = '';

            try {
                addMessage('bot', 'Thinking...');
                const result = await session.sendMessage(message);
                messagesContainer.lastElementChild.remove();
                await handleResponse(result, session);
            } catch (error) {
                if (messagesContainer.lastElementChild.textContent.includes('Thinking')) {
                    messagesContainer.lastElementChild.remove();
                }
                addMessage('bot', "Error: " + error.message);
            }
        }
    } else if (currentInputType === 'file') {
        if (selectedFile) {
            addMessage('user', `Uploaded File: ${selectedFile.name}`);

            try {
                addMessage('bot', 'Reading and analyzing file...');
                const content = await readFileContent(selectedFile);
                const prompt = `I have uploaded a file named "${selectedFile.name}". \n\nContent:\n${content}\n\nPlease analyze this content or confirm you received it.`;

                const result = await session.sendMessage(prompt);
                messagesContainer.lastElementChild.remove();
                await handleResponse(result, session);

                selectedFile = null;
                fileFileName.textContent = '';
                fileInput.value = '';
            } catch (error) {
                if (messagesContainer.lastElementChild.textContent.includes('Reading')) {
                    messagesContainer.lastElementChild.remove();
                }
                addMessage('bot', "Error processing file: " + error.message);
            }
        } else {
            alert('Please select a file first.');
        }
    }
});

// Clear messages
clearBtn.addEventListener('click', () => {
    messagesContainer.innerHTML = '';
    resetSessions();
});

// Enter key to send (for text input)
textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

function addMessage(sender, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
