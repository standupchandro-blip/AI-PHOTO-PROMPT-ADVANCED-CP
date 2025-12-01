// 1. Install Dependencies: Run 'npm install express cors node-fetch' in your terminal
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Used to make API calls from the server
const app = express();
const port = 3000; // The port the server will run on

// **IMPORTANT SECURITY NOTE:** // In a real application, you would load this key from a secure environment variable (e.g., process.env.GEMINI_API_KEY).
// For this tutorial, we are placing it directly for demonstration, but you MUST change the line below.
// The key should NOT be committed to version control like Git.
const GEMINI_API_KEY = AIzaSyBuBkAKCSl59wvRr-9vS_8OiWL5kc33yXw; // <<< PASTE YOUR KEY HERE

// --- Server Setup ---

// Enable CORS (Cross-Origin Resource Sharing) to allow your HTML app (which runs on a different port/origin) to talk to this server.
app.use(cors());

// Use express.json() to parse incoming JSON request bodies (like the prompt text from your app).
app.use(express.json());

// --- The Secure API Endpoint ---

// This is the URL your client-side app will call: http://localhost:3000/api/enhance-prompt
app.post('/api/enhance-prompt', async (req, res) => {
    console.log('Request received for prompt enhancement.');

    const userPrompt = req.body.userPrompt;
    if (!userPrompt) {
        return res.status(400).json({ error: 'Missing userPrompt in request body.' });
    }

    // Define the Gemini model and endpoint
    const MODEL = "gemini-2.5-flash-preview-09-2025";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    // Define the System Instruction for the model
    const systemPrompt = "You must only respond with the single, enhanced, comma-separated string, ready to be used as a prompt. Do not include any other text, labels, or explanations. Just the final prompt string.";

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    // --- Making the Secure Call to Google ---
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        // Check if the response is valid and extract the text
        const candidate = result.candidates?.[0];
        if (candidate && candidate.content?.parts?.[0]?.text) {
            const enhancedText = candidate.content.parts[0].text.trim();
            
            // Send ONLY the generated text back to the client, NOT the API key or raw API response!
            res.json({ success: true, enhancedPrompt: enhancedText });
        } else {
            console.error("Gemini API returned an invalid structure:", result);
            res.status(500).json({ success: false, error: 'AI processing failed or returned no text.' });
        }

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ success: false, error: 'Internal server error during API call.' });
    }
});

// --- Start the Server ---
app.listen(port, () => {
    console.log(`\n\n🛡️ Backend Proxy Server running at http://localhost:${port}`);
    console.log(`Client App should call: http://localhost:${port}/api/enhance-prompt\n`);
});

