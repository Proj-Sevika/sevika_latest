import { useEffect, useState } from "react";

function ForumPage() {

  const API = "http://localhost:3000/api/forum";

  const [organization, setOrganization] = useState("");
  const [type, setType] = useState("misconduct");
  const [action, setAction] = useState("");
  const [content, setContent] = useState("");

  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("green");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 5;

  // ================= LOAD POSTS =================

  const loadPosts = async (page = 1) => {
    try {

      const res = await fetch(`${API}/posts?page=${page}&limit=${limit}`);
      const data = await res.json();

      if (!res.ok) {
        console.error(data);
        return;
      }

      setPosts(data.posts || []);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(page);

    } catch (err) {
      console.error("Error loading posts:", err);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  // ================= SUBMIT POST =================

  const submitPost = async () => {

    if (!organization) {
      setMessageColor("red");
      setMessage("Organization name is required.");
      return;
    }

    try {

      const res = await fetch(`${API}/create-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content,
          type,
          requested_action: action,
          organization
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessageColor("red");
        setMessage(data.message || "Failed to submit complaint");
      } else {

        setMessageColor("green");
        setMessage(data.message || "Complaint submitted");

        setContent("");
        setAction("");
        setOrganization("");

        loadPosts(1);
      }

    } catch (err) {
      console.error(err);
      setMessageColor("red");
      setMessage("Server error");
    }

    setTimeout(() => {
      setMessage("");
    }, 4000);
  };

  // ================= VOTING =================

  const vote = async (id, voteType) => {

    try {

      const res = await fetch(`${API}/vote/${id}/${voteType}`, {
        method: "POST"
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Vote failed");
        return;
      }

      loadPosts(currentPage);

    } catch (err) {
      console.error(err);
    }
  };

  // ================= URGENCY COLOR =================

  const getUrgencyColor = (urgency) => {

    if (urgency === "high") return "#e74c3c";
    if (urgency === "medium") return "#f39c12";
    if (urgency === "low") return "#27ae60";

    return "#7f8c8d";
  };

  const getCardColor = (urgency) => {

    if (urgency === "high") return "#ffe6e6";
    if (urgency === "medium") return "#fff6e6";
    if (urgency === "low") return "#eafaf1";

    return "#f5f5f5";
  };

  return (

    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #e8f1f8, #d6e6f2)",
        paddingTop: "40px",
        paddingBottom: "40px"
      }}
    >

      <div
  style={{
    maxWidth: "800px",
    margin: "60px auto",
    fontFamily: "Poppins, Arial",
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(12px)",
    padding: "35px",
    borderRadius: "16px",
    boxShadow: "0 25px 60px rgba(0,0,0,0.15)"
  }}
>

        <h2 style={{ textAlign: "center", marginBottom: "20px", color: "#0d47a1" }}>
          📢 Anonymous Complaint Forum
        </h2>

        {message && (
          <p style={{ color: messageColor }}>{message}</p>
        )}

        {/* ORGANIZATION */}

        <label>Organization Name:</label>
        <input
          type="text"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          placeholder="Enter organization name"
          style={{ width: "100%", marginBottom: "10px", padding: "8px" }}
        />

        {/* TYPE */}

        <label>Complaint Type:</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ width: "100%", marginBottom: "10px", padding: "8px" }}
        >
          <option value="misconduct">Misconduct</option>
          <option value="service">Poor Service</option>
          <option value="corruption">Corruption</option>
          <option value="donation">Donation Issue</option>
          <option value="other">Other</option>
        </select>

        {/* ACTION */}

        <label>Expected Action:</label>
        <input
          type="text"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Investigation, refund, clarification..."
          style={{ width: "100%", marginBottom: "10px", padding: "8px" }}
        />

        {/* CONTENT */}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your complaint..."
          style={{ width: "100%", height: "100px", padding: "8px" }}
        />

        <button
          onClick={submitPost}
          style={{
            marginTop: "12px",
            padding: "10px 16px",
            background: "#1565c0",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Submit Complaint
        </button>

        <hr style={{ margin: "25px 0" }} />

        <h3>Complaints</h3>

        {posts.length === 0 && <p>No complaints yet.</p>}

        {posts.map((post) => (

          <div
            key={post.id}
            style={{
              background: getCardColor(post.urgency),
              padding: "14px",
              marginTop: "15px",
              borderRadius: "10px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.08)"
            }}
          >

            <span
              style={{
                background: getUrgencyColor(post.urgency),
                color: "white",
                padding: "4px 8px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "bold"
              }}
            >
              URGENCY: {(post.urgency || "unknown").toUpperCase()}
            </span>

            <br /><br />

            <strong>Organization:</strong> {post.organization} <br />
            <strong>Type:</strong> {post.type} <br />
            <strong>Requested Action:</strong> {post.requested_action || "None"} <br />
            <strong>Complaint:</strong> {post.content}

            <br /><br />

            <small style={{ color: "#666" }}>
              {new Date(post.created_at).toLocaleString()}
            </small>

            <br /><br />

            <button
              onClick={() => vote(post.id, "up")}
              style={{
                border: "none",
                background: "#ecf0f1",
                padding: "5px 10px",
                marginRight: "10px",
                borderRadius: "5px",
                cursor: "pointer"
              }}
            >
              👍 {post.upvotes || 0}
            </button>

            <button
              onClick={() => vote(post.id, "down")}
              style={{
                border: "none",
                background: "#ecf0f1",
                padding: "5px 10px",
                borderRadius: "5px",
                cursor: "pointer"
              }}
            >
              👎 {post.downvotes || 0}
            </button>

          </div>

        ))}

        {/* PAGINATION */}

        <div style={{ marginTop: "25px", textAlign: "center" }}>

          {[...Array(totalPages)].map((_, i) => {

            const page = i + 1;

            return (
              <button
                key={page}
                onClick={() => loadPosts(page)}
                style={{
                  marginRight: "6px",
                  padding: "6px 10px",
                  cursor: "pointer",
                  background: page === currentPage ? "#1565c0" : "#eee",
                  color: page === currentPage ? "white" : "black",
                  border: "none",
                  borderRadius: "4px"
                }}
              >
                {page}
              </button>
            );
          })}

        </div>

      </div>

    </div>
  );
}

export default ForumPage;