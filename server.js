// Import required modules
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("./db");   // MySQL connection file

// Initialize express app
const app = express();

// Middleware to handle form data & JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static frontend files (HTML, CSS, JS)
app.use(express.static("public"));

/* =====================================================
   ===================== REGISTER ======================
   Handles new user registration (donor / organisation)
===================================================== */
app.post("/register", async (req, res) => {
  const { full_name, email, phone, password, role, latitude, longitude } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO user_sev
      (full_name, email, phone, latitude, longitude, password, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [full_name,
      email,
      phone,
      latitude || null,
      longitude || null,
      hashed,
      role,

    ], (err, result) => {
  if (err) {
    console.log(err);
    return res.send("Registration failed");
  }

  const userId = result.insertId;

  if (role === "donor")
    return res.redirect(`/dashboards/donor.html?id=${userId}&name=${full_name}`);

  if (role === "organisation")
    return res.redirect(`/dashboards/organ_dash.html?id=${userId}&name=${full_name}`);

  if (role === "admin")
    return res.redirect("/dashboards/admin.html");
});
}catch{
  res.send("Error")
}
});



/* =====================================================
   ======================= LOGIN =======================
   Authenticates user and redirects to dashboard
===================================================== */
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.get('/test-bcrypt', async (req, res) => {
  const hash = '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36FhL0pPzGkN7L6kD9XxY9a';
  const ok = await bcrypt.compare('1234', hash);
  res.send(ok ? 'MATCH' : 'NO MATCH');
});


app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM user_sev WHERE email=?";

  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.log(err);
      return res.send("DB error");
    }
    if (results.length === 0) return res.send("User not found");

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Incorrect password");

    // Redirect to dashboard with name + id in URL
    if (user.role === "donor")
      return res.redirect(`/dashboards/donor.html?name=${user.full_name}&id=${user.id}`);
    if (user.role === "organisation")
      return res.redirect(`/dashboards/organ_dash.html?name=${user.full_name}&id=${user.id}`);
    if (user.role === "admin")
      return res.redirect(`/dashboards/admin.html?name=${user.full_name}&id=${user.id}`);
  });
  
});



