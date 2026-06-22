function academicIntegrityValidator(req, res, next) {
  const {
    student_status,
    year_of_study,
    graduation_year,
    district_id,
    college_id,
    degree_id,
    course_id,
  } = req.body;

  if (!district_id || !college_id || !degree_id || !course_id) {
    return res.status(400).json({
      error: 'district_id, college_id, degree_id, and course_id are required',
    });
  }

  if (student_status === 'student') {
    if (!Number.isInteger(year_of_study) || year_of_study < 1 || year_of_study > 8) {
      return res.status(400).json({
        error: 'For student status, year_of_study must be an integer between 1 and 8',
      });
    }
    if (graduation_year != null) {
      return res.status(400).json({
        error: 'For student status, graduation_year must be null',
      });
    }
  }

  if (student_status === 'alumni') {
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(graduation_year) || graduation_year < 1950 || graduation_year > currentYear + 1) {
      return res.status(400).json({
        error: 'For alumni status, graduation_year must be a valid integer year',
      });
    }
    if (year_of_study != null) {
      return res.status(400).json({
        error: 'For alumni status, year_of_study must be null',
      });
    }
  }

  return next();
}

module.exports = { academicIntegrityValidator };
