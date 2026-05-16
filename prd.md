# Complete Product Requirement Document (PRD)

## Project Title  
**ScamShield AI – Intelligent Elderly Protection for Online Banking**

## Version  
4.0 – Final for ElectroHack 2.0 (Assistive Technology Track)

---

## 1. Executive Summary

**ScamShield AI** is an intelligent security module embedded inside a bank’s online banking web interface. It protects elderly customers by analysing **four risk factors** in real time using a **knowledge‑based AI** (rules + optional ML):

1. **Recipient bank account** – checked against a pre‑loaded list of suspicious accounts (the “AI knowledge base”).
2. **Transaction amount** – if > RM 500, triggers a warning.
3. **Transaction frequency** – if too many transfers in a short period, flags as suspicious.
4. **Remark text** – detects scam‑related keywords (e.g., “lottery”, “prize”, “urgent”, “investment”).

When **any** of these factors is suspicious, the system:

- **Blocks** the transaction immediately.
- **Shows a clear warning** to the elderly user.
- **Notifies a pre‑registered trusted person** (e.g., a child) via simulated SMS.
- **If no response within a configurable timeout** (10 seconds for demo, 10 minutes in reality), **redirects the user to call 997** – the National Scam Response Centre (NSRC) of Malaysia.

All detection rules are stored in a single **JSON configuration file** (`scam_rules.json`), which acts as the AI’s “system prompt” or knowledge base. This file is read on every transaction, making the system transparent, easy to update, and fully demonstrable.

---

## 2. Problem Statement & Target Audience

### The Problem
- Elderly online banking users are frequently targeted by scams involving **mule accounts**, **large or repeated transfers**, and **urgent‑sounding remarks** (e.g., “lottery winner”, “investment opportunity”).
- Existing bank fraud detection is often **post‑transaction** and does not involve a **family member** in the approval loop.
- Many seniors do not recognise suspicious amounts, frequency patterns, or scam keywords.

### Target Audience
- **Primary:** Elderly bank customers (age 60+) with low digital literacy.
- **Secondary:** Trusted family members (children/relatives) who approve or reject transactions.
- **Tertiary:** National Scam Response Centre (997) as the final fallback.

---

## 3. Scope – In / Out for Hackathon

### ✅ In Scope

| Feature | Description |
|---------|-------------|
| **Bank web demo** | Fully functional prototype with login, dashboard, and transfer form. |
| **AI knowledge base** | A single `scam_rules.json` file containing suspicious accounts, amount threshold, frequency rules, and suspicious keywords. |
| **Suspicious account check** | Compare recipient account number against the `suspicious_accounts` list in the JSON file. |
| **Amount threshold check** | If amount > RM 500 → trigger warning + notify trusted person. |
| **Frequency check** | Track user’s transactions in the last 10 minutes; if > 3 transactions → flag. |
| **Remark keyword check** | Scan remark for keywords from the JSON list (e.g., “lottery”, “prize”, “urgent”). |
| **Block & notify elderly** | Show red warning, disable confirm button. |
| **Trusted person workflow** | Simulated SMS notification, approve/reject buttons, timeout logic. |
| **997 (NSRC) fallback** | After no response, redirect to call 997 (simulated with click‑to‑call or alert). |

### ❌ Out of Scope (explicitly removed per your instruction)

- Browser extension or monitoring other tabs.
- Live SMS gateway (simulated via console/alert).
- Real‑time web scraping from official websites.
- Mobile app – desktop web only.
- URL / website detection.
- Any external JSON databases other than the single `scam_rules.json`.

---

## 4. Functional Requirements – Detection Layers

### FR1 – Suspicious Bank Account Detection (AI Knowledge Base)

| ID | Requirement |
|----|-------------|
| FR1.1 | The system loads `scam_rules.json` at startup. This file contains a `"suspicious_accounts"` array. |
| FR1.2 | When the user enters a recipient account number, the system checks if it exists in that array. |
| FR1.3 | If a match is found, the transaction is immediately classified as **HIGH RISK**. |
| FR1.4 | **Action:** Block transaction, show warning, notify elderly, trigger trusted person workflow (FR5). |

> *Note: For hackathon simplicity, this is a direct lookup. In a production system, this could be replaced by an ML model that learns scam patterns. The JSON file acts as the “AI memory”.*

### FR2 – Transaction Amount Check (Rule‑Based)

| ID | Requirement |
|----|-------------|
| FR2.1 | Read `"amount_threshold"` from `scam_rules.json` (default: 500). |
| FR2.2 | If `amount > threshold`, flag as **AMOUNT_ALERT**. |
| FR2.3 | **Action:** Show warning *“This amount is higher than usual. We will notify your child.”* Do not block automatically – wait for trusted person approval. |

### FR3 – Transaction Frequency Check (Rule‑Based)

