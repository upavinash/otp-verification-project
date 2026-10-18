
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });
const authRoutes = require("./routes/authRoutes");

const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "10kb" }));
// Auth routes
app.use("/api/auth", authRoutes);

// Test API + MySQL connection
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "MySQL connected successfully!"
    });
  } catch (error) {
    console.error("MySQL error:", error.code || error.name);

    res.status(500).json({
      success: false,
      message: "MySQL connection failed",
      error: error.code || "UNKNOWN_ERROR",
    });
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Request body must contain valid JSON.",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body is too large.",
    });
  }

  console.error("Request error:", error.code || error.name);
  return res.status(500).json({
    success: false,
    message: "Something went wrong. Please try again.",
  });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
