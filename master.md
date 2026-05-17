# UMBRELLA – Complete Development Plan (with LLM Integration)

## Tech Stack Confirmed
- **Frontend:** HTML, CSS, JavaScript (vanilla)
- **Backend:** Node.js + Express
- **Database:** JSON files (users, transactions, scam_rules)
- **AI Integration:** External LLM API (e.g., OpenAI GPT-3.5/4 or Gemini) – using your API key

---

## Project Structure

```
Electrohack code/
│
├── master.md                    
├── prd.md                      
├── system prompt.md             
│
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── .env
│   │
│   ├── routes/
│   │   ├── transactions.js
│   │   └── approval.js
│   │
│   ├── utils/
│   │   ├── aiClient.js
│   │   ├── sessionTracker.js
│   │   └── scamRulesLoader.js
│   │
│   └── data/
│       ├── scam_rules.json
│       ├── users.json
│       ├── transactions.json
│       └── system_prompt.txt
│
└── frontend/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

---

## Phase 1: Project Setup & Backend Foundation (Day 1 – 3 hours)

### Task 1.1: Initialize Node.js Project
```bash
mkdir scamshield-ai && cd scamshield-ai/backend
npm init -y
npm install express cors dotenv body-parser
npm install openai   # or @google/generative-ai if using Gemini
npm install --save-dev nodemon
```

Create `.env` file:
```
AI_API_KEY=your_api_key_here
AI_MODEL=gpt-3.5-turbo   # or gemini-pro
```

### Task 1.2: Create JSON Data Files
- **`data/scam_rules.json`** – knowledge base that will be injected into system prompt
  ```json
  {
    "suspicious_accounts": ["1234567890","9876543210","5555555555"],
    "amount_threshold": 500,
    "frequency": { "max_transactions": 3, "time_window_minutes": 10 },
    "suspicious_keywords": ["lottery","prize","urgent","investment","verify","inheritance"],
    "response": { "timeout_seconds": 10, "fallback_number": "997" }
  }
  ```
- **`data/users.json`** – one elderly user + trusted person (for demo)
- **`data/transactions.json`** – empty array initially

### Task 1.3: Create System Prompt File (`data/system_prompt.txt`)
Copy the **complete system prompt** from my previous answer into this file. It instructs the AI to use the rules (accounts, amount, keywords, frequency) and output JSON with `decision`, `reason`, `notify_child`.

### Task 1.4: Build Utility Modules

**`utils/scamRulesLoader.js`** – reads `scam_rules.json` and `system_prompt.txt`
```javascript
const fs = require('fs');
const path = require('path');

function loadSystemPrompt() {
  const promptPath = path.join(__dirname, '../data/system_prompt.txt');
  let prompt = fs.readFileSync(promptPath, 'utf8');
  // Optionally inject current rules into prompt (or rely on prompt already containing them)
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/scam_rules.json'), 'utf8'));
  // Replace placeholders in prompt with actual rules (or simply keep prompt static)
  return prompt;
}
module.exports = { loadSystemPrompt };
```

**`utils/sessionTracker.js`** – same as before, tracks transaction frequency in memory.

**`utils/aiClient.js`** – centralised function to call LLM API:
```javascript
const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.AI_API_KEY });

