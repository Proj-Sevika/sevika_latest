import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Forum from "./pages/ForumPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DonorDashboard from "./pages/DonorDashboard";
import OrgDashboard from "./pages/OrgDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Home from "./pages/Home";
import Intro from "./pages/Intro";
import DonorDetails from "./pages/DonorDetails";

function App() {
  const [showIntro, setShowIntro] = useState(() => {
  return sessionStorage.getItem("introPlayed") !== "true";
});



  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        {showIntro ? (
          <Intro
            key="intro"
            onFinish={() => {
              sessionStorage.setItem("introPlayed", "true");
              setShowIntro(false);
            }}
          />
          
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/donor/:id" element={<DonorDetails />} />
              <Route path="/donor" element={<DonorDashboard />} />
              <Route path="/org" element={<OrgDashboard />} />
              <Route path="*" element={<Home />} />
              <Route path="/ForumPage" element={<Forum />} />
            </Routes>
          </motion.div>
        )}
      </AnimatePresence>
    </BrowserRouter>
  );
}

export default App;
