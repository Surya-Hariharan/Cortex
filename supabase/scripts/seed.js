const { pool } = require('../db/pool');

const districts = [
  'Ariyalur','Chengalpattu','Chennai','Coimbatore','Cuddalore','Dharmapuri','Dindigul',
  'Erode','Kallakurichi','Kancheepuram','Kanniyakumari','Karur','Krishnagiri','Madurai',
  'Mayiladuthurai','Nagapattinam','Namakkal','Nilgiris','Perambalur','Pudukkottai',
  'Ramanathapuram','Ranipet','Salem','Sivaganga','Tenkasi','Thanjavur','Theni','Thoothukudi',
  'Tiruchirappalli','Tirunelveli','Tirupathur','Tiruppur','Tiruvallur','Tiruvannamalai',
  'Tiruvarur','Vellore','Viluppuram','Virudhunagar'
];

const degreeOptions = ['B.E', 'B.Tech', 'B.Sc', 'M.Sc', 'MBA', 'M.E', 'M.Tech', 'PhD'];

const coursesByDegree = {
  'B.E': ['Computer Science and Engineering', 'Electronics and Communication Engineering', 'Mechanical Engineering', 'Electrical and Electronics Engineering', 'Civil Engineering', 'Information Technology', 'Automobile Engineering', 'Biomedical Engineering', 'Mechatronics Engineering', 'Aeronautical Engineering', 'Production Engineering', 'Electronics and Instrumentation Engineering', 'Metallurgical Engineering', 'Robotics and Automation', 'Agriculture Engineering', 'Marine Engineering', 'Petrochemical Engineering', 'Computer Science and Design', 'Artificial Intelligence and Data Science', 'Computer Engineering'],
  'B.Tech': ['Artificial Intelligence and Data Science', 'Information Technology', 'Computer Science and Business Systems', 'Biotechnology', 'Chemical Engineering', 'Food Technology', 'Fashion Technology', 'Textile Technology', 'Artificial Intelligence and Machine Learning', 'Cyber Security', 'Internet of Things (IoT)', 'Data Science', 'Dairy Technology', 'Polymer Technology', 'Pharmaceutical Technology', 'Agricultural Information Technology', 'Nanotechnology', 'Space Technology', 'Geo-Informatics', 'Cloud Computing and Virtualization'],
  'B.Sc': ['Computer Science', 'Information Technology', 'Mathematics', 'Physics', 'Chemistry', 'Botany', 'Zoology', 'Biotechnology', 'Microbiology', 'Data Science', 'Artificial Intelligence', 'Cyber Security', 'Visual Communication', 'Animation and Multimedia', 'Hotel Management and Catering Science', 'Electronics', 'Biochemistry', 'Statistics', 'Geology', 'Psychology'],
  'M.Sc': ['Computer Science', 'Information Technology', 'Data Science', 'Artificial Intelligence', 'Physics', 'Chemistry', 'Mathematics', 'Biotechnology', 'Microbiology', 'Bio-informatics', 'Applied Electronics', 'Software Engineering', 'Cyber Security', 'Actuarial Science', 'Environmental Science', 'Oceanography', 'Geology', 'Statistics', 'Zoology', 'Botany'],
  'MBA': ['Finance', 'Marketing', 'Human Resource Management', 'Operations Management', 'Information Technology', 'Business Analytics', 'International Business', 'Supply Chain Management', 'Healthcare Management', 'Hospitality Management', 'Retail Management', 'Agribusiness Management', 'Entrepreneurship', 'Aviation Management', 'Tourism Management', 'Media Management', 'Banking and Insurance', 'Project Management', 'Logistics Management', 'Digital Marketing'],
  'M.E': ['Computer Science and Engineering', 'Software Engineering', 'Structural Engineering', 'CAD/CAM', 'Communication Systems', 'Power Electronics and Drives', 'VLSI Design', 'Applied Electronics', 'Thermal Engineering', 'Manufacturing Engineering', 'Environmental Engineering', 'Industrial Engineering', 'Engineering Design', 'Embedded System Technologies', 'Mechatronics', 'Aeronautical Engineering', 'Automobile Engineering', 'Energy Engineering', 'Biometrics and Cyber Security', 'Construction Engineering'],
  'M.Tech': ['Information Technology', 'Artificial Intelligence and Machine Learning', 'Data Science', 'Cyber Security', 'Biotechnology', 'Chemical Engineering', 'Nanotechnology', 'Food Technology', 'Textile Technology', 'Remote Sensing', 'Environmental Science and Technology', 'Polymer Science and Engineering', 'Energy Technology', 'Industrial Safety Engineering', 'Network Engineering', 'Software Systems', 'Internet of Things', 'Cloud Computing', 'Big Data Analytics', 'Geo Informatics'],
  'PhD': ['Computer Science and Engineering', 'Information Technology', 'Mechanical Engineering', 'Electrical Engineering', 'Electronics and Communication Engineering', 'Civil Engineering', 'Chemical Engineering', 'Biotechnology', 'Physics', 'Chemistry', 'Mathematics', 'Management Studies', 'English', 'Economics', 'Commerce', 'Computer Applications', 'Environmental Sciences', 'Nanotechnology', 'Data Science', 'Artificial Intelligence']
};

