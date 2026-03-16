const { registerOrUpdateDevice } = require('../services/deviceService');

async function registerDevice(req, res) {
  try {
    const { fingerprint, ram, cpu, gpu, npu } = req.body;
    const device = await registerOrUpdateDevice({
      userId: req.auth.sub,
      fingerprint,
      ram,
      cpu,
      gpu,
      npu,
    });

    return res.status(200).json({ device });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

module.exports = { registerDevice };
