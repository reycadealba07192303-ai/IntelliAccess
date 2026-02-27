import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Mail, Lock, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { GlassCard, GlassButton, GlassInput } from "@/app/components/ui/glass-components";
import { apiFetch } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

const SignInPage = () => {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");



  const onSubmit = async (data: any) => {
    setIsLoading(true);
    setLoginError("");

    try {
      // 1. Verify credentials with Firebase first
      await signInWithEmailAndPassword(auth, data.email, data.password);

      // 2. Fetch our custom JWT from the backend so the rest of the app works
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      if (res.access_token) {
        localStorage.setItem("access_token", res.access_token);
        const user = res.user;

        if (user) {
          // Redirect based on Role from our custom backend
          const role = user.role?.toUpperCase() || "STUDENT";
          if (role === "ADMIN") {
            navigate("/admin");
          } else if (role === "FACULTY") {
            navigate("/faculty");
          } else if (role === "STAFF" || role === "UTILITY") {
            navigate("/utility");
          } else {
            navigate("/student"); // Default for STUDENT
          }
        }
      }
    } catch (error: any) {
      console.error("Login Error:", error);

      // Provide user-friendly firebase error messages
      if (error.code === 'auth/invalid-credential') {
        setLoginError("Invalid email or password. Please try again.");
      } else if (error.code === 'auth/user-not-found') {
        setLoginError("No account found with this email.");
      } else if (error.code === 'auth/wrong-password') {
        setLoginError("Incorrect password.");
      } else {
        setLoginError(error.message || "Invalid login credentials.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] relative overflow-hidden px-4">
      {/* Background Abstract */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 via-slate-900 to-black z-10" />
        <img
          src="https://images.unsplash.com/photo-1759661881353-5b9cc55e1cf4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxBYnN0cmFjdCUyMEJsdWUlMjBDeWJlciUyMFNlY3VyaXR5JTIwQmFja2dyb3VuZHxlbnwxfHx8fDE3NzAxMTU5MzR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Abstract Background"
          className="h-full w-full object-cover opacity-20"
        />
      </div>

      <div className="absolute top-6 left-6 z-30">
        <Link to="/">
          <GlassButton variant="ghost" className="pl-3 pr-3">
            <ArrowLeft className="h-4 w-4" />
          </GlassButton>
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-20 w-full max-w-md"
      >
        <GlassCard className="border-t-4 border-t-blue-500">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h2>
            <p className="text-slate-400 mt-2">Sign in to manage your campus access</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <GlassInput
              icon={<Mail className="h-5 w-5" />}
              placeholder="Email Address"
              type="email"
              error={errors.email?.message as string}
              {...register("email", { required: "Email is required" })}
            />

            <GlassInput
              icon={<Lock className="h-5 w-5" />}
              placeholder="Password"
              type="password"
              error={errors.password?.message as string}
              {...register("password", { required: "Password is required" })}
            />

            {loginError && (
              <motion.div
                initial={{ x: -10 }}
                animate={{ x: [0, -10, 10, -10, 10, 0] }}
                className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20"
              >
                <AlertCircle className="h-4 w-4" />
                {loginError}
              </motion.div>
            )}

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500" />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300 hover:underline">Forgot password?</Link>
            </div>

            <GlassButton type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <>Sign In <ArrowRight className="h-4 w-4" /></>
              )}
            </GlassButton>
          </form>

          {/* Google SSO Removed as requested */}

          <p className="mt-8 text-center text-sm text-slate-400">
            Don't have an account?{" "}
            <Link to="/sign-up" className="font-medium text-blue-400 hover:text-blue-300">
              Register now
            </Link>
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default SignInPage;
