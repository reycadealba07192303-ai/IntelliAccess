import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "../../components/ui/glass-components";
import {
    Video,
    Settings,
    MicOff,
    Radio,
    CheckCircle2,
    XCircle,
    Trash2,
    X
} from "lucide-react";
import toast from "react-hot-toast";
import { apiFetch, API_BASE_URL } from "@/lib/api";
const CameraPage = () => {
    const [selectedCamera, setSelectedCamera] = useState<number>(1);
    const [detectionResult, setDetectionResult] = useState<any>(null);
    const [isAutoScanning, setIsAutoScanning] = useState(true); // Default to AI auto-scan on
    const [isCapturing, setIsCapturing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'found' | 'empty'>('idle');
    const [scanCount, setScanCount] = useState(0);
    const lastScanTimeRef = useRef<number>(0);
    const lastScanStatusRef = useRef<'idle' | 'granted' | 'denied'>('idle');

    const [cameras, setCameras] = useState<any[]>([]);
    const [isAddingCamera, setIsAddingCamera] = useState(false);
    const [newCamera, setNewCamera] = useState({
        name: "",
        location: "",
        url: `${API_BASE_URL}/live-feed`,
        status: "Live"
    });

    const fetchCameras = async () => {
        try {
            const res = await apiFetch("/cameras");
            setCameras(res);
            if (res.length > 0 && !res.find((c: any) => c.id === selectedCamera)) {
                setSelectedCamera(res[0].id);
            }
        } catch (err) {
            console.error("Failed to fetch cameras:", err);
        }
    };

    useEffect(() => {
        fetchCameras();
    }, []);

    const handleAddCamera = async () => {
        if (!newCamera.name || !newCamera.location || !newCamera.url) {
            toast.error("Please fill in all fields");
            return;
        }
        try {
            await apiFetch("/cameras", {
                method: "POST",
                body: JSON.stringify(newCamera)
            });
            toast.success("Camera added successfully");
            setIsAddingCamera(false);
            setNewCamera({ name: "", location: "", url: "https://images.unsplash.com/photo-1590674899484-d5640e854abe?q=80&w=800&auto=format&fit=crop", status: "Live" });
            fetchCameras();
        } catch (error) {
            toast.error("Failed to add camera");
        }
    };

    const handleDeleteCamera = async (e: React.MouseEvent, cameraId: string) => {
        e.stopPropagation();
        if (cameras.length <= 1) {
            toast.error("Cannot delete the last camera");
            return;
        }
        try {
            await apiFetch(`/cameras/${cameraId}`, {
                method: "DELETE"
            });
            toast.success("Camera removed");
            fetchCameras();
        } catch (error) {
            toast.error("Failed to delete camera");
        }
    };

    const currentCamera = cameras.find(c => c.id === selectedCamera) || cameras[0] || {};

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const scanningRef = useRef(false);

    const SCAN_INTERVAL_MS = 1000; // Tick every 1 second to check if a capture is needed
    // MIN_CAPTURE_GAP_MS is dynamically decided in the loop now based on last result
    const ROI = {
        left: 0.2,
        top: 0.3,
        width: 0.6,
        height: 0.4,
    };

    const plateOverlay = detectionResult?.plate_box ? {
        left: `${(ROI.left + detectionResult.plate_box.x * ROI.width) * 100}%`,
        top: `${(ROI.top + detectionResult.plate_box.y * ROI.height) * 100}%`,
        width: `${detectionResult.plate_box.w * ROI.width * 100}%`,
        height: `${detectionResult.plate_box.h * ROI.height * 100}%`,
        label: `${detectionResult.plate_number || 'PLATE'} (${(detectionResult.confidence || 0).toFixed(1)}%)`,
    } : null;

    // --- Client-Side Camera & AI Scanning ---
    useEffect(() => {
        let stream: MediaStream | null = null;
        let scanInterval: NodeJS.Timeout;
        let clearTimer: NodeJS.Timeout;
        let isMounted = true;

        const startCamera = async () => {
            if (selectedCamera !== 1) {
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                setIsStreaming(false);
                return;
            }

            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        facingMode: { ideal: 'environment' } // Prefer back camera on mobile, fallback safely on laptops
                    } 
                });
                if (!isMounted) {
                    // If component unmounted while we were waiting for camera, stop tracks and exit
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setIsStreaming(true);
                }

                // Start the scanning loop
                if (isAutoScanning) {
                    // Delay scan slightly to ensure video has started playing and dimensions are loaded
                    scanInterval = setInterval(async () => {
                        if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2 || scanningRef.current) return;

                        const now = Date.now();
                        
                        // Dynamic capture gap logic
                        let requiredGap = 4000; // Default 4 seconds gap
                        if (lastScanStatusRef.current === 'denied') {
                            requiredGap = 2000; // Fast 2-second retry if denied/misread
                        } else if (lastScanStatusRef.current === 'granted') {
                            requiredGap = 5000; // 5-second pause if granted
                        }

                        if (now - lastScanTimeRef.current < requiredGap) {
                            return;
                        }

                        scanningRef.current = true;
                        setScanStatus('scanning');
                        lastScanTimeRef.current = now;

                        const canvas = canvasRef.current;
                        const video = videoRef.current;
                        
                        const vW = video.videoWidth;
                        const vH = video.videoHeight;
                        
                        const sx = Math.round(vW * ROI.left);
                        const sy = Math.round(vH * ROI.top);
                        const sWidth = Math.round(vW * ROI.width);
                        const sHeight = Math.round(vH * ROI.height);
                        
                        canvas.width = sWidth;
                        canvas.height = sHeight;
                        
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            // Draw only the target overlay crop (plate window) to the canvas
                            ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
                            
                            // Convert to blob and send to backend
                            canvas.toBlob(async (blob) => {
                                if (!blob || !isMounted) {
                                    scanningRef.current = false;
                                    return;
                                }
                                
                                const formData = new FormData();
                                formData.append('file', blob, 'frame.jpg');

                                try {
                                    const response = await fetch(`${API_BASE_URL}/detect`, {
                                        method: 'POST',
                                        body: formData
                                    });

                                    if (!response.ok) {
                                        console.error("Detection endpoint error", response.status);
                                        return;
                                    }

                                    const data = await response.json();
                                    
                                    // Only trigger UI if backend detected a REAL plate number
                                    // (data.detected can be true for vehicle body alone, without a plate read)
                                    const hasRealPlate = data.detected && 
                                        data.plate_number && 
                                        data.plate_number !== "Not Detected" && 
                                        data.plate_number !== "OCR Error" &&
                                        data.plate_number.length >= 4;

                                    if (hasRealPlate) {
                                        setScanStatus('found');
                                        setScanCount(c => c + 1);

                                        // 2. Perform the exact "Capture" blink flash
                                        setIsCapturing(true);
                                        setTimeout(() => {
                                            if (isMounted) setIsCapturing(false);
                                        }, 150);

                                        // 3. Show Results Panel
                                        setIsProcessing(false);
                                        setDetectionResult(data);
                                        
                                        lastScanStatusRef.current = data.access_granted ? 'granted' : 'denied';

                                        if (data.access_granted) {
                                            toast.success(`Granted: ${data.plate_text || data.plate_number}`);
                                        } else {
                                            toast.error(`Denied: ${data.plate_text || data.plate_number}`);
                                        }

                                        // 4. Panel stays for 5 seconds, then clears
                                        if (clearTimer) clearTimeout(clearTimer);
                                        clearTimer = setTimeout(() => {
                                            if (isMounted) setDetectionResult(null);
                                        }, 5000);
                                        
                                        // Set status so 'finally' block doesn't revert to empty
                                        setScanStatus('idle');
                                        return;
                                    }
                                } catch (err: any) {
                                    console.error("Scanning error:", err);
                                    setScanStatus('idle');
                                } finally {
                                    if (isMounted) {
                                        // If we completed a successful scan, scanStatus is likely 'idle' or 'found'. 
                                        // Only show 'empty' if we actually failed to find a plate in the current scan.
                                        if (scanStatus === 'scanning') {
                                            if (lastScanStatusRef.current !== 'granted' && lastScanStatusRef.current !== 'denied') {
                                                lastScanStatusRef.current = 'idle';
                                            }
                                            setScanStatus('empty');
                                            setTimeout(() => setScanStatus(s => s === 'empty' ? 'idle' : s), 1500);
                                        }
                                        scanningRef.current = false;
                                    }
                                }
                            }, 'image/jpeg', 0.85);
                        } else {
                            scanningRef.current = false;
                        }
                    }, SCAN_INTERVAL_MS);
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                if (isMounted) {
                    toast.error("Could not access device camera");
                }
            }
        };

        startCamera();

        return () => {
            isMounted = false;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (scanInterval) clearInterval(scanInterval);
            if (clearTimer) clearTimeout(clearTimer);
        };
    }, [selectedCamera, isAutoScanning]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Camera Surveillance</h1>
                    <p className="text-slate-400">Real-time monitoring and security feeds.</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Feed */}
                <div className="lg:col-span-2 space-y-6">
                    <GlassCard className="p-0 overflow-hidden relative group">
                        <div className="relative aspect-video bg-black">
                            {/* Hidden canvas for capturing frames */}
                            <canvas ref={canvasRef} className="hidden" />
                            
                            {/* Camera Feed Logic */}
                            {selectedCamera === 1 ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                    {/* Capture Flash Effect */}
                                    <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 ${isCapturing ? "opacity-30" : "opacity-0"}`} />
                                    
                                    {/* Scanning Target Box with Live Status */}
                                    {isAutoScanning && (
                                         <div className={`absolute top-[30%] bottom-[30%] left-[20%] right-[20%] border-2 border-dashed rounded-xl pointer-events-none flex flex-col items-center justify-center transition-colors duration-300 ${
                                            scanStatus === 'scanning' ? 'border-amber-400/60 bg-amber-500/10 shadow-[0_0_20px_rgba(251,191,36,0.2)_inset]' :
                                            scanStatus === 'found' ? 'border-emerald-500 bg-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.4)_inset] scale-[1.02]' :
                                            scanStatus === 'empty' ? 'border-red-400/60 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)_inset]' :
                                            'border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)_inset]'
                                         }`}>
                                             
                                             <div className="absolute -top-3 px-3 py-1 bg-black/80 text-white text-[10px] font-mono tracking-widest rounded-full border border-white/20 whitespace-nowrap">
                                                {scanStatus === 'scanning' ? `SCANNING FRAME #${scanCount + 1}...` :
                                                 scanStatus === 'found' ? `PLATE DETECTED ✓` :
                                                 scanStatus === 'empty' ? `NO PLATE DETECTED` :
                                                 `POSITION PLATE HERE`}
                                             </div>
                                             
                                             <span className={`font-bold tracking-widest text-xs px-4 py-1.5 rounded-full border transition-all duration-300 ${
                                                scanStatus === 'scanning' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(251,191,36,0.5)]' :
                                                scanStatus === 'found' ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-110' :
                                                scanStatus === 'empty' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                                'bg-black/60 text-emerald-400 border-emerald-500/30'
                                             }`}>
                                                {scanStatus === 'scanning' ? 'ANALYZING...' :
                                                 scanStatus === 'found' ? 'SUCCESS' :
                                                 scanStatus === 'empty' ? 'RETRYING' :
                                                 'AI READY'}
                                             </span>
                                         </div>
                                    )}

                                    {/* Live OCR boxes (from last detected plate) */}
                                    {plateOverlay && (
                                        <div className="absolute border-2 border-lime-400/80 rounded-md pointer-events-none" style={{
                                            left: plateOverlay.left,
                                            top: plateOverlay.top,
                                            width: plateOverlay.width,
                                            height: plateOverlay.height,
                                            boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.5)',
                                        }}>
                                            <div className="absolute -top-6 left-0 bg-lime-500/90 text-black text-xs px-2 py-0.5 rounded-sm">
                                                {plateOverlay.label}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="relative w-full h-full">
                                    <img
                                        src={currentCamera.url}
                                        alt={currentCamera.name}
                                        className={`w-full h-full object-cover transition-opacity duration-300 ${selectedCamera === 1 ? "opacity-30 grayscale" : "opacity-80"}`}
                                    />
                                    {selectedCamera !== 1 && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            {/* Placeholder overlay for other cameras */}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Overlays */}
                            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-md">
                                <div className="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
                                <span className="text-xs font-medium text-white">
                                    {selectedCamera === 1 ? "Local Device Camera" : cameras.find(c => c.id === selectedCamera)?.name}
                                </span>
                            </div>

                            <div className="absolute top-4 right-4 flex flex-col items-end gap-2 text-white/80">
                                <span className="text-xs font-mono">{new Date().toLocaleTimeString()}</span>
                            </div>

                            {/* Camera Actions Overlay */}
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsAutoScanning(!isAutoScanning);
                                        toast(isAutoScanning ? "Auto-Scanning Paused" : "Auto-Scanning Resumed", { icon: "🤖" });
                                    }}
                                    className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider shadow-lg transition-colors border ${isAutoScanning
                                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                                        : "bg-slate-800/80 text-slate-400 border-slate-600"
                                        }`}
                                >
                                    {isAutoScanning ? (
                                        <><div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> AI Auto-Scan Active</>
                                    ) : (
                                        "AI Auto-Scan Paused"
                                    )}
                                </button>
                            </div>
                        </div>
                    </GlassCard>

                    {/* Scanning Results Panel - More Prominent */}
                    {(detectionResult || isProcessing) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="lg:col-span-2"
                        >
                            <GlassCard className={`p-6 border-l-4 overflow-hidden relative ${
                                isProcessing ? 'border-l-blue-500 bg-blue-500/5' :
                                detectionResult?.access_granted ? 'border-l-emerald-500 bg-emerald-500/5' : 'border-l-red-500 bg-red-500/5'
                            }`}>
                                {isProcessing ? (
                                    <div className="flex flex-col items-center justify-center py-8">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                            className="h-12 w-12 border-4 border-blue-500/30 border-t-blue-400 rounded-full mb-4"
                                        />
                                        <p className="text-slate-300 font-medium">Analyzing plate...</p>
                                        <p className="text-xs text-slate-500 mt-2">Processing detection result</p>
                                    </div>
                                ) : detectionResult ? (
                                    <div className="space-y-4">
                                        {/* Top Section: Status & Plate */}
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className={`p-4 rounded-xl ${detectionResult.access_granted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {detectionResult.access_granted ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-3xl font-bold text-white tracking-widest mb-2">
                                                        {detectionResult.plate_number || "NO PLATE"}
                                                    </h3>
                                                    <p className={`text-lg font-semibold ${detectionResult.access_granted ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {detectionResult.access_status}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-2">
                                                        Confidence: <span className="text-white font-medium">{(detectionResult.confidence || 95).toFixed(1)}%</span>
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {/* Captured Image - Large */}
                                            {detectionResult.image_url && (
                                                <div className="h-32 w-40 overflow-hidden rounded-lg border-2 border-white/20 shrink-0 shadow-lg">
                                                    <img src={`${API_BASE_URL}${detectionResult.image_url}`} alt="Captured" className="h-full w-full object-cover" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Vehicle Info Section */}
                                        {detectionResult.vehicle_info && (
                                            <div className="border-t border-white/10 pt-4">
                                                <h4 className="text-sm font-semibold text-slate-300 mb-3">Vehicle Information</h4>
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <p className="text-slate-500">Owner</p>
                                                        <p className="text-white font-medium">{detectionResult.vehicle_info.owner_name || "Unknown"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-500">Role</p>
                                                        <p className="text-white font-medium">{detectionResult.vehicle_info.owner_role || "Unknown"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-500">Vehicle</p>
                                                        <p className="text-white font-medium">{detectionResult.vehicle_info.color} {detectionResult.vehicle_info.model}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-500">Type</p>
                                                        <p className="text-white font-medium">{detectionResult.vehicle_type || "Vehicle"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </GlassCard>
                        </motion.div>
                    )}

                    {/* Quick Stats or Alerts for Camera */}
                    <div className="grid grid-cols-3 gap-4">
                        <GlassCard className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                <Video className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">Active Cameras</p>
                                <p className="text-lg font-bold text-white">{cameras.filter(c => c.status === 'Live').length}/{cameras.length}</p>
                            </div>
                        </GlassCard>
                        <GlassCard className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                <Radio className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">Network Status</p>
                                <p className="text-lg font-bold text-white">Stable</p>
                            </div>
                        </GlassCard>
                        <GlassCard className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                <Settings className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">Resolution</p>
                                <p className="text-lg font-bold text-white">1080p</p>
                            </div>
                        </GlassCard>
                    </div>
                </div>

                {/* Camera List */}
                <div className="space-y-4">
                    <GlassCard className="h-full">
                        <h3 className="mb-4 text-lg font-semibold text-white">Camera Feeds</h3>
                        <div className="space-y-3">
                            {cameras.map((camera) => (
                                <div
                                    key={camera.id}
                                    onClick={() => setSelectedCamera(camera.id)}
                                    className={`cursor-pointer rounded-xl border p-3 transition-all ${selectedCamera === camera.id
                                        ? 'border-blue-500/50 bg-blue-500/10'
                                        : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative h-16 w-24 overflow-hidden rounded-lg bg-black">
                                            <img
                                                src={camera.url}
                                                alt={camera.name}
                                                className={`h-full w-full object-cover ${camera.status === 'Offline' ? 'opacity-20' : 'opacity-80'}`}
                                            />
                                            {camera.status === 'Offline' && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <MicOff className="h-4 w-4 text-slate-500" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between w-full">
                                            <div>
                                                <h4 className={`text-sm font-medium ${selectedCamera === camera.id ? 'text-white' : 'text-slate-300'}`}>
                                                    {camera.name}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`h-1.5 w-1.5 rounded-full ${camera.status === 'Live' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                    <span className="text-xs text-slate-500">{camera.location}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteCamera(e, camera._id)}
                                                className="p-1.5 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                                title="Remove Camera"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setIsAddingCamera(true)}
                            className="mt-6 w-full rounded-lg border border-dashed border-white/20 py-3 text-sm text-slate-400 hover:border-white/40 hover:text-white transition-colors"
                        >
                            + Add New Camera
                        </button>
                    </GlassCard>
                </div>
            </div>
            {/* Add Camera Modal */}
            {isAddingCamera && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-md"
                    >
                        <GlassCard className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">Add New Camera</h3>
                                <button onClick={() => setIsAddingCamera(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Camera Name</label>
                                    <input
                                        type="text"
                                        value={newCamera.name}
                                        onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })}
                                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                        placeholder="e.g. South Gate Feed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Location</label>
                                    <input
                                        type="text"
                                        value={newCamera.location}
                                        onChange={(e) => setNewCamera({ ...newCamera, location: e.target.value })}
                                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                        placeholder="e.g. Zone D"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Stream URL / Network</label>
                                    <select
                                        value={newCamera.url}
                                        onChange={(e) => setNewCamera({ ...newCamera, url: e.target.value })}
                                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500/50 appearance-none"
                                    >
                                        <option value={`${API_BASE_URL}/live-feed`} className="bg-slate-800 text-white">Built-in Camera (Live Stream)</option>
                                        <option value="https://images.unsplash.com/photo-1590674899484-d5640e854abe?q=80&w=800&auto=format&fit=crop" className="bg-slate-800 text-white">Demo Module 1 (Parking Lot)</option>
                                        <option value="https://images.unsplash.com/photo-1563630423918-b58f07336ac9?q=80&w=800&auto=format&fit=crop" className="bg-slate-800 text-white">Demo Module 2 (Main Gate)</option>
                                    </select>
                                </div>
                                <div className="pt-4 flex justify-end gap-3">
                                    <button
                                        onClick={() => setIsAddingCamera(false)}
                                        className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddCamera}
                                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                                    >
                                        Save Camera
                                    </button>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

export default CameraPage;
