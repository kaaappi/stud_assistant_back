import express from 'express';
const router = express.Router();
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pkg from 'pg';
const { Pool } = pkg;
import * as dotenv from "dotenv";
dotenv.config({
  path: "${__dirname}/../.env",
});
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Необхідні ім\'я користувача та пароль' });
  }

  try {

    const query = `SELECT * FROM Registration WHERE Username = '${username}'`;


    pool.query(query, async (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Something went wrong, try again pool' });
      }

      if (!result.rows || result.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid username or password' });
      }

      const user = result.rows[0];

      const passwordMatch = await bcrypt.compare(password, user.password);


      if (!passwordMatch) {
        return res.status(400).json({ message: 'Invalid username or password' });
      }

      const token = jwt.sign({ userId: user.id }, 'mySecretKey', { expiresIn: '1h' });


      res.json({
        token,
        isAdmin: user.IsAdmin
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Something went wrong, try again' });
  }
});


export default router