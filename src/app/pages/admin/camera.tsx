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
    const lastScanTimeRef = useRef<number>(0);

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

    // --- Background Polling for Live AI Scans ---
    useEffect(() => {
        if (!isAutoScanning) return;

        let clearTimer: NodeJS.Timeout;

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/latest-scan`);
                if (response.ok) {
                    const data = await response.json();

                    // Use a combination of timestamp and ID to ensure we only trigger on fresh scans
                    if (data.detected && data.timestamp > lastScanTimeRef.current) {
                        lastScanTimeRef.current = data.timestamp;
                        setDetectionResult(data);

                        if (data.access_granted) {
                            toast.success(`Auto-Scan Granted: ${data.plate_number}`);
                        } else {
                            toast.error(`Auto-Scan Denied: ${data.plate_number} (${data.access_status})`);
                        }

                        // Clear the display after 5 seconds
                        if (clearTimer) clearTimeout(clearTimer);
                        clearTimer = setTimeout(() => {
                            setDetectionResult(null);
                        }, 5000);
                    }
                }
            } catch (err) {
                // Silently ignore polling errors so it doesn't spam console if backend is restarting
            }
        }, 1500); // Poll every 1.5 seconds

        return () => {
            clearInterval(pollInterval);
            if (clearTimer) clearTimeout(clearTimer);
        };
    }, [isAutoScanning]);

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
                            {/* Camera Feed Logic */}
                            {selectedCamera === 1 ? (
                                <img
                                    src={`${API_BASE_URL}/live-feed`}
                                    alt="Live Camera Feed"
                                    className="w-full h-full object-cover"
                                />
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
                                    {cameras.find(c => c.id === selectedCamera)?.name}
                                </span>
                            </div>

                            <div className="absolute top-4 right-4 flex flex-col items-end gap-2 text-white/80">
                                <span className="text-xs font-mono">{new Date().toLocaleTimeString()}</span>
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

                    {/* Scanning Results Panel */}
                    {(detectionResult) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                        >
                            <GlassCard className="p-4 border-l-4 overflow-hidden relative">
                                {detectionResult && (
                                    <div className={`flex items-center justify-between relative z-10 ${detectionResult.access_granted ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl ${detectionResult.access_granted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {detectionResult.access_granted ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-white tracking-widest">
                                                    {detectionResult.plate_number || "NO PLATE"}
                                                </h3>
                                                <p className={`text-sm font-medium mt-1 ${detectionResult.access_granted ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {detectionResult.access_status}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            {detectionResult.vehicle_info && (
                                                <div className="text-right text-sm text-slate-400 border-l border-white/10 pl-6 space-y-1">
                                                    <p>Owner: <span className="text-white">{detectionResult.vehicle_info.owner_name || detectionResult.vehicle_info.owner_id || "Unknown"}</span></p>
                                                    <p>Role: <span className="text-white">{detectionResult.vehicle_info.owner_role || "Unknown"}</span></p>
                                                    <p>Vehicle: <span className="text-white">{detectionResult.vehicle_info.color} {detectionResult.vehicle_info.model}</span></p>
                                                </div>
                                            )}
                                            {!detectionResult.vehicle_info && detectionResult.detected && (
                                                <div className="text-right text-sm text-slate-400 border-l border-white/10 pl-6">
                                                    <p>Confidence: <span className="text-white">{(detectionResult.confidence * 100 || 95).toFixed(1)}%</span></p>
                                                    <p>Type: <span className="text-white">{detectionResult.vehicle_type || "Vehicle"}</span></p>
                                                </div>
                                            )}
                                            {detectionResult.image_url && (
                                                <div className="h-16 w-24 overflow-hidden rounded-lg border border-white/20 shrink-0 shadow-lg">
                                                    <img src={`${API_BASE_URL}${detectionResult.image_url}`} alt="Captured" className="h-full w-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
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
