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
    console.log(`INPUT CHANGE: ${e.target.name} = ${e.target.value}`);
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
        `https://sevikalatest-production.up.railway.app/donor/history`,
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
        `https://sevikalatest-production.up.railway.app/food/nearby-orgs`,
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

    /* ================= FOOD VALIDATION ================= */
    if (category === "food") {
      const { prepared_date, best_before, expected_datetime } = formData;
      if (prepared_date && expected_datetime) {
        const prepared = new Date(prepared_date).setHours(0, 0, 0, 0);
        const expected = new Date(expected_datetime).getTime();
        if (expected < prepared) {
          setSubmitStatus("❌ Expected date must be after or on prepared date.");
          return;
        }
      }
      if (best_before && expected_datetime) {
        const best = new Date(best_before).setHours(23, 59, 59, 999);
        const expected = new Date(expected_datetime).getTime();
        if (expected > best) {
          setSubmitStatus("❌ Expected date must be on or before best before date.");
          return;
        }
      }
    }

    try {
      setSubmitStatus("Submitting donation...");

      const data = {
        ...formData,
        category: category
      };
      console.log("SUBMITTING DATA:", data);
      console.log("TYPED QUANTITY:", formData.quantity);

      const res = await fetch("https://sevikalatest-production.up.railway.app/add-donation", {
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

  const getMinDateTime = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now - tzOffset).toISOString().slice(0, 16);
  };

  const getMinDate = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now - tzOffset).toISOString().slice(0, 10);
  };

  const getExpectedMin = () => {
    const todayMin = getMinDateTime();
    if (category === "food" && formData.prepared_date) {
      // It can't be before it was prepared, but also can't be in the past
      const preparedMin = formData.prepared_date + "T00:00";
      return preparedMin > todayMin ? preparedMin : todayMin;
    }
    return todayMin;
  };

  const getExpectedMax = () => {
    if (category === "food" && formData.best_before) {
      return formData.best_before + "T23:59";
    }
    return undefined; // or null
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
                if (e.target.value === "food") {
                  // Auto-load organisations when a category is selected (ONLY for food)
                  setTimeout(() => loadNearbyOrgs(), 0);
                }
              }}
              required
            >
              <option value="">Select</option>
              <option value="clothes">Clothes</option>
              <option value="food">Food</option>
              <option value="medicine">Medicine</option>
              <option value="toiletries">Toiletries</option>
              <option value="electricals">Electrical Essentials</option>
              <option value="stationary">Stationary</option>
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
                <input type="date" name="best_before" min={getMinDate()} onChange={handleChange} />

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

            {/* ================= TOILETRIES ================= */}
            {category === "toiletries" && (
              <>
                <label>Type</label>
                <select name="item_name" onChange={handleChange} required>
                  <option value="">Select</option>
                  <option>Soaps</option>
                  <option>Shampoo</option>
                  <option>Sanitary Napkins</option>
                </select>
              </>
            )}

            {/* ================= ELECTRICAL ESSENTIALS ================= */}
            {category === "electricals" && (
              <>
                <label>Type</label>
                <select name="item_name" onChange={handleChange} required>
                  <option value="">Select</option>
                  <option>Tubelight</option>
                  <option>Bulb</option>
                  <option>Battery</option>
                </select>
              </>
            )}

            {/* ================= STATIONARY ================= */}
            {category === "stationary" && (
              <>
                <label>Type</label>
                <select name="item_name" onChange={handleChange} required>
                  <option value="">Select</option>
                  <option>Pen</option>
                  <option>Pencils</option>
                  <option>Scale</option>
                </select>
              </>
            )}

            {category && (
              <>
                <label>Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  required
                  placeholder="e.g. 10"
                  onChange={handleChange}
                  value={formData.quantity || ""}
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginTop: "5px",
                    borderRadius: "5px",
                    border: "1px solid #ddd"
                  }}
                />
              </>
            )}

            {/* COMMON FIELDS */}
            {category && (
              <>
                {category === "food" && (
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
                  min={getExpectedMin()}
                  max={getExpectedMax()}
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
                    <td>{["toiletries","electricals","stationary"].includes(d.category) ? `${d.category} (${d.item_name || "N/A"})` : d.category} ({d.quantity})</td>

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
