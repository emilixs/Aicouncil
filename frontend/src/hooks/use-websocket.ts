import { useEffect, useState, useCallback, useRef } from "react";
import { Socket } from "socket.io-client";
import { createSocketConnection, disconnectSocket } from "@/lib/socket";
import { getSessionToken } from "@/lib/api/sessions";
import type { MessageResponse, MessageRole } from "@/types";

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  messages: MessageResponse[];
  consensusReached: boolean;
  isDiscussionActive: boolean;
  currentExpertTurn: string | null;
  startDiscussion: () => void;
  sendIntervention: (content: string) => Promise<void>;
  disconnect: () => void;
}

export function useWebSocket(sessionId: string): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [consensusReached, setConsensusReached] = useState(false);
  const [isDiscussionActive, setIsDiscussionActive] = useState(false);
  const [currentExpertTurn, setCurrentExpertTurn] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    let isMounted = true;

    const initializeSocket = async () => {
      try {
        setError(null);
        const tokenResponse = await getSessionToken(sessionId);
        const newSocket = createSocketConnection(tokenResponse.token);

        // Connection events
        newSocket.on("connect", () => {
          if (isMounted) {
            setIsConnected(true);
            setError(null);
          }
        });

        newSocket.on("disconnect", () => {
          if (isMounted) {
            setIsConnected(false);
          }
        });

        // Message events
        newSocket.on("message", (message: MessageResponse) => {
          if (isMounted) {
            setMessages((prev) => [...prev, message]);
          }
        });

        // Expert turn events
        newSocket.on("expert-turn-start", (data: { expertId: string; expertName: string }) => {
          if (isMounted) {
            setCurrentExpertTurn(data.expertId);
          }
        });

        // Discussion events
        newSocket.on("discussion-started", () => {
          if (isMounted) {
            setIsDiscussionActive(true);
          }
        });

        // Consensus reached
        newSocket.on("consensus-reached", (data: { consensus: string }) => {
          if (isMounted) {
            setConsensusReached(true);
            // Add consensus message
            const consensusMessage: MessageResponse = {
              id: `consensus-${Date.now()}`,
              sessionId,
              expertId: null,
              content: data.consensus,
              role: "SYSTEM" as MessageRole,
              isIntervention: false,
              timestamp: new Date().toISOString(),
              expertName: null,
              expertSpecialty: null,
            };
            setMessages((prev) => [...prev, consensusMessage]);
          }
        });

        // Session ended
        newSocket.on("session-ended", () => {
          if (isMounted) {
            setIsDiscussionActive(false);
          }
        });

        // Intervention queued
        newSocket.on("intervention-queued", () => {
          if (isMounted) {
            setError(null);
          }
        });

        // Error handling
        newSocket.on("error", (errorData: { message: string }) => {
          if (isMounted) {
            setError(errorData.message || "WebSocket error occurred");
          }
        });

        newSocket.connect();
        socketRef.current = newSocket;
        setSocket(newSocket);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to initialize WebSocket");
        }
      }
    };

    initializeSocket();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  // Start discussion
  const startDiscussion = useCallback(() => {
    if (socket?.connected) {
      socket.emit("start-discussion");
    }
  }, [socket]);

  // Send intervention
  const sendIntervention = useCallback(
    async (content: string) => {
      return new Promise<void>((resolve, reject) => {
        if (!socket?.connected) {
          reject(new Error("WebSocket not connected"));
          return;
        }

        socket.emit("intervention", { content }, (response: { success: boolean; error?: string }) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || "Failed to send intervention"));
          }
        });
      });
    },
    [socket]
  );

  // Disconnect
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      disconnectSocket(socketRef.current);
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    socket,
    isConnected,
    error,
    messages,
    consensusReached,
    isDiscussionActive,
    currentExpertTurn,
    startDiscussion,
    sendIntervention,
    disconnect,
  };
}

