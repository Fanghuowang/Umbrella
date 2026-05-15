let currentUser = null;
let currentTransactionId = null;
let statusPollingInterval = null;
let transactionHistory = [];

// Login
document.getElementById('loginBtn').addEventListener('click', () => {
    const userId = document.getElementById('userSelect').value;
    currentUser = { id: userId, name: 'Ahmad Abdullah' };

    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('bankingSection').style.display = 'block';

    loadTransactionHistory();
});

// Transfer form submission
document.getElementById('transferForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const recipient_account = document.getElementById('recipientAccount').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const remark = document.getElementById('remark').value;

    if (!recipient_account || !amount) {
        alert('Please fill in all required fields');
        return;
    }

    // Show loading
    const transferBtn = document.getElementById('transferBtn');
    transferBtn.disabled = true;
    transferBtn.textContent = '🔄 Analysing with AI...';

    try {
        const response = await fetch('/api/transactions/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                recipient_account,
                amount,
                remark
            })
        });

        const result = await response.json();
        console.log('Response:', result);

        if (result.success) {
            // Transaction allowed
            showDecision('success', '✅ Transaction completed successfully!');
            addToHistory(recipient_account, amount, remark, 'COMPLETED');
            clearForm();
        } else {
            // Transaction blocked or needs approval
            currentTransactionId = result.transactionId;

            if (result.decision === 'BLOCK') {
                showDecision('danger', `⚠️ TRANSACTION BLOCKED: ${result.reason}`);
            } else {
                showDecision('warning', `⚠️ TRANSACTION HELD: ${result.reason}`);
            }

            // Show simulated SMS
            const smsDiv = document.getElementById('simulatedSMS');
            smsDiv.innerHTML = `📱 SMS sent to Siti Ahmad (0123456789):<br>
                "Your parent Ahmad is trying to transfer RM ${amount} to ${recipient_account}. 
                Reason: ${result.reason}. Reply APPROVE or REJECT."`;

            // Show approve/reject buttons
            document.getElementById('approvalButtons').style.display = 'block';

            // Start polling for status
            startPolling(result.transactionId);
        }
    } catch (error) {
        console.error('Error:', error);
        showDecision('danger', '❌ Error connecting to server. Please try again.');
    } finally {
        transferBtn.disabled = false;
        transferBtn.textContent = 'Check & Transfer';
    }
});

// Approve button (simulating trusted person)
document.getElementById('approveBtn').addEventListener('click', async () => {
    if (!currentTransactionId) return;

    const response = await fetch(`/api/approval/approve/${currentTransactionId}`, {
        method: 'POST'
    });

    const result = await response.json();
    if (result.success) {
        showDecision('success', '✅ Trusted person APPROVED. Transaction completed!');
        addToHistory(
            document.getElementById('recipientAccount').value,
            parseFloat(document.getElementById('amount').value),
            document.getElementById('remark').value,
            'APPROVED'
        );
        clearApprovalUI();
        clearForm();
        stopPolling();
    }
});

// Reject button (simulating trusted person)
document.getElementById('rejectBtn').addEventListener('click', async () => {
    if (!currentTransactionId) return;

    const response = await fetch(`/api/approval/reject/${currentTransactionId}`, {
        method: 'POST'
    });

    const result = await response.json();
    if (result.success) {
        showDecision('danger', '❌ Trusted person REJECTED. Transaction cancelled.');
        clearApprovalUI();
        clearForm();
        stopPolling();
    }
});

// 997 Call button
document.getElementById('call997Btn').addEventListener('click', () => {
    window.location.href = 'tel:997';
    alert('Calling 997 - National Scam Response Centre');
});

function startPolling(transactionId) {
    stopPolling();
    statusPollingInterval = setInterval(async () => {
        const response = await fetch(`/api/transactions/status/${transactionId}`);
        const result = await response.json();

        if (result.status === 'ESCALATED') {
            stopPolling();
            document.getElementById('approvalButtons').style.display = 'none';
            document.getElementById('call997Section').style.display = 'block';
            showDecision('warning', '⏰ No response from trusted person. Escalating to 997...');
        } else if (result.status === 'APPROVED' || result.status === 'REJECTED') {
            stopPolling();
        }
    }, 1000); // Poll every second
}

function stopPolling() {
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        statusPollingInterval = null;
    }
}

function showDecision(type, message) {
    const decisionDiv = document.getElementById('aiDecision');
    const messageDiv = document.getElementById('decisionMessage');

    decisionDiv.style.display = 'block';
    decisionDiv.className = `decision-card ${type}`;
    messageDiv.innerHTML = message;

    // Auto hide after 10 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            decisionDiv.style.display = 'none';
        }, 5000);
    }
}

function clearApprovalUI() {
    document.getElementById('approvalButtons').style.display = 'none';
    document.getElementById('simulatedSMS').innerHTML = '';
    document.getElementById('call997Section').style.display = 'none';
    currentTransactionId = null;
}

function clearForm() {
    document.getElementById('recipientAccount').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('remark').value = '';
}

function addToHistory(account, amount, remark, status) {
    const historyItem = {
        date: new Date().toLocaleString(),
        account,
        amount,
        remark,
        status
    };
    transactionHistory.unshift(historyItem);
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const historyList = document.getElementById('transactionHistory');
    if (transactionHistory.length === 0) {
        historyList.innerHTML = '<li>No transactions yet</li>';
        return;
    }

    historyList.innerHTML = transactionHistory.slice(0, 10).map(tx => `
        <li>
            <strong>${tx.date}</strong><br>
            To: ${tx.account} | Amount: RM ${tx.amount}<br>
            Remark: ${tx.remark || '-'} | 
            <span style="color: ${tx.status === 'COMPLETED' ? 'green' : 'orange'}">${tx.status}</span>
        </li>
    `).join('');
}

function loadTransactionHistory() {
    // In a real app, fetch from server
    transactionHistory = [];
    updateHistoryDisplay();
}