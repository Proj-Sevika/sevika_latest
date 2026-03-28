import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import "../index.css"; // Make sure index.css is imported

const Register = () => {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "",
    latitude: "",
    longitude: ""
  });

  const [locationStatus, setLocationStatus] = useState("");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  // Apply theme to body
  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Handle input change
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Detect geolocation

    const detectLocation = () => {
  if (!navigator.geolocation) {
    setLocationStatus("Geolocation is not supported by your browser");
    return;
  }

  setLocationStatus("Detecting location...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;

      setFormData((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));

      setLocationStatus("✅ Location detected successfully!");
    },
    (error) => {
      console.error("Error getting location:", error);
      setLocationStatus("❌ Unable to retrieve your location");
    }
  );
};

  // Submit registration
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      await axios.post("https://sevikalatest-production.up.railway.app/register", formData);
      alert("Registration successful!");
      // Optionally redirect to login page
      window.location.href = "/login";
    } catch (error) {
      console.error(error);
      alert("Registration failed. Please try again.");
    }
  };

  return (
    <motion.div
      className="register-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7 }}
    >
      {/* Theme toggle */}
      <div
        className="theme-toggle"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      >
        {theme === "light" ? "🌙 Dark Mode" : "☀ Light Mode"}
      </div>

      {/* Registration Form */}
      <motion.div
        className="form-container"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h2>Register</h2>

        <form onSubmit={handleSubmit}>
          <label>Full Name</label>
          <input
            type="text"
            name="full_name"
            required
            value={formData.full_name}
            onChange={handleChange}
          />

          <label>Email</label>
          <input
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
          />

          <label>Phone</label>
          <input
            type="text"
            name="phone"
            required
            value={formData.phone}
            onChange={handleChange}
          />

          <label>Location</label>
          <motion.button
            type="button"
            className="location-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={detectLocation}
          >
            📍 Detect My Location
          </motion.button>
          <p>{locationStatus}</p>

          <label>Password</label>
          <input
            type="password"
            name="password"
            required
            value={formData.password}
            onChange={handleChange}
          />

          <label>Confirm Password</label>
          <input
            type="password"
            name="confirmPassword"
            required
            value={formData.confirmPassword}
            onChange={handleChange}
          />

          <label>Register As</label>
          <select
            name="role"
            required
            value={formData.role}
            onChange={handleChange}
          >
            <option value="">Select</option>
            <option value="donor">Donor</option>
            <option value="organisation">Organisation</option>
          </select>

          <motion.button
            type="submit"
            className="submit-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Create Account
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default Register;
