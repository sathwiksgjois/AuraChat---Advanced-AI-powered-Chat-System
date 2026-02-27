import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(form);
      navigate("/");
    } catch (err) {
      alert("Invalid credentials");
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-blue-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-lg w-96"
      >
        <h2 className="text-2xl font-bold text-purple-600 mb-6 text-center">
          AuraChat Login
        </h2>

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-4 p-2 border rounded-xl"
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-6 p-2 border rounded-xl"
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <button className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white p-2 rounded-xl hover:opacity-90">
          Login
        </button>

        <p className="mt-4 text-sm text-center">
          Don't have an account?{" "}
          <button className="text-purple-500 hover:underline" onClick={() => navigate("/register")}> 
            Register here 
          </button>
        </p>
      </form>
    </div>
  );
}
