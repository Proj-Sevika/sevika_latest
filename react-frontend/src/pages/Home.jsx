import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import "./Home.css";

export default function Home() {
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    document.body.className = theme; // apply theme globally
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <motion.div
      className={`home-wrapper ${theme}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7 }}
    >
      {/* Theme Toggle */}
      <div
        className="theme-toggle"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      >
        {theme === "light" ? "🌙 Dark Mode" : "☀ Light Mode"}
      </div>

      {/* HERO */}
      <header>
        <h1>Sevika</h1>
        <p>Connecting Surplus Resources with Local Needs</p>
      </header>

      {/* NAVBAR */}
      <nav className="home-navbar">
        <a href="/">Home</a>
        <a href="/register">Register</a>
        <a href="/ForumPage">Forum</a>
        <a href="/login">Login</a>
      </nav>

      {/* ABOUT */}
      <section className="about">
        <h2>About Sevika</h2>
        <p>
          Sevika is a hyper-local charity platform that enables individuals and
          organizations to donate surplus clothes, food, medicines, and
          essential items to nearby charities and collection centers.
        </p>
        <p>
          The platform ensures that all donated items undergo verification
          before collection and distribution to maintain safety, quality, and
          trust.
        </p>
      </section>

      {/* MISSION & VISION */}
      <section className="mission-vision">
        <h2>Our Mission & Vision</h2>
        <div className="mv-container">
          <div className="mv-card">
            <h3>Mission</h3>
            <p>
              To reduce wastage of surplus essential items by providing a
              reliable platform connecting donors with people in need.
            </p>
          </div>
          <div className="mv-card">
            <h3>Vision</h3>
            <p>
              To create a sustainable, technology-driven system that
              efficiently redistributes resources and strengthens community
              welfare.
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section>
        <h2>How It Works</h2>
        <div className="card-container">
          <div className="card">
            <h3>Donate</h3>
            <p>List surplus clothes, food, medicines, or essentials.</p>
          </div>
          <div className="card">
            <h3>Verification</h3>
            <p>Items are verified for quality and safety.</p>
          </div>
          <div className="card">
            <h3>Collect & Distribute</h3>
            <p>Verified items are distributed to people in need.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <h2>Make a Difference Today</h2>
        <p>Your contribution can change lives.</p>
        <a href="/register">Get Started</a>
      </section>

      <footer>
        © 2026 Sevika
      </footer>
    </motion.div>
  );
}
