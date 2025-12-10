import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api";

const Register = () => {
  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    sms_api_url: "",
    sms_api_token: "",
    sms_sender_id: "",
    sms_quota: 100000,
    company_type: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" }); // clear individual field error
  };

  // ✅ Inline validation function
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!form.username.trim()) newErrors.username = "Username is required.";
    if (!form.password.trim()) newErrors.password = "Password is required.";
    else if (form.password.length < 6)
      newErrors.password = "Password must be at least 6 characters.";
    if (!form.email.trim()) newErrors.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = "Enter a valid email address.";
    if (!form.company_type)
      newErrors.company_type = "Please select a company type.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await api.post("/auth/register", form);
      setToast({
        type: "success",
        message: res.data.message || "User created successfully!",
      });
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
      setForm({
        username: "",
        password: "",
        email: "",
        sms_api_url: "",
        sms_api_token: "",
        sms_sender_id: "",
        sms_quota: 1000000,
        company_type: "",
      });
      setErrors({});
    } catch (err) {
      setToast({
        type: "error",
        message: "Failed to create user. Please try again.",
      });
      console.error(err);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 3500);
    }
  };

  return (
    <motion.div
      className="relative p-8 max-w-xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-2xl mt-10 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* 🔔 Toast for success/error */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.4 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 w-fit max-w-[90%] px-6 py-3 rounded-lg text-center text-white shadow-xl backdrop-blur-sm ${
              toast.type === "success" ? "bg-green-600/90" : "bg-red-600/90"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎊 Confetti Animation */}
      <AnimatePresence>
        {showConfetti &&
          [...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                top: "50%",
                left: "50%",
                width: "8px",
                height: "8px",
                backgroundColor: `hsl(${Math.random() * 360}, 80%, 60%)`,
              }}
              initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              animate={{
                opacity: 0,
                x: (Math.random() - 0.5) * 300,
                y: (Math.random() - 0.5) * 300,
                scale: 0.6,
                rotate: Math.random() * 360,
              }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            />
          ))}
      </AnimatePresence>

      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white text-center">
        Add New User
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username, Password, Email, etc. */}
        {[
          "username",
          "password",
          "email",
          "sms_api_url",
          "sms_api_token",
          "sms_sender_id",
        ].map((field) => (
          <div key={field}>
            <motion.input
              whileFocus={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 200 }}
              type={field === "password" ? "password" : "text"}
              name={field}
              placeholder={field.replace(/_/g, " ")}
              value={(form as any)[field]}
              onChange={handleChange}
              className={`w-full p-3 border ${
                errors[field]
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-700"
              } rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none`}
            />
            {errors[field] && (
              <p className="text-red-500 text-sm mt-1">{errors[field]}</p>
            )}
          </div>
        ))}

        {/* Company Type Dropdown */}
        <div>
          <label className="block text-gray-700 dark:text-gray-300 font-medium">
            Company Type
          </label>
          <select
            name="company_type"
            value={form.company_type}
            onChange={handleChange}
            className={`w-full p-3 border ${
              errors.company_type
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-700"
            } rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none`}
          >
            <option value="">Select company type</option>
            <option value="automobile">Automobile</option>
            <option value="technology">Technology</option>
            <option value="finance">Finance</option>
            <option value="manufacturing">Manufacturing</option>
            <option value="education">Education</option>
            <option value="retail">Retail</option>
            <option value="healthcare">Healthcare</option>
            <option value="other">Other</option>
          </select>
          {errors.company_type && (
            <p className="text-red-500 text-sm mt-1">{errors.company_type}</p>
          )}
        </div>

        {/* SMS Quota */}
        <div>
  <label className="block text-gray-700 dark:text-gray-300 font-medium">
    SMS Quota
  </label>

  <input
    type="number"
    name="sms_quota"
    placeholder="Enter SMS quota (e.g., 100000)"
    value={form.sms_quota}
    onChange={(e) =>
      setForm({ ...form, sms_quota: Number(e.target.value) })
    }
    className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
  />
</div>


        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={loading}
          type="submit"
          className={`w-full py-2 rounded-md text-white transition-all ${
            loading
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Creating..." : "Create User"}
        </motion.button>
      </form>
    </motion.div>
  );
};

export default Register;
