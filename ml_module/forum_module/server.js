const express = require("express");
const { spawn } = require("child_process");
const rateLimit = require("express-rate-limit");
const mysql = require("mysql2/promise");

const app = express();
app.use(express.static("public"));
app.use(express.json());

// Rate limiter
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 2,
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many complaints submitted. Please wait before trying again."
    });
  }
});

// MySQL connection pool
// 🔹 Use a dedicated app user instead of root
const pool = mysql.createPool({
  host: "localhost",
  user: "sevika_user",       // new user you create
  password: "sevika123", // password for the new user
  database: "sevika_db",
  waitForConnections: true,
  connectionLimit: 10
});

// CREATE POST
app.post("/create-post", limiter, async (req, res) => {
  const { content, type, action, organization } = req.body;

  if (!content || !organization) {
    return res.status(400).json({ message: "Content and organization are required." });
  }

  // Spam detection
  const pythonProcess = spawn("python", ["../ml_spam/predict_spam.py", content]);

  pythonProcess.stdout.on("data", async (data) => {
    const result = data.toString().trim();
    if (result === "spam") {
      return res.status(403).json({ message: "Post rejected: Detected as spam" });
    }

    try {
      // Insert into MySQL
      const [rows] = await pool.execute(
        `INSERT INTO posts (type, requested_action, content, organization) VALUES (?, ?, ?, ?)`,
        [type, action, content, organization]
      );

      res.json({
        message: "Post created successfully",
        postId: rows.insertId
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Database error" });
    }
  });

  pythonProcess.stderr.on("data", (err) => {
    console.error("Python error:", err.toString());
  });
});

// VOTE
app.post("/vote/:postId/:voteType", async (req, res) => {
  const { postId, voteType } = req.params;
  const userIP = req.ip;

  try {
    // Upsert vote (one vote per IP)
    await pool.execute(
      `
      INSERT INTO votes (post_id, user_identifier, vote_type)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE vote_type = ?
      `,
      [postId, userIP, voteType, voteType]
    );

    res.json({ message: "Vote recorded/updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error" });
  }
});

// GET POSTS WITH VOTES AND PAGINATION
app.get("/posts", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const offset = (page - 1) * limit;

  try {
    // 🔹 LIMIT/OFFSET cannot use ? placeholders; interpolate safely as integers
    const [posts] = await pool.query(`
      SELECT p.*,
             COUNT(CASE WHEN v.vote_type = 'up' THEN 1 END) AS upvotes,
             COUNT(CASE WHEN v.vote_type = 'down' THEN 1 END) AS downvotes
      FROM posts p
      LEFT JOIN votes v ON p.id = v.post_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Total posts for pagination
    const [countRows] = await pool.execute(`SELECT COUNT(*) as total FROM posts`);
    const totalPages = Math.ceil(countRows[0].total / limit);

    res.json({ posts, totalPages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database error" });
  }
});

app.listen(5000, () => {
  console.log("Forum module running on port 5000");
});