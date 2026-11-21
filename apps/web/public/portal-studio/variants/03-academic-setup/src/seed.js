/** Existing Portal preview records, extended only for testable academic workflows. See docs/source-decisions.md. */
export const SEED = {
  "schema": 2,
  "revision": 0,
  "terms": [
    {
      "id": "w26",
      "code": "W26",
      "label": "Winter 2026",
      "year": "2026/2027",
      "season": "winter",
      "termStart": "2026-09-20",
      "termEnd": "2027-02-04",
      "teachingStart": "2026-09-20",
      "teachingEnd": "2027-02-04",
      "registrationStart": "2026-11-22",
      "registrationEnd": "2026-12-06",
      "advisingDeadline": "2026-12-06T23:59",
      "swapDeadline": "2026-12-13T23:59",
      "active": true
    },
    {
      "id": "s27",
      "code": "S27",
      "label": "Spring 2027",
      "year": "2026/2027",
      "season": "spring",
      "termStart": "2027-02-14",
      "termEnd": "2027-07-01",
      "teachingStart": "2027-02-14",
      "teachingEnd": "2027-07-01",
      "registrationStart": "2027-02-14",
      "registrationEnd": "2027-02-28",
      "advisingDeadline": "2027-02-28T23:59",
      "swapDeadline": "2027-03-07T23:59",
      "active": false
    },
    {
      "id": "s26",
      "code": "S26",
      "label": "Spring 2026",
      "year": "2025/2026",
      "season": "spring",
      "termStart": "2026-02-15",
      "termEnd": "2026-07-01",
      "teachingStart": "2026-02-15",
      "teachingEnd": "2026-07-01",
      "registrationStart": "2026-02-15",
      "registrationEnd": "2026-03-01",
      "advisingDeadline": "2026-03-01T23:59",
      "swapDeadline": "2026-03-08T23:59",
      "active": false
    },
    {
      "id": "w25",
      "code": "W25",
      "label": "Winter 2025",
      "year": "2025/2026",
      "season": "winter",
      "termStart": "2025-09-21",
      "termEnd": "2026-02-05",
      "teachingStart": "2025-09-21",
      "teachingEnd": "2026-02-05",
      "registrationStart": "2025-09-14",
      "registrationEnd": "2025-10-05",
      "advisingDeadline": "2025-10-05T23:59",
      "swapDeadline": "2025-10-12T23:59",
      "active": false
    },
    {
      "id": "u26",
      "code": "U26",
      "label": "Summer 2026",
      "year": "2025/2026",
      "season": "summer",
      "termStart": "2026-07-05",
      "termEnd": "2026-08-30",
      "teachingStart": "2026-07-05",
      "teachingEnd": "2026-08-30",
      "registrationStart": "2026-06-21",
      "registrationEnd": "2026-07-09",
      "advisingDeadline": "2026-07-09T23:59",
      "swapDeadline": "2026-07-12T23:59",
      "active": false
    }
  ],
  "courses": [
    {
      "id": "CSEN701",
      "code": "CSEN701",
      "name": "Embedded Systems",
      "credits": 5,
      "type": "core",
      "majors": [
        "CS"
      ],
      "semester": 7,
      "seasons": [
        "winter",
        "spring"
      ],
      "prerequisites": [
        "CSEN501"
      ],
      "hours": [
        2,
        2,
        2
      ],
      "active": true,
      "sourceNote": "Supplied Portal preview identity. Additional attributes are preview fixtures, not a curriculum correction."
    },
    {
      "id": "CSEN703",
      "code": "CSEN703",
      "name": "Analysis & Design of Algorithms",
      "credits": 5,
      "type": "core",
      "majors": [
        "CS"
      ],
      "semester": 7,
      "seasons": [
        "winter"
      ],
      "prerequisites": [],
      "hours": [
        2,
        2,
        0
      ],
      "active": true,
      "sourceNote": "Supplied Portal preview identity. Additional attributes are preview fixtures, not a curriculum correction."
    },
    {
      "id": "CSEN704",
      "code": "CSEN704",
      "name": "Advanced Computer Lab",
      "credits": 4,
      "type": "core",
      "majors": [
        "CS"
      ],
      "semester": 7,
      "seasons": [
        "winter"
      ],
      "prerequisites": [],
      "hours": [
        0,
        0,
        4
      ],
      "active": true,
      "sourceNote": "Supplied Portal preview identity. Additional attributes are preview fixtures, not a curriculum correction."
    },
    {
      "id": "DMET701",
      "code": "DMET701",
      "name": "Computer Graphics",
      "credits": 5,
      "type": "core",
      "majors": [
        "DMET"
      ],
      "semester": 7,
      "seasons": [
        "winter"
      ],
      "prerequisites": [],
      "hours": [
        2,
        0,
        2
      ],
      "active": true,
      "sourceNote": "Supplied Portal preview identity. Additional attributes are preview fixtures, not a curriculum correction."
    },
    {
      "id": "ELCT701",
      "code": "ELCT701",
      "name": "Communication Systems",
      "credits": 5,
      "type": "core",
      "majors": [
        "All"
      ],
      "semester": 7,
      "seasons": [
        "winter"
      ],
      "prerequisites": [],
      "hours": [
        2,
        2,
        2
      ],
      "active": true,
      "sourceNote": "Supplied Portal preview identity. Additional attributes are preview fixtures, not a curriculum correction."
    },
    {
      "id": "MATH701",
      "code": "MATH701",
      "name": "Numerical Analysis",
      "credits": 4,
      "type": "core",
      "majors": [
        "All"
      ],
      "semester": 7,
      "seasons": [
        "winter"
      ],
      "prerequisites": [],
      "hours": [
        2,
        2,
        0
      ],
      "active": true,
      "sourceNote": "Supplied Portal preview identity. Additional attributes are preview fixtures, not a curriculum correction."
    },
    {
      "id": "CSEN501",
      "code": "CSEN501",
      "name": "Introduction to Computer Architecture",
      "credits": 6,
      "type": "core",
      "majors": [
        "CS"
      ],
      "semester": 5,
      "seasons": [
        "winter",
        "spring"
      ],
      "prerequisites": [],
      "hours": [
        2,
        2,
        2
      ],
      "active": true,
      "sourceNote": "Supplied Portal preview identity. Additional attributes are preview fixtures, not a curriculum correction."
    }
  ],
  "offerings": [
    {
      "id": "w26-CSEN701",
      "course": "CSEN701",
      "term": "w26",
      "instructors": [
        {
          "name": "Dr. Salma Adel",
          "email": "csen701@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "CS",
          "semester": 7,
          "group": ""
        }
      ],
      "published": true,
      "slots": [
        {
          "id": "w26-CSEN701-lecture-1",
          "type": "lecture",
          "group": "1",
          "day": "Sunday",
          "start": 630,
          "end": 690,
          "room": "C2.301",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w26-CSEN701-lecture-4",
          "type": "lecture",
          "group": "4",
          "day": "Sunday",
          "start": 510,
          "end": 570,
          "room": "C2.301",
          "capacity": 90,
          "assigned": 6
        },
        {
          "id": "w26-CSEN701-tutorial-1",
          "type": "tutorial",
          "group": "1",
          "day": "Tuesday",
          "start": 720,
          "end": 780,
          "room": "C2.204",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w26-CSEN701-tutorial-4",
          "type": "tutorial",
          "group": "4",
          "day": "Tuesday",
          "start": 600,
          "end": 660,
          "room": "C2.204",
          "capacity": 30,
          "assigned": 6
        },
        {
          "id": "w26-CSEN701-lab-1",
          "type": "lab",
          "group": "1",
          "day": "Wednesday",
          "start": 840,
          "end": 900,
          "room": "C7.102",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w26-CSEN701-lab-4",
          "type": "lab",
          "group": "4",
          "day": "Wednesday",
          "start": 720,
          "end": 780,
          "room": "C7.102",
          "capacity": 30,
          "assigned": 6
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    },
    {
      "id": "w26-CSEN703",
      "course": "CSEN703",
      "term": "w26",
      "instructors": [
        {
          "name": "Dr. Hany Youssef",
          "email": "csen703@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "CS",
          "semester": 7,
          "group": ""
        }
      ],
      "published": true,
      "slots": [
        {
          "id": "w26-CSEN703-lecture-1",
          "type": "lecture",
          "group": "1",
          "day": "Tuesday",
          "start": 630,
          "end": 690,
          "room": "C3.202",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w26-CSEN703-lecture-4",
          "type": "lecture",
          "group": "4",
          "day": "Tuesday",
          "start": 510,
          "end": 570,
          "room": "C3.202",
          "capacity": 90,
          "assigned": 6
        },
        {
          "id": "w26-CSEN703-tutorial-1",
          "type": "tutorial",
          "group": "1",
          "day": "Sunday",
          "start": 840,
          "end": 900,
          "room": "C3.104",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w26-CSEN703-tutorial-4",
          "type": "tutorial",
          "group": "4",
          "day": "Sunday",
          "start": 720,
          "end": 780,
          "room": "C3.104",
          "capacity": 30,
          "assigned": 6
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    },
    {
      "id": "w26-CSEN704",
      "course": "CSEN704",
      "term": "w26",
      "instructors": [
        {
          "name": "Dr. Amira Nabil",
          "email": "csen704@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "CS",
          "semester": 7,
          "group": ""
        }
      ],
      "published": true,
      "slots": [
        {
          "id": "w26-CSEN704-lab-1",
          "type": "lab",
          "group": "1",
          "day": "Monday",
          "start": 720,
          "end": 780,
          "room": "C7.102",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w26-CSEN704-lab-4",
          "type": "lab",
          "group": "4",
          "day": "Monday",
          "start": 600,
          "end": 660,
          "room": "C7.102",
          "capacity": 30,
          "assigned": 6
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    },
    {
      "id": "w26-DMET701",
      "course": "DMET701",
      "term": "w26",
      "instructors": [
        {
          "name": "Dr. Karim Fawzy",
          "email": "dmet701@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "DMET",
          "semester": 7,
          "group": ""
        }
      ],
      "published": false,
      "slots": [
        {
          "id": "w26-DMET701-lecture-1",
          "type": "lecture",
          "group": "1",
          "day": "Wednesday",
          "start": 720,
          "end": 780,
          "room": "C1.201",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w26-DMET701-lecture-4",
          "type": "lecture",
          "group": "4",
          "day": "Wednesday",
          "start": 600,
          "end": 660,
          "room": "C1.201",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w26-DMET701-lab-1",
          "type": "lab",
          "group": "1",
          "day": "Thursday",
          "start": 720,
          "end": 780,
          "room": "C1.101",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w26-DMET701-lab-4",
          "type": "lab",
          "group": "4",
          "day": "Thursday",
          "start": 600,
          "end": 660,
          "room": "C1.101",
          "capacity": 30,
          "assigned": 0
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    },
    {
      "id": "w25-CSEN701",
      "course": "CSEN701",
      "term": "w25",
      "instructors": [
        {
          "name": "Dr. Salma Adel",
          "email": "csen701@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "CS",
          "semester": 7,
          "group": ""
        }
      ],
      "published": true,
      "slots": [
        {
          "id": "w25-CSEN701-lecture-1",
          "type": "lecture",
          "group": "1",
          "day": "Sunday",
          "start": 630,
          "end": 690,
          "room": "C2.301",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w25-CSEN701-lecture-4",
          "type": "lecture",
          "group": "4",
          "day": "Sunday",
          "start": 510,
          "end": 570,
          "room": "C2.301",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w25-CSEN701-tutorial-1",
          "type": "tutorial",
          "group": "1",
          "day": "Tuesday",
          "start": 720,
          "end": 780,
          "room": "C2.204",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w25-CSEN701-tutorial-4",
          "type": "tutorial",
          "group": "4",
          "day": "Tuesday",
          "start": 600,
          "end": 660,
          "room": "C2.204",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w25-CSEN701-lab-1",
          "type": "lab",
          "group": "1",
          "day": "Wednesday",
          "start": 840,
          "end": 900,
          "room": "C7.102",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w25-CSEN701-lab-4",
          "type": "lab",
          "group": "4",
          "day": "Wednesday",
          "start": 720,
          "end": 780,
          "room": "C7.102",
          "capacity": 30,
          "assigned": 0
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    },
    {
      "id": "w25-CSEN703",
      "course": "CSEN703",
      "term": "w25",
      "instructors": [
        {
          "name": "Dr. Hany Youssef",
          "email": "csen703@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "CS",
          "semester": 7,
          "group": ""
        }
      ],
      "published": true,
      "slots": [
        {
          "id": "w25-CSEN703-lecture-1",
          "type": "lecture",
          "group": "1",
          "day": "Tuesday",
          "start": 630,
          "end": 690,
          "room": "C3.202",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w25-CSEN703-lecture-4",
          "type": "lecture",
          "group": "4",
          "day": "Tuesday",
          "start": 510,
          "end": 570,
          "room": "C3.202",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w25-CSEN703-tutorial-1",
          "type": "tutorial",
          "group": "1",
          "day": "Sunday",
          "start": 840,
          "end": 900,
          "room": "C3.104",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w25-CSEN703-tutorial-4",
          "type": "tutorial",
          "group": "4",
          "day": "Sunday",
          "start": 720,
          "end": 780,
          "room": "C3.104",
          "capacity": 30,
          "assigned": 0
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    },
    {
      "id": "w25-CSEN704",
      "course": "CSEN704",
      "term": "w25",
      "instructors": [
        {
          "name": "Dr. Amira Nabil",
          "email": "csen704@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "CS",
          "semester": 7,
          "group": ""
        }
      ],
      "published": true,
      "slots": [
        {
          "id": "w25-CSEN704-lab-1",
          "type": "lab",
          "group": "1",
          "day": "Monday",
          "start": 720,
          "end": 780,
          "room": "C7.102",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w25-CSEN704-lab-4",
          "type": "lab",
          "group": "4",
          "day": "Monday",
          "start": 600,
          "end": 660,
          "room": "C7.102",
          "capacity": 30,
          "assigned": 0
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    },
    {
      "id": "w25-DMET701",
      "course": "DMET701",
      "term": "w25",
      "instructors": [
        {
          "name": "Dr. Karim Fawzy",
          "email": "dmet701@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "DMET",
          "semester": 7,
          "group": ""
        }
      ],
      "published": true,
      "slots": [
        {
          "id": "w25-DMET701-lecture-1",
          "type": "lecture",
          "group": "1",
          "day": "Wednesday",
          "start": 720,
          "end": 780,
          "room": "C1.201",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w25-DMET701-lecture-4",
          "type": "lecture",
          "group": "4",
          "day": "Wednesday",
          "start": 600,
          "end": 660,
          "room": "C1.201",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w25-DMET701-lab-1",
          "type": "lab",
          "group": "1",
          "day": "Thursday",
          "start": 720,
          "end": 780,
          "room": "C1.101",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w25-DMET701-lab-4",
          "type": "lab",
          "group": "4",
          "day": "Thursday",
          "start": 600,
          "end": 660,
          "room": "C1.101",
          "capacity": 30,
          "assigned": 0
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    },
    {
      "id": "w25-ELCT701",
      "course": "ELCT701",
      "term": "w25",
      "instructors": [
        {
          "name": "Dr. Dina Adel",
          "email": "elct701@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "All",
          "semester": 7,
          "group": ""
        }
      ],
      "published": true,
      "slots": [
        {
          "id": "w25-ELCT701-lecture-1",
          "type": "lecture",
          "group": "1",
          "day": "Monday",
          "start": 630,
          "end": 690,
          "room": "C4.201",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w25-ELCT701-lecture-4",
          "type": "lecture",
          "group": "4",
          "day": "Monday",
          "start": 510,
          "end": 570,
          "room": "C4.201",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w25-ELCT701-tutorial-1",
          "type": "tutorial",
          "group": "1",
          "day": "Thursday",
          "start": 840,
          "end": 900,
          "room": "C4.204",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w25-ELCT701-tutorial-4",
          "type": "tutorial",
          "group": "4",
          "day": "Thursday",
          "start": 720,
          "end": 780,
          "room": "C4.204",
          "capacity": 30,
          "assigned": 0
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    },
    {
      "id": "w25-MATH701",
      "course": "MATH701",
      "term": "w25",
      "instructors": [
        {
          "name": "Dr. Ali Fathy",
          "email": "math701@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "All",
          "semester": 7,
          "group": ""
        }
      ],
      "published": true,
      "slots": [
        {
          "id": "w25-MATH701-lecture-1",
          "type": "lecture",
          "group": "1",
          "day": "Sunday",
          "start": 930,
          "end": 990,
          "room": "C5.201",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w25-MATH701-lecture-4",
          "type": "lecture",
          "group": "4",
          "day": "Sunday",
          "start": 810,
          "end": 870,
          "room": "C5.201",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "w25-MATH701-tutorial-1",
          "type": "tutorial",
          "group": "1",
          "day": "Wednesday",
          "start": 930,
          "end": 990,
          "room": "C5.204",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "w25-MATH701-tutorial-4",
          "type": "tutorial",
          "group": "4",
          "day": "Wednesday",
          "start": 810,
          "end": 870,
          "room": "C5.204",
          "capacity": 30,
          "assigned": 0
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    },
    {
      "id": "s26-CSEN701",
      "course": "CSEN701",
      "term": "s26",
      "instructors": [
        {
          "name": "Dr. Salma Adel",
          "email": "csen701@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "CS",
          "semester": 7,
          "group": ""
        }
      ],
      "published": true,
      "slots": [
        {
          "id": "s26-CSEN701-lecture-1",
          "type": "lecture",
          "group": "1",
          "day": "Sunday",
          "start": 630,
          "end": 690,
          "room": "C2.301",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "s26-CSEN701-lecture-4",
          "type": "lecture",
          "group": "4",
          "day": "Sunday",
          "start": 510,
          "end": 570,
          "room": "C2.301",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "s26-CSEN701-tutorial-1",
          "type": "tutorial",
          "group": "1",
          "day": "Tuesday",
          "start": 720,
          "end": 780,
          "room": "C2.204",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "s26-CSEN701-tutorial-4",
          "type": "tutorial",
          "group": "4",
          "day": "Tuesday",
          "start": 600,
          "end": 660,
          "room": "C2.204",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "s26-CSEN701-lab-1",
          "type": "lab",
          "group": "1",
          "day": "Wednesday",
          "start": 840,
          "end": 900,
          "room": "C7.102",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "s26-CSEN701-lab-4",
          "type": "lab",
          "group": "4",
          "day": "Wednesday",
          "start": 720,
          "end": 780,
          "room": "C7.102",
          "capacity": 30,
          "assigned": 0
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    },
    {
      "id": "s26-CSEN703",
      "course": "CSEN703",
      "term": "s26",
      "instructors": [
        {
          "name": "Dr. Hany Youssef",
          "email": "csen703@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "CS",
          "semester": 7,
          "group": ""
        }
      ],
      "published": true,
      "slots": [
        {
          "id": "s26-CSEN703-lecture-1",
          "type": "lecture",
          "group": "1",
          "day": "Tuesday",
          "start": 630,
          "end": 690,
          "room": "C3.202",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "s26-CSEN703-lecture-4",
          "type": "lecture",
          "group": "4",
          "day": "Tuesday",
          "start": 510,
          "end": 570,
          "room": "C3.202",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "s26-CSEN703-tutorial-1",
          "type": "tutorial",
          "group": "1",
          "day": "Sunday",
          "start": 840,
          "end": 900,
          "room": "C3.104",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "s26-CSEN703-tutorial-4",
          "type": "tutorial",
          "group": "4",
          "day": "Sunday",
          "start": 720,
          "end": 780,
          "room": "C3.104",
          "capacity": 30,
          "assigned": 0
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    },
    {
      "id": "u26-CSEN701",
      "course": "CSEN701",
      "term": "u26",
      "instructors": [
        {
          "name": "Dr. Salma Adel",
          "email": "csen701@guc.edu.eg"
        }
      ],
      "eligible": [
        {
          "major": "CS",
          "semester": 7,
          "group": ""
        }
      ],
      "published": true,
      "slots": [
        {
          "id": "u26-CSEN701-lecture-1",
          "type": "lecture",
          "group": "1",
          "day": "Sunday",
          "start": 630,
          "end": 690,
          "room": "C2.301",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "u26-CSEN701-lecture-4",
          "type": "lecture",
          "group": "4",
          "day": "Sunday",
          "start": 510,
          "end": 570,
          "room": "C2.301",
          "capacity": 90,
          "assigned": 0
        },
        {
          "id": "u26-CSEN701-tutorial-1",
          "type": "tutorial",
          "group": "1",
          "day": "Tuesday",
          "start": 720,
          "end": 780,
          "room": "C2.204",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "u26-CSEN701-tutorial-4",
          "type": "tutorial",
          "group": "4",
          "day": "Tuesday",
          "start": 600,
          "end": 660,
          "room": "C2.204",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "u26-CSEN701-lab-1",
          "type": "lab",
          "group": "1",
          "day": "Wednesday",
          "start": 840,
          "end": 900,
          "room": "C7.102",
          "capacity": 30,
          "assigned": 0
        },
        {
          "id": "u26-CSEN701-lab-4",
          "type": "lab",
          "group": "4",
          "day": "Wednesday",
          "start": 720,
          "end": 780,
          "room": "C7.102",
          "capacity": 30,
          "assigned": 0
        }
      ],
      "externalReferences": {
        "schedules": 0,
        "plans": 0,
        "slotChanges": 0
      }
    }
  ],
  "templates": [
    {
      "id": "group-1",
      "term": "w26",
      "major": "CS",
      "semester": 7,
      "group": "1",
      "entries": [
        {
          "offering": "w26-CSEN701",
          "slots": [
            "w26-CSEN701-lecture-1",
            "w26-CSEN701-tutorial-1",
            "w26-CSEN701-lab-1"
          ]
        },
        {
          "offering": "w26-CSEN703",
          "slots": [
            "w26-CSEN703-lecture-1",
            "w26-CSEN703-tutorial-1"
          ]
        },
        {
          "offering": "w26-CSEN704",
          "slots": [
            "w26-CSEN704-lab-1"
          ]
        }
      ],
      "published": true,
      "version": 1
    },
    {
      "id": "group-2",
      "term": "w26",
      "major": "CS",
      "semester": 7,
      "group": "2",
      "entries": [
        {
          "offering": "w26-CSEN701",
          "slots": [
            "w26-CSEN701-lecture-4",
            "w26-CSEN701-tutorial-4",
            "w26-CSEN701-lab-4"
          ]
        },
        {
          "offering": "w26-CSEN703",
          "slots": [
            "w26-CSEN703-lecture-4",
            "w26-CSEN703-tutorial-4"
          ]
        },
        {
          "offering": "w26-CSEN704",
          "slots": [
            "w26-CSEN704-lab-4"
          ]
        }
      ],
      "published": true,
      "version": 1
    },
    {
      "id": "group-3",
      "term": "w26",
      "major": "CS",
      "semester": 7,
      "group": "3",
      "entries": [
        {
          "offering": "w26-CSEN701",
          "slots": [
            "w26-CSEN701-lecture-1",
            "w26-CSEN701-tutorial-1",
            "w26-CSEN701-lab-1"
          ]
        },
        {
          "offering": "w26-CSEN703",
          "slots": [
            "w26-CSEN703-lecture-1",
            "w26-CSEN703-tutorial-1"
          ]
        },
        {
          "offering": "w26-CSEN704",
          "slots": [
            "w26-CSEN704-lab-1"
          ]
        }
      ],
      "published": true,
      "version": 1
    },
    {
      "id": "group-4",
      "term": "w26",
      "major": "CS",
      "semester": 7,
      "group": "4",
      "entries": [
        {
          "offering": "w26-CSEN701",
          "slots": [
            "w26-CSEN701-lecture-4",
            "w26-CSEN701-tutorial-4",
            "w26-CSEN701-lab-4"
          ]
        },
        {
          "offering": "w26-CSEN703",
          "slots": [
            "w26-CSEN703-lecture-4",
            "w26-CSEN703-tutorial-4"
          ]
        },
        {
          "offering": "w26-CSEN704",
          "slots": [
            "w26-CSEN704-lab-4"
          ]
        }
      ],
      "published": true,
      "version": 1
    }
  ],
  "students": [
    {
      "id": "student-0",
      "name": "Omar Hassan",
      "studentId": "70-71577",
      "email": "omar.hassan@student.guc.edu.eg",
      "type": "normal",
      "major": "CS",
      "semester": 7,
      "active": true,
      "assignment": "group-4",
      "history": []
    },
    {
      "id": "student-1",
      "name": "Mariam Mostafa",
      "studentId": "70-71578",
      "email": "mariam.mostafa@student.guc.edu.eg",
      "type": "normal",
      "major": "CS",
      "semester": 7,
      "active": true,
      "assignment": null,
      "history": []
    },
    {
      "id": "student-2",
      "name": "Ahmed Khaled",
      "studentId": "70-71579",
      "email": "ahmed.khaled@student.guc.edu.eg",
      "type": "normal",
      "major": "CS",
      "semester": 7,
      "active": true,
      "assignment": "group-4",
      "history": []
    },
    {
      "id": "student-3",
      "name": "Farah Mahmoud",
      "studentId": "70-71580",
      "email": "farah.mahmoud@student.guc.edu.eg",
      "type": "normal",
      "major": "CS",
      "semester": 7,
      "active": true,
      "assignment": null,
      "history": []
    },
    {
      "id": "student-4",
      "name": "Youssef Tarek",
      "studentId": "70-71581",
      "email": "youssef.tarek@student.guc.edu.eg",
      "type": "normal",
      "major": "CS",
      "semester": 7,
      "active": true,
      "assignment": "group-4",
      "history": []
    },
    {
      "id": "student-5",
      "name": "Laila Amr",
      "studentId": "70-71582",
      "email": "laila.amr@student.guc.edu.eg",
      "type": "normal",
      "major": "CS",
      "semester": 7,
      "active": true,
      "assignment": null,
      "history": []
    },
    {
      "id": "student-6",
      "name": "Nour Ibrahim",
      "studentId": "70-71583",
      "email": "nour.ibrahim@student.guc.edu.eg",
      "type": "normal",
      "major": "CS",
      "semester": 7,
      "active": true,
      "assignment": "group-4",
      "history": []
    },
    {
      "id": "student-7",
      "name": "Salma Tamer",
      "studentId": "70-71584",
      "email": "salma.tamer@student.guc.edu.eg",
      "type": "normal",
      "major": "CS",
      "semester": 7,
      "active": true,
      "assignment": null,
      "history": []
    },
    {
      "id": "student-8",
      "name": "Kareem Mostafa",
      "studentId": "70-71585",
      "email": "kareem.mostafa@student.guc.edu.eg",
      "type": "normal",
      "major": "CS",
      "semester": 7,
      "active": true,
      "assignment": "group-4",
      "history": []
    },
    {
      "id": "student-9",
      "name": "Yasmin Adel",
      "studentId": "70-71586",
      "email": "yasmin.adel@student.guc.edu.eg",
      "type": "normal",
      "major": "CS",
      "semester": 7,
      "active": true,
      "assignment": null,
      "history": []
    },
    {
      "id": "student-10",
      "name": "Ali Nabil",
      "studentId": "70-71587",
      "email": "ali.nabil@student.guc.edu.eg",
      "type": "normal",
      "major": "CS",
      "semester": 7,
      "active": true,
      "assignment": "group-4",
      "history": []
    },
    {
      "id": "student-11",
      "name": "Hana Sherif",
      "studentId": "70-71588",
      "email": "hana.sherif@student.guc.edu.eg",
      "type": "normal",
      "major": "CS",
      "semester": 7,
      "active": true,
      "assignment": null,
      "history": []
    }
  ],
  "activity": [],
  "standings": []
};
