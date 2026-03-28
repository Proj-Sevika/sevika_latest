import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Orgdash.css";

function OrgDashboard() {
  const navigate = useNavigate();

  const orgId = localStorage.getItem("userId");
  const orgName = localStorage.getItem("name") || "Organization";

  const [items, setItems] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [requestQuantities, setRequestQuantities] = useState({});

  const [formData, setFormData] = useState({
    category: "",
    subcategory: "",
    gender: "",
    age_group: "",
    quantity: 1,
    urgency: "Medium",
  });

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

  /* ================= PROTECT ROUTE ================= */
  useEffect(() => {
    const token = getToken();
    const role = localStorage.getItem("role");
    if (!token || role !== "organisation") {
      navigate("/login");
    }
  }, []);

  /* ================= FETCH AVAILABLE ITEMS ================= */
  const fetchItems = async () => {
    try {
      const res = await fetch("https://sevikalatest-production.up.railway.app/donations/available", {
        headers: {
          Authorization: "Bearer " + getToken(),
        },
      });

      if (handleAuthError(res)) return;
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading items:", err);
    }
  };

  /* ================= REQUEST DONATION ================= */
  const requestItem = async (donationId) => {
    try {
      const res = await fetch("https://sevikalatest-production.up.railway.app/request-donation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + getToken(),
        },
        body: JSON.stringify({
          donation_id: donationId,
          org_id: orgId,
          quantity: requestQuantities[donationId] || 1
        }),
      });

      const result = await res.json();

      if (handleAuthError(res)) return;
      if (res.ok) {
        alert("Donation requested successfully");
        fetchItems();
      } else {
        alert(result.message || "Request failed");
      }
    } catch (err) {
      alert("Failed to request donation");
    }
  };

  /* ================= FETCH MY NEEDS ================= */
  const fetchMyNeeds = async () => {
    try {
      const res = await fetch(
        `https://sevikalatest-production.up.railway.app/org-requests/${orgId}`,
        {
          headers: {
            Authorization: "Bearer " + getToken(),
          },
        }
      );

      if (handleAuthError(res)) return;
      const data = await res.json();
      setNeeds(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading needs:", err);
    }
  };

  /* ================= ADD NEED ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.category) {
      alert("Please select a category");
      return;
    }

    if (formData.category === "clothes" && (!formData.gender || !formData.age_group)) {
      alert("Please provide gender and age group for clothes");
      return;
    }

    if (formData.category !== "clothes" && !formData.subcategory) {
      alert("Please select a subcategory for this category");
      return;
    }

    try {
      const res = await fetch("https://sevikalatest-production.up.railway.app/add-org-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + getToken(),
        },
        body: JSON.stringify({
          category: formData.category,
          subcategory: formData.subcategory || null,
          gender: formData.gender || null,
          age_group: formData.age_group || null,
          quantity: formData.quantity || 1,
          urgency: formData.urgency || "Medium",
          org_id: orgId,
        }),
      });

      const result = await res.json();
      alert(result.message);

      setFormData({
        category: "",
        subcategory: "",
        gender: "",
        age_group: "",
        quantity: 1,
        urgency: "Medium",
      });

      fetchMyNeeds();
    } catch (err) {
      alert("Failed to add need");
    }
  };

  /* ================= LOGOUT ================= */
  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    const token = getToken();
    const role = localStorage.getItem("role");
    if (token && orgId && role === "organisation") {
      fetchItems();
      fetchMyNeeds();
    }
  }, []);

  return (
    <div className="org-container">
      <div className="org-sidebar">
        <h2>Org Dashboard</h2>

        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Dashboard
        </button>

        <button
          onClick={() =>
            document
              .querySelector("#items-available")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          Items Available
        </button>

        <button
          onClick={() =>
            document
              .querySelector("#my-needs")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          My Needs
        </button>

        <button
          onClick={() =>
            document
              .querySelector("#add-need")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          Add Need
        </button>

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="org-main">
        <div className="card">
          <h3>Welcome, {orgName} 👋</h3>
        </div>

        {/* ITEMS AVAILABLE */}
        <div className="card" id="items-available">
          <h3>Items Available</h3>

          <table>
            <thead>
              <tr>
                <th>Donor</th>
                <th>Category</th>
                <th>Available</th>
                <th>Qty to Request</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="3">No items available</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.donation_id}>
                    <td>D{item.user_id}</td>
                    <td>{["toiletries","electricals","stationary"].includes(item.category) ? `${item.category} (${item.item_name || "N/A"})` : item.category}</td>
                    <td>{item.quantity}</td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        max={item.quantity}
                        value={requestQuantities[item.donation_id] || ""}
                        onChange={(e) => setRequestQuantities({
                          ...requestQuantities,
                          [item.donation_id]: parseInt(e.target.value)
                        })}
                        placeholder="Qty"
                        style={{ width: "60px", padding: "4px" }}
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => requestItem(item.donation_id)}
                      >
                        Request
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MY NEEDS */}
        <div className="card" id="my-needs">
          <h3>My Needs</h3>

          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Category</th>
                <th>Subcategory</th>
                <th>Qty</th>
                <th>Urgency</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {needs.length === 0 ? (
                <tr>
                  <td colSpan="8">No needs posted yet</td>
                </tr>
              ) : (
                needs.map((n, index) => (
                  <tr key={index}>
                    <td>My Need</td>
                    <td>{n.category || "-"}</td>
                    <td>
                      {n.category === 'clothes'
                        ? `${n.gender || 'Any'} - ${n.age_group || 'Any'}`
                        : (n.subcategory || "-")}
                    </td>
                    <td>{n.quantity || "-"}</td>
                    <td>{n.urgency}</td>
                    <td>{n.status}</td>
                    <td>
                      {new Date(n.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ADD NEED */}
        <div className="card" id="add-need">
          <h3>Add New Need</h3>

          <form onSubmit={handleSubmit}>
            <select
              value={formData.category || ""}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              required
            >
              <option value="">Select Category</option>
              <option value="clothes">Clothes</option>
              <option value="food">Food</option>
              <option value="medicine">Medicine</option>
              <option value="toiletries">Toiletries</option>
              <option value="electricals">Electrical Essentials</option>
              <option value="stationary">Stationary</option>
            </select>

            {formData.category === "clothes" && (
              <>
                <select value={formData.gender || ""} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} required>
                  <option value="">Select Gender</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Unisex</option>
                </select>
                <select value={formData.age_group || ""} onChange={(e) => setFormData({ ...formData, age_group: e.target.value })} required>
                  <option value="">Select Age Group</option>
                  <option>Kids</option>
                  <option>Teens</option>
                  <option>Adults</option>
                </select>
              </>
            )}

            {formData.category === "food" && (
              <>
                <select value={formData.subcategory || ""} onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })} required>
                  <option value="">Select Food Type</option>
                  <option>Cooked</option>
                  <option>Packed</option>
                  <option>Raw</option>
                </select>
              </>
            )}

            {formData.category === "medicine" && (
              <>
                <input
                  type="text"
                  value={formData.subcategory || ""}
                  placeholder="Medicine Name"
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  required
                />
              </>
            )}

            {formData.category === "toiletries" && (
              <>
                <select value={formData.subcategory || ""} onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })} required>
                  <option value="">Select Type</option>
                  <option>Soaps</option>
                  <option>Shampoo</option>
                  <option>Sanitary Napkins</option>
                </select>
              </>
            )}

            {formData.category === "electricals" && (
              <>
                <select value={formData.subcategory || ""} onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })} required>
                  <option value="">Select Type</option>
                  <option>Tubelight</option>
                  <option>Bulb</option>
                  <option>Battery</option>
                </select>
              </>
            )}

            {formData.category === "stationary" && (
              <>
                <select value={formData.subcategory || ""} onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })} required>
                  <option value="">Select Type</option>
                  <option>Pen</option>
                  <option>Pencils</option>
                  <option>Scale</option>
                </select>
              </>
            )}

            <input
              type="number"
              min="1"
              value={formData.quantity || 1}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              placeholder="Quantity"
            />

            <select
              value={formData.urgency || "Medium"}
              onChange={(e) =>
                setFormData({ ...formData, urgency: e.target.value })
              }
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>

            <button type="submit">Add Need</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default OrgDashboard;
