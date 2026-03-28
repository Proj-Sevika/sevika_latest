const mysql = require("mysql2");


const db = mysql.createConnection({
   host: process.env.MYSQLHOST,
port: process.env.MYSQLPORT,
user: process.env.MYSQLUSER,
password: process.env.MYSQLPASSWORD,
database: process.env.MYSQLDATABASE
});

db.connect(err => {
    if (err) throw err;
    console.log("DB connected");
});

module.exports = db;