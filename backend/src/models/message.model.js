import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId, // ✅ Fixed capitalization
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    image: {
      type: String, // ✅ Fixed typo
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema); // ✅ Variable name fixed
export default Message;
