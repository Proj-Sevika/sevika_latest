import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./Admindash.css"; // Reuse admin styles for consistency

const DonorDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [donor, setDonor] = useState(null);
    const [address, setAddress] = useState("Loading location...");
    const [loading, setLoading] = useState(true);

    const getToken = () => localStorage.getItem("token");

    useEffect(() => {
        const fetchDonorDetails = async () => {
            try {
                const res = await fetch(`https://sevikalatest-production.up.railway.app/admin/donor/${id}`, {
                    headers: { "Authorization": "Bearer " + getToken() }
                });
                if (res.status === 401 || res.status === 403) {
                    navigate("/login");
                    return;
                }
                const data = await res.json();
                setDonor(data);
                
                if (data.latitude && data.longitude) {
                    reverseGeocode(data.latitude, data.longitude);
                } else {
                    setAddress("Location coordinates not available");
                }
            } catch (err) {
                console.error("Failed to fetch donor details:", err);
            } finally {
                setLoading(false);
            }
        };

        const reverseGeocode = async (lat, lng) => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
                const data = await response.json();
                setAddress(data.display_name || "Address not found");
            } catch (error) {
                console.error("Geocoding error:", error);
                setAddress("Unable to fetch address");
            }
        };

        fetchDonorDetails();
    }, [id, navigate]);

    if (loading) return <div className="admin-container"><div className="main">Loading donor details...</div></div>;
    if (!donor) return <div className="admin-container"><div className="main">Donor not found.</div></div>;

    return (
        <div className="admin-container">
            <div className="sidebar">
                <h2>Admin Panel</h2>
                <button onClick={() => navigate("/admin")}>Back to Dashboard</button>
                <button onClick={() => { localStorage.clear(); navigate("/"); }}>Logout</button>
            </div>

            <motion.div 
                className="main"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="card">
                    <h2 style={{ marginBottom: "20px", color: "#2c3e50" }}>Donor Profile</h2>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "15px", alignItems: "center" }}>
                        <strong style={{ color: "#7f8c8d" }}>Donor ID:</strong>
                        <span style={{ fontSize: "1.1em", fontWeight: "bold" }}>#{donor.id}</span>

                        <strong style={{ color: "#7f8c8d" }}>Full Name:</strong>
                        <span style={{ fontSize: "1.1em" }}>{donor.full_name}</span>

                        <strong style={{ color: "#7f8c8d" }}>Email:</strong>
                        <span style={{ fontSize: "1.1em" }}>{donor.email}</span>

                        <strong style={{ color: "#7f8c8d" }}>Contact Number:</strong>
                        <span style={{ fontSize: "1.1em", color: "#27ae60", fontWeight: "bold" }}>
                            +91 {donor.phone}
                        </span>

                        <strong style={{ color: "#7f8c8d" }}>Location:</strong>
                        <div style={{ fontSize: "1em", lineHeight: "1.4" }}>
                            <p style={{ margin: "0", fontWeight: "500" }}>{address}</p>
                            <small style={{ color: "#95a5a6" }}>
                                ({donor.latitude}, {donor.longitude})
                            </small>
                        </div>
                    </div>

                    <button 
                        onClick={() => navigate("/admin")}
                        style={{ 
                            marginTop: "30px", 
                            padding: "10px 20px", 
                            backgroundColor: "#3498db", 
                            color: "white", 
                            border: "none", 
                            borderRadius: "5px",
                            cursor: "pointer",
                            fontSize: "1em"
                        }}
                    >
                        Return to Dashboard
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default DonorDetails;
