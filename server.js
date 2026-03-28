const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const db = require("./db");   // MySQL connection file
const fs = require("fs");
require("dotenv").config();
const jwt = require("jsonwebtoken");

// Initialize express app
const app = express();

// Rate limiter for forum
const forumLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many complaints submitted. Please wait before trying again."
    });
  }
});

/* =====================================================
   JWT AUTH MIDDLEWARE
===================================================== */
app.use(cors({
  origin: function (origin, callback) {
    console.log("CORS Origin Header:", origin);
    // Allow any origin for debugging, especially localhost:5173/5174
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Global request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});


function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ message: "Access Denied" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid or Expired Token" });
        req.user = user;
        next();
    });
}

function authorizeRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden: Access not allowed" });
        }
        next();
    };
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));


/* =====================================================
   FORUM ROUTES
===================================================== */
app.post("/api/forum/create-post", forumLimiter, async (req, res) => {
  const { content, type, action, organization } = req.body;
  if (!content || !organization) {
    return res.status(400).json({ message: "Content and organization required" });
  }
  try {
    const mlResponse = await axios.post("http://127.0.0.1:5001/analyze", { message: content });
    const { spam, urgency } = mlResponse.data;
    if (spam) return res.status(400).json({ message: "Post detected as spam and rejected." });
    
    const sql = `INSERT INTO posts (type, requested_action, content, organization, urgency) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [type, action, content, organization, urgency], (err, result) => {
      if (err) return res.status(500).json({ message: "Database error" });
      res.json({ message: "Post created successfully", postId: result.insertId, urgency });
    });
  } catch (error) {
    return res.status(500).json({ message: "Spam detection service unavailable." });
  }
});

app.post("/api/forum/vote/:postId/:voteType", (req, res) => {
  const { postId, voteType } = req.params;
  const userIP = req.ip;
  const sql = `INSERT INTO votes (post_id, user_identifier, vote_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vote_type = ?`;
  db.query(sql, [postId, userIP, voteType, voteType], (err) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json({ message: "Vote recorded" });
  });
});

app.get("/api/forum/posts", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const offset = (page - 1) * limit;
  const postsSql = `SELECT p.*, COUNT(CASE WHEN v.vote_type = 'up' THEN 1 END) AS upvotes, COUNT(CASE WHEN v.vote_type = 'down' THEN 1 END) AS downvotes FROM posts p LEFT JOIN votes v ON p.id = v.post_id GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
  db.query(postsSql, [limit, offset], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error" });
    db.query(`SELECT COUNT(*) AS total FROM posts`, (err2, countResult) => {
      if (err2) return res.status(500).json({ message: "Count error" });
      res.json({ posts: rows, totalPages: Math.ceil(countResult[0].total / limit) });
    });
  });
});

/* =====================================================
   REGISTER
===================================================== */
app.post("/register", async (req, res) => {
  const { full_name, email, phone, password, role, latitude, longitude } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const sql = `INSERT INTO user_sev
      (full_name, email, phone, latitude, longitude, password, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [full_name, email, phone, latitude || null, longitude || null, hashed, role], 
      (err, result) => {
        if (err) { console.log(err); return res.send("Registration failed"); }
        res.json({ success: true, role, id: result.insertId, name: full_name });
      }
    );  
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   LOGIN
===================================================== */
app.post("/login", (req, res) => {
    const { email, password } = req.body;
    console.log("LOGIN ATTEMPT:", email);
    fs.appendFileSync("server_debug.log", `[${new Date().toISOString()}] LOGIN ATTEMPT: ${email}\n`);
    
    db.query("SELECT * FROM user_sev WHERE email = ?", [email], async (err, results) => {
        if (err) {
            console.error("LOGIN DB ERROR:", err);
            fs.appendFileSync("server_debug.log", `[${new Date().toISOString()}] LOGIN DB ERROR: ${err.message}\n`);
            return res.status(500).json({ message: "Database error" });
        }
        
        if (results.length === 0) {
            console.log("LOGIN FAILED: User not found", email);
            fs.appendFileSync("server_debug.log", `[${new Date().toISOString()}] LOGIN FAILED: User not found: ${email}\n`);
            return res.status(400).json({ message: "User not found" });
        }

        const user = results[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log("LOGIN FAILED: Invalid password", email);
            fs.appendFileSync("server_debug.log", `[${new Date().toISOString()}] LOGIN FAILED: Invalid password: ${email}\n`);
            return res.status(400).json({ message: "Invalid password" });
        }

        const token = jwt.sign(
            { id: user.id, full_name: user.full_name, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES }
        );

        console.log("LOGIN SUCCESS:", email, "Role:", user.role);
        fs.appendFileSync("server_debug.log", `[${new Date().toISOString()}] LOGIN SUCCESS: ${email} (Role: ${user.role})\n`);
        res.json({ success: true, token, role: user.role, id: user.id, name: user.full_name });
    });
});

app.get("/donor/dashboard", authenticateToken, authorizeRole("donor"), (req, res) => {
    res.json({ message: `Welcome Donor ${req.user.full_name}` });
});

app.get("/organisation/dashboard", authenticateToken, authorizeRole("organisation"), (req, res) => {
    res.json({ message: `Welcome Organisation ${req.user.full_name}` });
});

app.get("/admin/dashboard", authenticateToken, authorizeRole("admin"), (req, res) => {
    res.json({ message: `Welcome Admin ${req.user.full_name}` });
});

/* =====================================================
   ADD DONATION
===================================================== */
app.post("/add-donation", authenticateToken, authorizeRole("donor"), (req, res) => {
  const user_id = req.user.id;
  const { category, gender, age_group, food_type, prepared_date, best_before, pickup_urgency, medicine_name, expiry_date, item_name, organisation_id, pickup_preference, expected_datetime, quantity } = req.body;
  console.log("PAYLOAD RECEIVED (/add-donation):", JSON.stringify(req.body, null, 2));

  let data = { gender: null, age_group: null, food_type: null, prepared_date: null, best_before: null, pickup_urgency: null, medicine_name: null, expiry_date: null, item_name: null };
  const logMsg = `[${new Date().toISOString()}] /add-donation body: ${JSON.stringify(req.body)}\n`;
  fs.appendFileSync("server_debug.log", logMsg);

  if (category === "clothes") { data.gender = gender || null; data.age_group = age_group || null; }
  if (category === "food") { 
    data.food_type = food_type || null; 
    data.prepared_date = prepared_date || null; 
    data.best_before = best_before || null; 
    data.pickup_urgency = pickup_urgency || null; 
  } else {
    // For non-food items, donor cannot choose organization
    req.body.organisation_id = null;
  }
  if (category === "medicine") { data.medicine_name = medicine_name || null; data.expiry_date = expiry_date || null; }
  if (["toiletries", "electricals", "stationary", "others"].includes(category)) { data.item_name = item_name || null; }

  const organisation_id_to_use = (category === "food") ? organisation_id : null;

  const sql = `INSERT INTO donations (user_id, category, gender, age_group, food_type, prepared_date, best_before, pickup_urgency, medicine_name, expiry_date, item_name, organisation_id, pickup_preference, expected_datetime, quantity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`;
  const finalQuantity = quantity || 1;
  console.log("FINAL QUANTITY TO DB:", finalQuantity);
  fs.appendFileSync("server_debug.log", `[${new Date().toISOString()}] FINAL QUANTITY TO DB: ${finalQuantity}\n`);

  db.query(sql, [user_id, category, data.gender, data.age_group, data.food_type, data.prepared_date, data.best_before, data.pickup_urgency, data.medicine_name, data.expiry_date, data.item_name, organisation_id_to_use || null, pickup_preference || "pickup", expected_datetime, finalQuantity], (err) => {
    if (err) { console.log(err); return res.status(500).json({ message: "Donation failed" }); }
    res.json({ message: "Donation added successfully" });
  });
});

/* =====================================================
   DONOR HISTORY
===================================================== */
app.get("/donor/history", authenticateToken, authorizeRole("donor"), async (req, res) => {
    try {
        const [rows] = await db.promise().query(`
            SELECT d.donation_id, d.category, d.item_name, d.status, d.created_at, d.quantity, u.full_name AS organisation_name
            FROM donations d
            LEFT JOIN user_sev u ON d.organisation_id = u.id
            WHERE d.user_id = ?
            ORDER BY d.created_at DESC
        `, [req.user.id]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});
// ================= ADD ORGANIZATION NEED =================
app.post("/add-org-request",
    authenticateToken,
    authorizeRole("organisation"),
    (req, res) => {

  const org_id = req.user.id;
  const {
    category,
    gender,
    age_group,
    subcategory,
    quantity,
    urgency,
  } = req.body;
  console.log("PAYLOAD RECEIVED (/add-org-request):", JSON.stringify(req.body, null, 2));

  if (!org_id || !category) return res.status(400).json({ message: "Org ID and category required" });

  const sql = `INSERT INTO org_needs 
    (org_id, category, subcategory, gender, age_group, quantity, urgency) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`;

  db.query(sql, [
    org_id,
    category,
    subcategory || null,
    gender || null,
    age_group || null,
    quantity || 1,
    urgency || "Medium",
  ], (err) => {
    if (err) {
      console.log("add-org-request error", err);
      return res.status(500).json({ message: "Failed to post request" });
    }
    res.json({ message: "Request posted successfully" });
  });
});

// organisation donation requests
app.post("/request-donation",
  authenticateToken,
  authorizeRole("organisation"), (req, res) => {
    const org_id = req.user.id;
  const { donation_id, quantity } = req.body;

  db.query(
    "SELECT * FROM donation_requests WHERE donation_id=? AND org_id=?",
    [donation_id, org_id],
    (err, rows) => {
      if (rows.length > 0) return res.json({ success:false, message: "Already requested" });

      db.query(
        "INSERT INTO donation_requests (donation_id, org_id, requested_quantity) VALUES (?,?,?)",
        [donation_id, org_id, quantity || 1],
        () => {
          db.query(
            "UPDATE donations SET status='Requested' WHERE donation_id=?",
            [donation_id]
          );
          res.json({ success:true });
        }
      );
    }
  );
});
/* =====================================================
   ORG REQUESTS
===================================================== */
app.get("/org-requests/:orgId", authenticateToken, authorizeRole("organisation"), async (req, res) => {
    const orgId = req.user.id;
    try {
        const [rows] = await db.promise().query(`
            SELECT
              n.need_id AS id,
              'need' AS type,
              n.category,
              n.gender,
              n.age_group,
              n.subcategory,
              n.quantity,
              n.urgency,
              n.status,
              n.created_at
            FROM org_needs n
            WHERE n.org_id = ?
            ORDER BY created_at DESC
        `, [orgId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch requests" });
    }
});

/* =====================================================
   ADMIN ALL REQUESTS
===================================================== */
app.get("/admin/all-requests", authenticateToken, authorizeRole("admin"), async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT 
        n.need_id AS id,
        u.full_name AS requester,
        n.category AS title,
        n.subcategory AS description,
        NULL AS requested_quantity,
        n.urgency,
        n.status,
        n.created_at,
        'need' AS type
      FROM org_needs n
      JOIN user_sev u ON n.org_id = u.id

      UNION ALL

      SELECT 
        dr.request_id AS id,
        u.full_name AS requester,
        d.category AS title,
        d.item_name AS description,
        dr.requested_quantity AS requested_quantity,
        'Medium' AS urgency,
        d.status AS status,
        dr.requested_at AS created_at,
        'donation' AS type
      FROM donation_requests dr
      JOIN user_sev u ON dr.org_id = u.id
      JOIN donations d ON dr.donation_id = d.donation_id

      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});

/* =====================================================
   ADMIN FULFILL NEED
===================================================== */
app.post("/admin/settle-need", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const { id, donation_id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: "Need ID required" });

  console.log(`SETTLE-NEED START: need_id=${id}, donation_id=${donation_id}`);

  try {
    const [nRows] = await db.promise().query("SELECT * FROM org_needs WHERE need_id = ?", [id]);
    if (nRows.length === 0) return res.status(404).json({ success: false, message: "Need not found" });
    const need = nRows[0];
    const org_id = need.org_id;

    console.log(`NEED DATA: qty=${need.quantity}, org=${org_id}`);

    await db.promise().query("UPDATE org_needs SET status='Fulfilled' WHERE need_id=?", [id]);

    if (donation_id) {
      const [dRows] = await db.promise().query("SELECT * FROM donations WHERE donation_id=?", [donation_id]);
      if (dRows.length === 0) return res.status(500).json({ success: false, message: "Donation not found" });
      
      const donation = dRows[0];
      const need_qty = Number(need.quantity || 1);
      const don_qty = Number(donation.quantity || 0);

      console.log(`SETTLEMENT LOGIC: don_qty=${don_qty}, need_qty=${need_qty}`);

      if (don_qty > need_qty) {
        console.log("EXECUING PARTIAL SETTLEMENT");
        // Update original to remaining quantity
        await db.promise().query(
          "UPDATE donations SET quantity = quantity - ?, status = 'Pending' WHERE donation_id = ?",
          [need_qty, donation_id]
        );
        
        // Create new settled record
        const insertSql = `INSERT INTO donations 
          (user_id, category, gender, age_group, food_type, prepared_date, best_before, pickup_urgency, medicine_name, expiry_date, item_name, organisation_id, pickup_preference, expected_datetime, quantity, status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Settled')`;
        
        await db.promise().query(insertSql, [
          donation.user_id, donation.category, donation.gender, donation.age_group, 
          donation.food_type, donation.prepared_date, donation.best_before, 
          donation.pickup_urgency, donation.medicine_name, donation.expiry_date, 
          donation.item_name, org_id, donation.pickup_preference, 
          donation.expected_datetime, need_qty
        ]);

        res.json({ success: true, message: `Need fulfilled partially. ${need_qty} items settled, ${don_qty - need_qty} remain.` });
      } else {
        console.log("EXECUTING FULL SETTLEMENT");
        await db.promise().query(
          "UPDATE donations SET status='Settled', organisation_id=? WHERE donation_id=?",
          [org_id, donation_id]
        );
        res.json({ success: true, message: "Need fulfilled and donation fully settled" });
      }
    } else {
      res.json({ success: true, message: "Need marked as fulfilled manually" });
    }
  } catch (err) {
    console.error("SETTLE-NEED ERROR:", err);
    res.status(500).json({ success: false, message: "Internal server error during settlement" });
  }
});

