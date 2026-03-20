import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Donordash.css";

const DonorDashboard = () => {
  const navigate = useNavigate();

  const userId = localStorage.getItem("userId");
  const name = localStorage.getItem("name");

  const [category, setCategory] = useState("");
  const [formData, setFormData] = useState({});
  const [history, setHistory] = useState([]);
  const [nearbyOrgs, setNearbyOrgs] = useState([]);
  const [submitStatus, setSubmitStatus] = useState("");
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  /* ================= HELPER: get fresh token ================= */
  const getToken = () => localStorage.getItem("token");

  /* ================= HELPER: handle auth errors ================= */
  const handleAuthError = (res) => {
    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      navigate("/login");
      return true;
    }
    return false;
  };

  /* ================= HANDLE INPUT ================= */
  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  /* ================= LOAD HISTORY ================= */
  const loadHistory = async () => {
    if (!userId) return;

    try {
      const res = await fetch(
      `http://localhost:3000/donor/history`,
      {
        headers: {
          "Authorization": "Bearer " + getToken()
        }
      }
    );

      if (handleAuthError(res)) return;

      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("History load error:", error);
    }
  };

  /* ================= LOAD NEARBY ORGS ================= */
  const loadNearbyOrgs = async () => {
    if (!userId) return;

    try {
      setLoadingOrgs(true);

      const res = await fetch(
        `http://localhost:3000/food/nearby-orgs`,
        {
          headers: {
            "Authorization": "Bearer " + getToken()
          }
        }
      );

      if (handleAuthError(res)) return;
      if (!res.ok) throw new Error("Failed to fetch organisations");

      const orgs = await res.json();
      setNearbyOrgs(Array.isArray(orgs) ? orgs : []);

    } catch (error) {
      console.error("Nearby orgs error:", error);
      setNearbyOrgs([]);
    } finally {
      setLoadingOrgs(false);
    }
  };

  /* ================= SUBMIT DONATION ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userId) {
      setSubmitStatus("❌ User not logged in.");
      return;
    }

    try {
      setSubmitStatus("Submitting donation...");

      const data = {
        ...formData,
        category: category
      };

      const res = await fetch("http://localhost:3000/add-donation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + getToken()
        },
        body: JSON.stringify(data),
      });

      if (handleAuthError(res)) return;

      const result = await res.json();

      if (!res.ok) {
        console.log("Server error response:", result);
        throw new Error(result.message || "Donation failed");
      }

      setSubmitStatus("✅ Donation submitted successfully!");

      setFormData({});
      setCategory("");
      setNearbyOrgs([]);

      loadHistory();

    } catch (error) {
      console.error("Submission Error:", error);
      setSubmitStatus("❌ " + error.message);
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate("/");
  };

  useEffect(() => {
    const token = getToken();
    const role = localStorage.getItem("role");
    if (!token || !userId || role !== "donor") {
      navigate("/login");
    } else {
      loadHistory();
    }
  }, []);

  return (
    <div className="donor-container">
      <div className="sidebar">
        <h2>Donor Panel</h2>
        <button>Dashboard</button>
        <button>Add Donation</button>
        <button>History</button>
        <button onClick={logout}>Logout</button>
      </div>

      <div className="main">

        {/* WELCOME CARD */}
        <div className="card">
          <h3>Welcome, {name} 👋</h3>
          <p>Donor ID: D{userId}</p>
        </div>

        {/* ADD DONATION CARD */}
        <div className="card">
          <h3>Add Donation</h3>

          <form onSubmit={handleSubmit}>

            {/* CATEGORY */}
            <label>Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setFormData({});
                setNearbyOrgs([]);
                if (e.target.value) {
                  // Auto-load organisations when a category is selected
                  setTimeout(() => loadNearbyOrgs(), 0);
                }
              }}
              required
            >
              <option value="">Select</option>
              <option value="clothes">Clothes</option>
              <option value="food">Food</option>
              <option value="medicine">Medicine</option>
              <option value="others">Others</option>
            </select>

            {/* ================= CLOTHES ================= */}
            {category === "clothes" && (
              <>
                <label>Gender</label>
                <select name="gender" onChange={handleChange} required>
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Unisex</option>
                </select>

                <label>Age Group</label>
                <select name="age_group" onChange={handleChange} required>
                  <option value="">Select</option>
                  <option>Kids</option>
                  <option>Teens</option>
                  <option>Adults</option>
                </select>
              </>
            )}

            {/* ================= FOOD ================= */}
            {category === "food" && (
              <>
                <label>Food Type</label>
                <select name="food_type" onChange={handleChange} required>
                  <option value="">Select</option>
                  <option>Cooked</option>
                  <option>Packed</option>
                  <option>Raw</option>
                </select>

                <label>Prepared Date</label>
                <input type="date" name="prepared_date" onChange={handleChange} />

                <label>Best Before</label>
                <input type="date" name="best_before" onChange={handleChange} />

                <label>Pickup Urgency</label>
                <select name="pickup_urgency" onChange={handleChange}>
                  <option value="">Select</option>
                  <option>Immediate</option>
                  <option>Within 2 hours</option>
                  <option>Today</option>
                </select>
              </>
            )}

            {/* ================= MEDICINE ================= */}
            {category === "medicine" && (
              <>
                <label>Medicine Name</label>
                <input
                  type="text"
                  name="medicine_name"
                  onChange={handleChange}
                  required
                />

                <label>Expiry Date</label>
                <input
                  type="date"
                  name="expiry_date"
                  onChange={handleChange}
                  required
                />
              </>
            )}

            {/* ================= OTHERS ================= */}
            {category === "others" && (
              <>
                <label>Item Name</label>
                <input
                  type="text"
                  name="item_name"
                  onChange={handleChange}
                  required
                />
              </>
            )}

            {/* COMMON FIELDS */}
            {category && (
              <>
                <label>Select Organisation (optional — admin can assign later)</label>
                {loadingOrgs ? (
                  <p>Loading organisations...</p>
                ) : (
                  <>
                    <select
                      name="organisation_id"
                      onChange={handleChange}
                    >
                      <option value="">No preference — let admin assign</option>
                      {nearbyOrgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}{o.distance !== null ? ` (${o.distance.toFixed(2)} km)` : ""}
                        </option>
                      ))}
                    </select>
                    {nearbyOrgs.length === 0 && (
                      <button
                        type="button"
                        className="small-btn"
                        onClick={loadNearbyOrgs}
                      >
                        📍 Reload Organisations
                      </button>
                    )}
                  </>
                )}

                <label>Pickup Preference</label>
                <select
                  name="pickup_preference"
                  onChange={handleChange}
                  required
                >
                  <option value="Pickup">Pickup</option>
                  <option value="Delivery">Delivery</option>
                </select>

                <label>Expected Date & Time</label>
                <input
                  type="datetime-local"
                  name="expected_datetime"
                  onChange={handleChange}
                />

                <button type="submit" className="submit">
                  Submit Donation
                </button>
              </>
            )}

            {submitStatus && (
              <p className="submit-message">{submitStatus}</p>
            )}
          </form>
        </div>

        {/* HISTORY CARD */}
        <div className="card">
          <h3>Donation History</h3>

          {history.length === 0 ? (
            <p>No donations yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Charity Given To</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((d) => (
                  <tr key={d.donation_id}>
                    <td>{new Date(d.created_at).toLocaleString()}</td>
                    <td>{d.category}</td>

                    <td>{d.organisation_name || (d.status === "Settled" ? "—" : "Not yet assigned")}</td>
                    <td className={`status-${d.status}`}>
                      {d.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
};

export default DonorDashboard;
