import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
export default function Register() {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    username: "",
    phone_number: "",
    password: "",
    password2: "",
  });

  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      await register(form);
      navigate("/"); // redirect to home after successful registration
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Registration failed. Check your inputs."
      );
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-blue-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-lg w-96"
      >
        <h2 className="text-2xl font-bold text-purple-600 mb-6 text-center">
          Create Account
        </h2>

        {error && (
          <div className="mb-4 text-red-500 text-sm">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Username"
          className="w-full mb-3 p-2 border rounded-xl"
          onChange={(e) =>
            setForm({ ...form, username: e.target.value })
          }
        />

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 p-2 border rounded-xl"
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
        />

        <input
          type="text"
          placeholder="Phone Number"
          className="w-full mb-3 p-2 border rounded-xl"
          onChange={(e) =>
            setForm({ ...form, phone_number: e.target.value })
          }
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-3 p-2 border rounded-xl"
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
        />

        <input
          type="password"
          placeholder="Confirm Password"
          className="w-full mb-6 p-2 border rounded-xl"
          onChange={(e) =>
            setForm({ ...form, password2: e.target.value })
          }
        />

        <button className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white p-2 rounded-xl hover:opacity-90">
          Register
        </button>

        <p className="text-sm mt-4 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-purple-600 font-medium">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
