import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Orgdash.css";

function OrgDashboard() {
  const navigate = useNavigate();

  const orgId = localStorage.getItem("userId");
  const orgName = localStorage.getItem("name") || "Organization";

  const [items, setItems] = useState([]);
  const [needs, setNeeds] = useState([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
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
      const res = await fetch("http://localhost:3000/donations/available", {
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
      const res = await fetch("http://localhost:3000/request-donation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + getToken(),
        },
        body: JSON.stringify({
          donation_id: donationId,
          org_id: orgId,
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
        `http://localhost:3000/org-requests/${orgId}`,
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

    try {
      const res = await fetch("http://localhost:3000/add-org-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + getToken(),
        },
        body: JSON.stringify({
          ...formData,
          org_id: orgId,
        }),
      });

      const result = await res.json();
      alert(result.message);

      setFormData({
        title: "",
        description: "",
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
                    <td>{item.category}</td>
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
                <th>Title</th>
                <th>Description</th>
                <th>Urgency</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {needs.length === 0 ? (
                <tr>
                  <td colSpan="5">No needs posted yet</td>
                </tr>
              ) : (
                needs.map((n, index) => (
                  <tr key={index}>
                    <td>{n.title}</td>
                    <td>{n.description || "-"}</td>
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
            <input
              type="text"
              placeholder="Title"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />

            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />

            <select
              value={formData.urgency}
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