const fs = require('fs');
const path = require('path');

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

function loadScamRules() {
    const rulesPath = path.join(__dirname, '../data/scam_rules.json');
    try {
        const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
        return rules;
    } catch (error) {
        console.error('Error loading scam rules:', error);
        return null;
    }
}

module.exports = { loadSystemPrompt, loadScamRules };