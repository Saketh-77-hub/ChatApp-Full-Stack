import { useEffect } from "react";
import useSocket from "../hooks/useSocket";

const SocketProvider = ({ children }) => {
  // Initialize socket connection
  useSocket();

  return children;
};

export default SocketProvider;