/* =====================================================
   =================== ADD DONATION ====================
   Stores donation with category-based NULL handling
===================================================== */
app.post("/add-donation", (req, res) => {
  const {
    user_id, category,
    gender, age_group,
    food_type, prepared_date, best_before, pickup_urgency,
    medicine_name, expiry_date,
    item_name, organisation_id, pickup_preference, expected_datetime
  } = req.body;

  // Initialize all category fields as NULL
  let data = { gender: null, age_group: null, food_type: null, prepared_date: null,
               best_before: null, pickup_urgency: null, medicine_name: null,
               expiry_date: null, item_name: null };

  if (category === "clothes") { data.gender = gender || null; data.age_group = age_group || null; }
  if (category === "food") { data.food_type = food_type || null; data.prepared_date = prepared_date || null; data.best_before = best_before || null; data.pickup_urgency = pickup_urgency || null; }
  if (category === "medicine") { data.medicine_name = medicine_name || null; data.expiry_date = expiry_date || null; }
  if (category === "others") { data.item_name = item_name || null; }

  const sql = `
    INSERT INTO donations (
      user_id, category,
      gender, age_group,
      food_type, prepared_date, best_before, pickup_urgency,
      medicine_name, expiry_date,
      item_name,organisation_id, pickup_preference, expected_datetime
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [
    user_id, category,
    data.gender, data.age_group,
    data.food_type, data.prepared_date, data.best_before, data.pickup_urgency,
    data.medicine_name, data.expiry_date,
    data.item_name, organisation_id||null, pickup_preference, expected_datetime
  ], (err) => {
    if (err) { console.log(err); return res.status(500).json({ message: "Donation failed" }); }
    res.json({ message: "Donation added successfully" });
  });
});

/* =====================================================
   ============ NEARBY FOOD ORGANISATIONS ==============
   Returns organisations near donor (distance-based)
===================================================== */


app.get("/food/nearby-orgs", (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json([]);

  // 1️⃣ Get donor's latitude & longitude
  const donorSql = `
    SELECT latitude, longitude
    FROM user_sev
    WHERE id = ? AND role = 'donor'
  `;

  db.query(donorSql, [userId], (err, donorRows) => {
    if (err || donorRows.length === 0) {
      console.log(err);
      return res.status(500).json([]);
    }

    const { latitude, longitude } = donorRows[0];

    // 2️⃣ Find nearby organisations (within 5 km)
    const orgSql = `
      SELECT 
        id,
        full_name AS name,
        (
          6371 * ACOS(
            COS(RADIANS(?)) *
            COS(RADIANS(latitude)) *
            COS(RADIANS(longitude) - RADIANS(?)) +
            SIN(RADIANS(?)) *
            SIN(RADIANS(latitude))
          )
        ) AS distance
      FROM user_sev
      WHERE role = 'organisation'
      HAVING distance <= 50
      ORDER BY distance ASC
    `;

    db.query(orgSql, [latitude, longitude, latitude], (err, orgRows) => {
      if (err) {
        console.log(err);
        return res.status(500).json([]);
      }
      res.json(orgRows);
    });
  });
});


/* =====================================================
   ================= DONATION HISTORY ==================
   Fetches donation history for donor dashboard
===================================================== */
app.get("/donor/history", async (req, res) => {
    const userId = req.query.userId;

    try {
        const [rows] = await db.promise().query(`
            SELECT
                d.donation_id,
                d.category,
                d.status,
                d.created_at,
                u.full_name AS organisation_name
                FROM donations d
                LEFT JOIN user_sev u
                ON d.organisation_id = u.id
            WHERE d.user_id = ?
            ORDER BY d.created_at DESC
        `, [userId]);

        res.json(rows); // MUST be array
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// AVAILABLE DONATIONS (STATUS = PENDING)
app.get("/donations/available", async (req, res) => {
    try {
        const [rows] = await db.promise().query(`
            SELECT
                d.donation_id,
                d.category,
                d.created_at,
                d.user_id
            FROM donations d
            WHERE d.status = 'Pending'
            ORDER BY d.created_at DESC
        `);

        res.json(rows);
    } catch (err) {
        console.error("Error fetching available donations:", err);
        res.status(500).json([]);
    }
});


// ================= ADD ORGANIZATION NEED =================
app.post("/add-org-request", (req, res) => {
  const { org_id, title, description, urgency } = req.body;
  if (!org_id || !title) return res.status(400).json({ message: "Title & Org ID required" });

  const sql = `INSERT INTO org_needs (org_id, title, description, urgency) VALUES (?, ?, ?, ?)`;
  db.query(sql, [org_id, title, description || "", urgency || "Medium"], (err) => {
    if (err) return res.status(500).json({ message: "Failed to post request" });
    res.json({ message: "Request posted successfully" });
  });
});

// organisation donation requests
app.post("/request-donation", (req, res) => {
  const { donation_id, org_id } = req.body;

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

// ================= GET ORGANIZATION NEEDS =================
app.get("/org-requests/:orgId", (req, res) => {
  const orgId = req.params.orgId;
  const sql = `SELECT * FROM org_needs WHERE org_id = ? ORDER BY created_at DESC`;
  db.query(sql, [orgId], (err, rows) => {
    if (err) return res.status(500).json({ message: "Failed to fetch requests" });
    res.json(rows);
  });
});

// ADMIN: Available pending donations (minimal view)
app.get("/admin/available-items", async (req, res) => {
    try {
        const [rows] = await db.promise().query(`
            SELECT
                d.donation_id,
                d.category,
                u.full_name AS donor_name
            FROM donations d
            JOIN user_sev u ON d.user_id = u.id
            WHERE d.status = 'Pending'
            ORDER BY d.created_at DESC
        `);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

//ADMIN: Settle donation with organisation
app.post("/admin/settle-donation", async (req, res) => {
    const { donation_id, organisation_id } = req.body;

    if (!organisation_id) {
        return res.status(400).json({ message: "Organisation is required" });
    }

    try {
        await db.promise().query(`
            UPDATE donations
            SET status = 'Settled',
                organisation_id = ?
            WHERE donation_id = ?
        `, [organisation_id, donation_id]);

        res.json({ message: "Donation settled and organisation assigned" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Settlement failed" });
    }
});

// ADMIN: Fetch all organisations
app.get("/admin/organisations", async (req, res) => {
    try {
        const [rows] = await db.promise().query(`
            SELECT id, full_name
            FROM user_sev
            WHERE role = 'organisation'
            ORDER BY full_name
        `);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// ADMIN: Recent settled donations (NO quantity)
app.get("/admin/recent-donations", async (req, res) => {
    try {
        const [rows] = await db.promise().query(`
            SELECT
                d.donation_id,
                donor.full_name AS donor_name,
                d.category,
                org.full_name AS organisation_name,
                d.updated_at AS settled_date
            FROM donations d
            JOIN user_sev donor ON d.user_id = donor.id
            LEFT JOIN user_sev org ON d.organisation_id = org.id
            WHERE d.status = 'Settled'
            ORDER BY d.updated_at DESC
            LIMIT 10
        `);

        res.json(rows);
    } catch (err) {
        console.error("Recent donations error:", err);
        res.status(500).json([]);
    }
});

//admin donation requests//
app.get("/admin/all-requests", async (req, res) => {
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
        dr.requested_at AS created_at,
        'donation' AS type
      FROM donation_requests dr
      JOIN user_sev u ON dr.org_id = u.id
      JOIN donations d ON dr.donation_id = d.donation_id

      ORDER BY created_at DESC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).send("DB error");
  }
});

/* ================= ADMIN FULFILL NEED ================= */
app.post("/admin/settle-need", (req, res) => {
  const { id } = req.body;

  db.query(
    "UPDATE org_needs SET status='Settled' WHERE need_id=?",
    [id],
    () => res.json({ success:true })
  );
});

/* ================= ADMIN FULFILL DONATION ================= */
app.post("/admin/settledonation", (req, res) => {
  const { id } = req.body;

  db.query(
    "SELECT donation_id FROM donation_requests WHERE request_id=?",
    [id],
    (err, rows) => {
      if (rows.length === 0) return res.json({ success:false });

      const donationId = rows[0].donation_id;

      db.query(
        "UPDATE donations SET status='Settled' WHERE donation_id=?",
        [donationId]
      );

      res.json({ success:true });
    }
  );
});

// ================= LOGOUT =================
app.get("/logout", (req, res) => {
  res.redirect("/login.html");  // frontend can clear localStorage/sessionStorage
});


/* =====================================================
   ==================== SERVER =========================
===================================================== */
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
