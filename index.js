import express from "express";
import cors from "cors";
import register from './registration/register.js'
import login from './registration/login.js'
import pkg from 'pg';
const { Pool } = pkg;
import * as dotenv from "dotenv";
dotenv.config({
  path: "${__dirname}/../.env",
});

const app = express();
const port = 3000;
app.use(express.json());
app.use(cors());

app.use('/auth', register);
app.use('/auth', login);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Successfully connected to the database.');
  }
});

// ============================================== Сторінка з викладачами ==============================================

app.get("/getTeachers", (req, res) => {
  const param = req.query.Param;

  const query = `SELECT DISTINCT T.LastName, T.FirstName, T.MiddleName, T.Email, P.PositionName
FROM Teachers T
LEFT JOIN Positions P ON T.PositionID = P.PositionID
LEFT JOIN WorkLoads WL ON T.TeacherID = WL.TeacherID
LEFT JOIN Subjects S ON WL.SubjectID = S.SubjectID
LEFT JOIN Departments D ON S.DepartmentID = D.DepartmentID
WHERE 
    P.PositionName = '${param}'
    OR S.SubjectName = '${param}'
    OR D.DepartmentName = '${param}';`;

  pool.query(query, (err, result) => {
    if (err) {
      console.error(err);
      res
        .status(500)
        .send(
          "Помилка виконання запиту до бази даних."
        );
    } else {
      res.json(result.rows);
    }
  });
});


app.post("/addTeacher", (req, res) => {
  const { PositionName, LastName, FirstName, MiddleName, Email } = req.body;
  const query = `INSERT INTO Teachers (PositionID, LastName, FirstName, MiddleName, Email)
     VALUES (
     (SELECT PositionID FROM Positions WHERE PositionName = '${PositionName}'),
     '${LastName}',
     '${FirstName}',
     '${MiddleName}',
     '${Email}');
    `;

  pool.query( query, (err, result) => {
    if (err) {
      console.error(err);
      res
        .status(500)
        .send("Помилка при додаванні викладача до бази даних" + err);
    } else {
      res.status(200).send("Викладач успішно доданий до бази даних");
    }
  });
});


app.delete("/deleteTeacher", (req, res) => {
  const teacherFullName = req.query.TeacherFullName;
  const [lastName, firstName, middleName] = teacherFullName.split(" ");
  const query = `
    DELETE FROM Teachers
    WHERE LastName = '${lastName}' AND FirstName =  '${firstName}' AND MiddleName = '${middleName}'`;

  pool.query(query, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("Помилка під час видалення викладача з бази даних");
    } else {
      res.status(200).send("Викладач успішно видалений з бази даних");
    }
  });
});

app.put("/editTeacherByFullName", async (req, res) => {
  const { LastName,FirstName,MiddleName,PositionName, Email } = req.body;
  console.log(req.body)
  try {
    const updateQuery = `
          UPDATE Teachers
          SET PositionID = (SELECT PositionID FROM Positions WHERE PositionName = '${PositionName}'),
          Email = '${Email}'
          WHERE LastName = '${LastName}' AND FirstName = '${FirstName}' AND MiddleName = '${MiddleName}';`;

    pool.query(updateQuery, (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send("Помилка при оновленні викладача у базі даних");
      } else {
        res.status(200).send("Викладача успішно оновлено у базі даних");
      }
    });
  } catch (error) {
    console.error(error);
    res.status(404).send(error.message);
  }
});

// ============================================== Сторінка з педнавантаженням ==============================================

