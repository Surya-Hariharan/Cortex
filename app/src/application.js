const express = require('express');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
const referenceRoutes = require('./routes/reference.routes');
const deviceRoutes = require('./routes/device.routes');
const { errorHandler } = require('./middleware/error-handler.middleware');
const { correlationId } = require('./middleware/correlation-id.middleware');

const app = express();

app.use(helmet());
app.use(correlationId);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'cortex-backend' });
});

app.use('/auth', authRoutes);
app.use('/reference', referenceRoutes);
app.use('/device', deviceRoutes);

app.use(errorHandler);

module.exports = { app };
