const mysql = require("mysql2");

const db = mysql.createConnection({
 host:"localhost",
 user:"root",
 password:"Admin@123",
 database:"sevika_db"
});

db.connect(err=>{
 if(err) throw err;
 console.log("DB connected");
});

module.exports=db;
