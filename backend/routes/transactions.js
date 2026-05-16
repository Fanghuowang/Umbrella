const express = require('express');
const router = express.Router();
const { callAIDetection } = require('../utils/aiClient');
const { getTransactionCount, addTransaction } = require('../utils/sessionTracker');
const { loadSystemPrompt } = require('../utils/scamRulesLoader');
const fs = require('fs');
const path = require('path');

const TRANSACTIONS_FILE = path.join(__dirname, '../data/transactions.json');
const USERS_FILE = path.join(__dirname, '../data/users.json');
let pendingTimeouts = {};

function readTransactions() {
    if (!fs.existsSync(TRANSACTIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8'));
}

function writeTransactions(data) {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(data, null, 2));
}

function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function writeUsers(data) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function deductBalance(userId, amount) {
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) return { success: false, error: 'User not found' };
    if (users[userIndex].balance < amount) return { success: false, error: 'Insufficient balance' };

    users[userIndex].balance -= amount;
    writeUsers(users);

    return { success: true, newBalance: users[userIndex].balance };
}

// Initiate transfer
router.post('/initiate', async (req, res) => {
    const { userId, recipient_account, amount, remark } = req.body;

    // ✅ REMARK IS NOW REQUIRED - validate it
    if (!userId || !recipient_account || !amount) {
        return res.status(400).json({ error: 'Missing required fields: userId, recipient_account, amount are required' });
    }

    if (!remark || remark.trim() === '') {
        return res.status(400).json({ error: 'Remark is required. Please describe the purpose of this transfer' });
    }

    const amountNum = parseFloat(amount);
    const remarkTrimmed = remark.trim();

    // Check balance first
    const users = readUsers();
    const currentUser = users.find(u => u.id === userId);
    if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
    }
    if (currentUser.balance < amountNum) {
        return res.status(400).json({
            success: false,
            error: 'Insufficient balance',
            balance: currentUser.balance
        });
    }

    // Get frequency count
    const frequencyCount = getTransactionCount(userId);

    // Load system prompt
    const systemPrompt = loadSystemPrompt();

    // Prepare transaction data for AI
    const transactionData = {
        recipient_account,
        amount: amountNum,
        remark: remarkTrimmed,
        frequencyCount
    };

    try {
        // Call AI for detection
        const aiDecision = await callAIDetection(transactionData, systemPrompt);
        console.log('AI Decision:', aiDecision);

        // Add to frequency tracker
        addTransaction(userId);

        if (aiDecision.decision === 'ALLOW') {
            // Deduct balance
            const deduction = deductBalance(userId, amountNum);

            if (!deduction.success) {
                return res.status(400).json({
                    success: false,
                    error: deduction.error
                });
            }

            // Record successful transaction
            const transactions = readTransactions();
            const newTransaction = {
                id: Date.now().toString(),
                userId,
                recipient_account,
                amount: amountNum,
                remark: remarkTrimmed,
                status: 'COMPLETED',
                decision: aiDecision.decision,
                ai_reason: aiDecision.reason,
                timestamp: new Date().toISOString()
            };
            transactions.push(newTransaction);
            writeTransactions(transactions);

            return res.json({
                success: true,
                decision: 'ALLOW',
                newBalance: deduction.newBalance,
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
                amount: amountNum,
                remark: remarkTrimmed,
                status: 'PENDING',
                decision: aiDecision.decision,
                ai_reason: aiDecision.reason,
                timestamp: new Date().toISOString()
            };
            transactions.push(pendingTransaction);
            writeTransactions(transactions);

            // Set timeout for 997 escalation
            const timeout = setTimeout(() => {
                const allTx = readTransactions();
                const tx = allTx.find(t => t.id === transactionId);
                if (tx && tx.status === 'PENDING') {
                    tx.status = 'ESCALATED';
                    writeTransactions(allTx);
                    console.log(`⏰ Transaction ${transactionId} escalated to 997`);
                }
                delete pendingTimeouts[transactionId];
            }, 10000);

            pendingTimeouts[transactionId] = timeout;

            return res.json({
                success: false,
                decision: aiDecision.decision,
                reason: aiDecision.reason,
                notify_child: aiDecision.notify_child,
                transactionId,
                currentBalance: currentUser.balance,
                message: `Transaction ${aiDecision.decision === 'BLOCK' ? 'blocked' : 'held for review'}: ${aiDecision.reason}`
            });
        }
    } catch (error) {
        console.error('AI detection error:', error);
        return res.status(500).json({ error: 'AI service unavailable' });
    }
});

// Get transaction status
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
        reason: transaction.ai_reason,
        amount: transaction.amount,
        recipient_account: transaction.recipient_account
    });
});

// Get user balance
router.get('/balance/:userId', (req, res) => {
    const { userId } = req.params;
    const users = readUsers();
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({
        userId: user.id,
        name: user.name,
        balance: user.balance,
        trusted_person: user.trusted_person
    });
});

module.exports = router;