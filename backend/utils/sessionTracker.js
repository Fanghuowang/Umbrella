// In-memory storage for transaction timestamps
const userTransactions = new Map(); // userId -> array of timestamps

function addTransaction(userId) {
    if (!userTransactions.has(userId)) {
        userTransactions.set(userId, []);
    }
    const timestamps = userTransactions.get(userId);
    timestamps.push(Date.now());

    // Clean old entries (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const filtered = timestamps.filter(ts => ts > tenMinutesAgo);
    userTransactions.set(userId, filtered);
}

function getTransactionCount(userId, minutes = 10) {
    if (!userTransactions.has(userId)) return 0;
    const timestamps = userTransactions.get(userId);
    const cutoff = Date.now() - minutes * 60 * 1000;
    return timestamps.filter(ts => ts > cutoff).length;
}

function resetUserSession(userId) {
    userTransactions.delete(userId);
}

module.exports = { addTransaction, getTransactionCount, resetUserSession };