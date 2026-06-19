import { Menu, ChartNetwork, Activity, Home, History, Layers } from "lucide-react";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useEncryption } from "../../App";
// kept intentionally minimal for the encryption-focused UI

const Logo = () => {
  return (
    <motion.div
      className="text-white text-center flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Logo Text */}
      <div className="text-xl font-bold tracking-wider mt-1">
        <span className="text-gradient bg-gradient-to-t from-[#00E68F] via-[#00B378] to-[#007F5E] bg-clip-text text-transparent">
          Syntom
        </span>
      </div>
    </motion.div>
  );
};

const SIDEBAR_ITEMS = [
  {
    name: "Home",
    icon: Home,
    color: "#9CA3AF",
    href: "/landing",
  },
  {
    name: "Encryption",
    icon: ChartNetwork,
    color: "#34D399",
    href: "/encryption",
  },
  {
    name: "Decrypt",
    icon: Activity,
    color: "#F59E0B",
    href: "/encryption/decrypt",
  },
  {
    name: "Process",
    icon: Activity,
    color: "#8B5CF6",
    href: "/encryption/process",
  },
  {
    name: "History",
    icon: History,
    color: "#3B82F6",
    href: "/history",
  },
];

const Sidebar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeItem, setActiveItem] = useState("/encryption");
  const enc = useEncryption();
  const navigate = useNavigate();

  useEffect(() => {
    // Set active item based on current location
    setActiveItem(window.location.pathname || "/encryption");
  }, []);

  return (
    <motion.div
      className="relative z-10 transition-all duration-300 ease-in-out flex-shrink-0"
      animate={{ width: isSidebarOpen ? 256 : 80 }}
    >
      <div className="h-full bg-gradient-to-b from-gray-900/80 to-gray-800/80 backdrop-blur-lg p-4 flex flex-col border-r border-gray-700/40 shadow-xl">
        {/* Top section with logo and toggle */}
        <div className="flex items-center justify-start mb-4 mt-2 space-x-4">
          <motion.button
            whileHover={{ scale: 1.1, rotate: isSidebarOpen ? 0 : 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-full hover:bg-gray-700/50 transition-all duration-300 bg-gray-800/60 border border-gray-700/30"
          >
            <Menu size={22} className="text-gray-300" />
          </motion.button>
          {isSidebarOpen && <Logo />}
        </div>

        {/* Divider with glowing effect */}
        <div className="relative h-px w-full bg-gradient-to-r from-transparent via-gray-500/30 to-transparent my-2">
          <div
            className="absolute h-px w-16 bg-gradient-to-r from-transparent via-[#00E68F]/60 to-transparent animate-pulse"
            style={{ left: "40%" }}
          ></div>
        </div>

        {/* Navigation items */}
        <nav className="mt-4 flex-grow space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = activeItem === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setActiveItem(item.href)}
              >
                <motion.div
                  className={`flex items-center p-3 text-base font-medium rounded-lg hover:bg-gray-700/40 transition-all duration-300 mb-1 relative overflow-hidden ${
                    isActive
                      ? "bg-gray-700/60 shadow-lg border-l-2 border-[#00E68F]"
                      : "bg-gray-800/20"
                  }`}
                  whileHover={{ x: 3 }}
                >
                  {/* Background glow effect for active item */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-[#00E68F]/5 to-transparent opacity-50"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.1 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        repeatType: "reverse",
                      }}
                    />
                  )}

                  {/* Icon with custom color */}
                  <div
                    className={`flex items-center justify-center w-8 h-8 ${
                      isActive ? "text-[#00E68F]" : "text-gray-300"
                    }`}
                  >
                    <item.icon
                      size={22}
                      style={{ color: isActive ? "#00E68F" : item.color }}
                    />
                  </div>

                  {/* Text label with animation */}
                  <AnimatePresence>
                    {isSidebarOpen && (
                      <motion.span
                        className={`ml-3 whitespace-nowrap ${
                          isActive ? "text-[#00E68F]" : "text-gray-300"
                        }`}
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section with additional design */}
        <div className="mt-auto pt-4">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-500/30 to-transparent mb-4"></div>
          {isSidebarOpen && (
            <motion.div
              className="text-xs text-gray-500 text-center px-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Syntom Secure System
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Sidebar;
