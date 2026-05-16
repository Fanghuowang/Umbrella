const userRecipientTransactions = new Map();

function addTransaction(userId, recipientAccount) {
    const key = `${userId}:${recipientAccount}`;
    if (!userRecipientTransactions.has(key)) {
        userRecipientTransactions.set(key, []);
    }
    const timestamps = userRecipientTransactions.get(key);
    timestamps.push(Date.now());

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const filtered = timestamps.filter(ts => ts > oneHourAgo);
    userRecipientTransactions.set(key, filtered);
}

function getTransactionCount(userId, recipientAccount, minutes = 60) {
    const key = `${userId}:${recipientAccount}`;
    if (!userRecipientTransactions.has(key)) return 0;
    const timestamps = userRecipientTransactions.get(key);
    const cutoff = Date.now() - minutes * 60 * 1000;
    return timestamps.filter(ts => ts > cutoff).length;
}


module.exports = { addTransaction, getTransactionCount };