const sampleColleges = [
  { name: 'Anna University (College of Engineering, Guindy)', district: 'Chennai' },
  { name: 'Indian Institute of Technology Madras', district: 'Chennai' },
  { name: 'Madras Institute of Technology, Chrompet', district: 'Chengalpattu' },
  { name: 'PSG College of Technology', district: 'Coimbatore' },
  { name: 'Coimbatore Institute of Technology', district: 'Coimbatore' },
  { name: 'National Institute of Technology, Tiruchirappalli', district: 'Tiruchirappalli' },
  { name: 'Vellore Institute of Technology (VIT)', district: 'Vellore' },
  { name: 'Thiagarajar College of Engineering, Madurai', district: 'Madurai' },
  { name: 'SASTRA', district: 'Thanjavur' },
  { name: 'Government College of Engineering, Salem (Autonomous)', district: 'Salem' },
  { name: 'Government College of Engineering, Tirunelveli', district: 'Tirunelveli' },
  { name: 'Kumaraguru College of Technology', district: 'Coimbatore' },
  { name: 'Bharathiar University', district: 'Coimbatore' },
  { name: 'Bharathidasan University', district: 'Tiruchirappalli' },
  { name: 'Manonmaniam Sundaranar University', district: 'Tirunelveli' }
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const district of districts) {
      await client.query(
        'INSERT INTO districts (name, state) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [district, 'Tamil Nadu']
      );
    }

    for (const degree of degreeOptions) {
      await client.query(
        'INSERT INTO degrees (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [degree]
      );
    }

    const degreeMapResult = await client.query('SELECT id, name FROM degrees');
    const degreeMap = Object.fromEntries(degreeMapResult.rows.map((row) => [row.name, row.id]));

    for (const [degreeName, courses] of Object.entries(coursesByDegree)) {
      const degreeId = degreeMap[degreeName];
      if (!degreeId) {
        throw new Error(`Degree not found while seeding courses: ${degreeName}`);
      }
      for (const courseName of courses) {
        await client.query(
          'INSERT INTO courses (name, degree_id) VALUES ($1, $2) ON CONFLICT (name, degree_id) DO NOTHING',
          [courseName, degreeId]
        );
      }
    }

    for (const college of sampleColleges) {
      const districtRes = await client.query('SELECT id FROM districts WHERE name = $1', [college.district]);
      if (districtRes.rowCount === 0) {
        throw new Error(`District not found for college seed: ${college.district}`);
      }
      await client.query(
        'INSERT INTO colleges (name, district_id, is_verified) VALUES ($1, $2, true) ON CONFLICT (name) DO NOTHING',
        [college.name, districtRes.rows[0].id]
      );
    }

    await client.query('COMMIT');
    console.log('Seed completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
