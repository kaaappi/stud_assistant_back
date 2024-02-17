import express from "express";
import bcrypt from "bcrypt";
import pkg from 'pg';
const { Pool } = pkg;
import * as dotenv from "dotenv";
dotenv.config({
  path: "${__dirname}/../.env",
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const router = express.Router();

router.post("/register", async (req, res) => {
  const { username, password } = req.body;


  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Необхідні ім'я користувача та пароль" });
  }

  try {
    const queryExistingUser = `
      SELECT * FROM Registration WHERE Username = '${username}'
    `;

    const getRows = async () => {
      return new Promise((resolve, reject) => {
        pool.query(queryExistingUser, (err, result) => {
          if (err) {
            console.error(err);
            reject(err);
          } else {
            resolve(result.rows);
          }
        });
      });
    };

     getRows()
      .then(async (rows) => {
        const existingUser = rows;
        console.log(existingUser && existingUser.length > 0)
        if (existingUser && existingUser.length > 0) {
          return res.status(400).json({message: 'User is already exist'});
        }
        else {
          const hashedPassword = await bcrypt.hash(password, 10);
          const queryInsertUser = `
        INSERT INTO Registration (username, password) VALUES ('${username}', '${hashedPassword}')
      `;
          pool.query( queryInsertUser, (errInsert, result) => {
            if (errInsert) {
              console.error(errInsert);
              return res.status(500).json({ message: 'Error adding user' });
            }
            return res.status(201).json({ message: 'User successfully registered' });
          });
        }


      })
      .catch((error) => {
        console.error(error);
      });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Щось пішло не так, спробуйте знову" });
  }
});

export default router