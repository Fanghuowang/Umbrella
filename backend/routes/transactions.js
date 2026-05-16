const express = require('express');
const router = express.Router();
const { callAIDetection } = require('../utils/aiClient');
const { getTransactionCount, addTransaction } = require('../utils/sessionTracker');
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

router.post('/initiate', async (req, res) => {
    const { userId, recipient_account, amount, remark } = req.body;

    if (!userId || !recipient_account || !amount || !remark || remark.trim() === '') {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const amountNum = parseFloat(amount);
    const remarkTrimmed = remark.trim();

    const users = readUsers();
    const currentUser = users.find(u => u.id === userId);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });
    if (currentUser.balance < amountNum) {
        return res.status(400).json({ success: false, error: 'Insufficient balance', balance: currentUser.balance });
    }

    const frequencyCount = getTransactionCount(userId, recipient_account, 60);

    const transactionData = { recipient_account, amount: amountNum, remark: remarkTrimmed, frequencyCount };

    try {
        const aiDecision = await callAIDetection(transactionData);
        console.log('AI Decision:', aiDecision);
        addTransaction(userId, recipient_account);

        if (aiDecision.decision === 'BLOCK') {
            const transactionId = Date.now().toString();
            const blockedTransaction = {
                id: transactionId,
                userId,
                recipient_account,
                amount: amountNum,
                remark: remarkTrimmed,
                status: 'BLOCKED',
                decision: aiDecision.decision,
                ai_reason: aiDecision.reason,
                timestamp: new Date().toISOString()
            };
            const transactions = readTransactions();
            transactions.push(blockedTransaction);
            writeTransactions(transactions);
            return res.json({
                success: false,
                decision: 'BLOCK',
                reason: aiDecision.reason,
                transactionId,
                message: `Transaction blocked: ${aiDecision.reason}`
            });
        }
        else if (aiDecision.decision === 'ALLOW') {
            const deduction = deductBalance(userId, amountNum);
            if (!deduction.success) return res.status(400).json({ success: false, error: deduction.error });
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
            const transactions = readTransactions();
            transactions.push(newTransaction);
            writeTransactions(transactions);
            return res.json({
                success: true,
                decision: 'ALLOW',
                newBalance: deduction.newBalance,
                message: 'Transaction completed successfully'
            });
        }
        else {
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

            const timeout = setTimeout(() => {
                const allTx = readTransactions();
                const tx = allTx.find(t => t.id === transactionId);
                if (tx && tx.status === 'PENDING') {
                    tx.status = 'ESCALATED';
                    writeTransactions(allTx);
                    console.log(`Transaction ${transactionId} escalated to 997 after 20 seconds`);
                }
                delete pendingTimeouts[transactionId];
            }, 20000);
            pendingTimeouts[transactionId] = timeout;

            return res.json({
                success: false,
                decision: 'WARN',
                reason: aiDecision.reason,
                transactionId,
                currentBalance: currentUser.balance,
                message: `Transaction held: ${aiDecision.reason}`
            });
        }
    } catch (error) {
        console.error('AI detection error:', error);
        return res.status(500).json({ error: 'AI service unavailable' });
    }
});

router.post('/approve/:transactionId', (req, res) => {
    const { transactionId } = req.params;
    const transactions = readTransactions();
    const tx = transactions.find(t => t.id === transactionId);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'PENDING') return res.status(400).json({ error: `Cannot approve: status ${tx.status}` });

    const deduct = deductBalance(tx.userId, tx.amount);
    if (!deduct.success) return res.status(400).json({ error: deduct.error });

    tx.status = 'APPROVED';
    writeTransactions(transactions);
    res.json({ success: true, newBalance: deduct.newBalance, message: 'Transaction approved' });
});

router.post('/reject/:transactionId', (req, res) => {
    const { transactionId } = req.params;
    const transactions = readTransactions();
    const tx = transactions.find(t => t.id === transactionId);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'PENDING') return res.status(400).json({ error: `Cannot reject: status ${tx.status}` });
    tx.status = 'REJECTED';
    writeTransactions(transactions);
    res.json({ success: true, message: 'Transaction rejected' });
});

router.post('/nsrc/:transactionId', (req, res) => {
    const { transactionId } = req.params;
    const { decision } = req.body;
    const transactions = readTransactions();
    const tx = transactions.find(t => t.id === transactionId);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'ESCALATED') return res.status(400).json({ error: `Cannot decide: status ${tx.status}` });
    if (decision === 'approve') {
        const deduct = deductBalance(tx.userId, tx.amount);
        if (!deduct.success) return res.status(400).json({ error: deduct.error });
        tx.status = 'APPROVED_BY_NSRC';
    } else if (decision === 'reject') {
        tx.status = 'REJECTED_BY_NSRC';
    } else {
        return res.status(400).json({ error: 'Invalid decision' });
    }
    writeTransactions(transactions);
    res.json({ success: true, message: `NSRC ${decision}d transaction` });
});

router.get('/status/:transactionId', (req, res) => {
    const { transactionId } = req.params;
    const transactions = readTransactions();
    const tx = transactions.find(t => t.id === transactionId);
    if (!tx) return res.status(404).json({ error: 'Not found' });
    res.json({ status: tx.status, decision: tx.decision, reason: tx.ai_reason });
});

router.get('/balance/:userId', (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ userId: user.id, name: user.name, balance: user.balance, trusted_person: user.trusted_person });
});

router.get('/details/:transactionId', (req, res) => {
    const { transactionId } = req.params;
    const transactions = readTransactions();
    const tx = transactions.find(t => t.id === transactionId);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json(tx);
});

module.exports = router;