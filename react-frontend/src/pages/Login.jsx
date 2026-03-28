import { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import "../index.css";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const [theme, setTheme] = useState("light");

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(
        "https://sevikalatest-production.up.railway.app/login",
        formData
      );

      if (res.data.success) {
        const role = res.data.role;

        // ✅ SAVE TOKEN (VERY IMPORTANT)
        localStorage.setItem("token", res.data.token);
        // Save user data
        localStorage.setItem("userId", res.data.id);
        localStorage.setItem("role", role);
        localStorage.setItem("name", res.data.name);

        // 🔥 Redirect based on role
        if (role === "admin") {
          navigate("/admin");
        } else if (role === "donor") {
          navigate("/donor");
        } else if (role === "organisation") {
          navigate("/org");
        } else if (role === "user") {
          navigate("/");
        } else {
          alert("Logged in, but no dedicated dashboard for role: " + role + ". Redirecting home.");
          navigate("/");
        }
      }

     } //catch (error) {
    //   alert("Login failed");
    // }
    catch (error) {
  console.log("ERROR:", error.response?.data);
  alert(error.response?.data?.message || "Login failed");
}

  };

  return (
    <motion.div
      className="register-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7 }}
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "60px 20px"
      }}
    >
      {/* Theme Toggle */}
      <div
        className="theme-toggle"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      >
        {theme === "light" ? "🌙 Dark Mode" : "☀ Light Mode"}
      </div>

      <motion.div
        className="form-container"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={{
          maxWidth: "400px",
          width: "100%",
          background: theme === "light" ? "white" : "#1e2a38",
          padding: "35px",
          borderRadius: "20px",
          boxShadow:
            theme === "light"
              ? "0 10px 25px rgba(0,0,0,0.2)"
              : "0 10px 25px rgba(0,0,0,0.5)",
          color: theme === "light" ? "#0D1E4C" : "#E5C9D7"
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
          Login
        </h2>

        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            required
            onChange={handleChange}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "6px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              background: theme === "light" ? "white" : "#2c3e50",
              color: theme === "light" ? "#0D1E4C" : "white"
            }}
          />

          <label>Password</label>
          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            required
            onChange={handleChange}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "6px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              background: theme === "light" ? "white" : "#2c3e50",
              color: theme === "light" ? "#0D1E4C" : "white"
            }}
          />

          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              marginTop: "25px",
              width: "100%",
              padding: "12px",
              background: theme === "light" ? "#0D1E4C" : "#42a5f5",
              border: "none",
              borderRadius: "30px",
              fontWeight: "600",
              color: "white",
              cursor: "pointer"
            }}
          >
            Login
          </motion.button>
        </form>

        <Link
          to="/forgot-password"
          style={{
            display: "block",
            textAlign: "center",
            marginTop: "15px",
            fontWeight: "bold",
            textDecoration: "none",
            color: theme === "light" ? "#0D1E4C" : "#E5C9D7"
          }}
        >
          Forgot Password?
        </Link>

        <div style={{ textAlign: "center", marginTop: "18px" }}>
          <Link
            to="/register"
            style={{
              fontWeight: "bold",
              margin: "0 8px",
              color: theme === "light" ? "#0D1E4C" : "#E5C9D7"
            }}
          >
            Create Account
          </Link>
          |
          <Link
            to="/"
            style={{
              fontWeight: "bold",
              margin: "0 8px",
              color: theme === "light" ? "#0D1E4C" : "#E5C9D7"
            }}
          >
            Back to Home
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default Login;
