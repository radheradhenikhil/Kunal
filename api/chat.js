/**
 * Vercel Serverless Function (Node.js)
 * This function acts as a secure "middle-man" or "proxy".
 * 1. It receives the `chatHistory` and `systemPrompt` from our front-end (`index.html`).
 * 2. It secretly and securely reads the `GEMINI_API_KEY` from Vercel's Environment Variables.
 * 3. It makes the *actual* call to the Google Gemini API.
 * 4. It sends the response (or error) back to the front-end.
 *
 * The user's browser (client) NEVER sees the API key.
 */
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Get the secret API key from Vercel's environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key is not configured on the server.' });
    }

    try {
        const { chatHistory, systemPrompt } = req.body;

        if (!chatHistory || !systemPrompt) {
            return res.status(400).json({ error: 'Missing chatHistory or systemPrompt in request body.' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        const payload = {
            contents: chatHistory,
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            ]
        };

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            throw new Error(`API Error ${apiResponse.status}: ${errorData.error?.message || apiResponse.statusText}`);
        }

        const result = await apiResponse.json();

        if (result.candidates && result.candidates.length > 0) {
            const modelResponse = result.candidates[0].content.parts[0].text;
            // Send the clean text response back to the browser
            res.status(200).json({ text: modelResponse });
        } else if (result.promptFeedback) {
            const blockReason = result.promptFeedback.blockReason;
            res.status(200).json({ error: `Request blocked (Reason: ${blockReason})` });
        } else {
            res.status(200).json({ error: 'Received an empty response from API.' });
        }

    } catch (error) {
        console.error('Error in serverless function:', error);
        res.status(500).json({ error: `Server error: ${error.message}` });
    }
}
