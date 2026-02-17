const express=require("express");
const bcrypt=require("bcrypt");
const db=require("../db");

const router=express.Router();

/* REGISTER */
router.post("/register", async(req,res)=>{
 const {full_name,email,phone,location,password,role}=req.body;

 db.query(
  "SELECT * FROM user_sev WHERE email=?",
  [email],
  async(err,result)=>{
   if(result.length>0)
    return res.send("Email exists");

   const hashed=await bcrypt.hash(password,10);

   db.query(
    `INSERT INTO user_sev
    (full_name,email,phone,location,password,role)
    VALUES(?,?,?,?,?,?)`,
    [full_name,email,phone,location,hashed,role],
    ()=>{
     res.send("Registered successfully");
    }
   );
  }
 );
});

/* LOGIN */
router.post("/login",(req,res)=>{
 const {email,password}=req.body;

 db.query(
  "SELECT * FROM user_sev WHERE email=?",
  [email],
  async(err,result)=>{
   if(result.length==0)
    return res.send("User not found");

   const valid=await bcrypt.compare(
    password,
    result[0].password
   );

   if(!valid)
    return res.send("Wrong password");

   req.session.user=result[0];

   if(result[0].role=="donor")
    res.redirect("/dashboards/donor.html");

   if(result[0].role=="organisation")
    res.redirect("/dashboards/org_dash.html");

   if(result[0].role=="admin")
    res.redirect("/dashboards/admin.html");
  }
 );
});

/* LOGOUT */
router.get("/logout",(req,res)=>{
 req.session.destroy();
 res.redirect("/login.html");
});

module.exports=router;
