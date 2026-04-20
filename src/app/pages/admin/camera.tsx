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
    X,
    Tag,
    Camera,
    Cpu,
    Activity,
    Loader2
} from "lucide-react";
import toast from "react-hot-toast";
import { apiFetch, API_BASE_URL, getSecureUrl } from "@/lib/api";
import { NgrokImage } from "../../components/figma/NgrokImage";
const CameraPage = () => {
    const [selectedCamera, setSelectedCamera] = useState<number>(1);
    const [detectionResult, setDetectionResult] = useState<any>(null);
    const [isAutoScanning, setIsAutoScanning] = useState(true); 
    const [isCapturing, setIsCapturing] = useState(false);
    const [brainImageBaseUrl, setBrainImageBaseUrl] = useState(API_BASE_URL);
    
    const toggleAutoScan = () => setIsAutoScanning(!isAutoScanning);
    const [isBrainMode, setIsBrainMode] = useState(true);
    const [brainStatus, setBrainStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
    const [lastBrainResult, setLastBrainResult] = useState<any>(null);

    const brainScanningRef = useRef(false);
    const BRAIN_URL = import.meta.env.VITE_BRAIN_URL || "http://localhost:8001";
    const [isProcessing, setIsProcessing] = useState(false);
    const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'found' | 'empty'>('idle');
    const [scanCount, setScanCount] = useState(0);
    const lastScanTimeRef = useRef<number>(0);
    const [lastScanStatusRef] = useState<'idle' | 'granted' | 'denied'>('idle');

    // Diagnostic State
    const [isDiagOpen, setIsDiagOpen] = useState(false);
    const [diagResults, setDiagResults] = useState<any>({
        api: 'pending',
        snapshot: 'pending',
        mixedContent: 'pending',
        ngrok: 'pending'
    });

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

    const imgRef = useRef<HTMLImageElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const lastScanIdRef = useRef<string | null>(null);
    const lastRfidScanIdRef = useRef<string | null>(null);
    const [rfidStatus, setRfidStatus] = useState<{connected: boolean, polling: boolean}>({connected: false, polling: false});
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamSrc, setStreamSrc] = useState<string | null>(null);
    const streamSrcRef = useRef<string | null>(null);
    const scanningRef = useRef(false);

    const SCAN_INTERVAL_MS = 1000;
    // MIN_CAPTURE_GAP_MS is dynamically decided in the loop now based on last result
    const ROI = {
        left: 0.2,
        top: 0.3,
        width: 0.6,
        height: 0.4,
    };

    const plateOverlay = detectionResult?.plate_box ? {
        left: selectedCamera === 1 
            ? `${(ROI.left + detectionResult.plate_box.x * ROI.width) * 100}%`
            : `${detectionResult.plate_box.x * 100}%`,
        top: selectedCamera === 1
            ? `${(ROI.top + detectionResult.plate_box.y * ROI.height) * 100}%`
            : `${detectionResult.plate_box.y * 100}%`,
        width: selectedCamera === 1
            ? `${detectionResult.plate_box.w * ROI.width * 100}%`
            : `${detectionResult.plate_box.w * 100}%`,
        height: selectedCamera === 1
            ? `${detectionResult.plate_box.h * ROI.height * 100}%`
            : `${detectionResult.plate_box.h * 100}%`,
        label: `${detectionResult.plate_number || 'PLATE'} (${(detectionResult.confidence || 0).toFixed(1)}%)`,
    } : null;

    const runDiagnostics = async () => {
        setIsDiagOpen(true);
        setDiagResults({ api: 'scanning', snapshot: 'scanning', mixedContent: 'pending', ngrok: 'pending' });

        const results = { api: 'error', snapshot: 'error', mixedContent: 'safe', ngrok: 'unknown' };

        // 1. Check Mixed Content
        if (window.location.protocol === 'https:' && API_BASE_URL.startsWith('http:')) {
            results.mixedContent = 'blocked';
        }

        // 2. Check API Reachability
        try {
            const start = Date.now();
            await apiFetch('/cameras/available');
            results.api = `success (${Date.now() - start}ms)`;
        } catch (e) {
            results.api = 'failed';
        }

        // 3. Check Snapshot Utility
        try {
            const res = await fetch(`${getSecureUrl(API_BASE_URL)}/snapshot`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (res.ok) results.snapshot = 'success';
            else results.snapshot = 'failed (Status: ' + res.status + ')';
        } catch (e) {
            results.snapshot = 'failed (Network Error)';
        }

        // 4. Check Ngrok
        if (API_BASE_URL.includes('ngrok-free.dev')) results.ngrok = 'active';

        setDiagResults(results);
    };

    // --- Backend-Driven Camera & AI Polling ---
    useEffect(() => {
        let scanInterval: NodeJS.Timeout;
        let clearTimer: NodeJS.Timeout;
        let streamInterval: NodeJS.Timeout;
        let isMounted = true;

        if (selectedCamera === 1) {
            setIsStreaming(true);

            // Fetch snapshots via fetch() so we can pass the ngrok-skip-browser-warning header
            streamInterval = setInterval(async () => {
                if (!isMounted) return;
                try {
                    // Use the specific camera's URL if selectedCamera > 1, otherwise use default API snapshot
                    const targetUrl = selectedCamera === 1 
                        ? `${API_BASE_URL}/snapshot` 
                        : (currentCamera.url || `${API_BASE_URL}/snapshot`);
                    
                    const secureTarget = getSecureUrl(targetUrl);

                    const token = localStorage.getItem('access_token');
                    const res = await fetch(secureTarget, {
                        headers: { 
                            'ngrok-skip-browser-warning': 'true',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        cache: 'no-store'
                    });
                    if (res.ok) {
                        const blob = await res.blob();
                        // console.log("[DEBUG] Snapshot Blob Size:", blob.size);
                        if (blob.size > 100) { // >100 bytes means actual JPEG data, not empty
                            const newUrl = URL.createObjectURL(blob);
                            setStreamSrc(newUrl);
                            if (streamSrcRef.current) URL.revokeObjectURL(streamSrcRef.current);
                            streamSrcRef.current = newUrl;
                        }
                    }
                } catch (err) {
                    // silently retry
                }
            }, 1000); // Relaxed for online use to prevent network choking

            if (isAutoScanning) {
                // Poll the backend's /latest-scan endpoint every second
                scanInterval = setInterval(async () => {
                    if (scanningRef.current) return;
                    scanningRef.current = true;
                    setScanStatus('scanning');

                    try {
                        const response = await fetch(`${API_BASE_URL}/latest-scan`, {
                            headers: { 'ngrok-skip-browser-warning': 'true' }
                        });
                        if (!response.ok) return;

                        const data = await response.json();
                        
                        if (data.detected) {
                            setScanStatus('found');
                            setDetectionResult(data);
                            
                            if (data.id !== lastScanIdRef.current && !data.id.startsWith('live_')) {
                                lastScanIdRef.current = data.id;
                                
                                setScanCount(c => c + 1);
                                setIsCapturing(true);
                                setTimeout(() => { if (isMounted) setIsCapturing(false); }, 150);
                                
                                if (data.access_granted) {
                                    toast.success(`Granted: ${data.plate_number}`);
                                } else {
                                    toast.error(`Denied: ${data.plate_number}`);
                                }

                                if (clearTimer) clearTimeout(clearTimer);
                                clearTimer = setTimeout(() => {
                                    if (isMounted) {
                                        // Prevent history from disappearing
                                        // setDetectionResult(null);
                                        setScanStatus('idle');
                                    }
                                }, 5000);
                            }
                        } else {
                            setScanStatus('idle');
                            // Only clear result if it's not a fresh log being displayed
                            if (!lastScanIdRef.current || lastScanIdRef.current.startsWith('live_')) {
                                // setDetectionResult(null);
                            }
                        }
                    } catch (err) {
                        console.error("Polling error:", err);
                        setScanStatus('idle');
                    } finally {
                        if (isMounted) {
                            scanningRef.current = false;
                        }
                    }
                }, SCAN_INTERVAL_MS);
            }
        } else {
            setIsStreaming(false);
            setStreamSrc(null);
        }

        return () => {
            isMounted = false;
            if (scanInterval) clearInterval(scanInterval);
            if (streamInterval) clearInterval(streamInterval);
            if (clearTimer) clearTimeout(clearTimer);
        };
    }, [selectedCamera, isAutoScanning]);

    // --- Local Webcam Polling (Laptop) ---
    useEffect(() => {
        let captureInterval: NodeJS.Timeout;
        let isMounted = true;
        
        let activeStream: MediaStream | null = null;
        
        const setupWebcam = async () => {
            if (currentCamera.url !== "local_webcam") return;
            
            // First time getting permissions and listing devices
            try {
                if (videoDevices.length === 0) {
                    await navigator.mediaDevices.getUserMedia({ video: true }); // Request initial permission
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const vDevices = devices.filter(d => d.kind === 'videoinput');
                    if (isMounted) {
                        setVideoDevices(vDevices);
                        if (!selectedDeviceId && vDevices.length > 0) {
                            setSelectedDeviceId(vDevices[0].deviceId);
                        }
                    }
                }

                // Wait until we have a device ID selected
                const targetDeviceId = selectedDeviceId || (videoDevices[0]?.deviceId);
                
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : true
                });
                
                activeStream = stream; // Keep track for cleanup
                
                if (!isMounted) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                setLocalStream(stream);
            } catch (err) {
                if (isMounted) {
                    console.error("Camera access error:", err);
                    toast.error("Failed to access laptop webcam. Defaulting fallback...");
                }
            }
        };

        setupWebcam();

        if (currentCamera.url === "local_webcam" && isAutoScanning && !isBrainMode) {
            captureInterval = setInterval(async () => {
                if (scanningRef.current || !videoRef.current || !canvasRef.current) return;
                
                const video = videoRef.current;
                const canvas = canvasRef.current;
                
                // Maintain aspect ratio while resizing to prevent OCR distortion
                const videoWidth = video.videoWidth;
                const videoHeight = video.videoHeight;
                const targetWidth = 640;
                const targetHeight = (videoHeight / videoWidth) * targetWidth;
                
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                
                ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
                
                scanningRef.current = true;
                setScanStatus('scanning');
                
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        scanningRef.current = false;
                        return;
                    }
                    
                    const formData = new FormData();
                    formData.append("file", blob, "webcam.jpg");
                    
                    try {
                        const res = await apiFetch("/detect", {
                            method: "POST",
                            body: formData
                        });
                        
                        if (isMounted && res.detected) {
                            setScanStatus('found');
                            setDetectionResult(res);
                            
                            // Prevent duplicate toast if it's the same plate within 5 secs
                            const resultId = res.plate_number + (res.timestamp || Date.now());
                            if (resultId !== lastScanIdRef.current) {
                                lastScanIdRef.current = resultId;
                                setScanCount(c => c+1);
                                setIsCapturing(true);
                                setTimeout(() => { if (isMounted) setIsCapturing(false); }, 150);
                                
                                if (res.access_granted) {
                                    toast.success(`Granted (Webcam): ${res.plate_number}`);
                                } else {
                                    toast.error(`Denied (Webcam): ${res.plate_number}`);
                                }
                                
                                setTimeout(() => {
                                    if (isMounted) {
                                        // Prevent history from disappearing
                                        // setDetectionResult(null);
                                        setScanStatus('idle');
                                    }
                                }, 5000);
                            }
                        } else if (isMounted) {
                            // If no plate, gracefully clear out old plate if it expired
                            setScanStatus('idle');
                            // setDetectionResult(null);
                        }
                    } catch (err: any) {
                        console.error("Local webcam detect error:", err);
                        if (isMounted) {
                            setScanStatus('idle');
                            // Specifically alert if it's a connection error
                            if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
                                toast.error("Cannot reach Raspberry Pi. Check Ngrok URL!", { id: 'api-error' });
                            }
                        }
                    } finally {
                        if (isMounted) scanningRef.current = false;
                    }
                }, "image/jpeg", 0.6);
            }, 1500); // Capture and post a frame every 1.5 seconds
        }

        return () => {
            isMounted = false;
            if (captureInterval) clearInterval(captureInterval);
            if (activeStream) {
                activeStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [currentCamera.url, isAutoScanning, selectedDeviceId]); // Re-attach when device changes

    // Attach stream to video tag whenever either changes
    useEffect(() => {
        if (currentCamera.url === "local_webcam" && videoRef.current && localStream) {
            videoRef.current.srcObject = localStream;
            videoRef.current.play().catch(e => console.error("Play error:", e));
        }
    }, [currentCamera.url, localStream]);

    // --- RFID Hardware Polling ---
    useEffect(() => {
        let statusInterval: NodeJS.Timeout;
        let isMounted = true;

        const checkRfid = async () => {
            try {
                // 1. Check Reader Connection Status
                const statusRes = await fetch(`${API_BASE_URL}/rfid/status`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    if (isMounted) setRfidStatus(statusData);
                }

                // 2. Check for Latest Scan
                const scanRes = await fetch(`${API_BASE_URL}/rfid/latest-scan`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                if (scanRes.ok) {
                    const scanData = await scanRes.json();
                    
                    if (scanData.detected && scanData.id !== lastRfidScanIdRef.current) {
                        lastRfidScanIdRef.current = scanData.id;
                        
                        // Signal "found" status briefly on main UI
                        setScanStatus('found');
                        setScanCount(c => c + 1);
                        setIsCapturing(true);
                        setTimeout(() => { if (isMounted) setIsCapturing(false); }, 150);

                        // Show Results
                        setIsProcessing(false);
                        setDetectionResult(scanData);

                        if (scanData.access_granted) {
                            toast.success(`RFID Tag Verified: ${scanData.plate_number || scanData.rfid_tag}`);
                        } else {
                            toast.error(`RFID Tag Denied: ${scanData.plate_number || scanData.rfid_tag}`);
                        }

                        // Reset UI after 5 seconds
                        setTimeout(() => {
                            if (isMounted) {
                                // Prevent history from disappearing
                                // setDetectionResult(null);
                                setScanStatus('idle');
                            }
                        }, 5000);
                    }
                }
            } catch (err) {
                console.error("RFID poll error:", err);
            }
        };

        statusInterval = setInterval(checkRfid, 2000);
        checkRfid(); // Immediate check

        return () => {
            isMounted = false;
            clearInterval(statusInterval);
        };
    }, []);

    // --- Web-Brain Orchestrator (Pi Feed -> Laptop Brain -> Pi Hardware) ---
    useEffect(() => {
        let brainInterval: any;

        if (isAutoScanning && isBrainMode) {
            brainInterval = setInterval(async () => {
                const source = imgRef.current || videoRef.current;
                if (brainScanningRef.current || !source) return;

                brainScanningRef.current = true;
                setBrainStatus('scanning');
                setScanStatus('scanning');

                try {
                    // Step 3: Snap Frame (from MJPEG img or Laptop video)
                    const canvas = document.createElement('canvas');
                    canvas.width = 640; 
                    canvas.height = 480;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error("Canvas ctx fail");
                    
                    ctx.drawImage(source, 0, 0, 640, 480);
                    
                    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

                    canvas.toBlob(async (blob) => {
                        if (!blob) return;
                        const formData = new FormData();
                        formData.append('file', blob, 'frame.jpg');

                        try {
                            // Step 4: Send to Laptop Brain (High Accuracy YOLO+EasyOCR)
                            const brainRes = await fetch(`${BRAIN_URL}/detect`, {
                                method: 'POST',
                                body: formData,
                                headers: { 'ngrok-skip-browser-warning': 'true' }
                            });
                            
                            if (!brainRes.ok) throw new Error("Brain offline");
                            const result = await brainRes.json();
                            if (result.detected) {
                                // Step 5: High-Accuracy Plate Found!
                                setBrainStatus('success');
                                setScanStatus('found');
                                setBrainImageBaseUrl(BRAIN_URL);
                                setDetectionResult(result);
                                
                                // Step 7-10: Trigger Pi Hardware + Upload Image
                                await apiFetch("/remote-process", {
                                    method: "POST",
                                    body: JSON.stringify({ 
                                        plate_number: result.plate_number,
                                        image_base64: imageBase64
                                    })
                                });
                                
                                toast.success(`High-Accuracy Scan: ${result.plate_number}`, { icon: '🧠' });
                            } else {
                                setBrainStatus('idle');
                                // Only reset scanStatus if not actively finding something
                                setTimeout(() => setScanStatus('idle'), 1000);
                            }
                        } catch (err) {
                            setBrainStatus('error');
                            console.error("Brain Error:", err);
                        } finally {
                            brainScanningRef.current = false;
                        }
                    }, 'image/jpeg', 0.8);

                } catch (err) {
                    console.error("Brain Orchestrator Error:", err);
                    brainScanningRef.current = false;
                    setBrainStatus('error');
                }
            }, 500); // 500ms interval for fast scanning (满足 5s 目标)
        }

        return () => {
            if (brainInterval) clearInterval(brainInterval);
        };
    }, [selectedCamera, isAutoScanning, isBrainMode]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        Camera Surveillance
                        {isBrainMode && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                                <div className={`h-1.5 w-1.5 rounded-full ${brainStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                                PC BRAIN ACTIVE
                            </span>
                        )}
                    </h1>
                    <p className="text-slate-400">Real-time monitoring and security feeds.</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsBrainMode(!isBrainMode)}
                        className={`group relative flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                            isBrainMode 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]" 
                            : "bg-slate-800/50 border-white/5 text-slate-400 grayscale"
                        }`}
                    >
                        <div className={`p-1 rounded-lg ${isBrainMode ? "bg-emerald-500/20" : "bg-slate-700"}`}>
                            <Cpu className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col items-start leading-none gap-1">
                            <span className="text-xs font-bold uppercase tracking-wider">AI Brain Mode</span>
                            <span className="text-[8px] opacity-60 font-medium whitespace-nowrap">Offload to PC (Accuracy: High)</span>
                        </div>
                    </button>
                    
                    <button
                        onClick={runDiagnostics}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-all font-bold text-xs"
                    >
                        <Activity className="h-4 w-4" />
                        DIAGNOSTICS
                    </button>
                    
                    <button
                        onClick={toggleAutoScan}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${
                            isAutoScanning
                                ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                                : "bg-slate-800 text-slate-400 border border-white/5"
                        }`}
                    >
                        <div className={`h-2 w-2 rounded-full ${isAutoScanning ? "bg-black animate-pulse" : "bg-slate-600"}`} />
                        {isAutoScanning ? "SCANNERS ACTIVE" : "ENABLE SCANNERS"}
                    </button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Feed */}
                <div className="lg:col-span-2 space-y-6">
                    <GlassCard className="p-0 overflow-hidden relative group">
                        <div className="relative aspect-video bg-black">
                            {selectedCamera === 1 ? (
                                <>
                                    {streamSrc ? (
                                        <img
                                            ref={imgRef}
                                            src={streamSrc}
                                            alt="Raspberry Pi Camera Feed"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500/20 border-t-emerald-500 mb-4" />
                                            <p className="text-slate-500 text-sm animate-pulse">Connecting to hardware feed...</p>
                                        </div>
                                    )}
                                    {/* Capture Flash Effect */}
                                    <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 ${isCapturing ? "opacity-30" : "opacity-0"}`} />
                                    
                                    {/* Step 3: ROI Box Overlay */}
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <div className={`border-2 rounded-xl transition-all duration-300 ${scanStatus === 'scanning' ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'border-dashed border-white/20'}`} 
                                            style={{
                                                width: `${ROI.width * 100}%`,
                                                height: `${ROI.height * 100}%`,
                                                maxWidth: '80%',
                                                maxHeight: '60%',
                                                boxShadow: scanStatus === 'scanning' ? '0 0 0 1000px rgba(0,0,0,0.5)' : '0 0 0 1000px rgba(0,0,0,0.3)'
                                            }}>
                                            
                                            {/* Step 2-5 Status Indicator - MOVED INSIDE FOR VISIBILITY */}
                                            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 w-full px-2">
                                                {scanStatus === 'scanning' ? (
                                                    <div className="flex items-center gap-2 bg-emerald-500 text-black font-black text-[9px] px-3 py-1 rounded shadow-lg animate-pulse uppercase tracking-tighter whitespace-nowrap">
                                                        <div className="h-1.5 w-1.5 bg-black rounded-full animate-ping" />
                                                        Step 5: OCR Reading
                                                    </div>
                                                ) : (
                                                    <div className="text-white/40 font-bold text-[8px] uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm border border-white/5">
                                                        Step 2: Monitoring
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>


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
                            ) : currentCamera.url === "local_webcam" ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                    {/* Scanning Target Box for Laptop */}
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <div className="border-2 border-dashed border-white/40 rounded-xl" style={{
                                            width: '60%',
                                            height: '40%',
                                            boxShadow: '0 0 0 1000px rgba(0,0,0,0.4)'
                                        }}>
                                            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 w-full px-2">
                                                {scanStatus === 'scanning' ? (
                                                    <motion.div 
                                                        initial={{ scale: 0.8, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        className="flex items-center gap-2 bg-emerald-500 text-black font-black text-[10px] px-4 py-1.5 rounded shadow-[0_0_20px_rgba(16,185,129,0.5)] uppercase tracking-tighter whitespace-nowrap"
                                                    >
                                                        <div className="h-2 w-2 bg-black rounded-full animate-pulse" />
                                                        AI ANALYZING PLATE...
                                                    </motion.div>
                                                ) : scanStatus === 'found' ? (
                                                    <motion.div 
                                                        initial={{ y: 5, opacity: 0 }}
                                                        animate={{ y: 0, opacity: 1 }}
                                                        className="bg-blue-500 text-white font-black text-[10px] px-4 py-1.5 rounded shadow-[0_0_20px_rgba(59,130,246,0.5)] uppercase tracking-tighter whitespace-nowrap"
                                                    >
                                                        SUCCESS! PLATE VERIFIED
                                                    </motion.div>
                                                ) : (
                                                    <div className="text-white/60 font-black text-[9px] uppercase tracking-widest bg-black/60 px-3 py-1 rounded border border-white/10 backdrop-blur-sm">
                                                        [ ROI TARGET ]
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Capture Flash Effect */}
                                    <div className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-150 ${isCapturing ? "opacity-30" : "opacity-0"}`} />
                                    
                                    {/* Device Selector Overlay */}
                                    {videoDevices.length > 1 && (
                                        <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-1">
                                            <span className="text-[10px] uppercase font-bold text-slate-300 drop-shadow-md bg-black/40 px-2 py-0.5 rounded">Switch Camera Device</span>
                                            <select
                                                className="bg-black/80 text-white text-xs px-3 py-2 rounded-lg border border-white/20 backdrop-blur-md outline-none cursor-pointer hover:bg-slate-800 transition-colors shadow-lg"
                                                value={selectedDeviceId}
                                                onChange={(e) => setSelectedDeviceId(e.target.value)}
                                            >
                                                {videoDevices.map(device => (
                                                    <option key={device.deviceId} value={device.deviceId}>
                                                        {device.label || `Camera ${videoDevices.indexOf(device) + 1}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Live OCR overlay */}
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
                                        className="w-full h-full object-cover transition-opacity duration-300 opacity-80"
                                    />
                                </div>
                            )}

                            {/* Overlays */}
                            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-md">
                                <div className="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
                                <span className="text-xs font-medium text-white">
                                    {selectedCamera === 1 ? "Local Device Camera" : 
                                     currentCamera.url === "local_webcam" ? (videoDevices.find(d => d.deviceId === selectedDeviceId)?.label || "Laptop Webcam") : 
                                     currentCamera.name}
                                </span>
                            </div>

                            <div className="absolute top-4 left-44 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-md border border-white/5">
                                <div className={`h-2 w-2 rounded-full ${rfidStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${rfidStatus.connected ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    {rfidStatus.connected ? "RFID ACTIVE" : "RFID OFFLINE"}
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
                                                <div className={`p-4 rounded-xl relative ${detectionResult.access_granted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {detectionResult.access_granted ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
                                                    <div className="absolute -bottom-1 -right-1 bg-[#0f172a] p-1 rounded-full border border-white/10">
                                                        {detectionResult.method === 'RFID' ? (
                                                            <Tag className="h-3 w-3 text-emerald-400" />
                                                        ) : (
                                                            <Camera className="h-3 w-3 text-blue-400" />
                                                        )}
                                                    </div>
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
                                                <div className="h-32 w-40 overflow-hidden rounded-lg border-2 border-white/20 shrink-0 shadow-lg bg-slate-900 flex items-center justify-center">
                                                    <NgrokImage 
                                                        src={`${API_BASE_URL}${detectionResult.image_url}`} 
                                                        alt="Captured" 
                                                        className="h-full w-full object-cover" 
                                                    />
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
                                        <div className={`relative h-16 w-24 overflow-hidden rounded-lg flex items-center justify-center transition-all border ${
                                            selectedCamera === camera.id 
                                            ? 'bg-blue-500/20 border-blue-500/30' 
                                            : 'bg-slate-800/50 border-white/5'
                                        }`}>
                                            <Camera className={`h-8 w-8 transition-colors ${
                                                selectedCamera === camera.id ? 'text-blue-400' : 'text-slate-500'
                                            } ${camera.status === 'Offline' ? 'opacity-30' : 'opacity-80'}`} />
                                            
                                            {camera.status === 'Offline' && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                    <MicOff className="h-4 w-4 text-slate-400" />
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
                                        <option value="local_webcam" className="bg-slate-800 text-emerald-400 font-bold">Laptop Webcam (Local Browser)</option>
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
            
            {/* Diagnostics Modal */}
            {isDiagOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <GlassCard className="w-full max-w-md p-6 border-white/10 shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500 animate-gradient-x" />
                        
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                                    <Activity className="h-5 w-5" />
                                </div>
                                <h2 className="text-xl font-bold text-white uppercase tracking-tight">System Health</h2>
                            </div>
                            <button onClick={() => setIsDiagOpen(false)} className="text-slate-400 hover:text-white">
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <DiagItem label="Main API Reachability" status={diagResults.api} />
                            <DiagItem label="Pi Snapshot Utility" status={diagResults.snapshot} />
                            <DiagItem label="Mixed Content Security" status={diagResults.mixedContent} inverse />
                            <DiagItem label="Ngrok Tunnel Identity" status={diagResults.ngrok} />
                        </div>

                        {diagResults.mixedContent === 'blocked' && (
                            <div className="mt-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                                <p className="text-[10px] text-red-400 uppercase font-black mb-1">Security Block Detected</p>
                                <p className="text-xs text-slate-300">Browser is blocking your local Pi because the URLs are <b>HTTP</b> while Vercel is <b>HTTPS</b>. Update your Vercel ENVs to use <b>https://</b>.</p>
                            </div>
                        )}

                        <button 
                            onClick={() => setIsDiagOpen(false)}
                            className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all uppercase tracking-widest text-xs"
                        >
                            Dismiss
                        </button>
                    </GlassCard>
                </div>
            )}
        </motion.div>
    );
};

const DiagItem = ({ label, status, inverse = false }: { label: string, status: string, inverse?: boolean }) => {
    let color = "text-slate-400";
    let icon = <Loader2 className="h-4 w-4 animate-spin" />;

    if (status.includes('success') || status === 'active' || (inverse && status === 'safe')) {
        color = "text-emerald-400";
        icon = <CheckCircle2 className="h-4 w-4" />;
    } else if (status === 'error' || status === 'failed' || status === 'blocked' || (inverse && status === 'blocked')) {
        color = "text-red-400";
        icon = <XCircle className="h-4 w-4" />;
    }

    return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-xs font-semibold text-slate-400">{label}</span>
            <div className={`flex items-center gap-2 text-xs font-bold ${color}`}>
                {status.toUpperCase()}
                {icon}
            </div>
        </div>
    );
};

// Helper component for Secure Thumbnails
const RemoteImage = ({ src, alt, className }: { src: string, alt: string, className: string }) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        
        const fetchThumb = async () => {
            if (!src || !src.includes('ngrok')) return;
            try {
                const res = await fetch(getSecureUrl(src), {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                if (res.ok) {
                    const blob = await res.blob();
                    if (isMounted) setBlobUrl(URL.createObjectURL(blob));
                } else setError(true);
            } catch (e) {
                if (isMounted) setError(true);
            }
        };

        fetchThumb();
        return () => { 
            isMounted = false; 
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [src]);

    if (error || !src.includes('ngrok')) return <img src={src} alt={alt} className={className} />;
    
    return blobUrl ? (
        <img src={blobUrl} alt={alt} className={className} />
    ) : (
        <div className={`flex items-center justify-center bg-black/40 ${className}`}>
             <Loader2 className="h-4 w-4 animate-spin text-slate-700" />
        </div>
    );
};

export default CameraPage;
