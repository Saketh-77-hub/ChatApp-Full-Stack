import { config } from "dotenv";
import { connectDB } from "../lib/db.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs"; // ✅ Add bcrypt

config();

// ✅ Hash passwords before inserting
const hashedUsers = await Promise.all(
  seedUsers.map(async (user) => ({
    ...user,
    password: await bcrypt.hash(user.password, 10),
  }))
);

const seedDatabase = async () => {
  try {
    await connectDB();

    // Optional: Clear old data first
    await User.deleteMany({});

    await User.insertMany(hashedUsers);
    console.log("✅ Database seeded successfully");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  }
};

// Call the function
seedDatabase();
