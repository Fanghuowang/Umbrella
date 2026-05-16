## Umbrella

## AI-Powered Elderly Protection for Online Banking

**Umbrella** is an intelligent security layer embedded inside a bank’s online banking web interface. It protects elderly customers from financial scams by analysing transactions in real time and involving a trusted family member when suspicious activity is detected.

If no response is received from the trusted person within **20 seconds**, the system automatically escalates to the **National Scam Response Centre (997)** with a simulated iPhone‑style call interface, where an operator can approve or block the transaction.

---

## Problem Statement

Elderly bank customers are frequently targeted by scams involving:
- Mule accounts (flagged by PDRM SemakMule)
- Large or repeated transfers to the same account
- Urgent or emotional language in transaction remarks

Existing bank fraud detection is **reactive** (after money is sent) and lacks **family‑in‑the‑loop** intervention. Umbrella solves this by combining **real‑time AI analysis**, **family approval**, and **automatic escalation to 997**.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **AI Detection** | Uses NVIDIA Llama 3.3 70B via free API to analyse transactions |
| **Suspicious Account Blacklist** | Blocks transfers to known mule accounts (from PDRM SemakMule) |
| **Amount Alert** | Flags transactions > RM 500 |
| **Frequency Check** | Alerts on ≥3 transfers to the same account within 1 hour |
| **Keyword Detection** | Scans remarks for scam‑related words (lottery, urgent, prize, etc.) |
| **Family Approval** | Notifies trusted person in a separate tab with full details |
| **20‑Second Timeout** | If no response, automatically escalates to 997 |
| **997 Call Simulation** | iPhone‑style incoming call interface with NSRC operator decision |
| **Transaction Blocking** | Blocks suspicious transfers and notifies both elderly and trusted person |
| **Transaction History** | Complete audit log with status (completed, approved, rejected, blocked) |
| **Responsive Design** | Works on desktop and mobile, with a warm, calm, elderly‑friendly UI |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (no framework) |
| **Backend** | Node.js, Express |
| **AI** | NVIDIA NIM API (Llama 3.3 70B Instruct) |
| **Database** | JSON files (portable, no external DB) |
| **Deployment** | Localhost (hackathon prototype) |

---

## Installation & Setup

### Prerequisites
- **Node.js** (v18 or higher)
- **NVIDIA API key** (free from [build.nvidia.com](https://build.nvidia.com))

### Steps

1. **Clone the repository**
   git clone https://github.com/Fanghuowang/Umbrella.git
   cd Umbrella/backend

2. **Install dependencies**
   npm install

3. **Create a `.env` file** in the `backend/` folder with the following content:
   ```env
   AI_API_KEY=nvapi-your_nvidia_api_key_here
   AI_MODEL=meta/llama-3.3-70b-instruct
   NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
   PORT=3000
   ```

4. **Start the server**
   npm start

5. **Open your browser** to `http://localhost:3000`

> **Note:** Any username/password works for the demo. The backend uses a fixed user (`user1`) with an initial balance of RM 10,000.

---

##  Demo Scenarios
| 1 | **Safe transfer** – RM 50, remark "groceries", normal account | ALLOW – balance deducted, success modal |
| 2 | **Suspicious account** – transfer to `512802774281` | BLOCK – immediate block + notification |
| 3 | **High amount** – RM 1000, normal account | WARN – trusted person tab opens, 20‑second countdown |
| 4 | **Suspicious remark** – "lottery winner" | WARN – same approval flow |
| 5 | **Frequency** – 4 transfers to same account in 1 hour | WARN on 4th attempt |
| 6 | **Trusted person approves** | Transaction completes, balance deducted |
| 7 | **Trusted person rejects** | Rejection modal with extra message to contact elderly |
| 8 | **No response (20 seconds)** | 997 call simulation opens in new tab – NSRC can approve/reject |
| 9 | **NSRC rejects** | Transaction blocked, elderly sees rejection reason |
| 10 | **Insufficient balance** | Error message |

---

##  How the AI Works

Umbrella sends the **system prompt** (from `backend/data/system_prompt.txt`) along with transaction details to the NVIDIA Llama 3.3 model. The prompt instructs the AI to evaluate the transaction in this order:

1. **Account check** → `BLOCK` if recipient is in suspicious accounts list
2. **Amount check** → `WARN` if > RM 500
3. **Frequency check** → `WARN` if ≥3 transfers to same account in 1 hour
4. **Remark check** → `WARN` if keyword matches (lottery, urgent, prize, etc.)
5. **All clear** → `ALLOW`

The AI returns a JSON object: `{"decision": "BLOCK/WARN/ALLOW", "reason": "...", "notify_child": true/false}`. The backend then executes the appropriate flow.


