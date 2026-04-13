import { useEffect, useState, useCallback, useRef } from "react";
import { Socket } from "socket.io-client";
import { createSocketConnection, disconnectSocket } from "@/lib/socket";
import { getSessionToken } from "@/lib/api/sessions";
import type { MessageResponse, MessageRole } from "@/types";

interface CurrentExpertTurn {
  expertId: string;
  expertName: string;
  turnNumber: number;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
  messages: MessageResponse[];
  consensusReached: boolean;
  isDiscussionActive: boolean;
  isPaused: boolean;
  currentExpertTurn: CurrentExpertTurn | null;
  startDiscussion: () => void;
  sendIntervention: (content: string) => Promise<void>;
  pauseDiscussion: () => void;
  resumeDiscussion: () => void;
  stopDiscussion: () => void;
  disconnect: () => void;
}

export function useWebSocket(sessionId: string): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [consensusReached, setConsensusReached] = useState(false);
  const [isDiscussionActive, setIsDiscussionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentExpertTurn, setCurrentExpertTurn] = useState<CurrentExpertTurn | null>(null);
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

        newSocket.on("connected", (data: { sessionId: string; status?: string }) => {
          if (isMounted && data.status) {
            setIsDiscussionActive(data.status === "active" || data.status === "paused");
            setIsPaused(data.status === "paused");
          }
        });

        newSocket.on("disconnect", (reason) => {
          if (isMounted) {
            setIsConnected(false);
            if (reason === "io server disconnect") {
              newSocket.connect();
            }
          }
        });

        newSocket.on("connect_error", (err) => {
          if (isMounted) {
            console.warn(`WebSocket connect_error: ${err.message}`);
          }
        });

        newSocket.io.on("reconnect_failed", () => {
          if (isMounted) {
            setError("Connection failed after multiple attempts. Please refresh the page.");
          }
        });

        // Message events
        newSocket.on("message", (message: MessageResponse) => {
          if (isMounted) {
            setMessages((prev) => [...prev, message]);
          }
        });

        // Expert turn events
        newSocket.on("expert-turn-start", (data: { expertId: string; expertName: string; turnNumber: number }) => {
          if (isMounted) {
            setCurrentExpertTurn({
              expertId: data.expertId,
              expertName: data.expertName,
              turnNumber: data.turnNumber,
            });
          }
        });

        // Discussion events
        newSocket.on("discussion-started", () => {
          if (isMounted) {
            setIsDiscussionActive(true);
            setIsPaused(false);
          }
        });

        newSocket.on("discussion-paused", () => {
          if (isMounted) {
            setIsPaused(true);
          }
        });

        newSocket.on("discussion-resumed", () => {
          if (isMounted) {
            setIsPaused(false);
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

        // Discussion stopped (immediate feedback before loop exits)
        newSocket.on("discussion-stopped", () => {
          if (isMounted) {
            setIsDiscussionActive(false);
            setIsPaused(false);
          }
        });

        // Session ended
        newSocket.on("session-ended", () => {
          if (isMounted) {
            setIsDiscussionActive(false);
            setIsPaused(false);
          }
        });

        // Intervention queued
        newSocket.on("intervention-queued", () => {
          if (isMounted) {
            setError(null);
          }
        });

        // Comparison events
        newSocket.on("comparison-response", (data: { sessionId: string; message: MessageResponse; completedCount: number; totalExperts: number }) => {
          if (isMounted) {
            setMessages((prev) => [...prev, data.message]);
          }
        });

        newSocket.on("comparison-complete", () => {
          if (isMounted) {
            setIsDiscussionActive(false);
          }
        });

        newSocket.on("comparison-error", (data: { sessionId: string; expertId: string; expertName: string; error: string }) => {
          if (isMounted) {
            setError(`${data.expertName}: ${data.error}`);
          }
        });

        newSocket.on("comparison-started", () => {
          if (isMounted) {
            setIsDiscussionActive(true);
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
      // Disconnect socket when sessionId changes
      if (socketRef.current) {
        disconnectSocket(socketRef.current);
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [sessionId]);

  // Start discussion
  const startDiscussion = useCallback(() => {
    if (socket?.connected) {
      socket.emit("start-discussion", { sessionId });
    }
  }, [socket, sessionId]);

  // Send intervention
  const sendIntervention = useCallback(
    async (content: string) => {
      return new Promise<void>((resolve, reject) => {
        if (!socket?.connected) {
          reject(new Error("WebSocket not connected"));
          return;
        }

        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Intervention timed out"));
        }, 10000);

        const cleanup = () => {
          clearTimeout(timeout);
          socket.off("intervention-queued", onQueued);
          socket.off("error", onError);
        };

        const onQueued = () => {
          cleanup();
          resolve();
        };

        const onError = (errorData: { message: string }) => {
          cleanup();
          reject(new Error(errorData.message || "Failed to send intervention"));
        };

        socket.on("intervention-queued", onQueued);
        socket.on("error", onError);
        socket.emit("intervention", { sessionId, content });
      });
    },
    [socket, sessionId]
  );

  // Pause discussion
  const pauseDiscussion = useCallback(() => {
    if (socket?.connected) {
      socket.emit("pause-discussion", { sessionId });
    }
  }, [socket, sessionId]);

  // Resume discussion
  const resumeDiscussion = useCallback(() => {
    if (socket?.connected) {
      socket.emit("resume-discussion", { sessionId });
    }
  }, [socket, sessionId]);

  // Stop discussion
  const stopDiscussion = useCallback(() => {
    if (socket?.connected) {
      socket.emit("stop-discussion", { sessionId });
    }
  }, [socket, sessionId]);

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
    isPaused,
    currentExpertTurn,
    startDiscussion,
    sendIntervention,
    pauseDiscussion,
    resumeDiscussion,
    stopDiscussion,
    disconnect,
  };
}

