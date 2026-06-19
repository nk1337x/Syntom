import React, { useState, useRef, useEffect } from "react";
import { Player } from "@lottiefiles/react-lottie-player";
import ChatBot from "../../assets/lottie/Chatbot.json";
import {
  Camera,
  Mic,
  Send,
  X,
  StopCircle,
  PlusCircle,
  Video,
  ChevronDown,
  AlertCircle,
  Settings,
} from "lucide-react";
import { FaVideoSlash } from "react-icons/fa";
import * as API from "../services/api";

function ChatBotWindow() {
  const [isLoading, setIsLoading] = useState(false);
  const [isVectorStoreLoading, setIsVectorStoreLoading] = useState(false);

  const [isTyping, setIsTyping] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const videoRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [place, setPlace] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const fetchCameras = async () => {
    setIsLoading(true);
    try {
      const cameras = await API.getCameras();
      setCameras(cameras);
      setIsDropdownOpen(true);
    } catch (error) {
      console.error("Error fetching cameras:", error);
      alert("Failed to fetch cameras. Please try again");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCameraSelect = async (event) => {
    const selectedPlace = event.target.value;
    setSelectedCamera(selectedPlace);
    setIsDropdownOpen(false);

    if (selectedPlace) {
      try {
        // Create the video source
        const videoSrc = `${selectedPlace}.mp4`;

        // Only try to set video properties after rendering cycle completes
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.src = videoSrc;
            videoRef.current.load();
          }
        }, 0);

        // Set loading state before API call
        setIsVectorStoreLoading(true);

        // Update vector store using API service
        await API.updateVectorStore(selectedPlace);

        // Clear loading state after successful response
        setIsVectorStoreLoading(false);
      } catch (error) {
        console.error("Error updating vector store:", error);
        alert("Failed to update vector store. Please try again");
        setIsVectorStoreLoading(false); // Clear loading state on error too
      }
    }
  };

  const handleFileChange = (event) => {
    setVideoFile(event.target.files[0]);
  };

  const handleSubmit = async () => {
    if (!videoFile || !place) {
      alert("Please enter a place and select a video file");
      return;
    }

    try {
      const response = await API.createFlorenceDocument(place, videoFile);

      if (response.status === "ok") {
        alert("CCTV registered successfully!");
        setIsPopupOpen(false);
        setPlace("");
        setVideoFile(null);
      } else {
        alert("Failed to register CCTV");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred while registering CCTV");
    }
  };

  const handleMessageChange = (e) => setUserMessage(e.target.value);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!userMessage.trim()) return;

    setChatHistory((prev) => [
      ...prev,
      { sender: "user", message: userMessage },
    ]);

    const currentMessage = userMessage;
    setUserMessage("");
    setIsTyping(true);

    try {
      const response = await API.getResponse(currentMessage);

      let chatbotMessage = response.response;

      // Updated regex to match [H:MM:SS] format
      const timestampRegex = /\[(\d+):(\d{2}):(\d{2})\]/g;
      let processedMessage = chatbotMessage;

      // Process the message to add hyperlinks to timestamps
      processedMessage = processedMessage.replace(
        timestampRegex,
        (match, hours, minutes, seconds) => {
          const h = parseInt(hours, 10);
          const m = parseInt(minutes, 10);
          const s = parseInt(seconds, 10);
          const timeInSeconds = h * 3600 + m * 60 + s;

          return `<span class='text-blue-400 cursor-pointer hover:underline' data-time='${timeInSeconds}'>${match}</span>`;
        }
      );

      // Add message with empty string first
      setChatHistory((prev) => [...prev, { sender: "chatbot", message: "" }]);

      setIsTyping(false);

      // Stream the message character by character
      const messageArray = processedMessage.split("");
      let currentIndex = 0;
      let accumulatedMessage = "";

      const streamInterval = setInterval(() => {
        if (currentIndex < messageArray.length) {
          // Add the next character to our accumulating message
          accumulatedMessage += messageArray[currentIndex];

          // Update the chat history with the complete accumulated message so far
          setChatHistory((prev) => {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1] = {
              sender: "chatbot",
              message: accumulatedMessage,
            };
            return newHistory;
          });

          currentIndex++;
        } else {
          clearInterval(streamInterval);
        }
      }, 15); // Speed of typing animation
    } catch (error) {
      console.error("Error:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          sender: "chatbot",
          message: "Sorry, I encountered an error. Please try again.",
        },
      ]);
      setIsTyping(false);
    }
  };

  const handleTimestampClick = (event) => {
    const timeElement = event.target.closest("[data-time]");
    if (timeElement) {
      const timeInSeconds = parseInt(timeElement.getAttribute("data-time"), 10);
      if (videoRef.current) {
        videoRef.current.currentTime = timeInSeconds;
        videoRef.current.pause();
      }
    }
  };

  useEffect(() => {
    const chatContainer = document.querySelector(".chat-container");
    if (chatContainer) {
      chatContainer.addEventListener("click", handleTimestampClick);
    }
    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener("click", handleTimestampClick);
      }
    };
  }, [chatHistory]);

  const themeClass = "bg-gray-900 text-white";
  const cardClass = "bg-gray-800";
  const inputClass = "bg-gray-700 text-white";

  return (
    <div
      className={`flex flex-col lg:flex-row min-h-screen ${themeClass} transition-colors duration-300 `}
    >
      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:flex-row  gap-8">
        {/* Left column - chat interface */}
        <div className="flex-1 flex flex-col items-center mt-3">
          <div className="text-center mb-6">
            <div className="text-4xl lg:text-4xl  tracking-wider">
              <span className="bg-gradient-to-tr from-green-400 via-green-500 to-green-600 bg-clip-text text-transparent">
                Hi, Iam CCTV Bot
              </span>{" "}
            </div>
            <p className={`text-sm mt-2 ${"text-gray-400"}`}>
              Your All In One Bot For Making CCTV Analysis 100X Faster
            </p>
          </div>

          <div className="relative w-full max-w-lg">
            {isVectorStoreLoading && (
              <div className="absolute inset-0 bg-gray-900 bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="flex flex-col items-center p-8 rounded-2xl bg-gray-800 bg-opacity-80 shadow-lg border border-gray-700">
                  {/* Pulse and ripple effect animation */}
                  <div className="relative mb-6">
                    <div className="w-20 h-20 bg-green-500 bg-opacity-20 rounded-full animate-ping absolute inset-0"></div>
                    <div className="w-20 h-20 flex items-center justify-center relative">
                      <div className="w-16 h-16 border-4 border-gray-700 border-t-green-500 border-r-green-400 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video size={24} className="text-green-400" />
                      </div>
                    </div>
                  </div>

                  {/* Text information */}
                  <p className="text-white font-medium text-lg">
                    Processing footage
                  </p>
                  <div className="flex space-x-1 mt-1 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce"></div>
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                  <p className="text-gray-300 text-sm mt-1 max-w-xs text-center">
                    Please hang tight, updating vector database
                  </p>

                  {/* Progress bar */}
                  <div className="w-64 h-1.5 bg-gray-700 rounded-full mt-4 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full animate-pulse"
                      style={{
                        width: "60%",
                        animation:
                          "progress 1.5s ease-in-out infinite alternate",
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            <Player
              autoplay
              loop
              src={ChatBot}
              className="w-28 h-28 mx-auto mb-2"
            />
            <br></br>
            <div
              className={`${cardClass} shadow-lg rounded-3xl w-full overflow-hidden transition-all duration-300 border ${"border-gray-700"}`}
            >
              {/* Chat header */}
              <div
                className={`p-4 flex justify-between items-center ${"bg-gray-700"} border-b ${"border-gray-600"}`}
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                  <p className="font-medium">Bot</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs ${"text-gray-400"}`}>Online</span>
                </div>
              </div>

              {/* Chat messages */}
              <div
                ref={chatContainerRef}
                className="chat-container h-80 overflow-y-auto p-4 flex flex-col space-y-4"
              >
                {chatHistory.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className={`text-4xl mb-2 ${"text-gray-600"}`}>🤖</div>
                    <p className="font-medium">Hello! How can I help you?</p>
                    <p className={`text-sm mt-2 ${"text-gray-400"}`}>
                      Ask me about your surveillance footage
                    </p>
                  </div>
                ) : (
                  chatHistory.map((chat, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-2xl max-w-[80%] ${
                        chat.sender === "user"
                          ? "bg-gradient-to-r from-green-500 to-green-600 text-white self-end shadow-md"
                          : `${"bg-gray-700"} self-start`
                      }`}
                    >
                      <div
                        dangerouslySetInnerHTML={{ __html: chat.message }}
                      ></div>
                    </div>
                  ))
                )}
                {isTyping && (
                  <div
                    className={`p-4 rounded-2xl max-w-[80%] ${"bg-gray-700"} self-start`}
                  >
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                      <div
                        className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input area */}
              <div
                className={`p-4 ${"bg-gray-700"} border-t ${"border-gray-600"}`}
              >
                <div className="flex items-center">
                  <input
                    className={`flex-1 p-3 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-green-400 mr-4`}
                    type="text"
                    value={userMessage}
                    onChange={handleMessageChange}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                  />
                  <div className="flex space-x-4">
                    <button
                      className="p-3 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                      onClick={handleSendMessage}
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Camera dropdown - only when open */}
          {isDropdownOpen && cameras.length > 0 && (
            <div
              className={`mt-4 p-2 ${cardClass} rounded-lg shadow-md w-full max-w-md border ${"border-gray-700"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Select Camera Feed</span>
                <button
                  onClick={() => setIsDropdownOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={18} />
                </button>
              </div>
              <select
                className={`w-full p-3 rounded-lg ${inputClass} border ${"border-gray-600"}`}
                onChange={handleCameraSelect}
                value={selectedCamera}
              >
                <option value="">Select a Camera</option>
                {cameras.map((camera, index) => (
                  <option key={index} value={camera}>
                    {camera}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right column - video player */}
        <div className="flex-1 flex flex-col" style={{ marginTop: "198px" }}>
          <div
            className={`${cardClass} rounded-lg shadow-lg overflow-hidden border ${"border-gray-700"}`}
          >
            <div
              className={`p-4 flex justify-between items-center ${"bg-gray-700"} border-b ${"border-gray-600"}`}
            >
              <div className="flex items-center space-x-2">
                <Video size={20} className={"text-red-400"} />
                <span className="font-medium">
                  {selectedCamera ? selectedCamera : "Surveillance Feed"}
                </span>
              </div>
              <div className="flex space-x-2">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${"bg-gray-600 text-gray-300"}`}
                >
                  Recorded
                </span>
              </div>
            </div>

            <div className="relative" style={{ height: "400px" }}>
              {selectedCamera ? (
                <video
                  ref={videoRef}
                  src="video.mp4"
                  controls
                  className="w-full h-full object-contain"
                ></video>
              ) : (
                <div className="flex flex-col items-center justify-center h-full bg-gray-800">
                  <FaVideoSlash size={64} className="text-gray-500 mb-4" />
                  <p className="text-gray-400 text-lg font-medium">
                    No Camera Selected
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Please select a CCTV camera for analysis
                  </p>
                </div>
              )}

              {selectedCamera && (
                <div
                  className={`absolute top-2 right-2 px-2 py-1 rounded-md text-xs ${"bg-black bg-opacity-60"} flex items-center space-x-1`}
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  <span>REC</span>
                </div>
              )}
            </div>

            {selectedCamera && (
              <div
                className={`p-3 ${"bg-gray-700"} flex justify-between items-center text-sm`}
              >
                <span>Resolution: 1080p</span>
                <span>FPS: 24</span>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span>Secure Connection</span>
                </div>
              </div>
            )}
            {!selectedCamera && (
              <div
                className={`p-3 ${"bg-gray-700"} flex justify-between items-center text-sm`}
              >
                <span>Resolution: Nil</span>
                <span>FPS: 0</span>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span>Disconnected</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CCTV Registration Modal */}
      {isPopupOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div
            className={`${cardClass} p-6 rounded-lg shadow-lg w-96 max-w-full mx-4 border ${"border-gray-700"}`}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Register CCTV Camera</h2>
              <button
                onClick={() => setIsPopupOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  className={`block mb-2 text-sm font-medium ${"text-gray-300"}`}
                >
                  Camera Location
                </label>
                <input
                  type="text"
                  placeholder="e.g., Front Entrance, Parking Lot"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  className={`w-full p-3 rounded-lg ${inputClass} border ${"border-gray-600"} focus:ring-2 focus:ring-green-400 focus:outline-none`}
                />
              </div>

              <div>
                <label
                  className={`block mb-2 text-sm font-medium ${"text-gray-300"}`}
                >
                  Upload Video Feed
                </label>
                <div
                  className={`border-2 border-dashed ${"border-gray-600"} rounded-lg p-4 text-center`}
                >
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="videoFileInput"
                  />
                  <label htmlFor="videoFileInput" className="cursor-pointer">
                    <div className="flex flex-col items-center">
                      <Video size={36} className={`mb-2 ${"text-gray-400"}`} />
                      <span className="text-sm font-medium">
                        Click to select video file
                      </span>
                      {videoFile && (
                        <span className={`mt-2 text-xs ${"text-green-400"}`}>
                          {videoFile.name}
                        </span>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  className={`px-4 py-2 rounded-lg ${"bg-gray-700 hover:bg-gray-600 text-gray-300"}`}
                  onClick={() => setIsPopupOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow"
                  onClick={handleSubmit}
                >
                  Register Camera
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function ChatBotPage() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl text-gray-900 dark:text-white">
              <span className="bg-gradient-to-tr from-green-400 via-green-500 to-green-600 bg-clip-text text-transparent">
                Chatbot
              </span>{" "}
              <span className="text-gray-700 dark:text-gray-300 text-2xl">
                Smart CCTV Querying System
              </span>
            </h1>
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300">
                Online
              </div>
              <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          {/* Container for the ChatBotPage */}

          {/* ChatBotPage content */}
          <div>
            <ChatBotWindow />
          </div>
        </div>
      </main>
    </div>
  );
}

export default ChatBotPage;
