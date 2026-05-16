const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const transactionsRoutes = require('./routes/transactions');
const approvalRoutes = require('./routes/approval');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/transactions', transactionsRoutes);
app.use('/api/approval', approvalRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'UMBRELLA is running' });
});

app.listen(PORT, () => {
    console.log(`✅ Umbrella running on http://localhost:${PORT}`);
});