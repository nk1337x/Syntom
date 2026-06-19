import React from "react";
import { motion } from "framer-motion";

const LayerCard = ({ title, description, icon: Icon, color = "#00E68F", onDetails, onTest }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 shadow-md"
    >
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-md flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.25)" }}
        >
          {Icon ? <Icon size={22} style={{ color }} /> : <div style={{width:22,height:22,background:color}} />}
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
          </div>
          <p className="mt-2 text-xs text-gray-300">{description}</p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={onDetails}
              className="px-3 py-1 text-xs bg-transparent border border-gray-700 rounded-md text-gray-200 hover:bg-gray-700/30"
            >
              Details
            </button>

            <button
              onClick={onTest}
              className="px-3 py-1 text-xs bg-gradient-to-r from-[#00E68F] to-[#007F5E] rounded-md text-black font-semibold"
            >
              Run Test
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LayerCard;
