const authService = require('../services/auth.service');

async function signup(req, res) {
  try {
    const result = await authService.signup(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

async function login(req, res) {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
}

async function refresh(req, res) {
  try {
    const result = await authService.refresh(req.body.refreshToken);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
}

async function logout(req, res) {
  try {
    const result = await authService.logout({
      userId: req.auth.sub,
      refreshToken: req.body.refreshToken,
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

module.exports = {
  signup,
  login,
  refresh,
  logout,
};
