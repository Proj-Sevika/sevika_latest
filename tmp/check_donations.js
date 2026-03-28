const mysql = require("mysql2/promise");
require("dotenv").config();

async function check() {
  const db = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "a1c2h3u4",
    database: "sevika_db"
  });

  try {
    const [rows] = await db.query(`
      SELECT d.donation_id
      FROM donations d
      WHERE d.status = 'Settled'
      ORDER BY d.created_at DESC
      LIMIT 5
    `);
    console.log("SUCCESS_COUNT:" + rows.length);
  } catch (err) {
    console.error("ERROR:" + err.message);
  } finally {
    await db.end();
  }
}

check();