/* =====================================================
   ADMIN FULFILL DONATION (Partial Support)
===================================================== */
app.post("/admin/settledonation", authenticateToken, authorizeRole("admin"), async (req, res) => {
  const { id } = req.body;
  console.log(`SETTLE-DONATION-REQ START: request_id=${id}`);

  try {
    const [reqRows] = await db.promise().query("SELECT * FROM donation_requests WHERE request_id=?", [id]);
    if (reqRows.length === 0) return res.json({ success: false, message: "Request not found" });

    const { donation_id, org_id, requested_quantity } = reqRows[0];
    const [donRows] = await db.promise().query("SELECT * FROM donations WHERE donation_id=?", [donation_id]);
    if (donRows.length === 0) return res.json({ success: false, message: "Donation not found" });

    const donation = donRows[0];
    const available_quantity = Number(donation.quantity || 0);
    const req_qty = Number(requested_quantity || 0);

    console.log(`REQ DATA: don_qty=${available_quantity}, req_qty=${req_qty}`);

    if (req_qty < available_quantity) {
      console.log("EXECUTING PARTIAL SETTLEMENT (REQ)");
      const insertSql = `INSERT INTO donations 
        (user_id, category, gender, age_group, food_type, prepared_date, best_before, pickup_urgency, medicine_name, expiry_date, item_name, organisation_id, pickup_preference, expected_datetime, quantity, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Settled')`;
      
      await db.promise().query(insertSql, [
        donation.user_id, donation.category, donation.gender, donation.age_group, 
        donation.food_type, donation.prepared_date, donation.best_before, 
        donation.pickup_urgency, donation.medicine_name, donation.expiry_date, 
        donation.item_name, org_id, donation.pickup_preference, 
        donation.expected_datetime, req_qty
      ]);

      await db.promise().query(
        "UPDATE donations SET quantity = quantity - ?, status = 'Pending' WHERE donation_id=?",
        [req_qty, donation_id]
      );
      
      await db.promise().query("DELETE FROM donation_requests WHERE request_id=?", [id]);
      res.json({ success: true, message: "Partially settled. Remaining quantity is back in inventory." });
    } else {
      console.log("EXECUTING FULL SETTLEMENT (REQ)");
      await db.promise().query(
        "UPDATE donations SET status='Settled', organisation_id=? WHERE donation_id=?",
        [org_id, donation_id]
      );
      await db.promise().query("DELETE FROM donation_requests WHERE request_id=?", [id]);
      res.json({ success: true, message: "Fully settled." });
    }
  } catch (err) {
    console.error("SETTLE-DONATION ERROR:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/* =====================================================
   ADMIN: RECENT (SETTLED) DONATIONS
===================================================== */
app.get("/admin/recent-donations", authenticateToken, authorizeRole("admin"), async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT d.donation_id, d.user_id, d.category, d.item_name, d.status, d.created_at AS settled_date, d.quantity,
             donor.full_name AS donor_name,
             org.full_name AS organisation_name
      FROM donations d
      JOIN user_sev donor ON d.user_id = donor.id
      LEFT JOIN user_sev org ON d.organisation_id = org.id
      WHERE d.status = 'Settled'
      ORDER BY d.created_at DESC
      LIMIT 5
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

/* =====================================================
   ADMIN: AVAILABLE (PENDING/REQUESTED) ITEMS
===================================================== */
app.get("/admin/available-items", authenticateToken, authorizeRole("admin"), async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT d.donation_id, d.user_id, d.category, d.item_name, d.status, d.organisation_id, d.quantity,
             d.gender, d.age_group,
             donor.full_name AS donor_name,
             org.full_name AS chosen_org_name
      FROM donations d
      JOIN user_sev donor ON d.user_id = donor.id
      LEFT JOIN user_sev org ON d.organisation_id = org.id
      WHERE d.status IN ('Pending', 'Requested')
      ORDER BY d.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

/* =====================================================
   ADMIN: LIST ALL ORGANISATIONS
===================================================== */
app.get("/admin/organisations", authenticateToken, authorizeRole("admin"), async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT id, full_name, email, phone FROM user_sev WHERE role = 'organisation'"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

/* =====================================================
   ADMIN: ORG NEEDS (SEPARATE ENDPOINT)
===================================================== */
app.get("/admin/org-needs", authenticateToken, authorizeRole("admin"), async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT 
        n.need_id AS id,
        u.full_name AS organisation_name,
        u.id AS org_id,
        n.category,
        n.gender,
        n.age_group,
        NULL AS food_type,
        NULL AS prepared_date,
        NULL AS best_before,
        NULL AS pickup_urgency,
        NULL AS medicine_name,
        NULL AS expiry_date,
        n.subcategory AS item_name,
        n.quantity,
        NULL AS pickup_preference,
        NULL AS expected_datetime,
        n.category AS title,
        n.subcategory AS description,
        n.urgency,
        n.status,
        n.created_at
      FROM org_needs n
      JOIN user_sev u ON n.org_id = u.id
      WHERE n.status = 'Open'
      ORDER BY n.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});

/* =====================================================
   ADMIN: DONATION REQUESTS (SEPARATE ENDPOINT)
===================================================== */
app.get("/admin/donation-requests", authenticateToken, authorizeRole("admin"), async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT 
        dr.request_id AS id,
        u.full_name AS organisation_name,
        u.id AS org_id,
        d.category,
        d.item_name AS title,
        dr.requested_quantity,
        d.quantity AS available_quantity,
        dr.requested_at AS created_at,
        d.donation_id,
        d.status AS donation_status,
        donor.full_name AS donor_name,
        donor.id AS donor_id
      FROM donation_requests dr
      JOIN user_sev u ON dr.org_id = u.id
      JOIN donations d ON dr.donation_id = d.donation_id
      JOIN user_sev donor ON d.user_id = donor.id
      WHERE d.status = 'Requested'
      ORDER BY dr.requested_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});

/* =====================================================
   ADMIN: FOOD DONATIONS
===================================================== */
app.get("/admin/food-donations", authenticateToken, authorizeRole("admin"), async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT d.donation_id, d.user_id, d.quantity, d.created_at,
             donor.full_name AS donor_name,
             org.full_name AS organisation_name
      FROM donations d
      JOIN user_sev donor ON d.user_id = donor.id
      LEFT JOIN user_sev org ON d.organisation_id = org.id
      WHERE d.category = 'food'
      ORDER BY d.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

/* =====================================================
   ADMIN: DONOR DETAILS
===================================================== */
app.get("/admin/donor/:id", authenticateToken, authorizeRole("admin"), async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT id, full_name, email, phone, latitude, longitude FROM user_sev WHERE id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Donor not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

/* =====================================================
   ADMIN: SETTLE DONATION (admin has final say)
===================================================== */
app.post("/admin/settle-donation", authenticateToken, authorizeRole("admin"), (req, res) => {
  const { donation_id, organisation_id } = req.body;
  if (!donation_id) {
    return res.status(400).json({ success: false, message: "Donation ID required" });
  }
  if (!organisation_id) {
    return res.status(400).json({ success: false, message: "Please select an organisation" });
  }

  db.query("SELECT organisation_id FROM donations WHERE donation_id = ?", [donation_id], (err, rows) => {
    if (err) { console.error(err); return res.status(500).json({ success: false, message: "DB error" }); }
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Donation not found" });

    // Admin has final authority — settle directly with admin's chosen org
    db.query(
      `UPDATE donations SET status='Settled', organisation_id=?, proposed_org_id=NULL, original_org_id=NULL WHERE donation_id=?`,
      [organisation_id, donation_id],
      (err2) => {
        if (err2) { console.error(err2); return res.status(500).json({ success: false, message: "DB error" }); }
        res.json({ success: true, message: "Donation settled successfully" });
      }
    );
  });
});

/* =====================================================
   DONOR: NOTIFICATIONS (org-change proposals)
===================================================== */
app.get("/donor/notifications", authenticateToken, authorizeRole("donor"), async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT d.donation_id, d.category, d.created_at,
             orig.full_name AS original_org_name,
             prop.full_name AS proposed_org_name
      FROM donations d
      LEFT JOIN user_sev orig ON d.original_org_id = orig.id
      LEFT JOIN user_sev prop ON d.proposed_org_id = prop.id
      WHERE d.user_id = ? AND d.status = 'OrgChangeProposed'
      ORDER BY d.created_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

/* =====================================================
   DONOR: RESPOND TO ORG CHANGE
===================================================== */
app.post("/donor/respond-org-change", authenticateToken, authorizeRole("donor"), (req, res) => {
  const { donation_id, action } = req.body;
  if (!donation_id || !action) {
    return res.status(400).json({ success: false, message: "donation_id and action required" });
  }

  // Verify this donation belongs to the donor and is in OrgChangeProposed status
  db.query(
    "SELECT * FROM donations WHERE donation_id = ? AND user_id = ? AND status = 'OrgChangeProposed'",
    [donation_id, req.user.id],
    (err, rows) => {
      if (err) { console.error(err); return res.status(500).json({ success: false, message: "DB error" }); }
      if (rows.length === 0) return res.status(404).json({ success: false, message: "No pending proposal found" });

      const donation = rows[0];

      if (action === "accept") {
        // Accept admin's proposed org
        db.query(
          `UPDATE donations SET status='Settled', organisation_id=?, proposed_org_id=NULL, original_org_id=NULL WHERE donation_id=?`,
          [donation.proposed_org_id, donation_id],
          (err2) => {
            if (err2) { console.error(err2); return res.status(500).json({ success: false, message: "DB error" }); }
            res.json({ success: true, message: "Accepted. Donation settled with the new organisation." });
          }
        );
      } else if (action === "reject") {
        // Reject — restore original org, revert to Pending
        db.query(
          `UPDATE donations SET status='Pending', organisation_id=?, proposed_org_id=NULL, original_org_id=NULL WHERE donation_id=?`,
          [donation.original_org_id, donation_id],
          (err2) => {
            if (err2) { console.error(err2); return res.status(500).json({ success: false, message: "DB error" }); }
            res.json({ success: true, message: "Rejected. Donation reverted to your original organisation." });
          }
        );
      } else if (action === "withdraw") {
        // Withdraw donation entirely
        db.query(
          `UPDATE donations SET status='Withdrawn', proposed_org_id=NULL, original_org_id=NULL WHERE donation_id=?`,
          [donation_id],
          (err2) => {
            if (err2) { console.error(err2); return res.status(500).json({ success: false, message: "DB error" }); }
            res.json({ success: true, message: "Donation withdrawn successfully." });
          }
        );
      } else {
        res.status(400).json({ success: false, message: "Invalid action. Use: accept, reject, or withdraw" });
      }
    }
  );
});

/* =====================================================
   ORG: AVAILABLE DONATIONS (pending items for orgs to request)
===================================================== */
app.get("/donations/available", authenticateToken, authorizeRole("organisation"), async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT d.donation_id, d.category, d.item_name, d.user_id, d.quantity,
             donor.full_name AS donor_name
      FROM donations d
      JOIN user_sev donor ON d.user_id = donor.id
      WHERE d.status = 'Pending'
      ORDER BY d.created_at DESC
    `);
    console.log("QUANTITIES_FETCHED:", rows);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

/* =====================================================
   DONOR: NEARBY ORGANISATIONS (for food donations)
===================================================== */
app.get("/food/nearby-orgs", authenticateToken, authorizeRole("donor"), async (req, res) => {
  try {
    // Get the donor's location
    const [donorRows] = await db.promise().query(
      "SELECT latitude, longitude FROM user_sev WHERE id = ?",
      [req.user.id]
    );

    const donor = donorRows[0];
    const donorLat = donor && donor.latitude ? parseFloat(donor.latitude) : null;
    const donorLng = donor && donor.longitude ? parseFloat(donor.longitude) : null;

    // Get ALL organisations (not just ones with location)
    const [orgs] = await db.promise().query(
      "SELECT id, full_name AS name, latitude, longitude FROM user_sev WHERE role = 'organisation'"
    );

    // Calculate distance if both donor and org have coordinates
    const result = orgs.map(org => {
      const orgLat = org.latitude ? parseFloat(org.latitude) : null;
      const orgLng = org.longitude ? parseFloat(org.longitude) : null;

      let distance = null;
      if (donorLat !== null && donorLng !== null && orgLat !== null && orgLng !== null) {
        const R = 6371; // km
        const dLat = (orgLat - donorLat) * Math.PI / 180;
        const dLon = (orgLng - donorLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(donorLat * Math.PI / 180) * Math.cos(orgLat * Math.PI / 180) *
                  Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distance = R * c;
      }

      return { id: org.id, name: org.name, distance };
    });

    // Sort: orgs with distance first (ascending), then orgs without distance
    result.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

/* =====================================================
   SERVER
===================================================== */
// TO:
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
