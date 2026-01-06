import { configDotenv } from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

// Load environment variables from .env
configDotenv();

// Global process-level error handlers to avoid silent crashes
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
  // For production, prefer graceful shutdown logic here
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // For production, prefer graceful shutdown logic here
  process.exit(1);
});

// Attach app-level error listener early (do not throw inside event handlers)
app.on("error", (error) => {
  console.error("Express app error:", error);
});

const PORT = Number(process.env.PORT) || 8000;
const NODE_ENV = process.env.NODE_ENV || "development";

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`[${NODE_ENV}] Server running on http://localhost:${PORT}`);
    });

    // Handle server-level errors (e.g., EADDRINUSE, EACCES)
    server.on("error", (err) => {
      console.error("HTTP server error:", err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });
