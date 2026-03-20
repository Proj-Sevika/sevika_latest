const mysql = require("mysql2");

const db = mysql.createConnection({
 host:"localhost",
 user:"sevika_user",
 password:"sevika123",
 database:"sevika_db"
});

db.connect(err=>{
 if(err) throw err;
 console.log("DB connected");
});

module.exports=db;
