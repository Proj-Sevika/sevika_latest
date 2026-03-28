const db = require('./db');

async function test() {
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
        console.log("QUERY EXECUTED SUCCESSFULLY");
        console.log("ROWS FOUND:", rows.length);
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error("QUERY ERROR:", err);
    } finally {
        process.exit(0);
    }
}

test();
