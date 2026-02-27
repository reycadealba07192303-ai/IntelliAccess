import React from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import {
   ShieldCheck,
   ScanLine,
   BellRing,
   ArrowRight,
   Cpu,
   Users,
   Lightbulb,
   Mail,
   MapPin,
   Phone,
   CheckCircle2,
   Zap,
   Globe
} from "lucide-react";
import { GlassCard, GlassButton, GlassInput } from "../components/ui/glass-components";
import sorsuLogo from "../../assets/sorsu.png";
import danielaImg from "../../assets/daniela.jpg";
import enzoImg from "../../assets/enzo.jpg";
import jombrionesImg from "../../assets/jombriones.jpg";

const LandingPage = () => {
   const scrollToSection = (id: string) => {
      const element = document.getElementById(id);
      if (element) {
         element.scrollIntoView({ behavior: 'smooth' });
      }
   };

   return (
      <div className="min-h-screen w-full bg-[#030712] text-white overflow-x-hidden relative selection:bg-blue-500/30 pt-20">
         {/* Global Background Effects */}
         <div className="fixed inset-0 z-0 pointer-events-none">
            {/* Deep space noise texture */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-overlay"></div>
            {/* Gradient Orbs */}
            <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-emerald-600/10 blur-[120px]" />
         </div>

         {/* Navbar */}
         <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 lg:px-12 backdrop-blur-xl bg-[#030712]/70 border-b border-white/5 transition-all duration-300">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollToSection('home')}>
               <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 shadow-lg shadow-blue-500/20">
                  <ShieldCheck className="h-6 w-6 text-white" />
               </div>
               <span className="text-xl font-bold tracking-tight text-white">IntelliAccess</span>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-8">
               <button onClick={() => scrollToSection('home')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors relative group">
                  Home
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-500 transition-all group-hover:w-full"></span>
               </button>
               <button onClick={() => scrollToSection('about')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors relative group">
                  About
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-500 transition-all group-hover:w-full"></span>
               </button>
               <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors relative group">
                  Features
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-500 transition-all group-hover:w-full"></span>
               </button>
               <button onClick={() => scrollToSection('founders')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors relative group">
                  Founders
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-500 transition-all group-hover:w-full"></span>
               </button>
               <button onClick={() => scrollToSection('contact')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors relative group">
                  Contact
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-500 transition-all group-hover:w-full"></span>
               </button>
            </div>

            <div className="flex items-center gap-4">
               <Link to="/sign-up">
                  <GlassButton variant="primary" className="rounded-full px-6 hover:shadow-blue-500/25 hover:scale-105 transition-all">Get Started</GlassButton>
               </Link>
            </div>
         </nav>

         {/* Hero Section */}
         <div id="home" className="relative z-20 mx-auto flex max-w-7xl flex-col items-center justify-center px-6 py-24 text-center lg:py-32">
            <motion.div
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ duration: 0.6 }}
               className="group relative mb-8 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-950/30 px-4 py-1.5 text-sm text-blue-300 backdrop-blur-md transition-colors hover:border-blue-400/50 hover:bg-blue-900/40"
            >
               <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
               </span>
               <span className="font-medium tracking-wide">System Online at SorSU Main Campus</span>
            </motion.div>

            <motion.h1
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.8, delay: 0.2 }}
               className="max-w-5xl text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl leading-tight"
            >
               <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">Secure Campus.</span>
               <br />
               <span className="bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-500 bg-clip-text text-transparent">Intelligent Access.</span>
            </motion.h1>

            <motion.p
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.8, delay: 0.4 }}
               className="mt-8 max-w-2xl text-lg text-slate-400 sm:text-xl leading-relaxed"
            >
               Next-generation vehicle security combining UHF RFID precision with AI computer vision. Experience the future of campus safety today.
            </motion.p>


         </div>

         {/* Modern Features Grid */}
         <div id="features" className="relative z-20 mx-auto max-w-7xl px-6 pb-24">
            <div className="grid gap-6 md:grid-cols-3">
               {[
                  {
                     icon: ScanLine,
                     title: "RFID Entry",
                     desc: "Passive UHF technology for seamless, stop-free access.",
                     color: "from-blue-500 to-indigo-500"
                  },
                  {
                     icon: ShieldCheck,
                     title: "AI Verification",
                     desc: "Neural networks analyze plates in <200ms with 99.8% accuracy.",
                     color: "from-emerald-500 to-teal-500"
                  },
                  {
                     icon: Zap,
                     title: "Instant Alerts",
                     desc: "Real-time websocket connections for zero-latency monitoring.",
                     color: "from-amber-500 to-orange-500"
                  }
               ].map((feature, i) => (
                  <motion.div
                     key={i}
                     initial={{ opacity: 0, y: 40 }}
                     whileInView={{ opacity: 1, y: 0 }}
                     viewport={{ once: true }}
                     transition={{ duration: 0.5, delay: i * 0.1 }}
                  >
                     <div className="group relative h-full overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:-translate-y-1">
                        <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 transition-opacity duration-500 group-hover:opacity-5`} />
                        <div className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.color} shadow-lg shadow-black/20`}>
                           <feature.icon className="h-7 w-7 text-white" />
                        </div>
                        <h3 className="mb-3 text-2xl font-bold text-white">{feature.title}</h3>
                        <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
                     </div>
                  </motion.div>
               ))}
            </div>
         </div>

         {/* NEW: About Section */}
         <div id="about" className="relative z-20 py-24 bg-gradient-to-b from-transparent to-blue-950/20">
            <div className="mx-auto max-w-7xl px-6">
               <div className="grid gap-16 lg:grid-cols-2 items-center">
                  <motion.div
                     initial={{ opacity: 0, x: -50 }}
                     whileInView={{ opacity: 1, x: 0 }}
                     viewport={{ once: true }}
                     transition={{ duration: 0.6 }}
                     className="relative group"
                  >
                     <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-br from-blue-500 to-emerald-500 opacity-20 blur-xl transition-all duration-500 group-hover:opacity-40"></div>
                     <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl">
                        <div className="absolute inset-0 bg-blue-950/20 mix-blend-overlay z-10 transition-opacity group-hover:opacity-0"></div>
                        <img
                           src={sorsuLogo}
                           className="h-full w-full object-contain p-8 transition-transform duration-700 group-hover:scale-110 drop-shadow-[0_0_20px_rgba(255,255,255,0.15)] bg-slate-900/60"
                           alt="Sorsogon State University Logo"
                        />
                        {/* Floating Badge */}
                        <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-md">
                           <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
                              <ShieldCheck className="h-5 w-5" />
                           </div>
                           <div>
                              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</p>
                              <p className="font-bold text-white">Fully Operational</p>
                           </div>
                        </div>
                     </div>
                  </motion.div>

                  <motion.div
                     initial={{ opacity: 0, x: 50 }}
                     whileInView={{ opacity: 1, x: 0 }}
                     viewport={{ once: true }}
                     transition={{ duration: 0.6, delay: 0.2 }}
                  >
                     <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-900/20 px-4 py-1.5 text-sm text-blue-300">
                        <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                        <span className="font-semibold">About The System</span>
                     </div>
                     <h2 className="text-4xl font-bold text-white mb-6 lg:text-5xl">
                        Securing the Future of Education
                     </h2>
                     <p className="text-lg text-slate-300 mb-6 leading-relaxed">
                        IntelliAccess represents a paradigm shift in university campus security. By integrating cutting-edge <span className="text-blue-400 font-medium">UHF RFID technology</span> with advanced <span className="text-emerald-400 font-medium">computer vision</span>, we provide a frictionless yet fortress-like entry management system for Sorsogon State University.
                     </p>
                     <p className="text-lg text-slate-400 leading-relaxed mb-8">
                        Our mission is to create a safe learning environment where technology operates invisibly in the background, ensuring that only authorized personnel and vehicles gain access while maintaining a welcoming atmosphere for students and faculty.
                     </p>

                     <div className="grid grid-cols-2 gap-4">
                        {[
                           "UHF RFID Scanning",
                           "AI Plate Recognition",
                           "Automated Gate Control",
                           "Instant SMS Alerts"
                        ].map((item, i) => (
                           <div key={i} className="flex items-center gap-2 text-slate-300">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                              {item}
                           </div>
                        ))}
                     </div>
                  </motion.div>
               </div>
            </div>
         </div>

         {/* 1. Workflow / How It Works - "Circuit Board" Design */}
         <div className="relative z-20 border-t border-white/5 bg-black/40 py-32">
            <div className="mx-auto max-w-7xl px-6">
               <div className="mb-20 text-center">
                  <span className="text-emerald-400 font-mono text-sm tracking-widest uppercase">System Architecture</span>
                  <h2 className="mt-4 text-4xl font-bold text-white md:text-5xl lg:text-6xl">
                     How IntelliAccess Works
                  </h2>
               </div>

               <div className="relative grid gap-16 lg:grid-cols-4">
                  {/* Connector Line (Desktop) */}
                  <div className="hidden lg:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0"></div>

                  {[
                     { step: "01", title: "Registration", desc: "Digital onboarding of vehicles.", icon: Users },
                     { step: "02", title: "Detection", desc: "UHF Sensors capture tag ID.", icon: ScanLine },
                     { step: "03", title: "AI Analysis", desc: "Vision matches plate to DB.", icon: Cpu },
                     { step: "04", title: "Grant Access", desc: "Gate opens automatically.", icon: CheckCircle2 },
                  ].map((item, i) => (
                     <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.2 }}
                        className="relative z-10 flex flex-col items-center text-center"
                     >
                        <div className="relative mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-slate-950 shadow-2xl shadow-blue-900/20">
                           <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl opacity-0 transition-opacity duration-500 hover:opacity-100" />
                           <item.icon className="h-10 w-10 text-blue-400" />
                           <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white shadow-lg">
                              {item.step}
                           </div>
                        </div>
                        <h3 className="mb-2 text-xl font-bold text-white">{item.title}</h3>
                        <p className="text-sm text-slate-400">{item.desc}</p>
                     </motion.div>
                  ))}
               </div>
            </div>
         </div>

         {/* 2. Facts - Large Stats */}
         <div className="relative z-20 overflow-hidden py-24">
            <div className="absolute inset-0 bg-blue-950/20 skew-y-3 transform origin-top-left" />
            <div className="relative z-10 mx-auto max-w-7xl px-6">
               <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                     { label: "Design System", value: "Glass + Neo", icon: Lightbulb },
                     { label: "Latency", value: "< 200ms", icon: Zap },
                     { label: "Security", value: "AES-256", icon: ShieldCheck },
                     { label: "Campus", value: "SorSU Main", icon: Globe },
                  ].map((stat, i) => (
                     <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className="group rounded-2xl border border-white/5 bg-white/5 p-8 backdrop-blur-sm transition-colors hover:bg-white/10"
                     >
                        <stat.icon className="mb-4 h-8 w-8 text-emerald-400 opacity-50 transition-opacity group-hover:opacity-100" />
                        <p className="text-3xl font-black text-white">{stat.value}</p>
                        <p className="mt-1 text-sm font-medium uppercase tracking-wider text-slate-500">{stat.label}</p>
                     </motion.div>
                  ))}
               </div>
            </div>
         </div>

         {/* 3. Founders - "Holographic Cards" */}
         <div id="founders" className="relative z-20 py-32">
            <div className="mx-auto max-w-7xl px-6">
               <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  className="mb-16 text-center"
               >
                  <h2 className="text-4xl font-bold text-white">The Visionaries</h2>
                  <p className="mt-4 text-slate-400">Engineering the future of Sorsogon State University security.</p>
               </motion.div>

               <div className="grid gap-8 md:grid-cols-3">
                  {[
                     {
                        name: "Ms. Daniela Fajardo",
                        role: "Project Lead",
                        img: danielaImg
                     },
                     {
                        name: "Louize Enzo Celestra",
                        role: "CEO",
                        img: enzoImg
                     },
                     {
                        name: "Jomarie Briones",
                        role: "Hardware Specialist",
                        img: jombrionesImg
                     }
                  ].map((founder, i) => (
                     <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.2 }}
                        className="group relative h-[400px] overflow-hidden rounded-3xl bg-slate-800"
                     >
                        <img
                           src={founder.img}
                           alt={founder.name}
                           className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:opacity-60"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80" />

                        <div className="absolute bottom-0 left-0 w-full p-8 translate-y-4 transition-transform duration-300 group-hover:translate-y-0">
                           <div className="mb-2 h-1 w-12 rounded-full bg-emerald-500" />
                           <h3 className="text-2xl font-bold text-white">{founder.name}</h3>
                           <p className="text-emerald-400 font-medium">{founder.role}</p>
                        </div>
                     </motion.div>
                  ))}
               </div>
            </div>
         </div>

         {/* 4. Contact - Split Screen Modern */}
         <div id="contact" className="relative z-20 border-t border-white/5 bg-[#020617] pb-12 pt-24">
            <div className="mx-auto max-w-7xl px-6">
               <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-xl">
                  <div className="grid lg:grid-cols-2">
                     <div className="p-12 lg:p-16">
                        <h2 className="text-3xl font-bold text-white">Get in Touch</h2>
                        <p className="mt-4 mb-12 text-slate-400">
                           Report issues or request access. Our support team is available 24/7 for urgent security matters.
                        </p>

                        <div className="space-y-8">
                           <div className="flex items-start gap-5">
                              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                                 <Mail className="h-6 w-6" />
                              </div>
                              <div>
                                 <h4 className="text-lg font-semibold text-white">Email Us</h4>
                                 <p className="text-slate-500">intelliaccessssu@gmail.com</p>
                              </div>
                           </div>

                           <div className="flex items-start gap-5">
                              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                                 <MapPin className="h-6 w-6" />
                              </div>
                              <div>
                                 <h4 className="text-lg font-semibold text-white">Main Office</h4>
                                 <p className="text-slate-500">College of Engineering and Architecture</p>
                                 <p className="text-slate-500">Sorsogon State University</p>
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="relative bg-white/5 p-4 lg:p-8 rounded-r-3xl h-full min-h-[400px]">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent pointer-events-none" />
                        <iframe
                           src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.9289677521874!2d124.00480407507649!3d12.976394987339386!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a0ef107b03064f%3A0x9a375cfbd21282c!2sSorsogon%20State%20University!5e0!3m2!1sen!2sph!4v1772172949237!5m2!1sen!2sph"
                           width="100%"
                           height="100%"
                           style={{ border: 0, borderRadius: '1rem', position: 'relative', zIndex: 10 }}
                           allowFullScreen={false}
                           loading="lazy"
                           referrerPolicy="no-referrer-when-downgrade"
                        ></iframe>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Footer */}
         <footer className="relative z-20 border-t border-white/10 bg-black py-12 text-center">
            <div className="mx-auto max-w-7xl px-6">
               <div className="mb-8 flex justify-center gap-6 text-slate-400">
                  <ShieldCheck className="h-6 w-6 hover:text-white cursor-pointer transition-colors" />
                  <Globe className="h-6 w-6 hover:text-white cursor-pointer transition-colors" />
                  <Mail className="h-6 w-6 hover:text-white cursor-pointer transition-colors" />
               </div>
               <p className="text-sm text-slate-600">
                  © 2026 IntelliAccess System. Sorsogon State University. <br />
                  Designed for the future of campus security.
               </p>
            </div>
         </footer>
      </div>
   );
};

export default LandingPage;
