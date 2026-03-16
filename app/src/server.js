const dotenv = require('dotenv');
const { app } = require('./app');

dotenv.config();

const port = Number(process.env.PORT || 8080);

app.listen(port, () => {
  console.log(`Cortex backend listening on port ${port}`);
});
