import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Cookies from "js-cookie";
import { useTheme } from "../context/ThemeContext";
import PricingCard from "../components/PricingCard";
import { getPricing, getUserInfo, sendLeadSupportMessage, sendSupportMessage } from "../api";

interface Plan {
  id: number;
  sms_amount: string;
  price: string;
  color: string;
  senderIDs: string;
  apiIntegration: string;
  support: string;
}

const Pricing = () => {
  const { darkMode } = useTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // ⭐ message popup
  const [popup, setPopup] = useState<{ planId: number; text: string } | null>(null);

  // TOKEN CHECK
  const getToken = () => {
    const t =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      Cookies.get("token");

    if (!t || t === "null" || t === "undefined") return null;
    return t;
  };

  const isLoggedIn = Boolean(getToken());

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const data = await getPricing();
        setPlans(Array.isArray(data) ? data : []);
      } catch {
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, []);

  const handleStartNow = async (data: any) => {
    try {
      if (!isLoggedIn) {
        // ✅ Anonymous → send lead
        await sendLeadSupportMessage({
          name: "Pricing Page Lead",
          phone: "N/A",
          email: "",
          message: "Pricing request from website",
          price: data.price,
          sms: data.sms,
          sender: data.senderIDs,
          api: data.apiIntegration,
          token: "N/A",
        });
  
      } else {
        // ✅ Logged-in → authenticated support
        const user = await getUserInfo();
        const username = user?.username || "Unknown User";
  
        const msg = `
  New Pricing Request:
  
  User: ${username}
  Price: ${data.price}
  SMS Credits: ${data.sms}
  Sender IDs: ${data.senderIDs}
  API Integration: ${data.apiIntegration}
        `;
  
        await sendSupportMessage({ message: msg });
      }
  
      // ✅ success popup
      setPopup({
        planId: data.id,
        text: "Request Sent ✔️",
      });
  
      setTimeout(() => setPopup(null), 3000);
  
    } catch (err) {
      setPopup({
        planId: data.id,
        text: "Failed ❌",
      });
      setTimeout(() => setPopup(null), 3000);
      console.error(err);
    }
  };
  
  return (
    <div
      className={`min-h-screen ${
        darkMode
          ? "bg-[#020617] text-gray-100"
          : "bg-gradient-to-b from-white via-slate-50 to-indigo-50 text-gray-900"
      }`}
    >

      {/* HERO */}
      <section className="pt-20 pb-24 text-center max-w-3xl mx-auto px-6">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl sm:text-6xl font-extrabold leading-tight"
        >
          Reach Your Customers  
          <span className="text-indigo-600"> Instantly</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-lg sm:text-xl text-gray-600 dark:text-gray-300"
        >
          The fastest SMS marketing platform in Egypt — send bulk SMS, filter by
          location, gender, keywords, and more.
        </motion.p>

        {!isLoggedIn && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8"
          >
            <Link
              to="/login"
              className="px-8 py-4 rounded-xl bg-indigo-600 text-white font-bold text-lg shadow-md hover:bg-indigo-500 transition"
            >
              Login to Dashboard
            </Link>
          </motion.div>
        )}
      </section>

      {/* FEATURES */}
      <section className="py-20 bg-white/50 dark:bg-slate-900/40 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 px-6">
          <FeatureBox
            title="Smart Filters"
            text="Filter by city, job, gender, birthdate, carrier, and 10 more attributes."
            icon="🔍"
          />
          <FeatureBox
            title="45M+ Verified Numbers"
            text="Egypt’s largest verified phone database, built for targeted messages."
            icon="📱"
          />
          <FeatureBox
            title="Ultra Fast Sending"
            text="Send 10,000+ SMS per minute using your own API provider."
            icon="⚡"
          />
        </div>
      </section>

      {/* ABOUT */}
      <section className="py-20 text-center max-w-4xl mx-auto px-6">
        <h2 className="text-3xl font-bold mb-4">Why Profile SMS?</h2>
        <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
          Profile SMS is designed for marketers, agencies, and businesses that
          need instant communication with millions of customers.
        </p>
      </section>

      {/* PRICING */}
      <section id="plans" className="py-20 max-w-7xl mx-auto px-6">
        <h2 className="text-center text-3xl font-bold mb-10">
          Choose Your SMS Plan
        </h2>

        {loading ? (
          <p className="text-center">Loading pricing plans...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 relative">
            {plans.map((plan, i) => (
              <div className="relative" key={plan.id}>

                {/* ⭐ Popup over card */}
                {popup?.planId === plan.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-3xl z-20"
                  >
                    <div className="bg-white text-green-700 rounded-2xl px-6 py-4 shadow-xl font-bold text-lg">
                      ✔️ {popup.text}
                    </div>
                  </motion.div>
                )}

                <PricingCard
                  price={plan.price}
                  sms={plan.sms_amount}
                  color={plan.color}
                  senderIDs={plan.senderIDs}
                  apiIntegration={plan.apiIntegration}
                  support={plan.support}
                  delay={i * 0.1}
                  featured={i === 1}
                  onStart={handleStartNow}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const FeatureBox = ({ title, text, icon }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="p-6 rounded-2xl bg-white dark:bg-slate-800 shadow-md border border-gray-200 dark:border-slate-700"
  >
    <div className="text-4xl mb-4">{icon}</div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-gray-600 dark:text-gray-300 text-sm">{text}</p>
  </motion.div>
);

export default Pricing;