| ID | Requirement |
|----|-------------|
| FR3.1 | Read `"max_transactions"` and `"time_window_minutes"` from `scam_rules.json`. |
| FR3.2 | Track the user’s transactions in the current session (or last N minutes). |
| FR3.3 | If the number of transactions exceeds `max_transactions` within the time window, flag as **FREQUENCY_ALERT**. |
| FR3.4 | **Action:** Same as amount – warning + notify trusted person. |

### FR4 – Suspicious Remark Detection (Rule‑Based)

| ID | Requirement |
|----|-------------|
| FR4.1 | Read `"suspicious_keywords"` array from `scam_rules.json` (e.g., `["lottery", "prize", "urgent", "investment", "verify"]`). |
| FR4.2 | If the remark text (case‑insensitive) contains any of these keywords, flag as **REMARK_ALERT**. |
| FR4.3 | **Action:** Warning + notify trusted person. |

### FR5 – Unified Response & Trusted Person Workflow

| ID | Requirement |
|----|-------------|
| FR5.1 | If **any** of FR1–FR4 triggers an alert, the transaction enters **PENDING** state and is blocked. |
| FR5.2 | Elderly user sees a clear message: *“Suspicious activity detected. Your trusted person has been notified.”* |
| FR5.3 | System sends a **simulated SMS** to the trusted person (displayed on screen or console):<br> *“Your parent [Name] is trying to transfer RM [amount] to [account]. Reason: [account scam / high amount / too frequent / suspicious remark]. Reply APPROVE or REJECT.”* |
| FR5.4 | A simple demo page (or buttons on the same page) allows the trusted person to click **Approve** or **Reject**. |
| FR5.5 | If **Approve** → transaction released, funds transferred. |
| FR5.6 | If **Reject** → transaction permanently blocked, elderly user notified: *“Your child has rejected this transaction.”* |
| FR5.7 | If **no response** within the timeout defined in `scam_rules.json` (`"timeout_seconds"`, default 10 seconds for demo) → proceed to FR6. |

### FR6 – 997 National Scam Response Centre Fallback

| ID | Requirement |
|----|-------------|
| FR6.1 | After timeout with no response, display: *“No response from your trusted person. Redirecting to National Scam Response Centre – 997. Please call immediately.”* |
| FR6.2 | Provide a button: **“Call 997 now”** which simulates a call (`tel:997` on mobile, or shows the number on desktop). |
| FR6.3 | Transaction remains blocked. The NSRC operator would manually verify (outside demo scope). |

---

## 5. The AI Knowledge Base – `scam_rules.json`

This single file is the **brain** of the system. It can be edited without changing code.

### File Structure

```json
{
  "suspicious_accounts": [
    "1234567890",
    "9876543210",
    "5555555555",
    "1111222233",
    "4444555566"
  ],
  "amount_threshold": 500,
  "frequency": {
    "max_transactions": 3,
    "time_window_minutes": 10
  },
  "suspicious_keywords": [
    "lottery", "prize", "winner", "urgent", "investment",
    "verify", "account update", "security alert", "inheritance",
    "gov", "refund", "tax"
  ],
  "response": {
    "timeout_seconds": 10,
    "fallback_number": "997"
  }
}
```

### How It Is Used

- The system **loads this file at startup** (or on each request for simplicity).
- Every transaction is evaluated against the rules in this file.
- You can **update the file** during the hackathon to show judges how easy it is to add new scam accounts or keywords.

> *This is exactly like a **system prompt** for an AI – a set of instructions and data that the AI reads before making a decision.*

---

## 6. User Flow Diagram

```mermaid
graph TD
    A[Elderly user initiates transfer] --> B[Load scam_rules.json]
    B --> C{Check recipient account}
    C -->|In suspicious_accounts| D[BLOCK + Notify + Trusted person]
    C -->|Not in list| E{Check amount > threshold?}
    E -->|Yes| D
    E -->|No| F{Check frequency > limit?}
    F -->|Yes| D
    F -->|No| G{Check remark for keywords?}
    G -->|Yes| D
    G -->|No| H[Allow transfer]

    D --> I[Simulated SMS to trusted person]
    I --> J{Response?}
    J -->|Approve| K[Unblock transfer]
    J -->|Reject| L[Block permanently + notify user]
    J -->|No response (timeout)| M[Redirect to 997 (NSRC)]
```

---

## 7. Technical Stack (Hackathon Recommended)

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | Bank UI, transfer form, warning modals, approve/reject buttons |
| **Backend** |  Node.js| API endpoints: `/transfer`, `/check-rules`, `/approve`, `/reject` |
| **AI / Rules Engine** | Python (JSON loader + condition checks) | Reads `scam_rules.json`, evaluates each transaction |
| **Session tracking** | Flask session or in‑memory dict | Track transaction count and timestamps for frequency check |
| **SMS simulation** | Console log + in‑app notification panel | Judges can see the simulated message |
| **997 fallback** | `window.location.href = "tel:997"` | Opens dialer on mobile, shows number on desktop |
| **Version control** | GitHub | Required for submission |

