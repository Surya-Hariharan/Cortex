const referenceService = require('../services/reference.service');

async function getDistricts(req, res) {
  const data = await referenceService.getDistricts();
  return res.json(data);
}

async function getColleges(req, res) {
  const data = await referenceService.getColleges(req.query.districtId);
  return res.json(data);
}

async function getDegrees(req, res) {
  const data = await referenceService.getDegrees();
  return res.json(data);
}

async function getCourses(req, res) {
  const data = await referenceService.getCourses(req.query.degreeId);
  return res.json(data);
}

module.exports = {
  getDistricts,
  getColleges,
  getDegrees,
  getCourses,
};
