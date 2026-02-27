import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Mail, ArrowLeft, Send } from "lucide-react";
import { GlassCard, GlassButton, GlassInput } from "@/app/components/ui/glass-components";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";

const ForgotPasswordPage = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        try {
            await sendPasswordResetEmail(auth, data.email);
            setIsSent(true);
        } catch (error: any) {
            console.error(error);
            // We can optionally show an alert here or simple alert fallback
            alert(error.message || "Failed to send reset email");
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
                <Link to="/sign-in">
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
                        <h2 className="text-3xl font-bold text-white tracking-tight">Forgot Password</h2>
                        <p className="text-slate-400 mt-2">Enter your email to receive reset instructions</p>
                    </div>

                    {!isSent ? (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <GlassInput
                                icon={<Mail className="h-5 w-5" />}
                                placeholder="Email Address"
                                type="email"
                                error={errors.email?.message as string}
                                {...register("email", {
                                    required: "Email is required",
                                    pattern: {
                                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                        message: "Invalid email address"
                                    }
                                })}
                            />

                            <GlassButton type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Sending...
                                    </span>
                                ) : (
                                    <>Send Reset Link <Send className="h-4 w-4" /></>
                                )}
                            </GlassButton>
                        </form>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center space-y-4"
                        >
                            <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 mb-4 border border-blue-500/20">
                                <Mail className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-semibold text-white">Check your email</h3>
                            <p className="text-slate-400 text-sm">
                                We've sent password reset instructions to your email address.
                            </p>
                            <div className="pt-4">
                                <Link to="/sign-in">
                                    <GlassButton variant="ghost" className="w-full">
                                        Back to Sign In
                                    </GlassButton>
                                </Link>
                            </div>
                        </motion.div>
                    )}

                    <p className="mt-8 text-center text-sm text-slate-400">
                        Remember your password?{" "}
                        <Link to="/sign-in" className="font-medium text-blue-400 hover:text-blue-300">
                            Sign in
                        </Link>
                    </p>
                </GlassCard>
            </motion.div>
        </div>
    );
};

export default ForgotPasswordPage;
