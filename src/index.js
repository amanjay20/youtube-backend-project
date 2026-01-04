import { configDotenv } from "dotenv";
import connectDB from "./db/index.js";

// Load environment variables from .env
configDotenv();

connectDB()