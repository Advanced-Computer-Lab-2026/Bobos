// MET / DMET curriculum, transcribed from the course's "MET and DMET Curriculum"
// sheet. This is SEED DATA ONLY - the Course model deliberately stores just
// `creditHours` (the sheet's Total Hours column); the per-component hour columns
// live here because the seed uses them to derive the lecture / tutorial / lab
// groups of each course offering.
//
// Sheet rule: "2 hours = 1 lecture or 1 tutorial or 1 lab".
// E.g. MATH 103 has 4 lecture hours and 4 tutorial hours => 2 lectures and 2
// tutorials per week.
//
// Semester 8 is intentionally empty: it is the bachelor-project semester for
// non-advising students.

// lec / tut / lab / total are the sheet's hour columns.
export const CURRICULUM = [
  // ---------------------------------------------------------------- semester 1
  { code: 'CSEN 102', name: 'Introduction to Computer Science', lec: 2, tut: 2, lab: 2, total: 6, semester: 1, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'MATH 103', name: 'Maths', lec: 4, tut: 4, lab: 0, total: 8, semester: 1, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'CHEMP 102', name: 'Chemistry (Practical)', lec: 0, tut: 0, lab: 2, total: 2, semester: 1, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'CHEMT 102', name: 'Chemistry (Theoretical)', lec: 2, tut: 2, lab: 0, total: 4, semester: 1, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'PHYS 101', name: 'Physics', lec: 3, tut: 2, lab: 0, total: 5, semester: 1, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'EDPT 201', name: 'Production Technology', lec: 1, tut: 2, lab: 0, total: 3, semester: 1, major: 'ALL', type: 'core', prereqs: [] },

  // ---------------------------------------------------------------- semester 2
  { code: 'MATH 203', name: 'Mathematics I', lec: 4, tut: 4, lab: 0, total: 8, semester: 2, major: 'ALL', type: 'core', prereqs: ['MATH 103'] },
  { code: 'PHYS 202', name: 'Physics II', lec: 3, tut: 2, lab: 0, total: 5, semester: 2, major: 'ALL', type: 'core', prereqs: ['PHYS 101'] },
  { code: 'CSEN 202', name: 'Introduction to Computer Programming', lec: 2, tut: 2, lab: 2, total: 6, semester: 2, major: 'ALL', type: 'core', prereqs: ['CSEN 102'] },
  { code: 'ENGD 301', name: 'Engineering Drawing & Design', lec: 1, tut: 2, lab: 0, total: 3, semester: 2, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'ELCT 201', name: 'Digital Logic Design', lec: 2, tut: 2, lab: 0, total: 4, semester: 2, major: 'ALL', type: 'core', prereqs: [] },

  // ---------------------------------------------------------------- semester 3
  { code: 'MATH 301', name: 'Mathematics III', lec: 4, tut: 4, lab: 0, total: 8, semester: 3, major: 'ALL', type: 'core', prereqs: ['MATH 103', 'MATH 203'] },
  { code: 'PHYSP 301', name: 'Physics III (Practical)', lec: 0, tut: 0, lab: 2, total: 2, semester: 3, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'PHYST 301', name: 'Physics III (Theoretical)', lec: 3, tut: 2, lab: 0, total: 5, semester: 3, major: 'ALL', type: 'core', prereqs: ['PHYS 101', 'PHYS 202'] },
  { code: 'ELCT 301', name: 'Electric Circuits I', lec: 2, tut: 2, lab: 2, total: 6, semester: 3, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'CSEN 301', name: 'Data Structures and Algorithms', lec: 2, tut: 2, lab: 2, total: 6, semester: 3, major: 'ALL', type: 'core', prereqs: ['CSEN 102', 'CSEN 202'] },

  // ---------------------------------------------------------------- semester 4
  { code: 'MATH 401', name: 'Mathematics IV Probability and Statistics', lec: 2, tut: 2, lab: 0, total: 4, semester: 4, major: 'ALL', type: 'core', prereqs: ['MATH 103', 'MATH 203', 'MATH 301'] },
  { code: 'CSEN 403', name: 'Concepts of Programming Languages', lec: 2, tut: 2, lab: 0, total: 4, semester: 4, major: 'ALL', type: 'core', prereqs: ['CSEN 202'] },
  { code: 'CSIS 402', name: 'Computer Organization and System Programming', lec: 2, tut: 2, lab: 0, total: 4, semester: 4, major: 'ALL', type: 'core', prereqs: ['ELCT 201'] },
  { code: 'CSEN 401', name: 'Computer Programming Lab', lec: 2, tut: 0, lab: 2, total: 4, semester: 4, major: 'ALL', type: 'core', prereqs: ['CSEN 202', 'CSEN 301'] },
  { code: 'ELCT 401', name: 'Electric Circuits II', lec: 2, tut: 2, lab: 2, total: 6, semester: 4, major: 'ALL', type: 'core', prereqs: ['ELCT 301'] },
  { code: 'COMM 401', name: 'Signal and System Theory', lec: 2, tut: 2, lab: 2, total: 6, semester: 4, major: 'ALL', type: 'core', prereqs: ['MATH 103'] },

  // ---------------------------------------------------------------- semester 5
  { code: 'MATH 501', name: 'Mathematics V (Discrete Math)', lec: 2, tut: 2, lab: 0, total: 4, semester: 5, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'DMET 501', name: 'Introduction to Media Engineering', lec: 2, tut: 2, lab: 0, total: 4, semester: 5, major: 'ALL', type: 'core', prereqs: ['CSEN 202'] },
  { code: 'CSEN 501', name: 'Data Base I', lec: 2, tut: 2, lab: 2, total: 6, semester: 5, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'CSEN 503', name: 'Introduction to Communication Networks', lec: 2, tut: 2, lab: 0, total: 4, semester: 5, major: 'ALL', type: 'core', prereqs: ['CSEN 301'] },
  { code: 'CSEN 605', name: 'Digital System Design', lec: 2, tut: 2, lab: 0, total: 4, semester: 5, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'CSEN 502', name: 'Theory of Computation', lec: 4, tut: 2, lab: 0, total: 6, semester: 5, major: 'CS', type: 'core', prereqs: ['CSEN 202'] },
  // DMET 502 is listed twice in the sheet: semester 5 for the DMET major and
  // semester 7 for the CSEN major. The catalogue holds ONE course (codes are
  // unique); the per-major/semester course sets below decide who takes it when.
  { code: 'DMET 502', name: 'Computer Graphics', lec: 2, tut: 2, lab: 2, total: 6, semester: 5, major: 'ALL', type: 'core', prereqs: ['CSEN 202', 'CSEN 301'] },

  // ---------------------------------------------------------------- semester 6
  { code: 'CSEN 601', name: 'Computer System Architecture', lec: 2, tut: 2, lab: 2, total: 6, semester: 6, major: 'ALL', type: 'core', prereqs: ['ELCT 201', 'CSIS 402'] },
  { code: 'CSEN 602', name: 'Operating Systems', lec: 2, tut: 2, lab: 0, total: 4, semester: 6, major: 'ALL', type: 'core', prereqs: ['CSEN 301'] },
  { code: 'MNGT 601', name: 'Introduction to Management', lec: 2, tut: 0, lab: 0, total: 2, semester: 6, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'DMET 602', name: 'Network and Media Lab', lec: 2, tut: 0, lab: 2, total: 4, semester: 6, major: 'ALL', type: 'core', prereqs: ['CSEN 503'] },
  { code: 'CSEN 603', name: 'Software Engineering', lec: 2, tut: 0, lab: 2, total: 4, semester: 6, major: 'CS', type: 'core', prereqs: [] },
  { code: 'CSEN 604', name: 'Data Bases II', lec: 2, tut: 0, lab: 2, total: 4, semester: 6, major: 'CS', type: 'core', prereqs: ['CSEN 501'] },
  { code: 'DMET 601', name: 'Web Technologies and Usability', lec: 2, tut: 0, lab: 2, total: 4, semester: 6, major: 'DMET', type: 'core', prereqs: ['CSEN 202'] },
  { code: 'DMET 603', name: 'Digital Signal Processing', lec: 2, tut: 2, lab: 0, total: 4, semester: 6, major: 'DMET', type: 'core', prereqs: ['COMM 401'] },

  // ---------------------------------------------------------------- semester 7
  { code: 'CSEN 701', name: 'Embedded System Architecture', lec: 3, tut: 2, lab: 0, total: 5, semester: 7, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'CSEN 703', name: 'Analysis and Design of Algorithms', lec: 2, tut: 2, lab: 0, total: 4, semester: 7, major: 'CS', type: 'core', prereqs: [] },
  { code: 'CSEN 702', name: 'Microprocessors', lec: 3, tut: 2, lab: 0, total: 5, semester: 7, major: 'CS', type: 'core', prereqs: ['CSEN 601'] },
  { code: 'CSEN 704', name: 'Advanced Computer Lab', lec: 0, tut: 0, lab: 4, total: 4, semester: 7, major: 'CS', type: 'core', prereqs: [] },
  { code: 'DMET 702', name: 'Visualization and Animation', lec: 3, tut: 2, lab: 2, total: 7, semester: 7, major: 'DMET', type: 'core', prereqs: ['CSEN 202', 'CSEN 301', 'DMET 502'] },
  { code: 'DMET 703', name: 'Video and Audio Technology', lec: 2, tut: 2, lab: 0, total: 4, semester: 7, major: 'DMET', type: 'core', prereqs: ['DMET 603'] },
  { code: 'DMET 704', name: 'Multimedia & Networking', lec: 2, tut: 2, lab: 0, total: 4, semester: 7, major: 'DMET', type: 'core', prereqs: ['CSEN 503'] },
  { code: 'DMET 706', name: 'Advanced Media Lab', lec: 0, tut: 0, lab: 4, total: 4, semester: 7, major: 'DMET', type: 'core', prereqs: [] },

  // ---------------------------------------------------------------- semester 9
  { code: 'DMET 901', name: 'Computer Vision', lec: 2, tut: 2, lab: 0, total: 4, semester: 9, major: 'ALL', type: 'core', prereqs: ['DMET 502'] },
  { code: 'CSEN 901', name: 'Artificial Intelligence', lec: 2, tut: 2, lab: 0, total: 4, semester: 9, major: 'CS', type: 'core', prereqs: ['CSEN 301'] },
  { code: 'CSEN 903', name: 'Advanced Computer Lab', lec: 0, tut: 0, lab: 4, total: 4, semester: 9, major: 'CS', type: 'core', prereqs: [] },
  { code: 'DMET 902', name: 'Advanced Video Processing', lec: 2, tut: 2, lab: 0, total: 4, semester: 9, major: 'DMET', type: 'core', prereqs: ['DMET 603', 'DMET 703'] },
  { code: 'DMET 904', name: 'Advanced Media Lab', lec: 0, tut: 0, lab: 4, total: 4, semester: 9, major: 'DMET', type: 'core', prereqs: [] },

  // --------------------------------------------------------------- semester 10
  { code: 'HUMA 1001', name: 'Project Management', lec: 2, tut: 2, lab: 0, total: 4, semester: 10, major: 'ALL', type: 'huma', prereqs: [] },
  { code: 'CSEN 1004', name: 'Seminar', lec: 2, tut: 0, lab: 0, total: 2, semester: 10, major: 'ALL', type: 'core', prereqs: [] },
  { code: 'CSEN 1001', name: 'Computer and Network Security', lec: 2, tut: 2, lab: 0, total: 4, semester: 10, major: 'CS', type: 'core', prereqs: [] },
  { code: 'CSEN 1002', name: 'Advanced Computer Lab', lec: 0, tut: 0, lab: 4, total: 4, semester: 10, major: 'CS', type: 'core', prereqs: [] },
  { code: 'CSEN 1003', name: 'Compiler', lec: 2, tut: 2, lab: 0, total: 4, semester: 10, major: 'CS', type: 'core', prereqs: ['CSEN 502'] },
  { code: 'DMET 1001', name: 'Image Processing', lec: 2, tut: 2, lab: 0, total: 4, semester: 10, major: 'DMET', type: 'core', prereqs: ['DMET 603'] },
  { code: 'DMET 1002', name: 'Advanced Media Lab', lec: 0, tut: 0, lab: 4, total: 4, semester: 10, major: 'DMET', type: 'core', prereqs: [] },
  { code: 'DMET 1003', name: 'Audio and Acoustics', lec: 2, tut: 2, lab: 0, total: 4, semester: 10, major: 'DMET', type: 'core', prereqs: ['DMET 603', 'COMM 401'] },

  // ---------------------------- English courses (assigned from semesters 1-4)
  { code: 'AS 102', name: 'English for Academic Purposes', lec: 0, tut: 2, lab: 0, total: 2, semester: 1, major: 'ALL', type: 'huma', prereqs: [] },
  { code: 'SM 101', name: 'Scientific Methods', lec: 0, tut: 2, lab: 0, total: 2, semester: 2, major: 'ALL', type: 'huma', prereqs: [] },
  { code: 'CPS 402', name: 'Communication and Presentation Skills', lec: 0, tut: 2, lab: 0, total: 2, semester: 4, major: 'ALL', type: 'huma', prereqs: [] },
  { code: 'RPW 401', name: 'Research Paper Writing', lec: 0, tut: 2, lab: 0, total: 2, semester: 4, major: 'ALL', type: 'huma', prereqs: [] },

  // ----------------------------- German courses (assigned from semesters 1-4)
  { code: 'DE 101', name: 'German 1', lec: 0, tut: 4, lab: 0, total: 4, semester: 1, major: 'ALL', type: 'huma', prereqs: [] },
  { code: 'DE 202', name: 'German 2', lec: 0, tut: 4, lab: 0, total: 4, semester: 2, major: 'ALL', type: 'huma', prereqs: ['DE 101'] },
  { code: 'DE 303', name: 'German 3', lec: 0, tut: 4, lab: 0, total: 4, semester: 3, major: 'ALL', type: 'huma', prereqs: ['DE 202'] },
  { code: 'DE 404', name: 'German 4', lec: 0, tut: 4, lab: 0, total: 4, semester: 4, major: 'ALL', type: 'huma', prereqs: ['DE 303'] }
];

// The 10 electives the "Evaluation DB" sheet asks for. Electives live in the
// same course catalogue (requirement 18) and are flagged courseType 'elective'.
export const ELECTIVES = [
  { code: 'CSEN 905', name: 'Machine Learning', lec: 2, tut: 2, lab: 0, total: 4, semester: 9, major: 'CS', type: 'elective', prereqs: ['CSEN 301'] },
  { code: 'CSEN 906', name: 'Cloud Computing', lec: 2, tut: 2, lab: 0, total: 4, semester: 9, major: 'CS', type: 'elective', prereqs: ['CSEN 503'] },
  { code: 'CSEN 907', name: 'Information Retrieval', lec: 2, tut: 2, lab: 0, total: 4, semester: 10, major: 'CS', type: 'elective', prereqs: ['CSEN 501'] },
  { code: 'CSEN 908', name: 'Cryptography and Data Security', lec: 2, tut: 2, lab: 0, total: 4, semester: 10, major: 'CS', type: 'elective', prereqs: ['MATH 501'] },
  { code: 'CSEN 909', name: 'Parallel and Distributed Computing', lec: 2, tut: 2, lab: 0, total: 4, semester: 10, major: 'CS', type: 'elective', prereqs: ['CSEN 602'] },
  { code: 'DMET 905', name: 'Game Development', lec: 2, tut: 2, lab: 0, total: 4, semester: 9, major: 'DMET', type: 'elective', prereqs: ['DMET 502'] },
  { code: 'DMET 906', name: 'Virtual and Augmented Reality', lec: 2, tut: 2, lab: 0, total: 4, semester: 9, major: 'DMET', type: 'elective', prereqs: ['DMET 502'] },
  { code: 'DMET 907', name: 'Human Computer Interaction', lec: 2, tut: 2, lab: 0, total: 4, semester: 10, major: 'DMET', type: 'elective', prereqs: ['DMET 601'] },
  { code: 'DMET 908', name: '3D Modelling and Rendering', lec: 2, tut: 2, lab: 0, total: 4, semester: 10, major: 'DMET', type: 'elective', prereqs: ['DMET 502'] },
  { code: 'DMET 909', name: 'Interactive Media Design', lec: 2, tut: 2, lab: 0, total: 4, semester: 10, major: 'DMET', type: 'elective', prereqs: ['DMET 501'] }
];

// The exact course set of every (major, semester) cohort that gets published
// offerings and standard schedule templates in this seed. Requirement 30 is
// demoed on semesters 5 and 7, which is where the sheet splits the two majors.
export const COHORT_COURSES = {
  'CS-5': ['MATH 501', 'DMET 501', 'CSEN 501', 'CSEN 503', 'CSEN 605', 'CSEN 502'],
  'DMET-5': ['MATH 501', 'DMET 501', 'CSEN 501', 'CSEN 503', 'CSEN 605', 'DMET 502'],
  'CS-7': ['CSEN 701', 'DMET 502', 'CSEN 703', 'CSEN 702', 'CSEN 704'],
  'DMET-7': ['CSEN 701', 'DMET 702', 'DMET 703', 'DMET 704', 'DMET 706']
};

export const INSTRUCTORS = [
  'Dr. Amr Desouky',
  'Dr. Nourhan Ehab',
  'Dr. Mervat Abu-Elkheir',
  'Dr. Hassan Soubra',
  'Dr. Milad Ghantous',
  'Dr. Sherif Aly',
  'Dr. Yasmine Elhefnawy',
  'Dr. Omar Shalash'
];
