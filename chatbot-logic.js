
// Configuration and State
export const CONFIG = {
    GEMINI_API_KEY: '',
    OPENROUTER_API_KEY: '',
    GROQ_API_KEY: '',
    MODEL_NAME: 'gemini-2.5-flash'
};

let chatHistory = [];
let chatSession = null;
let openRouterHistory = [];
let groqHistory = [];

// --- API & Auth Logic ---

// Function to load API Keys from .env file
export async function loadApiKey() {
    try {
        // Add timestamp to prevent caching
        const response = await fetch(`./.env?t=${new Date().getTime()}`);
        if (!response.ok) {
            console.warn(`Failed to load .env file (Status: ${response.status}). Using manual or prompt keys.`);
            return false;
        }
        const text = await response.text();

        // Helper to extract and clean keys
        const extractKey = (pattern) => {
            const match = text.match(pattern);
            if (match && match[1]) {
                // Remove quotes and whitespace
                return match[1].trim().replace(/['"]/g, '');
            }
            return '';
        };

        const geminiKey = extractKey(/GEMINI_API_KEY\s*=\s*(.*)/);
        if (geminiKey) CONFIG.GEMINI_API_KEY = geminiKey;

        const openRouterKey = extractKey(/OPENROUTER_API_KEY\s*=\s*(.*)/);
        if (openRouterKey) CONFIG.OPENROUTER_API_KEY = openRouterKey;

        const groqKey = extractKey(/GROQ_API_KEY\s*=\s*(.*)/);
        if (groqKey) CONFIG.GROQ_API_KEY = groqKey;

        return true;
    } catch (error) {
        console.warn('Could not auto-load API keys:', error);
        return false;
    }
}

// --- DeepSeek / OpenRouter Logic ---

const STRICT_SYSTEM_PROMPT = `
You are a specialized Car Insurance Assistant.
YOUR ONLY PURPOSE is to help with processing car insurance forms, extracting data, and filling forms.

STRICT RULES:
1. REFUSE to answer any general knowledge questions (e.g., "What is love?", "Who is PM", "Capital of France").
2. REFUSE to provide personal advice, poems, jokes, or code unrelated to this specific project.
3. If a user asks a non-work-related question, your response must be EXACTLY: 
   "I can only assist with Car Insurance Form tasks and file analysis."
4. Do not offer to "help with something else". Just refuse.
5. ONLY analyze text/files given to you for Car Insurance data (Names, Vehicles, Coverage, etc.).
`;

export async function callOpenRouter(message, fileContent = null) {
    if (!CONFIG.OPENROUTER_API_KEY) {
        throw new Error("OpenRouter API Key not found.");
    }

    // Add System Prompt + History + Current User Message
    let content = message;
    if (fileContent) {
        content += `\n\nFile Content:\n${fileContent}`;
    }

    const messages = [
        { role: 'system', content: STRICT_SYSTEM_PROMPT },
        ...openRouterHistory,
        { role: 'user', content: content }
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
            "HTTP-Referer": window.location.href, // Site URL for rankings 
            "X-Title": "Project Hustle Chatbot", // Site title
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "model": "deepseek/deepseek-r1",
            "messages": messages
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'OpenRouter API Error');
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    // Update History
    openRouterHistory.push({ role: 'user', content: content });
    openRouterHistory.push({ role: 'assistant', content: reply });

    return reply;
}

// --- Groq Logic ---

export async function callGroq(message, fileContent = null) {
    if (!CONFIG.GROQ_API_KEY) {
        throw new Error("Groq API Key not found.");
    }

    // Add User Message
    let content = message;
    if (fileContent) {
        content += `\n\nFile Content:\n${fileContent}`;
    }

    const messages = [
        { role: 'system', content: STRICT_SYSTEM_PROMPT },
        ...groqHistory,
        { role: 'user', content: content }
    ];

    // Using Llama-3.3-70b because it's good at instruction following like DeepSeek R1

    // Ensure key is clean
    const cleanKey = CONFIG.GROQ_API_KEY.trim();

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${cleanKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "model": "llama-3.3-70b-versatile",
            "messages": messages
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `Groq Error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    // Update History
    groqHistory.push({ role: 'user', content: content });
    groqHistory.push({ role: 'assistant', content: reply });

    return reply;
}

// --- Tool Definitions & Execution ---

const submitInsuranceApplicationTool = {
    name: "submitInsuranceApplication",
    description: "Accepts a list of car insurance applications and fills/submits the form for each one sequentially.",
    parameters: {
        type: "OBJECT",
        properties: {
            applications: {
                type: "ARRAY",
                description: "List of insurance applications to submit.",
                items: {
                    type: "OBJECT",
                    properties: {
                        firstName: { type: "STRING" },
                        lastName: { type: "STRING" },
                        email: { type: "STRING" },
                        phone: { type: "STRING" },
                        driverFirstName: { type: "STRING" },
                        driverLastName: { type: "STRING" },
                        commute: { type: "STRING", enum: ["Pleasure use only", "Less than 3 miles", "Less than 10 miles", "More than 10 miles"] },
                        parking: { type: "STRING", enum: ["A private garage", "The driveway", "A quiet residential street", "other"] },
                        coverage: { type: "STRING", enum: ["Yes", "No"] },
                        ownership: { type: "STRING", enum: ["Owned", "Leased", "Financed"] },
                        state: { type: "STRING" }
                    },
                    required: ["firstName", "lastName", "email", "phone"]
                }
            }
        },
        required: ["applications"]
    }
};

export async function executeInsuranceSubmission({ applications }) {
    try {
        const firstNameInput = document.getElementById('firstName');
        const lastNameInput = document.getElementById('lastName');
        const emailInput = document.getElementById('email');
        const phoneInput = document.getElementById('phone');
        const driverFirstInput = document.getElementById('driverFirstName');
        const driverLastInput = document.getElementById('driverLastName');
        const stateInput = document.getElementById('state');
        const submitBtn = document.querySelector('#car-insurance-form button[type="submit"]');

        if (!firstNameInput) {
            return "Error: Could not find form elements for insurance form.";
        }

        let results = [];

        for (const app of applications) {
            // Fill Text Fields
            firstNameInput.value = app.firstName || '';
            lastNameInput.value = app.lastName || '';
            if (emailInput) emailInput.value = app.email || '';
            if (phoneInput) phoneInput.value = app.phone || '';
            if (driverFirstInput) driverFirstInput.value = app.driverFirstName || '';
            if (driverLastInput) driverLastInput.value = app.driverLastName || '';
            if (stateInput) stateInput.value = app.state || '';

            // Set Radio Buttons
            const resetRadios = document.querySelectorAll('input[type="radio"]');
            resetRadios.forEach(r => r.checked = false);

            ['commute', 'parking', 'coverage', 'ownership'].forEach(field => {
                if (app[field]) {
                    // Try to match value exactly
                    let radio = document.querySelector(`input[name="${field}"][value="${app[field]}"]`);
                    if (radio) radio.checked = true;
                }
            });

            // Visual Highlight (Green flash)
            firstNameInput.style.backgroundColor = 'rgba(51, 250, 124, 0.4)';
            lastNameInput.style.backgroundColor = 'rgba(51, 250, 124, 0.4)';

            await new Promise(r => setTimeout(r, 600));

            submitBtn.click();
            results.push(`Submitted Insurance Application for: ${app.firstName} ${app.lastName}`);

            await new Promise(r => setTimeout(r, 1500)); // Wait for submit + potential network

            // Clear Highlight
            firstNameInput.style.backgroundColor = '';
            lastNameInput.style.backgroundColor = '';
        }

        return `Successfully processed ${applications.length} applications:\n${results.join('\n')}`;
    } catch (e) {
        return `Error executing submission: ${e.message}`;
    }
}

// --- Gemini AI Logic ---

export async function getChatSession() {
    // Try to load Keys if not set
    if (!CONFIG.GEMINI_API_KEY) {
        await loadApiKey();
    }

    if (!CONFIG.GEMINI_API_KEY) {
        const promptKey = prompt("Gemini API Key missing. Enter key:", "");
        if (promptKey) CONFIG.GEMINI_API_KEY = promptKey;
        else return null;
    }

    if (!chatSession && window.GoogleGenerativeAI) {
        const genAI = new window.GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);

        const systemInstruction = `You are an expert Assistant that processes Car Insurance Application files.
        
        YOUR GOAL:
        1. When a user uploads a file, analyze ALL rows/records.
        2. Extract details: First Name, Last Name, Email, Phone, Driver Name, Commute, Parking, Coverage, Ownership, State.
        3. Create a list of all applications.
        4. CALL the 'submitInsuranceApplication' tool with this list in a single call.
        
        GUIDELINES:
        - Split full names into First and Last names.
        - Map values to match Enum options where possible (e.g. "Garage" -> "A private garage").
        `;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction,
            tools: [
                {
                    functionDeclarations: [submitInsuranceApplicationTool]
                }
            ]
        });

        chatSession = model.startChat({
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: 2000,
            },
        });
    }
    return chatSession;
}

export function resetSessions() {
    chatHistory = [];
    chatSession = null;
    openRouterHistory = [];
    groqHistory = [];
}

// --- Utilities ---

export function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const extension = file.name.split('.').pop().toLowerCase();
        const reader = new FileReader();

        if (extension === 'xls' || extension === 'xlsx') {
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    resolve(JSON.stringify(json, null, 2));
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        }
    });
}