app.get("/getWorkloadByFullName", (req, res) => {
  const teacherFullName = req.query.TeacherFullName;

  const query = `
SELECT 
    'Lecture' AS "Type", 
    s.SubjectName AS "Subject", 
    STRING_AGG(g.GroupCode, ', ') AS "GroupCode", 
    SUM(wl.LoadHours) AS "Hours",
    CONCAT(t.LastName, ' ', t.FirstName, ' ', t.MiddleName) AS "FullName",
    '' AS "Position"
FROM WorkLoads wl
JOIN Subjects s ON wl.SubjectID = s.SubjectID
JOIN Groups g ON wl.GroupID = g.GroupID
JOIN LessonTypes lt ON s.LessonTypeID = lt.LessonTypeID
JOIN Teachers t ON wl.TeacherID = t.TeacherID
JOIN Positions p ON t.PositionID = p.PositionID
WHERE (t.LastName = '${teacherFullName}' OR t.FirstName = '${teacherFullName}' OR t.MiddleName = '${teacherFullName}'
    OR CONCAT(t.FirstName, ' ', t.LastName) = '${teacherFullName}' OR CONCAT(t.LastName, ' ', t.FirstName) = '${teacherFullName}'
    OR CONCAT(t.FirstName, ' ', t.MiddleName) = '${teacherFullName}' OR CONCAT(t.MiddleName, ' ', t.FirstName) = '${teacherFullName}'
    OR CONCAT(t.LastName, ' ', t.MiddleName) = '${teacherFullName}' OR CONCAT(t.MiddleName, ' ', t.LastName) = '${teacherFullName}'
    OR CONCAT(t.LastName, ' ', t.FirstName, ' ', t.MiddleName) = '${teacherFullName}' OR CONCAT(t.FirstName, ' ', t.MiddleName, ' ', t.LastName) = '${teacherFullName}'
    OR CONCAT(t.MiddleName, ' ', t.FirstName, ' ', t.LastName) = '${teacherFullName}' OR CONCAT(t.FirstName, ' ', t.LastName, ' ', t.MiddleName) = '${teacherFullName}'
    OR CONCAT(t.MiddleName, ' ', t.LastName, ' ', t.FirstName) = '${teacherFullName}')
    AND lt.LessonTypeName = 'Lecture'
GROUP BY s.SubjectName, t.LastName, t.FirstName, t.MiddleName, p.PositionName

UNION ALL

SELECT 
    'Practice' AS "Type", 
    s.SubjectName AS "Subject", 
    STRING_AGG(g.GroupCode, ', ') AS "GroupCode", 
    SUM(wl.LoadHours) AS "Hours",
    CONCAT(t.LastName, ' ', t.FirstName, ' ', t.MiddleName) AS "FullName",
    '' AS "Position"
FROM WorkLoads wl
JOIN Subjects s ON wl.SubjectID = s.SubjectID
JOIN Groups g ON wl.GroupID = g.GroupID
JOIN LessonTypes lt ON s.LessonTypeID = lt.LessonTypeID
JOIN Teachers t ON wl.TeacherID = t.TeacherID
JOIN Positions p ON t.PositionID = p.PositionID
WHERE (t.LastName = '${teacherFullName}' OR t.FirstName = '${teacherFullName}' OR t.MiddleName = '${teacherFullName}'
    OR CONCAT(t.FirstName, ' ', t.LastName) = '${teacherFullName}' OR CONCAT(t.LastName, ' ', t.FirstName) = '${teacherFullName}'
    OR CONCAT(t.FirstName, ' ', t.MiddleName) = '${teacherFullName}' OR CONCAT(t.MiddleName, ' ', t.FirstName) = '${teacherFullName}'
    OR CONCAT(t.LastName, ' ', t.MiddleName) = '${teacherFullName}' OR CONCAT(t.MiddleName, ' ', t.LastName) = '${teacherFullName}'
    OR CONCAT(t.LastName, ' ', t.FirstName, ' ', t.MiddleName) = '${teacherFullName}' OR CONCAT(t.FirstName, ' ', t.MiddleName, ' ', t.LastName) = '${teacherFullName}'
    OR CONCAT(t.MiddleName, ' ', t.FirstName, ' ', t.LastName) = '${teacherFullName}' OR CONCAT(t.FirstName, ' ', t.LastName, ' ', t.MiddleName) = '${teacherFullName}'
    OR CONCAT(t.MiddleName, ' ', t.LastName, ' ', t.FirstName) = '${teacherFullName}')
    AND lt.LessonTypeName = 'Practice'
GROUP BY s.SubjectName, t.LastName, t.FirstName, t.MiddleName, p.PositionName

UNION ALL

SELECT 
    'All' AS "Type", 
    '' AS "Subject", 
    '' AS "GroupCode", 
    COALESCE(SUM(wl.LoadHours), 0) AS "Hours",
    CONCAT(t.LastName, ' ', t.FirstName, ' ', t.MiddleName) AS "FullName",
    p.PositionName AS "Position"
FROM Teachers t
LEFT JOIN WorkLoads wl ON wl.TeacherID = t.TeacherID
LEFT JOIN Subjects s ON wl.SubjectID = s.SubjectID
LEFT JOIN Groups g ON wl.GroupID = g.GroupID
LEFT JOIN LessonTypes lt ON s.LessonTypeID = lt.LessonTypeID
LEFT JOIN Positions p ON t.PositionID = p.PositionID
WHERE (t.LastName = '${teacherFullName}' OR t.FirstName = '${teacherFullName}' OR t.MiddleName = '${teacherFullName}'
    OR CONCAT(t.FirstName, ' ', t.LastName) = '${teacherFullName}' OR CONCAT(t.LastName, ' ', t.FirstName) = '${teacherFullName}'
    OR CONCAT(t.FirstName, ' ', t.MiddleName) = '${teacherFullName}' OR CONCAT(t.MiddleName, ' ', t.FirstName) = '${teacherFullName}'
    OR CONCAT(t.LastName, ' ', t.MiddleName) = '${teacherFullName}' OR CONCAT(t.MiddleName, ' ', t.LastName) = '${teacherFullName}'
    OR CONCAT(t.LastName, ' ', t.FirstName, ' ', t.MiddleName) = '${teacherFullName}' OR CONCAT(t.FirstName, ' ', t.MiddleName, ' ', t.LastName) = '${teacherFullName}'
    OR CONCAT(t.MiddleName, ' ', t.FirstName, ' ', t.LastName) = '${teacherFullName}' OR CONCAT(t.FirstName, ' ', t.LastName, ' ', t.MiddleName) = '${teacherFullName}'
    OR CONCAT(t.MiddleName, ' ', t.LastName, ' ', t.FirstName) = '${teacherFullName}')
GROUP BY t.LastName, t.FirstName, t.MiddleName, p.PositionName;
 `

  pool.query(query, (err, result) => {
    if (err) {
      console.error(err);
      res
        .status(500)
        .send(
          "Ошибка выполнения запроса к базе данных. заг кількості годин(лекц+практ) по ПІБ викладача"
        );
    } else {
      res.json(result.rows);
    }
  });
});

