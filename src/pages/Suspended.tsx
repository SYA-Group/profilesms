import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function Suspended() {
  const navigate = useNavigate();

  // ✅ If user refreshes the page → go to login
  useEffect(() => {
    const handleRefresh = () => {
      navigate("/login", { replace: true });
    };

    window.addEventListener("beforeunload", handleRefresh);
    return () => window.removeEventListener("beforeunload", handleRefresh);
  }, [navigate]);

  return (
    <div className="h-screen flex items-center justify-center bg-red-100">
      <div className="p-10 bg-white rounded-xl shadow text-center max-w-md">
        <h1 className="text-3xl font-bold text-red-600">
          Your Account is Suspended
        </h1>

        <p className="mt-4 text-gray-700">
          Please contact the administrator for assistance.
        </p>

        {/* ✅ Login Button */}
        <button
          onClick={() => navigate("/login", { replace: true })}
          className="mt-6 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Return to Login
        </button>
      </div>
    </div>
  );
}
