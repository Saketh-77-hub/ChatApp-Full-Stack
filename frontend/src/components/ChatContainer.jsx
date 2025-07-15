import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton.jsx";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();

  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  useEffect(() => {
    getMessages(selectedUser._id);
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [selectedUser._id]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isSentByMe = message.senderId === authUser._id;

          return (
            <div
              key={message._id}
              className={`chat ${isSentByMe ? "chat-end" : "chat-start"}`}
              ref={messageEndRef}
            >
              <div className="chat-image avatar">
                <div className="size-10 rounded-full border">
                  <img
                    src={
                      isSentByMe
                        ? authUser.profilePic || "/avatar.png"
                        : selectedUser.profilePic || "/avatar.png"
                    }
                    alt="profile pic"
                  />
                </div>
              </div>

              <div className="chat-header mb-1">
                <time className="text-xs opacity-50 ml-1">
                  {formatMessageTime(message.createdAt)}
                </time>
              </div>

              <div className="chat-bubble flex flex-col max-w-sm sm:max-w-lg md:max-w-xl">
                {/* 🖼️ Image */}
                {message.image && (
                  <img
                    src={message.image}
                    alt="Image"
                    className="rounded-lg mb-2 max-w-full"
                  />
                )}

                {/* 🔊 Audio */}
                {message.audio && (
                  <audio 
                    controls 
                    className="rounded-lg mb-2 max-w-full max-h-[200px]"
                    preload="metadata"
                  >
                    <source src={message.audio} type="audio/mpeg" />
                    <source src={message.audio} type="audio/wav" />
                    <source src={message.audio} type="audio/ogg" />
                    Your browser does not support the audio element.
                  </audio>
                )}

                {/* 🎥 Video */}
                {message.video && (
                  <video
                    controls
                    className="rounded-lg mb-2 max-w-full max-h-[200px]"
                  >
                    <source src={message.video} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                )}

                {/* 📝 Text */}
                {message.text && <p>{message.text}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <MessageInput />
    </div>
  );
};

export default ChatContainer;
