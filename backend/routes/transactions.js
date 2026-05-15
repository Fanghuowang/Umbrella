const express = require('express');
const router = express.Router();
const { callAIDetection } = require('../utils/aiClient');
const { getTransactionCount, addTransaction } = require('../utils/sessionTracker');
const { loadSystemPrompt } = require('../utils/scamRulesLoader');
const fs = require('fs');
const path = require('path');

const TRANSACTIONS_FILE = path.join(__dirname, '../data/transactions.json');
let pendingTimeouts = {};

// Helper to read/write JSON file
function readTransactions() {
    if (!fs.existsSync(TRANSACTIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8'));
}

function writeTransactions(data) {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(data, null, 2));
}

// Initiate transfer
router.post('/initiate', async (req, res) => {
    const { userId, recipient_account, amount, remark } = req.body;

    if (!userId || !recipient_account || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get frequency count
    const frequencyCount = getTransactionCount(userId);

    // Load system prompt
    const systemPrompt = loadSystemPrompt();

    // Prepare transaction data for AI
    const transactionData = {
        recipient_account,
        amount: parseFloat(amount),
        remark: remark || '',
        frequencyCount
    };

    try {
        // Call AI for detection
        const aiDecision = await callAIDetection(transactionData, systemPrompt);
        console.log('AI Decision:', aiDecision);

        // Add to frequency tracker (even if blocked/warned, it's an attempt)
        addTransaction(userId);

        if (aiDecision.decision === 'ALLOW') {
            // Record successful transaction
            const transactions = readTransactions();
            const newTransaction = {
                id: Date.now().toString(),
                userId,
                recipient_account,
                amount,
                remark,
                status: 'COMPLETED',
                ai_reason: aiDecision.reason,
                timestamp: new Date().toISOString()
            };
            transactions.push(newTransaction);
            writeTransactions(transactions);

            return res.json({
                success: true,
                decision: 'ALLOW',
                message: 'Transaction completed successfully'
            });
        } else {
            // BLOCK or WARN - create pending transaction
            const transactions = readTransactions();
            const transactionId = Date.now().toString();
            const pendingTransaction = {
                id: transactionId,
                userId,
                recipient_account,
                amount,
                remark,
                status: 'PENDING',
                decision: aiDecision.decision,
                ai_reason: aiDecision.reason,
                timestamp: new Date().toISOString()
            };
            transactions.push(pendingTransaction);
            writeTransactions(transactions);

            // Set timeout for 997 escalation (10 seconds for demo)
            const timeout = setTimeout(() => {
                const allTx = readTransactions();
                const tx = allTx.find(t => t.id === transactionId);
                if (tx && tx.status === 'PENDING') {
                    tx.status = 'ESCALATED';
                    writeTransactions(allTx);
                    console.log(`⏰ Transaction ${transactionId} escalated to 997`);
                }
                delete pendingTimeouts[transactionId];
            }, 10000); // 10 seconds demo timeout

            pendingTimeouts[transactionId] = timeout;

            return res.json({
                success: false,
                decision: aiDecision.decision,
                reason: aiDecision.reason,
                notify_child: aiDecision.notify_child,
                transactionId,
                message: `Transaction ${aiDecision.decision === 'BLOCK' ? 'blocked' : 'held for review'}: ${aiDecision.reason}`
            });
        }
    } catch (error) {
        console.error('AI detection error:', error);
        return res.status(500).json({ error: 'AI service unavailable' });
    }
});

// Get transaction status (for polling)
router.get('/status/:transactionId', (req, res) => {
    const { transactionId } = req.params;
    const transactions = readTransactions();
    const transaction = transactions.find(t => t.id === transactionId);

    if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
        status: transaction.status,
        decision: transaction.decision,
        reason: transaction.ai_reason
    });
});

module.exports = router;