app.put("/editLoadByFullName", async (req, res) => {
  const { TeacherFullName, SubjectName, GroupCode, LoadHours } = req.body;
  console.log(req.body)
  try {
    const updateQuery = `
      UPDATE WorkLoads
SET 
   
    LoadHours = '${LoadHours}'
WHERE TeacherID = (
    SELECT TeacherID 
    FROM Teachers 
    WHERE CONCAT(LastName, ' ', FirstName, ' ', MiddleName) = '${TeacherFullName}'
)
AND SubjectID = (
    SELECT s.SubjectID 
    FROM Subjects s 
    WHERE s.SubjectName = '${SubjectName}' 
AND GroupID = (
        SELECT g.GroupID 
        FROM Groups g 
        WHERE g.GroupCode = '${GroupCode}'
    )
);`;

    pool.query(updateQuery, (err, result) => {
      if (err) {
        console.error(err);
        res
          .status(500)
          .send("Помилка при оновленні педнавантаження у базі даних");
      } else {
        res.status(200).send("Педнавантаження успішно оновлено у базі даних");
      }
    });
  } catch (error) {
    console.error(error);
    res.status(404).send(error.message);
  }
});

app.post("/addLoad", (req, res) => {


  const { TeacherFullName, SubjectName, GroupCode, LoadHours } = req.body;
  console.log(TeacherFullName)
  const query = `INSERT INTO WorkLoads (TeacherID, SubjectID, GroupID, LoadHours)
SELECT 
    (SELECT TeacherID FROM Teachers WHERE CONCAT(LastName, ' ', FirstName, ' ', MiddleName) = '${TeacherFullName}'), 
    (SELECT SubjectID FROM Subjects WHERE SubjectName = '${SubjectName}'),
    (SELECT GroupID FROM Groups WHERE GroupCode = '${GroupCode}'),
    ${LoadHours};
    `;

  pool.query(query, (err, result) => {
    if (err) {
      console.error(err);
      res
        .status(500)
        .send("Помилка при додаванні педнавантаження до бази даних" + err);
    } else {
      res.status(200).send("Педнавантаження успішно доданий до бази даних");
    }
  });
});

app.delete("/deleteLoadByFullNameAndGroup", (req, res) => {
  const { TeacherFullName, GroupCode, SubjectName } = req.query;

  const query = `
  DECLARE @deletedRowCount INT;
  DELETE FROM WorkLoads
  WHERE TeacherID = (
      SELECT TeacherID
      FROM Teachers
      WHERE CONCAT(LastName, ' ', FirstName, ' ', MiddleName) = '${TeacherFullName}'
  )
  AND GroupID = (
      SELECT GroupID
      FROM Groups
      WHERE GroupCode = '${GroupCode}'
  )
  AND SubjectID = (
      SELECT SubjectID
      FROM Subjects
      WHERE SubjectName = '${SubjectName}'
  );
  SET @deletedRowCount = @@ROWCOUNT;
  SELECT @deletedRowCount AS "DeletedRowCount";`;

  pool.query(query, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send("Помилка при видаленні педнавантаження");
    } else {
      if (result && result.length > 0) {
        const deletedRowCount = result[0].DeletedRowCount;
        if (deletedRowCount > 0) {
          res.status(200).send(`Успішно видалено ${deletedRowCount} записів з педнавантаження`);
        } else {
          res.status(404).send("Запис не знайдено для видалення");
        }
      }
    }
  });
});

// ============================================== Сторінка з розкладом ==============================================

