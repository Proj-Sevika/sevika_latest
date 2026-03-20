const express = require("express");
const { spawn } = require("child_process");
const rateLimit = require("express-rate-limit");
const db = require("../db");   // reuse main DB connection
const axios = require("axios");

const router = express.Router();

// Rate limiter
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many complaints submitted. Please wait before trying again."
    });
  }
});

// ================= CREATE POST =================
router.post("/create-post", limiter, async (req, res) => {
  const { content, type, action, organization } = req.body;

  if (!content || !organization) {
    return res.status(400).json({ message: "Content and organization required" });
  }

  try {
    // 🔵 Call ML API
    const mlResponse = await axios.post("http://127.0.0.1:5001/analyze", {
      message: content
    });

    const { spam, urgency } = mlResponse.data;

    // 🔴 If spam → reject
    if (spam) {
      return res.status(400).json({
        message: "Post detected as spam and was rejected."
      });
    }

    // 🟢 If not spam → Save to DB (with urgency)
    const sql = `
    INSERT INTO posts 
    (type, requested_action, content, organization, urgency)
    VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [type, action, content, organization, urgency], (err, result) => {
    if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
    }

    res.json({
        message: "Post created successfully",
        postId: result.insertId,
        urgency: urgency
    });
    });
  } catch (error) {
    console.error("ML API error:", error.message);
    return res.status(500).json({
      message: "Spam detection service unavailable."
    });
  }
});
// ================= VOTE =================
router.post("/vote/:postId/:voteType", (req, res) => {
  const { postId, voteType } = req.params;
  const userIP = req.ip;

  const sql = `
    INSERT INTO votes (post_id, user_identifier, vote_type)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE vote_type = ?
  `;

  db.query(sql, [postId, userIP, voteType, voteType], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json({ message: "Vote recorded" });
  });
});

// ================= GET POSTS =================
router.get("/posts", (req, res) => {

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const offset = (page - 1) * limit;

  const postsSql = `
    SELECT p.*,
      COUNT(CASE WHEN v.vote_type = 'up' THEN 1 END) AS upvotes,
      COUNT(CASE WHEN v.vote_type = 'down' THEN 1 END) AS downvotes
    FROM posts p
    LEFT JOIN votes v ON p.id = v.post_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countSql = `SELECT COUNT(*) AS total FROM posts`;

  db.query(postsSql, [limit, offset], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }

    db.query(countSql, (err2, countResult) => {
      if (err2) {
        console.error(err2);
        return res.status(500).json({ message: "Count error" });
      }

      const totalPosts = countResult[0].total;
      const totalPages = Math.ceil(totalPosts / limit);

      res.json({
        posts: rows,
        totalPages
      });
    });
  });
});

module.exports = router;