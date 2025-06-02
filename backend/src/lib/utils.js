import jwt from "jsonwebtoken"

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  // Setting the JWT token in a cookie
  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    httpOnly: true,                   // Make cookie inaccessible via JS
    sameSite: "strict",               // Make sure this is set correctly
    secure: process.env.NODE_ENV !== "development", // Secure cookie only over HTTPS in production
  });
};