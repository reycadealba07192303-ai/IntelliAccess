import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, User, Phone, CheckCircle, ArrowLeft, AlertCircle, ChevronDown } from "lucide-react";
import { GlassCard, GlassButton, GlassInput } from "@/app/components/ui/glass-components";
import { apiFetch } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

const SignUpPage = () => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    setSignupError("");
    try {
      // 1. Create User in Firebase Auth First
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);

      // 2. Sync their profile info to MongoDBBackend via our existing API
      await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: data.email,
          password: data.password, // Send exactly the same password to sync
          name: data.fullName,
          phone: data.phone,
          role: data.role,
        }),
      });

      setIsSuccess(true);
    } catch (error: any) {
      console.error("Sign Up Error:", error);

      // Provide prettier firebase error messages
      if (error.code === 'auth/email-already-in-use') {
        setSignupError("This email is already registered. Please sign in instead.");
      } else if (error.code === 'auth/weak-password') {
        setSignupError("Password is too weak. Please use a stronger password.");
      } else {
        setSignupError(`Registration failed: ${error.message}`);
      }
      setIsLoading(false);
    }
  };

  const password = watch("password");

  if (isSuccess) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-slate-900 to-black z-0" />

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 max-w-md w-full text-center"
        >
          <GlassCard className="border-t-4 border-t-emerald-500 py-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500"
            >
              <CheckCircle className="h-10 w-10" />
            </motion.div>
            <h2 className="text-3xl font-bold text-white mb-2">Registration Complete!</h2>
            <p className="text-slate-400 mb-8">
              Your account is pending approval by the campus security admin. You will receive an SMS notification once verified.
            </p>
            <Link to="/sign-in">
              <GlassButton className="w-full">Back to Sign In</GlassButton>
            </Link>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] py-12 px-4 relative">
      {/* Background Abstract */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-bl from-blue-900/30 via-slate-900 to-black z-10" />
        <img
          src="https://images.unsplash.com/photo-1759661881353-5b9cc55e1cf4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxBYnN0cmFjdCUyMEJsdWUlMjBDeWJlciUyMFNlY3VyaXR5JTIwQmFja2dyb3VuZHxlbnwxfHx8fDE3NzAxMTU5MzR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Abstract Background"
          className="h-full w-full object-cover opacity-10"
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-20 w-full max-w-lg"
      >
        <GlassCard>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white tracking-tight">Create Account</h2>
            <p className="text-slate-400 mt-2">Join the IntelliAccess secure network</p>
          </div>

          <AnimatePresence>
            {signupError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 flex items-center gap-3 text-red-400 text-sm bg-red-500/10 p-4 rounded-xl border border-red-500/20"
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p>{signupError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassInput
                icon={<User className="h-5 w-5" />}
                placeholder="Full Name"
                error={errors.fullName?.message as string}
                {...register("fullName", { required: "Name is required" })}
              />
              <GlassInput
                icon={<Phone className="h-5 w-5" />}
                placeholder="Phone Number"
                type="tel"
                error={errors.phone?.message as string}
                {...register("phone", { required: "Phone is required" })}
              />
            </div>

            <GlassInput
              icon={<Mail className="h-5 w-5" />}
              placeholder="University Email"
              type="email"
              error={errors.email?.message as string}
              {...register("email", {
                required: "Email is required",
                pattern: { value: /.+@.+\..+/, message: "Invalid email" }
              })}
            />

            {/* Role Selection */}
            <div className="relative">
              <select
                {...register("role", { required: "Role is required" })}
                className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 pl-11 pr-10 text-sm text-white placeholder-slate-400 backdrop-blur-xl transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="STUDENT">Student</option>
                <option value="FACULTY">Faculty</option>
                <option value="STAFF">Staff</option>
              </select>
              <User className="absolute left-3 top-3.5 h-5 w-5 text-slate-400 pointer-events-none" />
              <ChevronDown className="absolute right-4 top-3.5 h-5 w-5 text-slate-400 pointer-events-none" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassInput
                icon={<Lock className="h-5 w-5" />}
                placeholder="Password"
                type="password"
                error={errors.password?.message as string}
                {...register("password", {
                  required: "Password is required",
                  minLength: { value: 8, message: "Min 8 chars" },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
                    message: "Must contain uppercase, lowercase, number, and special character"
                  }
                })}
              />
              <GlassInput
                icon={<Lock className="h-5 w-5" />}
                placeholder="Confirm Password"
                type="password"
                error={errors.confirmPassword?.message as string}
                {...register("confirmPassword", {
                  validate: (val) => val === password || "Passwords do not match"
                })}
              />
            </div>

            <div className="flex items-start gap-2 pt-2">
              <input
                type="checkbox"
                className="mt-1 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 cursor-pointer"
                {...register("terms", { required: true })}
              />
              <span className="text-xs text-slate-400">
                I agree to the{" "}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="text-blue-400 hover:underline focus:outline-none"
                >
                  Terms of Service
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={() => setShowPrivacy(true)}
                  className="text-blue-400 hover:underline focus:outline-none"
                >
                  Privacy Policy
                </button>{" "}
                regarding vehicle data collection.
              </span>
            </div>
            {errors.terms && <p className="text-xs text-red-400">You must agree to the terms</p>}

            <GlassButton type="submit" className="w-full mt-4" disabled={isLoading}>
              {isLoading ? "Creating Account..." : "Register"}
            </GlassButton>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link to="/sign-in" className="font-medium text-blue-400 hover:text-blue-300">
              Sign In
            </Link>
          </p>
        </GlassCard>
      </motion.div>

      {/* Terms of Service Modal */}
      <AnimatePresence>
        {showTerms && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0f172a] border border-slate-700/50 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="text-xl font-bold text-white">Terms of Service</h3>
                <button
                  onClick={() => setShowTerms(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <AlertCircle className="h-6 w-6 rotate-45" /> {/* Makeshift close 'X' */}
                </button>
              </div>
              <div className="p-6 overflow-y-auto text-sm text-slate-300 space-y-4 custom-scrollbar">
                <p>Welcome to the IntelliAccess university network. By registering for an account, you agree to the following legally binding terms:</p>

                <h4 className="text-white font-semibold flex items-center gap-2">
                  <span className="h-6 w-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">1</span>
                  Acceptance of Vehicle Tracking
                </h4>
                <p>You explicitly consent to IntelliAccess utilizing Artificial Intelligence (AI) and OpenCV computer vision technology to actively scan, record, and log your vehicle's license plate upon entering and exiting all campus gates.</p>

                <h4 className="text-white font-semibold flex items-center gap-2 mt-4">
                  <span className="h-6 w-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">2</span>
                  Account Security
                </h4>
                <p>You are solely responsible for maintaining the confidentiality of your account credentials. You agree that any vehicle registered under your account is your responsibility, and any unauthorized access using your plate will be attributed to your account until reported.</p>

                <h4 className="text-white font-semibold flex items-center gap-2 mt-4">
                  <span className="h-6 w-6 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs">3</span>
                  Compliance with Campus Policy
                </h4>
                <p>Accessing the campus is a privilege. Failure to comply with security personnel, speed limits, or attempting to spoof license plates will result in immediate termination of network access and potential university disciplinary action.</p>
              </div>
              <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
                <GlassButton onClick={() => setShowTerms(false)}>I Understand</GlassButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Policy Modal */}
      <AnimatePresence>
        {showPrivacy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0f172a] border border-slate-700/50 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="text-xl font-bold text-white">Privacy Policy</h3>
                <button
                  onClick={() => setShowPrivacy(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <AlertCircle className="h-6 w-6 rotate-45" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto text-sm text-slate-300 space-y-4 custom-scrollbar">
                <p>At IntelliAccess, we take your privacy and data security seriously. This policy dictates how your personal information is handled.</p>

                <h4 className="text-white font-semibold flex items-center gap-2">
                  <Lock className="h-5 w-5 text-blue-400" />
                  Data Collection
                </h4>
                <ul className="list-disc pl-5 space-y-2">
                  <li>We collect your Name, University Email, and Phone Number strictly for identity verification and SMS security notifications.</li>
                  <li>We capture and store images of your vehicle's license plate exclusively when crossing campus security checkpoints.</li>
                </ul>

                <h4 className="text-white font-semibold flex items-center gap-2 mt-4">
                  <User className="h-5 w-5 text-emerald-400" />
                  Data Usage & Sharing
                </h4>
                <p>Your movement history (entry and exit logs) is stored securely in our MongoDB database. This data is rigorously protected and is only accessible by authorized campus administration and security personnel. We will never sell your data to third-party marketers.</p>

                <h4 className="text-white font-semibold flex items-center gap-2 mt-4">
                  <Phone className="h-5 w-5 text-purple-400" />
                  SMS Notifications
                </h4>
                <p>By registering your phone number, you consent to receive automated SMS alerts via the Sema API whenever your registered vehicle interacts with our AI cameras. Standard messaging rates may apply depending on your carrier.</p>
              </div>
              <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
                <GlassButton onClick={() => setShowPrivacy(false)}>Accept Privacy Policy</GlassButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SignUpPage;
