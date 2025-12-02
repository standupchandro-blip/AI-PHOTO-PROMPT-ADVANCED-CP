// --- REQUIRED DEPENDENCIES ---
// You must run 'npm install express node-fetch cors' in your terminal before running this script.
const express = require('express');
const nodeFetch = require('node-fetch');
// Fix for Node.js versions where 'fetch' is accessed via default export
const fetch = nodeFetch.default || nodeFetch; 
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Enable CORS for all requests. This is what allows index.html to talk to localhost:3000.
app.use(cors());

// --- CRITICAL CONFIGURATION ---
// The API Key will be securely loaded from Vercel's environment variables.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
// ^^^ PASTE YOUR KEY INSIDE THESE QUOTES ^^^

const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;


// --- API Endpoint ---
app.post('/api/enhance-prompt', async (req, res) => {
    
    // 1. Basic Validation
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_API_KEY_HERE") {
        return res.status(500).json({ success: false, error: "API Key is missing or default. Please configure proxy.js." });
    }

    if (!req.body || !req.body.userPrompt) {
        return res.status(400).json({ success: false, error: "Missing 'userPrompt' in request body." });
    }

    const userPrompt = req.body.userPrompt;
    console.log("Request received from client.");

    // 2. Construct the full prompt instructions for the AI
    const systemPrompt = `You are an expert AI art prompt engineer. Your task is to take the user's structured base prompt and convert it into a single, cohesive, highly descriptive, and artistic prompt ready for an image generation model.

    RULES:
    - Combine all structured components into one continuous paragraph.
    - Elaborate on the user's inputs, adding rich adjectives, sensory details, and cinematic descriptions.
    - DO NOT include any numbered lists, introductory text (like "Here is your enhanced prompt:"), or labels (like "Subject:").
    - The output must be the final, polished prompt text only.
    - Ensure all quality modifiers are at the very end.
    
    Example Transformation:
    Input: Main Subject: silver dragon | Action: soaring over a stormy sea | Medium: digital painting | Lighting: cinematic volumetric lighting | Composition: rule of thirds | Modifiers: 8k
    Output: A majestic, ancient silver dragon, scales catching the dramatic volumetric lighting, soaring with powerful wings over a turbulent, stormy sea. The composition adheres to the rule of thirds, emphasizing the scale and drama. Highly detailed, fantasy art, digital painting, 8k, smooth, trending on ArtStation.
    `;

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    // 3. Call the Gemini API with exponential backoff
    let attempts = 0;
    const maxAttempts = 3;
    let apiResponse;
    let lastError;

    while (attempts < maxAttempts) {
        try {
            if (attempts > 0) {
                const delay = Math.pow(2, attempts) * 1000 + Math.random() * 500;
                await new Promise(resolve => setTimeout(resolve, delay));
                console.log(`Retrying API call (Attempt ${attempts + 1})...`);
            }
            
            console.log("Calling Gemini API...");
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                apiResponse = await response.json();
                break; // Exit loop on success
            } else {
                lastError = `API call failed with status ${response.status}.`;
                console.error(lastError);
                // For non-retryable errors (e.g., 400, 403), stop
                if (response.status < 500 && response.status !== 429) { 
                     // Fetch response body for better error context
                    const errorBody = await response.json().catch(() => ({}));
                    console.error("API Error Details:", errorBody);
                    return res.status(response.status).json({ success: false, error: `${lastError} Check your API key or payload.` });
                }
            }
        } catch (error) {
            lastError = `Network or request error: ${error.message}`;
            console.error(lastError);
        }
        attempts++;
    }

    if (!apiResponse) {
        return res.status(500).json({ success: false, error: `Failed to get a response from Gemini after ${maxAttempts} attempts. Last error: ${lastError}` });
    }

    // 4. Extract and send the generated text
    const enhancedPrompt = apiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

    if (enhancedPrompt) {
        console.log("Response successful. Sending enhanced prompt back to client.");
        res.json({ 
            success: true, 
            enhancedPrompt: enhancedPrompt
        });
    } else {
        console.error("API response was valid but contained no text candidate.");
        res.status(500).json({ 
            success: false, 
            error: "AI did not return a valid prompt. Check API response structure." 
        });
    }
});


// --- Start Server Listener ---
app.listen(port, () => {
    console.log(`\n🛡️ Backend Proxy Server running at http://localhost:${port}`);
    console.log("Waiting for requests from index.html...");
});