async function callAIDetection(transactionData, systemPrompt) {
  const userPrompt = JSON.stringify({
    recipient_account: transactionData.recipient_account,
    amount: transactionData.amount,
    remark: transactionData.remark,
    transaction_count_last_10min: transactionData.frequencyCount
  });

  const response = await openai.chat.completions.create({
    model: process.env.AI_MODEL || 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    response_format: { type: "json_object" }  // if supported
  });

  const aiOutput = JSON.parse(response.choices[0].message.content);
  return aiOutput; // { decision, reason, notify_child }
}
module.exports = { callAIDetection };
```

### Task 1.5: Create Basic Express Server (`server.js`)
- Load environment variables  
- Serve static files from `public/`
- Mount routes: `/api/transactions`, `/api/approval`

---

## Phase 2: Frontend – Elderly User Interface (Day 1 – 3 hours)

### Task 2.1: Build HTML (`public/index.html`)
- Login dropdown (select user)
- Dashboard with dummy balance (RM 10,000)
- Transfer form: recipient account (text), amount (number), remark (text)
- Area to display AI decision, warning messages
- “Approve” and “Reject” buttons (for simulating trusted person response)

### Task 2.2: CSS (`public/css/style.css`)
- Elderly-friendly: large font, high contrast, big buttons
- Status colours: green (safe), orange (warning), red (blocked)

### Task 2.3: Frontend JavaScript (`public/js/app.js`)
- On form submit: collect data, call `POST /api/initiate-transfer`
- Show loading indicator
- On response:
  - If `decision === "ALLOW"` → show success, clear form
  - If `decision === "BLOCK"` or `"WARN"` → display warning, store `transactionId`, start polling `GET /api/transaction-status/:id` every 1 second
  - Display simulated SMS: “SMS sent to trusted person: …”
- When user clicks **Approve** or **Reject** (simulating trusted person), send `POST /api/approve/:id` or `/api/reject/:id`
- If status becomes `"ESCALATED"` (timeout), show “Call 997” button that triggers `window.location.href = "tel:997"`

---

## Phase 3: Backend – AI Detection & Approval Flow (Day 2 – 5 hours)

### Task 3.1: Create Routes (`routes/transactions.js`)
- **`POST /api/initiate-transfer`**
  - Receive `{ userId, recipient_account, amount, remark }`
  - Get current frequency count from `sessionTracker`
  - Prepare transaction data object
  - Load system prompt (from file)
  - Call `aiClient.callAIDetection()` with transaction data + system prompt
  - Parse AI output (expected fields: `decision`, `reason`, `notify_child`)
  - If `decision === "ALLOW"`:
    - Store completed transaction in `transactions.json` and user history
    - Return `{ success: true, decision: "ALLOW" }`
  - Else (`BLOCK` or `WARN`):
    - Create a pending transaction object with unique ID, store in `transactions.json` with status `PENDING`, AI reason, timestamp
    - Set a timeout (10 seconds) to escalate (function that changes status to `ESCALATED` if still pending)
    - Return `{ success: false, decision, reason, transactionId }`

### Task 3.2: Approval Routes (`routes/approval.js`)
- **`POST /api/approve/:txnId`** – find pending transaction, set status to `APPROVED`, clear timeout, record as completed, return success
- **`POST /api/reject/:txnId`** – set status to `REJECTED`, clear timeout, return success
- **`GET /api/transaction-status/:txnId`** – return current status and any additional info (for frontend polling)

### Task 3.3: Timeout & 997 Escalation
- When creating a pending transaction, use `setTimeout` with duration from `scam_rules.json` (10 seconds). The callback checks if status still `PENDING`, then updates to `ESCALATED`.

### Task 3.4: Session Tracking (Same as before)
- `utils/sessionTracker.js` – add timestamp on each transaction initiation, compute count in last 10 minutes.

---

## Phase 4: Integration & Testing (Day 2 – 2 hours)

### Task 4.1: End-to-End AI Calls
- Ensure API key works and calls return valid JSON.
- Test edge cases (malformed AI output – add fallback to rule-based logic).

### Task 4.2: Simulate Trusted Person Responses
- On frontend, after a transaction is blocked/warned, show the **Approve** and **Reject** buttons. They call the approval endpoints.
- Update UI accordingly.

### Task 4.3: Test All Demo Scenarios
1. Scam account → AI returns `BLOCK` → frontend shows block, buttons appear → child rejects → status `REJECTED`.
2. High amount (RM 1000) → AI returns `WARN` → buttons appear → child approves → status `APPROVED`.
3. Frequency – user makes 4 transfers in 8 minutes → AI (with frequency count) returns `WARN` → no response → timeout → frontend shows 997 button.
4. Suspicious remark “lottery” → AI returns `WARN`.
5. Safe transaction → `ALLOW` directly.

---

## Phase 5: Polishing & Demo Mode (Day 3 – 3 hours)

### Task 5.1: Admin Panel (for judges)
- Add a hidden or simple page that displays current `scam_rules.json` content and allows editing (show how easily rules can be updated).
- Provide a “Reset Demo” button to clear frequency tracker and pending transactions.

### Task 5.2: Error Handling & Logging
- If AI API fails (network, quota), fallback to a local rule-based engine (copy of logic from system prompt) to keep demo alive.
- Log errors to console.

### Task 5.3: UI Improvements
- Add loading spinners during AI call.
- Display the AI’s `reason` in a user-friendly way.

---

## Phase 6: Documentation & Submission (Day 3 – 2 hours)

### Task 6.1: Write README.md
- Setup instructions (install, create `.env`, add API key)
- How to run: `node server.js`
- Demo steps (matching the script)
- Explanation of AI integration (system prompt, LLM call)

### Task 6.2: Record Demo Video (3 minutes)
- Show the entire flow: safe transfer, scam account block + child reject, high amount + child approve, frequency + timeout + 997.

### Task 6.3: Prepare Slides
- Problem, solution, architecture, AI system prompt, demo screenshots.

---

## Summary Table – Task Breakdown

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 1 | Node.js setup, JSON files, system prompt, AI client, basic server | 3 hours |
| 2 | Frontend HTML/CSS/JS (elderly UI) | 3 hours |
| 3 | Backend routes, AI integration, approval flow, timeout logic | 5 hours |
| 4 | End-to-end testing, scenario validation | 2 hours |
| 5 | Polish, admin panel, error handling | 3 hours |
| 6 | Documentation, video, slides | 2 hours |
| **Total** | | **18 hours** |

---

## Critical Note – AI API Key

- You will provide the API key later. **Do not hardcode** – use `.env` file.
- Make sure your OpenAI/Gemini account has credits.
- For the hackathon, you can use a **local LLM** (e.g., Ollama with llama3) if internet is unreliable, but external API is fine.

---

## How to Present the AI Integration to Judges

> *“Our system calls an external AI model (GPT-3.5) with a custom system prompt that contains all the scam detection rules. The AI analyses the transaction and returns a decision – ALLOW, WARN, or BLOCK. This is real AI, not hardcoded if‑else.”*

Now you have a complete roadmap. Start with Phase 1 and keep your API key ready. Good luck!