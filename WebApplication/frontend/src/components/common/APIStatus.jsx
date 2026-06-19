import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Loader } from "lucide-react";
import * as API from "../services/api";

/**
 * APIStatus Component
 * Displays real-time connection status to the backend API
 * Shows indicators: Connected, Connecting, Disconnected
 */
export const APIStatus = () => {
  const [status, setStatus] = useState("checking");
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const isHealthy = await API.checkAPIHealth();
        setStatus(isHealthy ? "connected" : "disconnected");
      } catch {
        setStatus("disconnected");
      }
    };

    // Check immediately
    checkHealth();

    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  const statusConfig = {
    connected: {
      icon: CheckCircle,
      text: "Backend Connected",
      color: "bg-green-500",
      textColor: "text-green-700",
      bgColor: "bg-green-50",
    },
    disconnected: {
      icon: AlertCircle,
      text: "Backend Disconnected",
      color: "bg-red-500",
      textColor: "text-red-700",
      bgColor: "bg-red-50",
    },
    checking: {
      icon: Loader,
      text: "Checking Connection...",
      color: "bg-yellow-500",
      textColor: "text-yellow-700",
      bgColor: "bg-yellow-50",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`${config.bgColor} border-l-4 ${config.color} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className={`${config.textColor} ${status === "checking" ? "animate-spin" : ""}`} size={20} />
          <span className={`text-sm font-medium ${config.textColor}`}>
            {config.text}
          </span>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className={`${config.textColor} hover:opacity-70 text-lg`}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default APIStatus;
