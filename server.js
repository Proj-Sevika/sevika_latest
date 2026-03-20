// Import required modules
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const db = require("./db");   // MySQL connection file
require("dotenv").config();
const jwt = require("jsonwebtoken");
const forumRoutes = require("./routes/forumRoutes");

// Initialize express app
const app = express();


/* =====================================================
   JWT AUTH MIDDLEWARE
===================================================== */
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

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

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));


app.use("/api/forum", forumRoutes);

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
    db.query("SELECT * FROM user_sev WHERE email = ?", [email], async (err, results) => {
        if (err || results.length === 0) return res.status(400).json({ message: "User not found" });

        const user = results[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ message: "Invalid password" });

        const token = jwt.sign(
            { id: user.id, full_name: user.full_name, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES }
        );

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
  const { category, gender, age_group, food_type, prepared_date, best_before, pickup_urgency, medicine_name, expiry_date, item_name, organisation_id, pickup_preference, expected_datetime } = req.body;

  let data = { gender: null, age_group: null, food_type: null, prepared_date: null, best_before: null, pickup_urgency: null, medicine_name: null, expiry_date: null, item_name: null };
  if (category === "clothes") { data.gender = gender || null; data.age_group = age_group || null; }
  if (category === "food") { data.food_type = food_type || null; data.prepared_date = prepared_date || null; data.best_before = best_before || null; data.pickup_urgency = pickup_urgency || null; }
  if (category === "medicine") { data.medicine_name = medicine_name || null; data.expiry_date = expiry_date || null; }
  if (category === "others") { data.item_name = item_name || null; }

  const sql = `INSERT INTO donations (user_id, category, gender, age_group, food_type, prepared_date, best_before, pickup_urgency, medicine_name, expiry_date, item_name, organisation_id, pickup_preference, expected_datetime, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`;

  db.query(sql, [user_id, category, data.gender, data.age_group, data.food_type, data.prepared_date, data.best_before, data.pickup_urgency, data.medicine_name, data.expiry_date, data.item_name, organisation_id || null, pickup_preference || "pickup", expected_datetime], (err) => {
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
            SELECT d.donation_id, d.category, d.status, d.created_at, u.full_name AS organisation_name
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
  const { title, description, urgency } = req.body;
  if (!org_id || !title) return res.status(400).json({ message: "Title & Org ID required" });

  const sql = `INSERT INTO org_needs (org_id, title, description, urgency) VALUES (?, ?, ?, ?)`;
  db.query(sql, [org_id, title, description || "", urgency || "Medium"], (err) => {
    if (err) return res.status(500).json({ message: "Failed to post request" });
    res.json({ message: "Request posted successfully" });
  });
});

// organisation donation requests
app.post("/request-donation",
  authenticateToken,
  authorizeRole("organisation"), (req, res) => {
    const org_id = req.user.id;
  const { donation_id} = req.body;

  db.query(
    "SELECT * FROM donation_requests WHERE donation_id=? AND org_id=?",
    [donation_id, org_id],
    (err, rows) => {
      if (rows.length > 0) return res.json({ success:false });

      db.query(
        "INSERT INTO donation_requests (donation_id,org_id) VALUES (?,?)",
        [donation_id, org_id],
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
app.get("/org-requests/:orgId", authenticateToken, authorizeRole("organisation"), (req, res) => {
    const orgId = req.user.id;
    const sql = `SELECT * FROM org_needs WHERE org_id = ? ORDER BY created_at DESC`;
    db.query(sql, [orgId], (err, rows) => {
        if (err) return res.status(500).json({ message: "Failed to fetch requests" });
        res.json(rows);
    });
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
        n.title,
        n.description,
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
        'Medium' AS urgency,
        d.status AS status,
        dr.created_at AS created_at,
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
app.post("/admin/settle-need", authenticateToken, authorizeRole("admin"), (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: "Need ID required" });

  db.query("UPDATE org_needs SET status='Fulfilled' WHERE need_id=? AND status='Pending'", [id], (err,result) => {
      if (err) { console.error(err); return res.status(500).json({ success: false, message: "DB error" }); }
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Request already settled or not found" });
      res.json({ success: true, message: "Request successfully settled" });
  });
});

/* =====================================================
   ADMIN FULFILL DONATION
===================================================== */
app.post("/admin/settledonation", authenticateToken, authorizeRole("admin"), (req, res) => {
  const { id } = req.body;

  db.query("SELECT donation_id FROM donation_requests WHERE request_id=?", [id], (err, rows) => {
    if (err) { console.error(err); return res.status(500).json({ success: false, message: "DB error" }); }
    if (rows.length === 0) return res.json({ success:false, message: "Request not found" });

    const donationId = rows[0].donation_id;
    db.query("UPDATE donations SET status='Settled' WHERE donation_id=?", [donationId], (err2) => {
      if (err2) { console.error(err2); return res.status(500).json({ success: false, message: "DB error" }); }
      res.json({ success:true });
    });
  });
});

/* =====================================================
   ADMIN: RECENT (SETTLED) DONATIONS
===================================================== */
app.get("/admin/recent-donations", authenticateToken, authorizeRole("admin"), async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT d.donation_id, d.category, d.status, d.created_at AS settled_date,
             donor.full_name AS donor_name,
             org.full_name AS organisation_name
      FROM donations d
      JOIN user_sev donor ON d.user_id = donor.id
      LEFT JOIN user_sev org ON d.organisation_id = org.id
      WHERE d.status = 'Settled'
      ORDER BY d.created_at DESC
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
      SELECT d.donation_id, d.category, d.status, d.organisation_id,
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
      SELECT d.donation_id, d.category, d.user_id,
             donor.full_name AS donor_name
      FROM donations d
      JOIN user_sev donor ON d.user_id = donor.id
      WHERE d.status = 'Pending'
      ORDER BY d.created_at DESC
    `);
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
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
