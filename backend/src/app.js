const express = require('express');
const helmet = require('helmet');

const authRoutes = require('./routes/authRoutes');
const referenceRoutes = require('./routes/referenceRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'cortex-backend' });
});

app.use('/auth', authRoutes);
app.use('/reference', referenceRoutes);
app.use('/device', deviceRoutes);

app.use(errorHandler);

module.exports = { app };
