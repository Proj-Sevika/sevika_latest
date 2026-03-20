import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Admindash.css";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const name = localStorage.getItem("name");

  const [recent, setRecent] = useState([]);
  const [available, setAvailable] = useState([]);
  const [organisations, setOrganisations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedOrgs, setSelectedOrgs] = useState({});

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

  /* ================= AUTH CHECK ================= */
  useEffect(() => {
    const token = getToken();
    const role = localStorage.getItem("role");
    if (!token || role !== "admin") {
      navigate("/login");
    }
  }, []);

  /* ================= LOAD DATA ================= */

  const loadRecent = async () => {
    try {
      const res = await fetch("http://localhost:3000/admin/recent-donations", {
        headers: { "Authorization": "Bearer " + getToken() }
      });
      if (handleAuthError(res)) return;
      const data = await res.json();
      setRecent(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load recent donations:", err);
    }
  };

  const loadAvailable = async () => {
    try {
      const res = await fetch("http://localhost:3000/admin/available-items", {
        headers: { "Authorization": "Bearer " + getToken() }
      });
      if (handleAuthError(res)) return;
      const data = await res.json();
      setAvailable(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load available items:", err);
    }
  };

  const loadOrganisations = async () => {
    try {
      const res = await fetch("http://localhost:3000/admin/organisations", {
        headers: { "Authorization": "Bearer " + getToken() }
      });
      if (handleAuthError(res)) return;
      const data = await res.json();
      setOrganisations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load organisations:", err);
    }
  };

  const loadRequests = async () => {
    try {
      const res = await fetch("http://localhost:3000/admin/all-requests", {
        headers: { "Authorization": "Bearer " + getToken() }
      });
      if (handleAuthError(res)) return;
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load requests:", err);
    }
  };

  useEffect(() => {
    const token = getToken();
    const role = localStorage.getItem("role");
    if (token && role === "admin") {
      loadRecent();
      loadAvailable();
      loadOrganisations();
      loadRequests();
    }
  }, []);

  /* ================= ADMIN ACTIONS ================= */

  const settleDonation = async (donationId, organisation_id) => {
    if (!organisation_id) {
      alert("Please select organisation");
      return;
    }

    try {
      const res = await fetch("http://localhost:3000/admin/settle-donation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + getToken()
        },
        body: JSON.stringify({ donation_id: donationId, organisation_id }),
      });
      if (handleAuthError(res)) return;
      const data = await res.json();
      alert(data.message);
      loadAvailable();
      loadRecent();
    } catch {
      alert("Server error");
    }
  };

  const settleNeed = async (id) => {
    try {
      const res = await fetch("http://localhost:3000/admin/settle-need", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + getToken()
        },
        body: JSON.stringify({ id }),
      });
      if (handleAuthError(res)) return;
      const data = await res.json();
      if (data.success) {
        alert("Request settled successfully");
        loadRequests();
      } else {
        alert(data.message || "Failed to settle request");
      }
    } catch {
      alert("Server error");
    }
  };

  const settleDonationRequest = async (id) => {
    try {
      const res = await fetch("http://localhost:3000/admin/settledonation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + getToken()
        },
        body: JSON.stringify({ id }),
      });
      if (handleAuthError(res)) return;
      const data = await res.json();
      if (data.success) {
        alert("Donation request settled successfully");
        loadRequests();
      } else {
        alert("Failed to settle donation request");
      }
    } catch {
      alert("Server error");
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <div className="admin-container">

      {/* Sidebar */}
      <div className="sidebar">
        <h2>Admin Panel</h2>
        <button>Dashboard</button>
        <button>Recent Donations</button>
        <button>Available Items</button>
        <button>Organization Requests</button>
        <button onClick={logout}>Logout</button>
      </div>

      {/* Main */}
      <div className="main">

        {/* Welcome */}
        <div className="card">
          <h3>Welcome Admin {name ? `, ${name}` : ""} 👋</h3>
        </div>

        {/* Recent Donations */}
        <div className="card">
          <h3>Recent Donation History</h3>
          <table>
            <thead>
              <tr>
                <th>Donor</th>
                <th>Category</th>
                <th>Organisation</th>
                <th>Settled On</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan="4">No settled donations yet</td></tr>
              ) : (
                recent.map((d, i) => (
                  <tr key={i}>
                    <td>{d.donor_name}</td>
                    <td>{d.category}</td>
                    <td>{d.organisation_name || "-"}</td>
                    <td>{new Date(d.settled_date).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Available Items */}
        <div className="card">
          <h3>Available Items</h3>
          <table>
            <thead>
              <tr>
                <th>Donor</th>
                <th>Category</th>
                <th>Donor's Chosen Org</th>
                <th>Assign Organisation</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {available.length === 0 ? (
                <tr><td colSpan="5">No pending donations</td></tr>
              ) : (
                available.map((d) => (
                  <tr key={d.donation_id}>
                    <td>{d.donor_name}</td>
                    <td>{d.category}</td>
                    <td>
                      {d.chosen_org_name
                        ? <strong style={{ color: "#2e7d32" }}>✅ {d.chosen_org_name}</strong>
                        : <span style={{ color: "#999" }}>Not selected</span>
                      }
                    </td>
                    <td>
                      <select
                        value={selectedOrgs[d.donation_id] ?? d.organisation_id ?? ""}
                        onChange={(e) =>
                          setSelectedOrgs({
                            ...selectedOrgs,
                            [d.donation_id]: e.target.value ? Number(e.target.value) : null
                          })
                        }
                      >
                        <option value="">Select organisation</option>
                        {organisations.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.full_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        onClick={() =>
                          settleDonation(
                            d.donation_id,
                            selectedOrgs[d.donation_id] ?? d.organisation_id
                          )
                        }
                      >
                        Settle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Organization Requests */}
        <div className="card">
          <h3>Requests Posted by Organizations</h3>
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Title</th>
                <th>Description</th>
                <th>Urgency</th>
                <th>Status</th>
                <th>Posted On</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan="6">No requests yet</td></tr>
              ) : (
                requests.map((r) => (
                  <tr key={`${r.type}-${r.id}`}>
                    <td>{r.requester}</td>
                    <td>{r.title}</td>
                    <td>{r.description || "-"}</td>
                    <td>{r.urgency}</td>
                    <td>
                      {r.status === "Fulfilled" || r.status === "Settled" ? (
                        "✅ Settled"
                      ) : r.type === "need" ? (
                        <button onClick={() => settleNeed(r.id)}>Settle</button>
                      ) : (
                        <button onClick={() => settleDonationRequest(r.id)}>
                          Settle
                        </button>
                      )}
                    </td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;