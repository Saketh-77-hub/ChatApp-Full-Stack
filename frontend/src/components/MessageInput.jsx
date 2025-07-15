import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X, Mic, Video } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null); // for image/audio/video preview
  const [fileType, setFileType] = useState(""); // image, audio, video
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const { sendMessage } = useChatStore();

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const base64 = await convertToBase64(file);
    setPreview(base64);
    setFileType(type);
  };

  const removePreview = () => {
    setPreview(null);
    setFileType("");
    imageInputRef.current.value = "";
    audioInputRef.current.value = "";
    videoInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !preview) return;

    try {
      const payload = {
        text: text.trim(),
        contentType: fileType || "text",
      };

      if (fileType === "image") payload.image = preview;
      if (fileType === "audio") payload.audio = preview;
      if (fileType === "video") payload.video = preview;

      await sendMessage(payload);

      // Reset
      setText("");
      removePreview();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Message failed to send");
    }
  };

  return (
    <div className="p-4 w-full">
      {preview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            {fileType === "image" && (
              <img
                src={preview}
                alt="preview"
                className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
              />
            )}

            {fileType === "audio" && (
              <audio controls className="w-48">
                <source src={preview} type="audio/mp3" />
              </audio>
            )}

            {fileType === "video" && (
              <video controls className="w-48 h-24 rounded-lg border border-zinc-700">
                <source src={preview} type="video/mp4" />
              </video>
            )}

            <button
              onClick={removePreview}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {/* Hidden Inputs */}
          <input type="file" accept="image/*" ref={imageInputRef} className="hidden" onChange={(e) => handleFileChange(e, "image")} />
          <input type="file" accept="audio/*" ref={audioInputRef} className="hidden" onChange={(e) => handleFileChange(e, "audio")} />
          <input type="file" accept="video/*" ref={videoInputRef} className="hidden" onChange={(e) => handleFileChange(e, "video")} />

          {/* File Buttons */}
          <button
            type="button"
            className={`btn btn-circle text-zinc-400`}
            onClick={() => imageInputRef.current?.click()}
          >
            <Image size={20} />
          </button>

          <button
            type="button"
            className="btn btn-circle text-zinc-400"
            onClick={() => audioInputRef.current?.click()}
          >
            <Mic size={20} />
          </button>

          <button
            type="button"
            className="btn btn-circle text-zinc-400"
            onClick={() => videoInputRef.current?.click()}
          >
            <Video size={20} />
          </button>
        </div>

        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={!text.trim() && !preview}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
