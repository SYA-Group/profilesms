import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import { CheckCircle, CreditCard } from "lucide-react";

const plans = [
  {
    name: "Basic",
    price: "Free",
    description: "Great for testing and small campaigns.",
    features: [
      "Send up to 100 SMS per day",
      "Basic analytics",
      "Community support",
    ],
    color: "from-blue-500 to-indigo-600",
  },
  {
    name: "Pro",
    price: "$19 / month",
    description: "Perfect for growing businesses.",
    features: [
      "Up to 10,000 SMS per month",
      "Priority support",
      "Advanced dashboard insights",
    ],
    color: "from-green-500 to-emerald-600",
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For agencies and large-scale operations.",
    features: [
      "Unlimited SMS credits",
      "Dedicated account manager",
      "Custom integrations",
    ],
    color: "from-purple-500 to-pink-600",
  },
];

const Pricing = () => {
  const { darkMode } = useTheme();

  return (
    <div
      className={`min-h-screen px-6 sm:px-10 py-12 transition-all duration-300 ${
        darkMode ? "bg-[#0f172a] text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      <motion.h1
        className="text-4xl font-bold mb-8 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Choose Your Plan
      </motion.h1>

      <motion.p
        className={`text-center mb-12 text-lg ${
          darkMode ? "text-gray-400" : "text-gray-600"
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Select the best plan that fits your messaging needs.
      </motion.p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {plans.map((plan, idx) => (
          <motion.div
            key={idx}
            className={`rounded-2xl shadow-xl border overflow-hidden hover:scale-[1.03] transition-all duration-300 bg-gradient-to-br ${plan.color}`}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * idx }}
          >
            <div
              className={`p-6 h-full flex flex-col justify-between ${
                darkMode
                  ? "bg-slate-900/60 text-gray-100"
                  : "bg-white text-gray-800"
              }`}
            >
              <div>
                <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                <p className="text-3xl font-semibold mb-4">{plan.price}</p>
                <p
                  className={`text-sm mb-6 ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {plan.description}
                </p>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle className="text-green-500" size={18} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg font-semibold text-white shadow-md bg-gradient-to-r ${plan.color}`}
              >
                <CreditCard size={18} />
                Choose Plan
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Pricing;