app.get("/getScheduleByGroup", (req, res) => {
  const groupCode = req.query.GroupCode;

  const query = `SELECT
    CONCAT(t.LastName, ' ', t.FirstName, ' ', t.MiddleName) AS "TeacherName",
    sub.SubjectName AS "SubjectName",
    lt.LessonTypeName AS "LessonType",
    g.GroupCode AS "GroupCode",
    c.RoomNumber AS "Classroom",
    wd.WeekDayName AS "WeekDayName",
    s.PairNumber AS "PairNumber"
FROM Schedule s
INNER JOIN Teachers t ON s.TeacherID = t.TeacherID
INNER JOIN Subjects sub ON s.SubjectID = sub.SubjectID
INNER JOIN LessonTypes lt ON sub.LessonTypeID = lt.LessonTypeID
INNER JOIN Groups g ON s.GroupID = g.GroupID
INNER JOIN Classrooms c ON s.ClassroomID = c.ClassroomID
INNER JOIN WeekDays wd ON s.DayID = wd.DayID
WHERE s.GroupID = (
    SELECT GroupID
    FROM Groups
    WHERE GroupCode = '${groupCode}'
);`;

  pool.query(query, (err, result) => {
    if (err) {
      console.error(err);
      res
        .status(500)
        .send(
          "Ошибка выполнения запроса к базе данных. Отримання всієї таблиці розкладу"
        );
    } else {
      res.json(result.rows);
    }
  });
});

// ============================================== Додаткові запити ==============================================
app.get("/getAllDeps", (req, res) => {
  const query = `SELECT STRING_AGG(DepartmentName, ', ') AS "DepartmentNames"
    FROM Departments;`;

  pool.query(query, (err, result) => {
    if (err) {
      console.error(err);
      res
        .status(500)
        .send("Ошибка выполнения запроса к базе данных. getAllDeps");
    } else {

      res.json(result.rows);
    }
  });

});

app.get("/getData", (req, res) => {
  let result_to_send = {};

  // Отримання назв кафедр
  const queryDepartments = `SELECT STRING_AGG(DepartmentName, ', ') AS DepartmentNames FROM Departments;`;
  pool.query( queryDepartments, (errDep, result) => {
    if (errDep) {
      console.error(errDep);
      res.status(500).send("Помилка при отриманні назв кафедр");
    } else {
      result_to_send.DepartmentNames = result.rows[0].departmentnames;

      const querySubjects = `SELECT STRING_AGG(SubjectName, ', ') AS SubjectNames FROM Subjects;`;
      pool.query( querySubjects, (errSub, result) => {
        if (errSub) {
          console.error(errSub);
          res.status(500).send("Помилка при отриманні назв предметів");
        } else {
          result_to_send.SubjectNames =  result.rows[0].subjectnames;


          const queryPositions = `SELECT STRING_AGG(PositionName, ', ') AS PositionNames FROM Positions;`;
          pool.query(queryPositions, (errPos, result) => {
            if (errPos) {
              console.error(errPos);
              res.status(500).send("Помилка при отриманні назв посад");
            } else {
              result_to_send.PositionNames =  result.rows[0].positionnames;
              res.json([result_to_send]);
            }
          });
        }
      });
    }
  });
});

app.get("/getAllSubjsAndGroups", (req, res) => {
  const query = `SELECT 'Subjects' AS "Type", STRING_AGG(SubjectName, ', ') AS "Data"
FROM Subjects

UNION ALL

SELECT 'Groups' AS "Type", STRING_AGG(GroupCode, ', ') AS "Data"
FROM Groups;`;

  pool.query( query, (err, result) => {
    if (err) {
      console.error(err);
      res
        .status(500)
        .send("Ошибка выполнения запроса к базе данных. getAllSubjects");
    } else {
      res.json(result.rows);
    }
  });
});


app.get("/getGroupsByFullNameAndSubj", (req, res) => {
  const { fullName, subjectName } = req.query;

  const query = `
   SELECT STRING_AGG(G.GroupCode, ',') AS "GroupCodes"
FROM WorkLoads WL
JOIN Teachers T ON WL.TeacherID = T.TeacherID
JOIN Subjects S ON WL.SubjectID = S.SubjectID
JOIN Groups G ON WL.GroupID = G.GroupID
WHERE S.SubjectName = '${subjectName}'
AND CONCAT(T.LastName, ' ', T.FirstName, ' ', T.MiddleName) = '${fullName}';`;

  pool.query( query, (err, rows) => {
    if (err) {
      console.error(err);
      res
        .status(500)
        .send("Ошибка выполнения запроса к базе данных. getGroupsByFullNameAndSubj");
    } else {
      res.json(rows);
    }
  });
});


app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});


