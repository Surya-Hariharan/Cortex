const { createApp } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

const app = createApp();

app.listen(config.port, () => {
    logger.info(`listening on port ${config.port} (env=${config.env})`);
});
