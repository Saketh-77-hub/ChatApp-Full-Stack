import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import cloudinary from "../lib/cloudinary.js";

/**
 * Get users for sidebar (excluding the logged-in user)
 */
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("❌ Error in getUsersForSidebar:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get messages between the logged-in user and selected user
 */
export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("❌ Error in getMessages:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Send a new message (text/image/audio/video) from logged-in user to receiver
 */
export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio, video, contentType } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user?._id || req.body.senderId;

    if (!senderId || !receiverId) {
      return res.status(400).json({ message: "Missing sender or receiver ID" });
    }

    console.log("📩 Incoming message:");
    console.log("Sender ID:", senderId);
    console.log("Receiver ID:", receiverId);
    console.log("Text:", text);
    if (image) console.log("Image preview:", image.slice(0, 100));
    if (audio) console.log("Audio preview:", audio.slice(0, 100));
    if (video) console.log("Video preview:", video.slice(0, 100));

    let imageUrl = "", audioUrl = "", videoUrl = "";

    // Upload image
    if (image) {
      const uploadRes = await cloudinary.uploader.upload(image, {
        resource_type: "image",
      });
      imageUrl = uploadRes.secure_url;
    }

    // Upload audio
    if (audio) {
      const uploadRes = await cloudinary.uploader.upload(audio, {
        resource_type: "video", // Cloudinary treats audio as video
      });
      audioUrl = uploadRes.secure_url;
    }

    // Upload video
    if (video) {
      const uploadRes = await cloudinary.uploader.upload(video, {
        resource_type: "video",
      });
      videoUrl = uploadRes.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      video: videoUrl,
      contentType: contentType || "text",
    });

    await newMessage.save();
    console.log("✅ Message saved to DB:", newMessage._id);

    // Emit to both sender and receiver for real-time updates
    const messageData = {
      _id: newMessage._id,
      senderId: newMessage.senderId,
      receiverId: newMessage.receiverId,
      text: newMessage.text,
      image: newMessage.image,
      audio: newMessage.audio,
      video: newMessage.video,
      contentType: newMessage.contentType,
      createdAt: newMessage.createdAt,
      updatedAt: newMessage.updatedAt
    };

    // Send to receiver
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", messageData);
      console.log("📨 Message sent to receiver:", receiverId);
    } else {
      console.log("⚠️ Receiver offline:", receiverId);
    }

    // Send to sender for confirmation
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("newMessage", messageData);
      console.log("📨 Message confirmed to sender:", senderId);
    }

    res.status(200).json(newMessage);

  } catch (error) {
    console.error("❌ Error in sendMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
