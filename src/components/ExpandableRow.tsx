import { motion } from "framer-motion";
import { useState } from "react";
import "modern-normalize/modern-normalize.css";

interface MessageRowProps {
  msg: {
    phone: string;
    status: string;
    created_at: string;
  };
  index: number;
}

const ExpandableRow: React.FC<MessageRowProps> = ({ msg, index }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <motion.tr
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
      >
        <td className="px-4 sm:px-6 py-3 sm:py-4 font-medium text-base sm:text-lg">
          {msg.phone}
        </td>
        <td className="px-4 sm:px-6 py-3 sm:py-4">
          <span
            className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${
              msg.status === "sent"
                ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200"
                : msg.status === "failed"
                ? "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200"
            }`}
          >
            {msg.status}
          </span>
        </td>
        <td className="px-4 sm:px-6 py-3 sm:py-4 text-gray-600 dark:text-gray-400 text-base sm:text-lg whitespace-nowrap">
        {msg.created_at || "-"}
        </td>
      </motion.tr>


    </>
  );
};

export default ExpandableRow;