---

## 8. Demo Script for Judges (5 minutes)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as elderly user “Ahmad” (trusted person: “Siti”). | Dashboard shown. |
| 2 | Attempt transfer to account `5555555555` (in `suspicious_accounts` list). | **Blocked immediately** → warning: “This account is flagged as suspicious.” Simulated SMS to Siti appears. |
| 3 | Siti clicks **Reject**. | Transaction blocked permanently. Ahmad sees “Your child rejected this.” |
| 4 | Second transfer: amount **RM 1000** (>500), safe account. | Warning: “Amount higher than usual. Notifying Siti.” Siti approves → transfer goes through. |
| 5 | Third transfer: make 4 transfers in 8 minutes. | Frequency alert triggered, same workflow. |
| 6 | Fourth transfer: remark contains “lottery prize”. | Remark alert triggered, workflow again. |
| 7 | Simulate no response from Siti (wait 10 seconds timeout). | Redirect to **997** call button appears. Click it → shows “Call 997” (simulated). |
| 8 | Show `scam_rules.json` file on screen. | Judges see how easily rules can be updated (add new account, change threshold). |

---

## 9. Judging Criteria Alignment

| Criterion (Max Points) | How ScamShield AI Addresses It |
|------------------------|--------------------------------|
| **IDEA (15)** | Novel combination: knowledge‑based AI + family approval + 997 escalation. Uses a single editable JSON file as the AI’s “brain”. |
| **DESIGN (15)** | Elderly‑friendly: large buttons, simple warning messages, colour‑coded risk indicators. |
| **PRESENTATION (10)** | Demo script covers all four detection layers (account, amount, frequency, remark) and the full response flow (block → notify → approve/reject → 997). |
| **TECHNICALITY (50)** | Clean code, JSON‑driven rules engine, session‑based frequency tracking, simulated SMS and call, full documentation. |
| **COMMERCIALITY (10)** | Directly addresses elderly banking fraud in Malaysia. Unique differentiator: real‑time family approval + automatic escalation to NSRC (997). |

---

## 10. Deliverables for Submission

1. **GitHub repository** containing:
   - Complete source code (frontend + backend)
   - `scam_rules.json` (with realistic sample data)
   - `README.md` – setup instructions, how to run, demo steps
2. **Demo video** (max 3 minutes) showing the 8 steps from Section 8.
3. **Presentation slides** (PDF) – problem, solution architecture, the JSON knowledge base, response workflow, impact.

---

## 11. Risks & Mitigation

| Risk | Probability | Mitigation |
|------|-------------|-------------|
| Timeout (10 seconds) too short for realistic demo | Low | State clearly that it’s compressed for judging; real system would use 10 minutes. |
| Frequency tracking resets on page refresh | Medium | Use backend session (Flask session) or localStorage to persist counts. For demo, keep browser tab open. |
| No real SMS gateway | Low | Simulate with on‑screen alerts – judges accept for prototype. |
| Suspicious accounts list is static | Low | Show how to edit `scam_rules.json` live – no restart needed. |
| Judges ask “Where is the AI?” | Low | Explain: the JSON file is the AI’s knowledge base; the system reads it like a system prompt. It can be upgraded to an ML model later. |

---

## 12. Team & Timeline (3 Days)

| Day | Focus | Deliverable |
|-----|-------|-------------|
| **Fri (evening)** | Write `scam_rules.json` with sample data. Set up Flask backend skeleton. | JSON file, basic API endpoints. |
| **Sat** | Build frontend (bank UI, transfer form, warning modals). Implement rule‑checking logic and frequency tracking. | Working detection + block. |
| **Sun (morning)** | Add trusted person approve/reject buttons, timeout logic, 997 fallback. Test all 8 demo steps. | Complete prototype. |
| **Sun (afternoon)** | Record demo video, prepare slides, push to GitHub. | Final submission. |

---

## 13. Conclusion

ScamShield AI delivers a **simple, transparent, yet powerful** protection system for elderly bank users. By using a single **JSON knowledge base** (`scam_rules.json`) that acts as the AI’s system prompt, the system checks:

- Suspicious accounts
- Large amounts (> RM 500)
- Unusual frequency (> 3 transactions in 10 minutes)
- Scam‑related keywords (e.g., “lottery”)

On any alert, it **blocks**, **notifies a trusted family member**, and **escalates to 997 (NSRC)** if no response. The solution is fully demonstrable, aligns with every judging criterion, and directly addresses the **Assistive Technology** challenge of ElectroHack 2.0.

---

**Prepared by:** [Your Team Name]  
**Date:** May 2026  
**For:** ElectroHack 2.0 – SENSE‑AI: Inclusion in Motion