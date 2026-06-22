const { pool } = require('../../../../database/pool');

async function getDistricts() {
  const { rows } = await pool.query('SELECT id, name, state FROM districts ORDER BY name ASC');
  return rows;
}

async function getColleges(districtId) {
  const values = [];
  let where = '';

  if (districtId) {
    values.push(Number(districtId));
    where = 'WHERE district_id = $1';
  }

  const { rows } = await pool.query(
    `SELECT id, name, district_id, is_verified FROM colleges ${where} ORDER BY name ASC`,
    values
  );
  return rows;
}

async function getDegrees() {
  const { rows } = await pool.query('SELECT id, name FROM degrees ORDER BY name ASC');
  return rows;
}

async function getCourses(degreeId) {
  const values = [];
  let where = '';

  if (degreeId) {
    values.push(Number(degreeId));
    where = 'WHERE degree_id = $1';
  }

  const { rows } = await pool.query(
    `SELECT id, name, degree_id FROM courses ${where} ORDER BY name ASC`,
    values
  );
  return rows;
}

module.exports = {
  getDistricts,
  getColleges,
  getDegrees,
  getCourses,
};
