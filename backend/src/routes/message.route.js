import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getMessages,
  getUsersForSidebar,
  sendMessage
} from "../controllers/message.controller.js";

const router = express.Router();

// Get all users for the sidebar
router.get("/users", protectRoute, getUsersForSidebar);

// Get messages for a specific user or conversation
router.get("/:id", protectRoute, getMessages);

// Send a message to a specific user or conversation
router.post("/send/:id", protectRoute, sendMessage);

export default router;
