import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  MonitorPlay, 
  Grid, 
  LayoutGrid, 
  Maximize2, 
  VideoOff, 
  X, 
  Radio, 
  Scan, 
  Zap, 
  Layers,
  Camera as CameraIcon,
  Play,
  Pause,
  Sparkles,
  Plus
} from 'lucide-react';
import { api, getWsUrl } from '../lib/api';
import { cn } from '../utils/cn';
import { FaceRecognitionModal } from '../components/FaceRecognitionModal';
import { Badge } from '../components/ui/Badge';

interface CameraNode {
  id: string;
  name: string;
  protocol?: string;
  host?: string;
  status?: string;
  stream_path?: string;
  site_id?: string;
  isWebcam?: boolean;
}

export default function Live() {
  const [cameras, setCameras] = useState<CameraNode[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  
  const [layout, setLayout] = useState<1 | 4 | 9>(4);
  const [activeCameras, setActiveCameras] = useState<(CameraNode | null)[]>(Array(4).fill(null));
  
  // Face Recognition Modal
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);

  // Global live simulation / webcam run state
  const [allFeedsPlaying, setAllFeedsPlaying] = useState(true);

  // Store the latest detection event for each camera
  const [latestDetections, setLatestDetections] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchCameras();
    
    // Connect to WS for live detections
    let ws: WebSocket | null = null;
    try {
      const token = localStorage.getItem('token') || 'dummy-token';
      ws = new WebSocket(getWsUrl(`/api/v1/ws?token=${token}`));
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const payload = msg.data || msg;
          
          if (msg.type === 'live_detections' && payload.camera_id) {
            setLatestDetections(prev => ({
              ...prev,
              [payload.camera_id]: payload.detections
            }));
          }
        } catch {
          // ignore parse errors
        }
      };
    } catch {
      // ws optional
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Update active cameras array size when layout changes and auto-assign empty slots
  useEffect(() => {
    setActiveCameras(prev => {
      const newArray = Array(layout).fill(null);
      for (let i = 0; i < Math.min(prev.length, layout); i++) {
        newArray[i] = prev[i];
      }
      // Auto-fill unassigned slots from camera pool
      if (cameras.length > 0) {
        for (let i = 0; i < layout; i++) {
          if (!newArray[i]) {
            newArray[i] = cameras[i % cameras.length];
          }
        }
      }
      return newArray;
    });
  }, [layout, cameras]);

  const fetchCameras = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cameras');
      const items: CameraNode[] = res.data.items || [];
      
      // Fallback defaults if empty
      const cameraPool = items.length > 0 ? items : [
        { id: 'cam-1', name: 'Live Camera Scanner (Webcam)', host: '127.0.0.1', protocol: 'WEBCAM', status: 'active', isWebcam: true },
        { id: 'cam-2', name: 'Main Entrance & Gate Scanner', host: '192.168.1.101', protocol: 'RTSP', status: 'active' },
        { id: 'cam-3', name: 'Corporate Lobby & Reception', host: '192.168.1.102', protocol: 'RTSP', status: 'active' },
        { id: 'cam-4', name: 'Perimeter Security & Parking Bay', host: '192.168.1.103', protocol: 'RTSP', status: 'active' }
      ];

      setCameras(cameraPool);

      // Auto-populate active slots so all cameras open immediately
      const slots = Array(layout).fill(null);
      for (let i = 0; i < layout; i++) {
        slots[i] = cameraPool[i % cameraPool.length];
      }
      setActiveCameras(slots);

    } catch (err) {
      console.error('Failed to fetch cameras', err);
      // Fallback cameras
      const fallbackPool: CameraNode[] = [
        { id: 'cam-1', name: 'Live Camera Scanner (Webcam)', host: '127.0.0.1', protocol: 'WEBCAM', status: 'active', isWebcam: true },
        { id: 'cam-2', name: 'Main Entrance & Gate Scanner', host: '192.168.1.101', protocol: 'RTSP', status: 'active' },
        { id: 'cam-3', name: 'Corporate Lobby & Reception', host: '192.168.1.102', protocol: 'RTSP', status: 'active' },
        { id: 'cam-4', name: 'Perimeter Security & Parking Bay', host: '192.168.1.103', protocol: 'RTSP', status: 'active' }
      ];
      setCameras(fallbackPool);
      setActiveCameras(fallbackPool.slice(0, layout));
    } finally {
      setLoading(false);
    }
  };

  const filteredCameras = cameras.filter(cam => {
    const matchesSearch = cam.name.toLowerCase().includes(search.toLowerCase());
    const matchesSite = siteFilter === 'all' || cam.site_id === siteFilter;
    return matchesSearch && matchesSite;
  });

  const uniqueSites = Array.from(new Set(cameras.map(c => c.site_id).filter(Boolean)));

  const handleDragStart = (e: React.DragEvent, camera: CameraNode) => {
    e.dataTransfer.setData('camera', JSON.stringify(camera));
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const cameraData = e.dataTransfer.getData('camera');
    if (cameraData) {
      const camera = JSON.parse(cameraData);
      setActiveCameras(prev => {
        const newCams = [...prev];
        newCams[index] = camera;
        return newCams;
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeCamera = (index: number) => {
    setActiveCameras(prev => {
      const newCams = [...prev];
      newCams[index] = null;
      return newCams;
    });
  };

  const toggleCameraWebcam = (index: number) => {
    setActiveCameras(prev => {
      const newCams = [...prev];
      const current = newCams[index];
      if (current) {
        newCams[index] = {
          ...current,
          isWebcam: !current.isWebcam,
          protocol: !current.isWebcam ? 'WEBCAM' : 'RTSP'
        };
      }
      return newCams;
    });
  };

  const fillAllSlots = () => {
    if (cameras.length === 0) return;
    const updated = Array(layout).fill(null);
    for (let i = 0; i < layout; i++) {
      updated[i] = cameras[i % cameras.length];
    }
    setActiveCameras(updated);
  };

  const toggleFullscreen = () => {
    const el = document.getElementById('cctv-wall');
    if (el) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        el.requestFullscreen();
      }
    }
  };

  return (
    <div className="h-[calc(100vh-6.5rem)] flex flex-col md:flex-row gap-4 sm:gap-5 animate-fade-in select-none">
      {/* Left Sidebar - Camera Matrix Selector */}
      <div className="w-full md:w-80 flex flex-col glass-card rounded-2xl border border-border/80 overflow-hidden shrink-0">
        <div className="p-4 border-b border-border/60 bg-surface/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">Camera Feeds</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="cyan" size="xs">
                {cameras.length} NODES
              </Badge>
              <button
                onClick={fillAllSlots}
                className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono transition-colors"
                title="Populate All Slots"
              >
                Auto-Fill
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Filter feeds..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0f1d]/90 border border-border/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>

            {uniqueSites.length > 0 && (
              <div className="relative">
                <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <select 
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="w-full bg-[#0a0f1d]/90 border border-border/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white appearance-none focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                >
                  <option value="all">All Sectors</option>
                  {uniqueSites.map((site: any) => (
                    <option key={site} value={site}>Sector: {site.substring(0, 10)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Camera List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-hide">
          {loading ? (
            <div className="text-center py-8 text-text-muted text-xs font-mono">
              Interrogating camera nodes...
            </div>
          ) : filteredCameras.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-xs">
              No matching feeds found
            </div>
          ) : (
            filteredCameras.map((camera, idx) => {
              const isActive = camera.status === 'active';
              return (
                <div 
                  key={camera.id || idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, camera)}
                  className="p-3 bg-surface/40 hover:bg-surface-hover/80 border border-border/60 hover:border-cyan-500/40 rounded-xl cursor-grab active:cursor-grabbing transition-all group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="relative flex h-2 w-2 shrink-0">
                        {isActive && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        )}
                        <span className={cn('relative inline-flex rounded-full h-2 w-2', isActive ? 'bg-emerald-400' : 'bg-rose-500')}></span>
                      </span>
                      <span className="text-xs font-semibold text-text truncate max-w-[170px] group-hover:text-cyan-300 transition-colors">
                        {camera.name}
                      </span>
                    </div>
                    <MonitorPlay className="w-3.5 h-3.5 text-text-muted group-hover:text-cyan-400 transition-colors" />
                  </div>

                  <div className="text-[10px] font-mono text-text-dim mt-1.5 flex items-center justify-between">
                    <span className="truncate max-w-[130px]">{camera.host || '127.0.0.1'}</span>
                    <span className="uppercase text-cyan-400/80 font-bold">{camera.protocol || 'RTSP'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-2.5 bg-[#050811]/60 border-t border-border/60 text-[10px] font-mono text-text-muted text-center flex items-center justify-center gap-1.5">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span>Drag node to assign grid slot</span>
        </div>
      </div>

      {/* Main CCTV Wall Area */}
      <div className="flex-1 flex flex-col min-w-0 glass-card rounded-2xl border border-border/80 overflow-hidden shadow-2xl">
        {/* Wall Toolbar */}
        <div className="p-3 border-b border-border/60 bg-surface/50 flex flex-wrap gap-2 justify-between items-center">
          {/* Layout buttons */}
          <div className="flex items-center gap-1 bg-surface/80 p-1 rounded-xl border border-border/80">
            <button 
              onClick={() => setLayout(1)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5",
                layout === 1 
                  ? "bg-primary text-white shadow-md shadow-primary/25 font-bold" 
                  : "text-text-muted hover:text-white"
              )}
              title="1 Feed Solo"
            >
              <div className="w-3 h-3 border border-current rounded-sm"></div>
              <span>1x1</span>
            </button>
            <button 
              onClick={() => setLayout(4)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5",
                layout === 4 
                  ? "bg-primary text-white shadow-md shadow-primary/25 font-bold" 
                  : "text-text-muted hover:text-white"
              )}
              title="4 Feeds Quad"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>2x2</span>
            </button>
            <button 
              onClick={() => setLayout(9)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5",
                layout === 9 
                  ? "bg-primary text-white shadow-md shadow-primary/25 font-bold" 
                  : "text-text-muted hover:text-white"
              )}
              title="9 Feeds Matrix"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>3x3</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAllFeedsPlaying(!allFeedsPlaying)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                allFeedsPlaying
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              )}
            >
              {allFeedsPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{allFeedsPlaying ? 'All Feeds Live' : 'Feeds Paused'}</span>
            </button>

            <button 
              onClick={() => setIsFaceModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-md shadow-blue-500/25 transition-all"
            >
              <Scan className="w-3.5 h-3.5 animate-pulse" />
              <span>Webcam AI Face Rec</span>
            </button>

            <button 
              onClick={toggleFullscreen}
              className="p-1.5 rounded-xl bg-surface/80 border border-border/80 text-text-muted hover:text-white hover:bg-surface-hover transition-colors"
              title="Fullscreen Matrix"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Grid Wall */}
        <div id="cctv-wall" className="flex-1 bg-[#030611] p-2.5 overflow-hidden flex flex-col relative">
          <div className="absolute inset-0 bg-cyber-grid opacity-15 pointer-events-none" />

          <div className={cn(
            "flex-1 grid gap-2.5 relative z-10",
            layout === 1 ? "grid-cols-1 grid-rows-1" :
            layout === 4 ? "grid-cols-2 grid-rows-2" :
            "grid-cols-3 grid-rows-3"
          )}>
            {activeCameras.map((camera, index) => (
              <div 
                key={index}
                onDrop={(e) => handleDrop(e, index)}
                onDragOver={handleDragOver}
                className="bg-[#070b16] rounded-xl overflow-hidden relative group flex flex-col border border-border/60 hover:border-cyan-500/40 transition-colors shadow-inner"
              >
                {camera ? (
                  <ActiveCameraStream 
                    camera={camera} 
                    slotIndex={index}
                    isPlaying={allFeedsPlaying}
                    onRemove={() => removeCamera(index)} 
                    onToggleWebcam={() => toggleCameraWebcam(index)}
                    latestDetection={latestDetections[camera.id]} 
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-text-dim border border-dashed border-border/60 rounded-xl m-1 bg-[#040814]/60">
                    <VideoOff className="w-7 h-7 mb-2 text-text-dim/60" />
                    <span className="text-xs font-mono font-semibold tracking-wider text-text-muted">SLOT {index + 1} UNASSIGNED</span>
                    <button
                      onClick={() => {
                        const fallbackCam = cameras[index % cameras.length];
                        if (fallbackCam) {
                          setActiveCameras(prev => {
                            const updated = [...prev];
                            updated[index] = fallbackCam;
                            return updated;
                          });
                        }
                      }}
                      className="mt-2 text-[10px] text-cyan-400 font-mono hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Assign Feed</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <FaceRecognitionModal 
        isOpen={isFaceModalOpen} 
        onClose={() => setIsFaceModalOpen(false)} 
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Camera Stream Component (Webcam or High-Tech Surveillance Simulation)
// ---------------------------------------------------------------------------
interface ActiveCameraStreamProps {
  camera: CameraNode;
  slotIndex: number;
  isPlaying: boolean;
  onRemove: () => void;
  onToggleWebcam: () => void;
  latestDetection?: any;
}

function ActiveCameraStream({
  camera,
  slotIndex,
  isPlaying,
  onRemove,
  onToggleWebcam,
  latestDetection
}: ActiveCameraStreamProps) {
  // If slot 0 or marked as webcam, use real webcam
  const isWebcamMode = camera.isWebcam ?? (slotIndex === 0 || camera.name.toLowerCase().includes('webcam'));
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState<string>('');

  // Timecode clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const ms = String(now.getMilliseconds()).padStart(3, '0').slice(0, 2);
      setTimeStr(`${now.toLocaleTimeString('en-US', { hour12: false })}.${ms}`);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Real Webcam handler
  useEffect(() => {
    let isMounted = true;

    if (isWebcamMode && isPlaying) {
      setWebcamError(null);
      navigator.mediaDevices?.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: false
      })
      .then(stream => {
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setWebcamActive(true);
      })
      .catch(err => {
        console.warn(`Webcam access note on slot ${slotIndex}:`, err);
        if (isMounted) {
          setWebcamError('Webcam in use or permission denied. Showing live AI simulation.');
          setWebcamActive(false);
        }
      });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setWebcamActive(false);
    }

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [isWebcamMode, isPlaying, slotIndex]);

  // Surveillance Simulation Canvas Animation
  useEffect(() => {
    if (isWebcamMode && webcamActive) return;
    if (!isPlaying) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = slotIndex * 50;

    // Simulated bounding boxes
    const simObjects = [
      { label: slotIndex === 1 ? 'VEHICLE // CAR' : slotIndex === 2 ? 'PERSON // VERIFIED' : 'PERIMETER PATROL', color: '#06b6d4' },
      { label: slotIndex === 1 ? 'HSRP PLATE // UP32' : slotIndex === 2 ? 'LAPTOP // SECURE' : 'FACILITY ENTRANCE', color: '#10b981' }
    ];

    const render = () => {
      t += 0.02;
      const w = canvas.width;
      const h = canvas.height;

      // Dark surveillance background
      ctx.fillStyle = '#060a17';
      ctx.fillRect(0, 0, w, h);

      // Cyber surveillance perspective grid
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Dynamic radar sweep line
      const sweepY = (Math.sin(t * 0.8) * 0.5 + 0.5) * h;
      const grad = ctx.createLinearGradient(0, sweepY - 15, 0, sweepY + 15);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
      grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.25)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, sweepY - 15, w, 30);

      // Render moving target boxes
      simObjects.forEach((obj, idx) => {
        const offset = idx * 1.5;
        const boxX = w * 0.25 + Math.sin(t + offset) * (w * 0.18);
        const boxY = h * 0.3 + Math.cos(t * 0.8 + offset) * (h * 0.15);
        const boxW = w * 0.32;
        const boxH = h * 0.35;

        // Box border
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Fill tint
        ctx.fillStyle = obj.color === '#10b981' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(6, 182, 212, 0.08)';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        // Label banner
        ctx.fillStyle = obj.color;
        ctx.fillRect(boxX, boxY - 18, Math.min(boxW, 160), 18);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 10px monospace';
        const conf = Math.floor(88 + Math.sin(t + idx) * 8);
        ctx.fillText(`${obj.label} ${conf}%`, boxX + 6, boxY - 5);

        // Reticle corners
        const cornerSize = 8;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(boxX, boxY + cornerSize);
        ctx.lineTo(boxX, boxY);
        ctx.lineTo(boxX + cornerSize, boxY);
        ctx.stroke();
      });

      // Central crosshair
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 15, h / 2);
      ctx.lineTo(w / 2 + 15, h / 2);
      ctx.moveTo(w / 2, h / 2 - 15);
      ctx.lineTo(w / 2, h / 2 + 15);
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [isWebcamMode, webcamActive, isPlaying, slotIndex]);

  return (
    <>
      {/* Cyber Corner Brackets */}
      <div className="pointer-events-none absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-cyan-400/80 z-20" />
      <div className="pointer-events-none absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-cyan-400/80 z-20" />
      <div className="pointer-events-none absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-cyan-400/80 z-20" />
      <div className="pointer-events-none absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-cyan-400/80 z-20" />

      {/* Stream Overlay HUD Header */}
      <div className="absolute top-0 inset-x-0 p-2.5 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex justify-between items-start z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span className="text-white text-xs font-bold truncate max-w-[170px] drop-shadow font-mono tracking-wide">
              {camera.name}
            </span>
          </div>
          <span className="text-[10px] font-mono text-cyan-300 drop-shadow mt-0.5">
            {timeStr} • {isWebcamMode && webcamActive ? 'LOCAL WEBCAM' : 'NEURAL RTSP // 30 FPS'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button 
            onClick={onToggleWebcam}
            className={cn(
              "px-1.5 py-1 rounded-lg text-[10px] font-mono border backdrop-blur-md transition-all flex items-center gap-1",
              isWebcamMode
                ? "bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/30"
                : "bg-black/60 border-white/10 text-white/70 hover:text-white"
            )}
            title={isWebcamMode ? "Switch to Simulated Node" : "Use Laptop Webcam"}
          >
            <CameraIcon className="w-3 h-3" />
            <span className="hidden sm:inline">{isWebcamMode ? 'Webcam' : 'Sim'}</span>
          </button>

          <button 
            onClick={onRemove}
            className="p-1 rounded-lg bg-black/60 hover:bg-rose-500/20 text-white/70 hover:text-rose-400 border border-white/10 backdrop-blur-md transition-colors"
            title="Detach Slot"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stream Badges Bottom Right */}
      <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
        <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-600/90 text-white text-[10px] font-mono font-bold rounded border border-rose-400/30 shadow-lg shadow-rose-600/40">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
          LIVE
        </span>
      </div>

      {/* Video Content Area */}
      <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden">
        {isWebcamMode && webcamActive ? (
          // REAL WEBCAM VIDEO STREAM
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Real-time overlay bounding boxes */}
            <div className="absolute inset-0 pointer-events-none border border-cyan-500/20" />
            
            {/* Scan reticle */}
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-laser-sweep opacity-50 pointer-events-none" />

            {/* Live AI Overlay Banner */}
            <div className="absolute bottom-2.5 left-2.5 z-10 bg-black/70 backdrop-blur-md px-2 py-1 rounded border border-cyan-500/40 text-[10px] font-mono text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>ACTIVE WEBCAM INGEST // 1080P</span>
            </div>
          </div>
        ) : (
          // HIGH-TECH REALISTIC SURVEILLANCE SIMULATION CANVAS
          <div className="relative w-full h-full flex items-center justify-center bg-[#050914]">
            <canvas
              ref={canvasRef}
              width={640}
              height={400}
              className="w-full h-full object-cover"
            />

            {/* Bottom telemetry overlay */}
            <div className="absolute bottom-2.5 left-2.5 z-10 bg-black/70 backdrop-blur-md px-2 py-1 rounded border border-white/10 text-[10px] font-mono text-white/80 flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span>{camera.host || '127.0.0.1'} • {camera.protocol || 'RTSP'}</span>
            </div>

            {webcamError && isWebcamMode && (
              <div className="absolute inset-x-4 top-16 bg-amber-500/20 border border-amber-500/40 rounded-xl p-2 text-[10px] text-amber-200 font-mono text-center backdrop-blur-md z-20">
                {webcamError}
              </div>
            )}
          </div>
        )}

        {/* WebSocket Live Detection Bounding Box Overlay if available */}
        {latestDetection && Array.isArray(latestDetection) && latestDetection.map((det: any, idx: number) => (
          <div 
            key={det.track_id || idx}
            className="absolute border-2 border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all duration-75 pointer-events-none z-10"
            style={{
              left: `${(det.bbox?.x1 || 0.2) * 100}%`,
              top: `${(det.bbox?.y1 || 0.2) * 100}%`,
              width: `${((det.bbox?.x2 || 0.5) - (det.bbox?.x1 || 0.2)) * 100}%`,
              height: `${((det.bbox?.y2 || 0.6) - (det.bbox?.y1 || 0.2)) * 100}%`
            }}
          >
            <div className="absolute -top-5 left-[-2px] bg-cyan-500 text-black text-[9px] font-mono font-bold px-1.5 py-0.5 whitespace-nowrap capitalize rounded-t">
              {det.class_name?.replace(/_/g, ' ') || 'Subject'} {((det.confidence || 0.95) * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
