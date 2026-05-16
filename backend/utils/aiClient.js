const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: "https://integrate.api.nvidia.com/v1"
});

function loadSystemPrompt() {
    const promptPath = path.join(__dirname, '../data/system_prompt.txt');
    try {
        const prompt = fs.readFileSync(promptPath, 'utf8');
        return prompt;
    } catch (error) {
        console.error('Error loading system prompt:', error);
        return `You are a bank security AI. Analyse transactions and return JSON with decision (ALLOW/WARN/BLOCK), reason, and notify_child.`;
    }
}

function cleanAIResponse(content) {
    let cleaned = content.replace(/```json\s*/g, '');
    cleaned = cleaned.replace(/```\s*/g, '');
    cleaned = cleaned.trim();
    return cleaned;
}

async function callAIDetection(transactionData) {
    const userMessage = JSON.stringify({
        recipient_account: transactionData.recipient_account,
        amount: transactionData.amount,
        remark: transactionData.remark,
        transaction_count_last_10min: transactionData.frequencyCount
    });

    const systemPrompt = loadSystemPrompt();

    console.log("Sending to AI:", userMessage);

    try {
        const response = await openai.chat.completions.create({
            model: process.env.AI_MODEL || "meta/llama-3.3-70b-instruct",
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.1,
            max_tokens: 200
        });

        let rawContent = response.choices[0].message.content;
        console.log("Raw AI Response:", rawContent);

        const cleanedContent = cleanAIResponse(rawContent);
        console.log("Cleaned Response:", cleanedContent);

        const aiOutput = JSON.parse(cleanedContent);

        return {
            decision: aiOutput.decision,
            reason: aiOutput.reason,
            notify_child: aiOutput.notify_child === true
        };
    } catch (error) {
        console.error('AI API error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
        return {
            decision: 'WARN',
            reason: 'AI service temporarily unavailable. Transaction held for review.',
            notify_child: true
        };
    }
}

module.exports = { callAIDetection };