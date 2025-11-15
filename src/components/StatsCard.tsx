import { motion } from "framer-motion";
import { Users, Send, AlertTriangle, Clock } from "lucide-react";

const icons = {
  users: Users,
  send: Send,
  "alert-triangle": AlertTriangle,
  clock: Clock,
};

interface StatsCardProps {
  title: string;
  value: number;
  color?: string;
  icon?: keyof typeof icons;
  onClick?: () => void; // ✅ optional onClick
}

const StatsCard = ({
  title,
  value,
  color = "bg-blue-300",
  icon,
  onClick,
}: StatsCardProps) => {
  const IconComponent = icon ? icons[icon] : null;

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className={`p-3 rounded-2xl shadow-md text-white flex flex-col justify-between ${
        onClick ? "cursor-pointer" : ""
      } ${color}`}
      onClick={onClick} // ✅ attach onClick if provided
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {IconComponent && <IconComponent className="w-6 h-6 opacity-80" />}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </motion.div>
  );
};

export default StatsCard;
