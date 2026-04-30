/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import * as mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';
import WaveSurfer from 'wavesurfer.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table as DocxTable, TableCell, TableRow, WidthType, Footer, AlignmentType, TextRun } from 'docx';
import { saveAs } from 'file-saver';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

import { 
  Plus, 
  Trash2, 
  Youtube, 
  MessageCircle, 
  ExternalLink,
  ChevronRight,
  Cpu,
  Music,
  Image as ImageIcon,
  Video as VideoIcon,
  Upload,
  Check,
  Download,
  Maximize2,
  DollarSign,
  Settings2,
  Smile,
  Layers,
  Monitor,
  X,
  Key,
  Lock,
  RefreshCw,
  Home,
  Play,
  Pause,
  Clock,
  AlertCircle,
  List,
  Activity,
  Zap,
  PlayCircle,
  Sparkles,
  BrainCircuit,
  FileText,
  Table,
  Film,
  Copy,
  ChevronDown,
  Palette
} from 'lucide-react';

interface Section {
  id: string;
  title: string;
}

const WaveformPlayer = ({ url }: { url: string | null }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !url) {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      return;
    }

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(238, 136, 0, 0.2)',
      progressColor: '#ee8800',
      cursorColor: '#ee8800',
      barWidth: 2,
      barRadius: 4,
      height: 80,
      normalize: true,
    });

    ws.load(url);

    ws.on('ready', () => {
      setDuration(ws.getDuration());
    });

    ws.on('timeupdate', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [url]);

  const togglePlay = () => {
    if (!url) return;
    wavesurferRef.current?.playPause();
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-black/60 p-8 rounded-[40px] border border-white/5 shadow-2xl space-y-6 overflow-hidden relative group">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
      
      <div ref={containerRef} className="w-full relative z-10" />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-6">
          <button
            onClick={togglePlay}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-accent text-text-dark hover:scale-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(238,136,0,0.5)] border-4 border-white/10"
          >
            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
          </button>
          
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-1">Status: {isPlaying ? 'Playing' : 'Paused'}</span>
            <span className="text-xl font-mono font-bold text-accent tracking-tighter">
              {formatTime(currentTime)} <span className="text-white/20 mx-1">/</span> {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 h-10">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <motion.div
              key={i}
              className="w-1 bg-accent/40 rounded-full"
              animate={isPlaying ? { 
                height: [10, Math.random() * 40 + 10, 10],
                backgroundColor: ['#ee8800', '#ffcc80', '#ee8800'] 
              } : { 
                height: 10,
                backgroundColor: '#ee880044'
              }}
              transition={{
                duration: 0.5 + Math.random(),
                repeat: Infinity,
                delay: i * 0.05,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface VideoJob {
  id: string;
  prompt: string;
  inputType: 'text' | 'image' | 'frame';
  model: string;
  aspectRatio: '1:1' | '16:9' | '9:16';
  outputCount: number;
  inputImage?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

interface ConversationNode {
  id: string;
  speaker: string;
  text: string;
  style?: string;
  region?: string;
}

export default function App() {
  const [sections, setSections] = useState<Section[]>([
    { id: 'prompt', title: 'Prompt Generator' },
    { id: 'audio', title: 'Audio Generator' },
    { id: 'image', title: 'Image Generator' },
    { id: 'video', title: 'Video Generator' },
  ]);
  
  const [activeSection, setActiveSection] = useState<string>('prompt');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');

  // Image Generator State
  const [characterImages, setCharacterImages] = useState<(string | null)[]>([null, null, null, null]);
  const [selectedCharacters, setSelectedCharacters] = useState<boolean[]>([false, false, false, false]);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [useBackground, setUseBackground] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Cinematic');
  const [resolution, setResolution] = useState('1080p');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [imageModel, setImageModel] = useState('Nano Banana');
  const [resultCount, setResultCount] = useState(4); // Default to 4 as per latest request
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [headerLogo, setHeaderLogo] = useState<string | null>(null);

  // Prompt Generator State
  const [userIdea, setUserIdea] = useState('');
  const [numberOfScenes, setNumberOfScenes] = useState(4);
  const [scriptType, setScriptType] = useState<'Whisk' | 'Json'>('Whisk');
  const [promptStyle, setPromptStyle] = useState('Cinematic');
  const [promptAspectRatio, setPromptAspectRatio] = useState('16:9');
  const [isProcessingPrompt, setIsProcessingPrompt] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedScript, setGeneratedScript] = useState<{
    overview: string;
    scenes: {
      id: number;
      time: string;
      description: string;
      whiskPrompt?: string;
      movementPrompt?: string;
      videoPrompt?: string;
      jsonVideoPrompt?: string;
    }[];
  } | null>(null);

  // New API Key Modal State
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(localStorage.getItem('user_api_key') || '');

  // Video Generator State
  const [videoJobs, setVideoJobs] = useState<VideoJob[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [processingHistory, setProcessingHistory] = useState<number[]>([]);
  const [bulkPrompts, setBulkPrompts] = useState('');
  
  const [newJobSettings, setNewJobSettings] = useState({
    inputType: 'text' as const,
    model: 'veo-3.1-generate-preview',
    aspectRatio: '16:9' as const,
    outputCount: 1,
    inputImage: null as string | null
  });

  // Audio Generator (TTS Master) State
  const [ttsAiModel, setTtsAiModel] = useState('gemini-3.1-flash-tts-preview');
  const [ttsRegion, setTtsRegion] = useState('North');
  const [ttsStyle, setTtsStyle] = useState('Calm/Serene (Bình thản)');
  const [geminiVoice, setGeminiVoice] = useState('Puck');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(0);
  const [ttsText, setTtsText] = useState('');
  const [isTtsProcessing, setIsTtsProcessing] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsProgress, setTtsProgress] = useState(0);
  const [ttsMode, setTtsMode] = useState<'single' | 'multiple'>('single');
  const [conversationNodes, setConversationNodes] = useState<ConversationNode[]>([
    { id: 'node-1', speaker: 'Zephyr', text: '', style: 'Calm/Serene (Bình thản)', region: 'Default' },
    { id: 'node-2', speaker: 'Puck', text: '', style: 'Calm/Serene (Bình thản)', region: 'Default' },
  ]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ttsAiModels = [
    { id: 'gemini-2.5-flash-tts-preview', name: 'Gemini 2.5 Flash Preview TTS' },
    { id: 'gemini-2.5-pro-tts-preview', name: 'Gemini 2.5 Pro Preview TTS' },
    { id: 'gemini-3.1-flash-tts-preview', name: 'Gemini 3.1 Flash TTS Preview' },
  ];

  const geminiVoices = [
    // 🔹 Giọng Nữ (Female)
    { id: 'Zephyr', name: 'Zephyr – Sáng (Nữ - Trong trẻo)' },
    { id: 'Kore', name: 'Kore – Kiên quyết (Nữ - Mạnh mẽ)' },
    { id: 'Leda', name: 'Leda – Trẻ trung (Nữ - Trẻ)' },
    { id: 'Aoede', name: 'Aoede – Phóng khoáng (Nữ - Tự nhiên)' },
    { id: 'Callirrhoe', name: 'Callirrhoe – Dễ mến (Nữ - Thân thiện)' },
    { id: 'Autonoe', name: 'Autonoe – Tươi tắn (Nữ - Sáng)' },
    { id: 'Despina', name: 'Despina – Chỉnh chu (Nữ - Mượt mà)' },
    { id: 'Erinome', name: 'Erinome – Tinh tế (Nữ - Rõ ràng)' },
    { id: 'Laomedeia', name: 'Laomedeia – Sôi nổi (Nữ - Tích cực)' },
    { id: 'Achernar', name: 'Achernar – Nhẹ nhàng (Nữ - Mềm)' },
    { id: 'Gacrux', name: 'Gacrux – Chững chạc (Nữ - Trưởng thành)' },
    { id: 'Pulcherrima', name: 'Pulcherrima – Hướng ngoại (Nữ - Biểu cảm)' },
    { id: 'Vindemiatrix', name: 'Vindemiatrix – Dịu dàng (Nữ - Nhẹ nhàng)' },
    { id: 'Sulafat', name: 'Sulafat – Ấm áp (Nữ - Ấm)' },
    
    // 🔹 Giọng Nam (Male)
    { id: 'Puck', name: 'Puck – Sôi động (Nam - Năng lượng)' },
    { id: 'Charon', name: 'Charon – Trực diện (Nam - Chuyên nghiệp)' },
    { id: 'Fenrir', name: 'Fenrir – Hào khởi (Nam - Nhiệt tình)' },
    { id: 'Orus', name: 'Orus – Điềm đạm (Nam - Bình tĩnh)' },
    { id: 'Enceladus', name: 'Enceladus – Trầm lắng (Nam - Mềm)' },
    { id: 'Iapetus', name: 'Iapetus – Rành mạch (Nam - Rõ ràng)' },
    { id: 'Umbriel', name: 'Umbriel – Thong thả (Nam - Thư giãn)' },
    { id: 'Algieba', name: 'Algieba – Trôi chảy (Nam - Lưu loát)' },
    { id: 'Algenib', name: 'Algenib – Trầm khàn (Nam - Hơi khàn)' },
    { id: 'Rasalgethi', name: 'Rasalgethi – Truyền cảm (Nam - Kể chuyện)' },
    { id: 'Alnilam', name: 'Alnilam – Đĩnh đạc (Nam - Tự tin)' },
    { id: 'Schedar', name: 'Schedar – Đồng đều (Nam - Ổn định)' },
    { id: 'Achird', name: 'Achird – Gần gũi (Nam - Thân thiện)' },
    { id: 'Zubenelgenubi', name: 'Zubenelgenubi – Tự nhiên (Nam - Bình dân)' },
    { id: 'Sadachbia', name: 'Sadachbia – Hoạt bát (Nam - Sinh động)' },
    { id: 'Sadaltager', name: 'Sadaltager – Hiểu biết (Nam - Chuyên gia)' },
  ];

  const ttsRegions = ['Default', 'North', 'Hue', 'Central', 'South'];
  
  const ttsExpressions = [
    {
      category: "1. POSITIVE (NHÓM BIỂU CẢM TÍCH CỰC)",
      items: [
        { name: "Cheerful/Happy (Vui vẻ)", desc: "Giọng cao hơn bình thường, nhịp điệu nhanh, âm sắc sáng (bright)." },
        { name: "Excited/Enthusiastic (Hào hứng)", desc: "Tốc độ nhanh, nhấn mạnh vào các từ khóa, tông giọng cao, tràn đầy năng lượng." },
        { name: "Friendly/Warm (Thân thiện)", desc: "Giọng mềm mại, tông trầm ấm, tốc độ vừa phải, tạo cảm giác tin cậy." },
        { name: "Confident (Tự tin)", desc: "Giọng chắc chắn, rõ ràng, nhịp điệu ổn định, không ngập ngừng." },
        { name: "Inspirational/Encouraging (Truyền cảm hứng)", desc: "Giọng trầm ấm, tốc độ chậm rãi, có khoảng nghỉ ở các từ quan trọng để nhấn mạnh ý nghĩa." }
      ]
    },
    {
      category: "2. NEGATIVE/TENSE (NHÓM BIỂU CẢM TIÊU CỰC / CĂNG THẲNG)",
      items: [
        { name: "Sad (Buồn bã)", desc: "Tông giọng thấp, tốc độ chậm, thường có nhiều khoảng lặng, âm lượng nhỏ dần." },
        { name: "Angry/Aggressive (Tức giận)", desc: "Giọng đanh, âm lượng lớn, nhịp điệu dồn dập, nhấn mạnh mạnh bạo vào các âm tiết." },
        { name: "Anxious/Nervous (Lo lắng)", desc: "Giọng có thể hơi run, tốc độ nhanh hoặc không đều, thường ngập ngừng." },
        { name: "Fearful (Sợ hãi)", desc: "Giọng run, hơi thở gấp, âm vực không ổn định, đôi khi nhỏ dần như đang thì thầm." },
        { name: "Disappointed (Thất vọng)", desc: "Giọng trầm, kéo dài các từ cuối câu, thiếu năng lượng." }
      ]
    },
    {
      category: "3. NEUTRAL/PROFESSIONAL (NHÓM BIỂU CẢM TRUNG TÍNH / CHUYÊN NGHIỆP)",
      items: [
        { name: "Formal (Trang trọng)", desc: "Giọng chuẩn xác, tốc độ trung bình, không dùng từ ngữ luyến láy, cảm xúc phẳng (flat)." },
        { name: "Professional/Corporate (Chuyên nghiệp/Kinh doanh)", desc: "Ngữ điệu ổn định, rõ ràng, lịch sự, giống phát thanh viên." },
        { name: "Calm/Serene (Bình thản)", desc: "Giọng đều, êm dịu, không nhấn nhá quá mạnh, tạo cảm giác thư giãn." },
        { name: "Objective (Khách quan)", desc: "Giọng đều, không biểu lộ thái độ, dùng để đọc tin tức hoặc báo cáo." }
      ]
    },
    {
      category: "4. SPECIFIC CONTEXTS (NHÓM BIỂU CẢM ĐẶC THÙ)",
      items: [
        { name: "Whispering (Thì thầm)", desc: "Rất nhỏ, tạo cảm giác bí mật hoặc thân mật gần gũi." },
        { name: "Sarcastic (Mỉa mai)", desc: "Giọng điệu lên xuống thất thường, thường kéo dài các từ cuối để thể hiện sự châm chọc." },
        { name: "Mysterious/Eerie (Bí ẩn/Ma mị)", desc: "Giọng thì thầm hoặc trầm đục, nhịp điệu chậm, tạo cảm giác hồi hộp." },
        { name: "Sexy/Seductive (Quyến rũ)", desc: "Giọng trầm, hơi thở nhẹ (breathy), tốc độ chậm và nhịp nhàng." },
        { name: "Childlike (Trẻ con)", desc: "Giọng cao, ngọng nghịu hoặc hồn nhiên, nhịp điệu không theo quy tắc." }
      ]
    },
    {
      category: "5. CHARACTER ROLES (NHÓM ĐỘ TUỔI & ĐỐI TƯỢNG)",
      items: [
        { name: "Children (Trẻ em)", desc: "Giọng cao, trong trẻo, ngây thơ, lí lắc." },
        { name: "Young (Trẻ trung)", desc: "Giọng biến chuyển, năng động, có chút nổi loạn hoặc bồng bột." },
        { name: "Old person (Người già)", desc: "Giọng trầm, khàn, run rẩy, thong thả, mang vẻ từng trải, hiền từ hoặc nghiêm khắc." }
      ]
    },
    {
      category: "6. NARRATIVE STYLE (PHONG CÁCH KỂ CHUYỆN)",
      items: [
        { name: "Storytelling (Kể chuyện cổ tích)", desc: "Nhịp điệu chậm, uyển chuyển, có nhấn nhá như đưa người nghe vào thế giới tưởng tượng." },
        { name: "Creepy/Horror (Kinh dị/Ma mị)", desc: "Giọng thì thầm (whisper), trầm đục, bí hiểm, có những khoảng lặng bất ngờ, hù dọa." },
        { name: "News Anchor (Tin tức/Thời sự)", desc: "Giọng nghiêm túc, rõ chữ, tốc độ ổn định, âm vực trung tính (trung lập)." },
        { name: "Funny/Sarcastic (Hài hước/Châm biếm)", desc: "Giọng lém lỉnh, có nhấn nhá bất ngờ, lên xuống giọng tùy hứng." }
      ]
    },
    {
      category: "7. TECHNICAL SPECIFICATIONS & SOUND CHARACTERISTICS (ĐẶC ĐIỂM KỸ THUẬT & ĐẶC TRƯNG ÂM THANH)",
      items: [
        { name: "Raspy/Gravelly (Giọng khàn)", desc: "Có tiếng rung hoặc sạn trong cổ họng (tạo nét phong trần, bụi bặm)." },
        { name: "Nasal (Giọng mũi)", desc: "Thường dùng cho các nhân vật phản diện, lém lỉnh hoặc nhân vật hoạt hình vui nhộn." },
        { name: "Deep/Resonant (Giọng trầm ấm)", desc: "Giọng đầy đặn, độ vang cao (thường là giọng \"quý ông\" hoặc thuyết minh phim hành động)." },
        { name: "High-pitched (Giọng cao vút)", desc: "Dùng để diễn tả sự hốt hoảng, ngạc nhiên hoặc giọng nhân vật nhỏ bé." }
      ]
    }
  ];



  const concurrencyLimit = 4;
  const rateLimitPerMinute = 15;

  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  useEffect(() => {
    const checkApiKey = async () => {
      // Prioritize platform check if available
      if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setNeedsApiKey(!hasKey && !customApiKey);
      } else {
        // standalone web mode
        setNeedsApiKey(!customApiKey);
      }
    };
    checkApiKey();
  }, [customApiKey]);

  const handleOpenApiKeyDialog = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      setNeedsApiKey(!hasKey && !customApiKey);
    } else {
      setIsApiKeyModalOpen(true);
    }
  };

  const saveCustomApiKey = (key: string) => {
    setCustomApiKey(key);
    if (key) {
      localStorage.setItem('user_api_key', key);
      setNeedsApiKey(false);
    } else {
      localStorage.removeItem('user_api_key');
      setNeedsApiKey(true);
    }
    setIsApiKeyModalOpen(false);
  };

  const getEffectiveApiKey = () => {
    return customApiKey || process.env.GEMINI_API_KEY || '';
  };

  const getAutoResolution = (ratio: string) => {
    switch(ratio) {
      case '1:1': return '1080x1080 (1:1)';
      case '4:3': return '1440x1080 (4:3)';
      case '9:16': return '1080x1920 (9:16)';
      case '16:9': return '1920x1080 (16:9)';
      default: return '1920x1080 (16:9)';
    }
  };

  const getResolutionDisplay = () => {
    // Exact mapping for requested ratios at 1080p base (AUTO/1080p)
    const ratioMap: { [key: string]: { w: number, h: number } } = {
      '1:1': { w: 1080, h: 1080 },
      '4:3': { w: 1440, h: 1080 },
      '9:16': { w: 1080, h: 1920 },
      '16:9': { w: 1920, h: 1080 }
    };

    const base = ratioMap[aspectRatio] || { w: 1920, h: 1080 };

    let dims = `${base.w}x${base.h}`;
    if (resolution === '4K') {
      dims = `${base.w * 2}x${base.h * 2}`;
    } else if (resolution === '720p') {
      dims = `${Math.round(base.w * 2 / 3)}x${Math.round(base.h * 2 / 3)}`;
    }

    return `${dims} (${aspectRatio})`;
  };

  const calculateCost = () => {
    const resMultiplier = resolution === '4K' ? 2.5 : (resolution === '1080p' || resolution === 'AUTO') ? 1 : 0.5;
    const baseCost = 0.02;
    const totalUSD = baseCost * resMultiplier * resultCount;
    const totalVND = totalUSD * 25450;
    return { usd: totalUSD.toFixed(3), vnd: Math.round(totalVND).toLocaleString() };
  };

  const calculateVideoQueueCost = () => {
    const baseCostPerVideo = 0.50; // Estimated $0.50 per video for Veo
    const totalVideos = videoJobs.reduce((acc, job) => acc + job.outputCount, 0);
    const totalUSD = baseCostPerVideo * totalVideos;
    const totalVND = totalUSD * 25450;
    return { usd: totalUSD.toFixed(2), vnd: Math.round(totalVND).toLocaleString(), count: totalVideos };
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadDoc = async () => {
    if (!generatedScript) return;

    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Số TT/Phân cảnh", bold: true, font: "Calibri", size: 18 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Thời gian (8 giây)", bold: true, font: "Calibri", size: 18 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Mô tả kịch bản chi tiết", bold: true, font: "Calibri", size: 18 })] })] }),
          ...(scriptType === 'Whisk' 
            ? [
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Prompt tạo ảnh (Whisk AI)", bold: true, font: "Calibri", size: 18 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Prompt tạo chuyển động (Veo 3.1)", bold: true, font: "Calibri", size: 18 })] })] })
              ]
            : [
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Prompt tạo video (Veo 3.1)", bold: true, font: "Calibri", size: 18 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Prompt tạo video (JSON-Veo 3.1)", bold: true, font: "Calibri", size: 18 })] })] })
              ]
          )
        ],
      }),
    ];

    generatedScript.scenes.forEach((scene) => {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(scene.id), font: "Calibri", size: 18 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: scene.time, font: "Calibri", size: 18 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: scene.description, font: "Calibri", size: 18 })] })] }),
            ...(scriptType === 'Whisk' 
              ? [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: scene.whiskPrompt || "", font: "Calibri", size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: scene.movementPrompt || "", font: "Calibri", size: 18 })] })] })
                ]
              : [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: scene.videoPrompt || "", font: "Calibri", size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: scene.jsonVideoPrompt || "", font: "Calibri", size: 18 })] })] })
                ]
            )
          ],
        })
      );
    });

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: "Calibri",
              size: 18,
            },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            size: {
              orientation: "landscape",
            },
          },
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: "VIDEO SCRIPT IDEA", bold: true, size: 18, font: "Calibri" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Idea: ${userIdea}`, italics: true, font: "Calibri", size: 18 })],
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "STORY OVERVIEW", bold: true, underline: {}, font: "Calibri", size: 18 })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: generatedScript.overview, font: "Calibri", size: 18 })],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "STORYBOARD", bold: true, underline: {}, font: "Calibri", size: 18 })],
            spacing: { after: 200 },
          }),
          new DocxTable({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Video_Script_${Date.now()}.docx`);
  };

  const handlePromptGenerate = async () => {
    if (!userIdea.trim()) return;
    
    if (needsApiKey) {
      alert('Vui lòng chọn API Key để tiếp tục sử dụng dịch vụ.');
      await handleOpenApiKeyDialog();
      return;
    }

    setIsProcessingPrompt(true);
    try {
      const ai = new GoogleGenAI({ apiKey: getEffectiveApiKey() });
      
      const promptInstructions = scriptType === 'Whisk' 
        ? `- "Tổng quan kịch bản:" Tóm tắt ngắn gọn cốt truyện.
           - "Bảng phân cảnh:" Trình bày dưới dạng bảng với 5 cột bắt buộc:
             1. "Số TT/Phân cảnh"
             2. "Thời gian (8 giây)": mỗi cảnh 8 giây.
             3. "Mô tả kịch bản chi tiết": mô tả [Bối cảnh & môi trường], [Khối Dữ liệu Nhân vật], [Cỡ cảnh, Góc máy & chuyển động], [Hành động/Biểu cảm], [Ánh sáng/Màu sắc], [Chất lượng kỹ thuật/Phong cách], [Lời dẫn truyện/Lời thoại của từng nhân vật].
             4. "Prompt tạo ảnh (Whisk AI)": Detailed English prompt, optimized for 4K/3D Pixar/Animate/Cartoon/Cinematic/Hyper-realistic. Structure:
                [Scene: [describe the scene content], Environment: [location, time, lighting, weather]]
                [Subject: (one or more characters),
                Character: [Name, Gender, Age],
                Body shape: [height, proportions],
                Face: [shape, skin tone, eyes, eyebrows, expression (Friendly/Happy)],
                Hair: [color, style],
                Accessories: [watch, glasses, bag, etc.],
                Outfit: (MUST REMAIN CONSISTENT): [description of shirt, jacket, pants, shoes],
                Personality: [Active, curious, friendly, clear expressions],
                Style: [3D Pixar style, smooth skin, soft lighting, stable proportions, high detail],
                Voice: [pitch, quality, accent, speed, expression]]
                -- Keep character design unchanged, do not alter outfit, do not modify facial features, maintain full consistency throughout --
                Character consistency: insert the above Subject description into all prompts of every scene.
                [Camera: Shot size: [EWS/WS/MS/CU/ECU], Angle: [eye level/low angle/high angle/dutch angle/bird view], Lens: [24mm/35mm/50mm/85mm/cinematic], Focus: [rack focus/deep focus/shallow depth of field]]
                [Action: [what the character is doing]]
                [Emotion: [emotion + facial expression]]
                [Style: [Pixar-style 3D animation, cinematic, ultra-detailed, high quality, global illumination, soft shadows, volumetric light]]
             5. "Prompt tạo chuyển động (Veo 3.1)": English prompt describing motion and effects. Structure:
                [Camera: Movement: [static / zoom / pan / tilt / dolly / truck / crane / boom / tracking / handheld / gimbal]]
                [Action: [human action - detailed gestures], Dialogue (Character Name & Lip-sync): [" (Vietnamese text) "]]
                [Emotion: [emotion + facial expression]]
                [Style: [Pixar-style 3D animation, cinematic, ultra-detailed, high quality, global illumination, soft shadows, volumetric light]] No Subtitle`
        : `- "Tổng quan kịch bản:" Tóm tắt ngắn gọn cốt truyện.
           - "Bảng phân cảnh:" Trình bày dưới dạng bảng với 5 cột bắt buộc:
             1. "Số TT/Phân cảnh"
             2. "Thời gian (8 giây)": mỗi cảnh 8 giây.
             3. "Mô tả kịch bản chi tiết": mô tả [Bối cảnh & môi trường], [Khối Dữ liệu Nhân vật], [Cỡ cảnh, Góc máy & chuyển động], [Hành động/Biểu cảm], [Ánh sáng/Màu sắc], [Chất lượng kỹ thuật/Phong cách], [Lời dẫn truyện/Lời thoại của từng nhân vật].
             4. "Prompt tạo video (Veo 3.1)": Detailed descriptive English prompt. Structure:
                [Scene: [describe scene], Environment: [location, time, lighting, weather]]
                [Subject: (one or more characters),
                Character: [Name, Gender, Age],
                Body shape: [height, proportions],
                Face: [shape, skin tone, eyes, eyebrows, expression],
                Hair: [color, style],
                Accessories: [items],
                Outfit: (MUST REMAIN CONSISTENT): [shirt, jacket, pants, shoes],
                Personality: [attributes],
                Style: [3D Pixar style, high detail],
                Voice: [attributes]]
                -- Keep character design consistent throughout --
                [Camera: Shot size: [EWS/WS/MS/CU/ECU], Angle: [angle types], Lens: [lens types], Focus: [focus types], Movement: [movement types]]
                [Action: [detailed action], Dialogue (Character Name & Lip-sync): [" (Vietnamese text) "]]
                [Emotion: [emotion + facial expression]]
                [Style: [Pixar-style 3D animation, cinematic, high quality]] No Subtitle
              5. "Prompt tạo video (JSON-Veo 3.1)": Identical content to the descriptive prompt above but formatted as a standard JSON object for Veo 3.1. Structure:
                [Scene: [describe scene], Environment: [location, time, lighting, weather]]
                [Subject: (one or more characters),
                Character: [Name, Gender, Age],
                Body shape: [height, proportions],
                Face: [shape, skin tone, eyes, eyebrows, expression],
                Hair: [color, style],
                Accessories: [items],
                Outfit: (MUST REMAIN CONSISTENT): [shirt, jacket, pants, shoes],
                Personality: [attributes],
                Style: [3D Pixar style, high detail],
                Voice: [attributes]]
                -- Keep character design consistent throughout --
                [Camera: Shot size: [EWS/WS/MS/CU/ECU], Angle: [angle types], Lens: [lens types], Focus: [focus types], Movement: [movement types]]
                [Action: [detailed action], Dialogue (Character Name & Lip-sync): [" (Vietnamese text) "]]
                [Emotion: [emotion + facial expression]]
                [Style: [Pixar-style 3D animation, cinematic, high quality]] No Subtitle`;

      const jsonFields = scriptType === 'Whisk'
        ? `"whiskPrompt": "Detailed English prompt for image generation following the structure provided", "movementPrompt": "English prompt for movement following the structure provided"`
        : `"videoPrompt": "Detailed descriptive English prompt for video generation following the structure provided", "jsonVideoPrompt": "Standard JSON-formatted prompt for Veo 3.1 following the structure provided"`;

      const promptText = `
        You are an "AI Video Script and Prompt Expert". 
        Task: Analyze the user's idea, ${numberOfScenes === 0 ? "determine the optimal number of scenes to cover the story appropriately (not too many, not too few)" : `divide it into exactly ${numberOfScenes} scenes`} of 8 seconds each.
        
        Selected Style: ${promptStyle}
        Target Aspect Ratio: ${promptAspectRatio} (Full HD Quality 1080p)
        
        User Idea: ${userIdea}
        Number of Scenes: ${numberOfScenes === 0 ? "Auto (determined by AI)" : numberOfScenes}
        Total Duration: ${numberOfScenes === 0 ? "Determined by AI" : `${numberOfScenes * 8}s`}
        Script Type: ${scriptType === 'Whisk' ? 'Image to Video (Whisk)' : 'Text to Video (Json)'}
        
        Rules:
        - Each scene MUST be exactly 8 seconds.
        ${numberOfScenes === 0 ? `- The first scene MUST be an Extremely Wide Shot (EWS), Bird eye view angle, with Dolly movement (for the opening).
        - The last scene MUST be a Wide Shot (WS) for the ending.` : `- Total scenes MUST be exactly ${numberOfScenes}.`}
        - Overview summary in Vietnamese.
        - Storyboard scenes with "Mô tả kịch bản chi tiết" (Vietnamese) following the specific structure provided.
        - Visual prompts MUST strictly follow the selected style: ${promptStyle}.
        - CHARACTER CONSISTENCY: For all prompts, the character description (Subject) MUST be detailed and identical across all scene prompts.
        - DIALOGUE & LIP-SYNC: For each scene, you MUST include character dialogue in English prompts for "Prompt tạo chuyển động (Veo 3.1)", "Prompt tạo video (Veo 3.1)", and "Prompt tạo video (JSON-Veo 3.1)". Format: [Dialogue (Character Name): "Vietnamese dialogue text inside quotes"] and explicitly state that the character's lips must sync with the speech. The dialogue itself MUST be in Vietnamese.
        - NO SUBTITLE: You MUST add the phrase "No Subtitle" at the very end of every English prompt for "Prompt tạo chuyển động (Veo 3.1)", "Prompt tạo video (Veo 3.1)", and "Prompt tạo video (JSON-Veo 3.1)".
        ${promptInstructions}
        
        Return ONLY a JSON object with this EXACT structure:
        {
          "overview": "Tóm tắt cốt truyện ngắn gọn tại đây",
          "scenes": [
            {
              "id": 1,
              "time": "8s",
              "description": "[Bối cảnh & môi trường]... [Khối Dữ liệu Nhân vật]... [Cỡ cảnh, Góc máy & chuyển động]... [Hành động/Biểu cảm]... [Ánh sáng/Màu sắc]... [Chất lượng kỹ thuật/Phong cách]",
              ${jsonFields}
            }
          ]
        }
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = result.text || "";
      try {
        const parsed = JSON.parse(text);
        setGeneratedScript(parsed);
      } catch (e) {
        // Fallback to regex if JSON.parse fails (e.g. if AI includes markdown backticks despite JSON mode)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            setGeneratedScript(parsed);
          } catch (innerError) {
             throw new Error("Could not parse extracted JSON from AI response");
          }
        } else {
          throw new Error("Could not find valid JSON in AI response");
        }
      }
    } catch (err: any) {
      console.error("Prompt generation error:", err);
      const errorMsg = err.message || '';
      if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not found') || errorMsg.includes('403') || errorMsg.includes('401')) {
        setNeedsApiKey(true);
        alert('API Key không hợp lệ hoặc đã hết hạn. Vui lòng chọn lại API Key từ dự án Google Cloud có trả phí để tiếp tục.');
      } else {
        alert("Lỗi khi tạo kịch bản: " + (err.message || "Dịch vụ hiện không khả dụng"));
      }
    } finally {
      setIsProcessingPrompt(false);
    }
  };

  const handleImageUpload = (index: number, type: 'character' | 'background') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const url = readerEvent.target?.result as string;
          if (type === 'character') {
            const newImages = [...characterImages];
            newImages[index] = url;
            setCharacterImages(newImages);
          } else {
            setBackgroundImage(url);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleHeaderLogoUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          setHeaderLogo(readerEvent.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const addConversationNode = () => {
    const lastNode = conversationNodes[conversationNodes.length - 1];
    const newSpeaker = lastNode ? (lastNode.speaker === 'Zephyr' ? 'Puck' : 'Zephyr') : 'Zephyr';
    setConversationNodes([...conversationNodes, { 
      id: `node-${Date.now()}`, 
      speaker: newSpeaker, 
      text: '', 
      style: ttsStyle,
      region: ttsRegion
    }]);
  };

  const removeConversationNode = (id: string) => {
    if (conversationNodes.length <= 1) return;
    setConversationNodes(conversationNodes.filter(n => n.id !== id));
  };

  const updateConversationNode = (id: string, updates: Partial<ConversationNode>) => {
    setConversationNodes(conversationNodes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const handleGenerate = async () => {
    if (needsApiKey) {
      alert('Vui lòng chọn API Key để tiếp tục sử dụng dịch vụ.');
      await handleOpenApiKeyDialog();
      return;
    }

    setIsGenerating(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: getEffectiveApiKey() });
      
      const currentDims = getResolutionDisplay();
      
      // Map simplified labels to actual Gemini Image models
      const modelMapping: { [key: string]: string } = {
        'Nano Banana': 'gemini-3.1-flash-image-preview',
        'Nano Banana 2': 'gemini-2.5-flash-image',
        'Nano Banana Pro': 'gemini-3.1-pro-image-preview'
      };
      
      const activeModel = modelMapping[imageModel] || 'gemini-3.1-flash-image-preview';
      
      const fullPrompt = `${imagePrompt}. Style: ${selectedStyle}. Resolution: ${currentDims}.`;
      const parts: any[] = [{ text: fullPrompt }];

      // Add character references
      characterImages.forEach((img, idx) => {
        if (img && selectedCharacters[idx]) {
          parts.push({
            inlineData: {
              data: img.split(',')[1],
              mimeType: 'image/png'
            }
          });
          parts.push({ text: `This is reference image for Character ${idx + 1}. Ensure consistency.` });
        }
      });

      // Add background reference
      if (backgroundImage && useBackground) {
        parts.push({
          inlineData: {
            data: backgroundImage.split(',')[1],
            mimeType: 'image/png'
          }
        });
        parts.push({ text: "Use this as the background context. Keep the background consistent." });
      }

      // Generate multiple images based on resultCount
      const generationPromises = Array.from({ length: resultCount }).map(() => 
        ai.models.generateContent({
          model: activeModel,
          contents: [{ parts }],
          config: {
            imageConfig: {
              aspectRatio: aspectRatio as any,
              imageSize: resolution === '4K' ? '4K' : (resolution === '1080p' || resolution === 'AUTO') ? '1K' : '512px'
            }
          }
        })
      );

      const responses = await Promise.all(generationPromises);
      const newImages: string[] = [];

      responses.forEach(response => {
        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              newImages.push(`data:image/png;base64,${part.inlineData.data}`);
            }
          }
        }
      });

      if (newImages.length === 0) {
        throw new Error("No images generated");
      }

      setGeneratedImages(newImages);
    } catch (error: any) {
      console.error('Generation failed:', error);
      
      const errorMsg = error.message || '';
      if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not found') || errorMsg.includes('403') || errorMsg.includes('401')) {
        setNeedsApiKey(true);
        alert('API Key không hợp lệ hoặc đã hết hạn. Vui lòng chọn lại API Key từ dự án Google Cloud có trả phí để tiếp tục.');
        return;
      }
      
      // Dynamic dimensions for mock images
      const resDisplay = getResolutionDisplay();
      const [w, h] = resDisplay.split('x');
      
      const mockImages = Array.from({ length: resultCount }, (_, i) => 
        `https://picsum.photos/seed/${Math.random() + i}/${w}/${h}`
      );

      setGeneratedImages(mockImages);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `QP-AI-Studio-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = 'image.jpg';
      link.click();
    }
  };

  const handleVideoDownload = async (url: string, jobId: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `QP-Video-${jobId}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Video download failed:', error);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = `video-${jobId}.mp4`;
      link.click();
    }
  };

  // --- Video Generator Logic ---
  
  useEffect(() => {
    if (!isQueueRunning) return;

    const processQueue = async () => {
      const activeJobsCount = videoJobs.filter(j => j.status === 'processing').length;
      const availableSlots = concurrencyLimit - activeJobsCount;
      
      if (availableSlots <= 0) return;

      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const recentStartsCount = processingHistory.filter(time => time > oneMinuteAgo).length;
      const allowedToStart = rateLimitPerMinute - recentStartsCount;

      if (allowedToStart <= 0) return;

      const pendingJobs = videoJobs.filter(j => j.status === 'pending');
      if (pendingJobs.length === 0) {
        if (activeJobsCount === 0) setIsQueueRunning(false);
        return;
      }

      // Determine how many jobs to start in this batch
      const batchSize = Math.min(availableSlots, allowedToStart, pendingJobs.length);
      const jobsToStart = pendingJobs.slice(0, batchSize);

      if (jobsToStart.length > 0) {
        // Start the jobs in the state
        const startTimes = jobsToStart.map(() => Date.now());
        setProcessingHistory(prev => [...prev, ...startTimes]);
        
        setVideoJobs(prev => prev.map(j => {
          const startingJob = jobsToStart.find(js => js.id === j.id);
          if (startingJob) {
            return { ...j, status: 'processing', startedAt: Date.now() };
          }
          return j;
        }));

        // Trigger the actual API calls
        jobsToStart.forEach(job => processVideoJob(job.id));
      }
    };

    const interval = setInterval(processQueue, 1500); // Slightly faster polling
    return () => clearInterval(interval);
  }, [isQueueRunning, videoJobs, processingHistory]);

  const processVideoJob = async (jobId: string) => {
    try {
      const job = videoJobs.find(j => j.id === jobId);
      if (!job) return;

      const apiKey = getEffectiveApiKey();
      const ai = new GoogleGenAI({ apiKey });
      
      const config: any = {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio: job.aspectRatio
      };

      const videoParams: any = {
        model: job.model,
        prompt: job.prompt,
        config
      };

      // Handle Image or Frame input for Veo
      if ((job.inputType === 'image' || job.inputType === 'frame') && job.inputImage) {
        // Detect MIME type from data URL
        const match = job.inputImage.match(/^data:(image\/[a-z]+);base64,/);
        const mimeType = match ? match[1] : 'image/png';
        
        videoParams.image = {
          imageBytes: job.inputImage.split(',')[1],
          mimeType: mimeType
        };
      }

      let operation = await ai.models.generateVideos(videoParams);

      // Special handling for operation monitoring
      if (!operation || !operation.name) {
         throw new Error("Invalid API response: video generation operation failed to initialize");
      }

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        const nextOp = await ai.operations.getVideosOperation({ operation: operation } as any);
        if (!nextOp) {
          throw new Error("Failed to poll operation status: no response from API");
        }
        operation = nextOp;
      }

      const generatedVideo = operation.response?.generatedVideos?.[0]?.video;
      if (generatedVideo?.uri) {
        // Fetch the video with the API key header
        const response = await fetch(generatedVideo.uri, {
          method: 'GET',
          headers: {
            'x-goog-api-key': apiKey,
          },
        });
        
        if (!response.ok) {
          const fetchErrorBody = await response.text().catch(() => '');
          throw new Error(`Failed to fetch video content: ${response.statusText}${fetchErrorBody ? ' - ' + fetchErrorBody : ''}`);
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        setVideoJobs(prev => prev.map(j => 
          j.id === jobId ? { 
            ...j, 
            status: 'completed', 
            resultUrl: blobUrl, 
            completedAt: Date.now() 
          } : j
        ));
      } else {
        const opError = (operation as any).error;
        let errorContext = "";
        
        // Check for safety filter results which might cause missing video
        const safetyResults = (operation.response?.generatedVideos?.[0]?.video as any)?.safetyFilterResults;
        if (safetyResults) {
          errorContext = " Potentially triggered safety filters.";
        }

        const errorMessage = opError?.message || (opError?.code ? `Error Code: ${opError.code}` : "Video generation failed without explicit error message from API.") + errorContext;
        throw new Error(errorMessage);
      }

    } catch (error: any) {
      console.error(`Job ${jobId} failed:`, error);
      const errorMsg = error.message || '';
      if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not found') || errorMsg.includes('403') || errorMsg.includes('401')) {
        setNeedsApiKey(true);
      }
      setVideoJobs(prev => prev.map(j => 
        j.id === jobId ? { 
          ...j, 
          status: 'failed', 
          error: error.message || "An unknown error occurred" 
        } : j
      ));
    }
  };

  const handleBulkSubmit = async () => {
    if (needsApiKey) {
      alert('Vui lòng chọn API Key để tiếp tục sử dụng dịch vụ.');
      await handleOpenApiKeyDialog();
      return;
    }

    const prompts = bulkPrompts.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    if (prompts.length === 0) return;

    const newJobs: VideoJob[] = prompts.map((prompt, i) => ({
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      prompt,
      inputType: newJobSettings.inputType,
      model: newJobSettings.model,
      aspectRatio: newJobSettings.aspectRatio,
      outputCount: newJobSettings.outputCount,
      inputImage: newJobSettings.inputImage || undefined,
      status: 'pending',
      createdAt: Date.now()
    }));

    setVideoJobs(prev => [...prev, ...newJobs]);
    setBulkPrompts('');
    setIsQueueRunning(true);
  };

  // Audio Generator (TTS Master) Handlers
  const handleTtsFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setTtsText(result.value);
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
        }
        setTtsText(fullText);
      } else {
        alert('Vui lòng chọn file .pdf hoặc .docx');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Lỗi khi xử lý file. Vui lòng thử lại.');
    }
  };

  const calculateTtsCost = (text: string) => {
    // Ước tính chi phí dựa trên số ký tự (giá định $0.01 cho 5000 ký tự)
    const charCount = text.length;
    const usd = (charCount / 5000) * 0.01;
    const vnd = usd * 25400;
    return { usd: usd.toFixed(4), vnd: Math.round(vnd).toLocaleString('vi-VN') };
  };

  const callGeminiTtsApi = async (text: string, overrideVoice?: string, overrideStyle?: string, overrideRegion?: string) => {
    const ai = new GoogleGenAI({ apiKey: getEffectiveApiKey() });
    
    // Choose voice, style and region
    const activeVoice = overrideVoice || geminiVoice;
    const activeStyle = overrideStyle || ttsStyle;
    const activeRegion = overrideRegion || ttsRegion;

    // Tạo prompt mô tả giọng điệu vùng miền
    let regionPrompt = '';
    if (activeRegion === 'Default') {
      regionPrompt = 'Giọng đọc gốc, tự nhiên nhất của AI.';
    } else if (activeRegion === 'North') {
      regionPrompt = 'Giọng Hà Nội, miền Bắc Việt Nam chuẩn.';
    } else if (activeRegion === 'Hue') {
      regionPrompt = 'Giọng Huế, miền Trung Việt Nam đặc trưng.';
    } else if (activeRegion === 'Central') {
      regionPrompt = 'Giọng Bình Định và Phú Yên, miền Trung Việt Nam.';
    } else if (activeRegion === 'South') {
      regionPrompt = 'Giọng Cà Mau, miền Tây Nam Bộ Việt Nam.';
    }

    const speedText = ttsSpeed === 1 ? 'tốc độ bình thường' : `tốc độ ${ttsSpeed}x`;
    const pitchText = ttsPitch === 0 ? 'tông giọng trung bình' : `tông giọng (độ cao) ${ttsPitch > 0 ? '+' : ''}${ttsPitch}`;
    
    const fullPrompt = `Hãy đóng vai là một người kể chuyện chuyên nghiệp. Đọc đoạn văn bản sau đây với các yêu cầu:
- Giọng đọc: ${activeVoice}
- Vùng miền/Accent: ${regionPrompt}
- Phong cách/Cảm xúc: ${activeStyle}
- ${speedText}
- ${pitchText}
- Cảm xúc: Diễn cảm, trôi chảy, đúng sắc thái ${activeStyle} và ngữ điệu ${activeRegion}.

Nội dung văn bản:
"${text}"`;

    const response = await ai.models.generateContent({
      model: ttsAiModel,
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: activeVoice },
          },
        },
      },
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('AI không hỗ trợ hoặc gặp lỗi khi tạo âm thanh cho model này.');
    }
    
    return base64Audio;
  };

  const createWavHeader = (pcmLength: number) => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;

    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + pcmLength, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM - integer
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, pcmLength, true);

    return new Uint8Array(header);
  };

  const handleTtsConvert = async (previewOnly = false) => {
    if (ttsMode === 'single' && !ttsText.trim()) {
      alert('Vui lòng nhập văn bản hoặc tải file');
      return;
    }
    if (ttsMode === 'multiple' && conversationNodes.every(n => !n.text.trim())) {
      alert('Vui lòng nhập nội dung cho ít nhất một hội thoại');
      return;
    }

    if (needsApiKey) {
      alert('Vui lòng chọn API Key để tiếp tục sử dụng dịch vụ.');
      await handleOpenApiKeyDialog();
      return;
    }

    setIsTtsProcessing(true);
    setTtsProgress(0);
    setTtsAudioUrl(null);

    try {
      if (ttsMode === 'multiple') {
        const audioContents: Uint8Array[] = [];
        const activeNodes = conversationNodes.filter(n => n.text.trim().length > 0);
        
        for (let i = 0; i < activeNodes.length; i++) {
          const node = activeNodes[i];
          setTtsProgress(Math.round((i / activeNodes.length) * 100));
          
          const base64 = await callGeminiTtsApi(node.text, node.speaker, node.style, node.region);
          const binaryString = window.atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          audioContents.push(bytes);
        }

        const totalPcmLength = audioContents.reduce((acc, curr) => acc + curr.length, 0);
        const wavHeader = createWavHeader(totalPcmLength);
        const combinedBlob = new Blob([wavHeader, ...audioContents], { type: 'audio/wav' });
        const url = URL.createObjectURL(combinedBlob);
        setTtsAudioUrl(url);
        setTtsProgress(100);
      } else {
        // Single Speaker Mode
        let textToProcess = ttsText;
        if (previewOnly) {
          const sentences = ttsText.split(/[.!?]/).filter(s => s.trim().length > 0);
          textToProcess = sentences.slice(0, 2).join('. ') + (sentences.length > 0 ? '.' : '');
        }

        // Chunking logic
        const chunks: string[] = [];
        const maxChars = 3000; 
        let currentChunk = '';
        
        const sentences = textToProcess.match(/[^.!?]+[.!?]*/g) || [textToProcess];
        
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length > maxChars) {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = sentence;
          } else {
            currentChunk += sentence;
          }
        }
        if (currentChunk) chunks.push(currentChunk);

        const audioContents: Uint8Array[] = [];
        for (let i = 0; i < chunks.length; i++) {
            setTtsProgress(Math.round((i / chunks.length) * 100));
            const base64 = await callGeminiTtsApi(chunks[i]);
            
            const binaryString = window.atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
              bytes[j] = binaryString.charCodeAt(j);
            }
            audioContents.push(bytes);
        }

        const totalPcmLength = audioContents.reduce((acc, curr) => acc + curr.length, 0);
        const wavHeader = createWavHeader(totalPcmLength);
        const combinedBlob = new Blob([wavHeader, ...audioContents], { type: 'audio/wav' });
        const url = URL.createObjectURL(combinedBlob);
        setTtsAudioUrl(url);
        setTtsProgress(100);
      }
    } catch (error: any) {
      console.error('TTS Conversion error:', error);
      const errorMsg = error.message || '';
      if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not found') || errorMsg.includes('403') || errorMsg.includes('401')) {
        setNeedsApiKey(true);
        alert('API Key không hợp lệ hoặc đã hết hạn. Vui lòng chọn lại API Key từ dự án Google Cloud có trả phí để tiếp tục.');
      } else {
        alert(`Lỗi chuyển đổi: ${error.message || 'Dịch vụ hiện không khả dụng'}`);
      }
    } finally {
      setIsTtsProcessing(false);
    }
  };

  const handlePreviewVoice = async () => {
    setIsTtsProcessing(true);
    setTtsProgress(0);
    try {
      const voiceName = geminiVoices.find(v => v.id === geminiVoice)?.name || geminiVoice;
      const regionMap: { [key: string]: string } = {
        'Default': ' tự nhiên',
        'North': ' Bắc bộ Việt Nam',
        'Hue': ' Huế Việt Nam ',
        'Central': ' Trung bộ Việt Nam ',
        'South': ' Nam bộ Việt Nam'
      };
      const regionPart = regionMap[ttsRegion] || ' tự nhiên';
      const previewText = `Đây là bản nghe thử cho giọng ${voiceName} với âm hưởng${regionPart} phong cách ${ttsStyle}.`;
      
      const base64 = await callGeminiTtsApi(previewText);
      const binaryString = window.atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([createWavHeader(bytes.length), bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      setTtsAudioUrl(url);
      setTtsProgress(100);
    } catch (error) {
       console.error('Preview error:', error);
       alert('Lỗi khi nghe thử giọng.');
    } finally {
      setIsTtsProcessing(false);
    }
  };

  const handleDownloadTts = (format: 'mp3' | 'wav') => {
    if (!ttsAudioUrl) return;
    const link = document.createElement('a');
    link.href = ttsAudioUrl;
    link.download = `TTS_Master_${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRetryJob = (jobId: string) => {
    setVideoJobs(prev => prev.map(j => 
      j.id === jobId ? { ...j, status: 'pending', error: undefined, startedAt: undefined, completedAt: undefined } : j
    ));
    setIsQueueRunning(true);
  };

  const handleDeleteJob = (jobId: string) => {
    setVideoJobs(prev => prev.filter(j => j.id !== jobId));
  };

  const handleDownloadAllVideos = async () => {
    const completed = videoJobs.filter(j => j.status === 'completed' && j.resultUrl);
    for (const job of completed) {
      if (job.resultUrl) {
        const link = document.createElement('a');
        link.href = job.resultUrl;
        link.download = `video-${job.id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise(r => setTimeout(r, 500)); 
      }
    }
  };

  const handleVideoInputImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          setNewJobSettings(prev => ({ ...prev, inputImage: readerEvent.target?.result as string }));
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const scrollToSection = (id: string) => {
    const element = sectionRefs.current[id];
    if (element) {
      const offset = 150; // Updated for new header height
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    setActiveSection(id);
  };

  const addSection = () => {
    if (newSectionTitle.trim()) {
      const id = newSectionTitle.toLowerCase().replace(/\s+/g, '-');
      setSections([...sections, { id, title: newSectionTitle }]);
      setNewSectionTitle('');
      setIsAddModalOpen(false);
    }
  };

  const deleteSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
    setIsDeleteModalOpen(false);
  };

  // Intersection Observer to update active menu item on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Use a smaller threshold or just check if it enters the 'active zone'
          // The active zone starts after the header (reduced to approx 140px)
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { 
        threshold: 0, 
        rootMargin: '-160px 0px -70% 0px' 
      }
    );

    sections.forEach((section) => {
      const el = sectionRefs.current[section.id];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="min-h-screen bg-main-bg text-text-primary selection:bg-accent selection:text-main-bg">
      {/* Header */}
      <header className="sticky top-0 z-[100] w-full min-h-[150px] border-b border-border-subtle bg-secondary-bg flex flex-col md:flex-row shadow-2xl">
        {/* Left Column (Logo Branding) */}
        <div className="min-w-[350px] min-h-[150px] h-auto border-r border-border-subtle bg-black/40 flex items-center justify-center px-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              backgroundPosition: ["0% center", "200% center"],
              textShadow: [
                "0 0 10px rgba(0, 136, 255, 0.5)",
                "0 0 25px rgba(0, 136, 255, 0.8)",
                "0 0 10px rgba(0, 136, 255, 0.5)"
              ]
            }}
            transition={{
              opacity: { duration: 1 },
              scale: { duration: 1 },
              backgroundPosition: {
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              },
              textShadow: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
            className="text-[44px] font-display font-black italic tracking-tighter text-transparent bg-clip-text whitespace-nowrap bg-gradient-to-r from-[#0088ff] via-[#66ccff] to-[#0088ff] bg-[length:200%_auto] cursor-pointer"
            whileHover={{ 
              scale: 1.15, 
              filter: "brightness(1.5)",
              textShadow: "0 0 35px rgba(0, 136, 255, 0.9)"
            }}
          >
            P-ToonGo
          </motion.div>
        </div>

        {/* Title & Menu Column */}
        <div className="flex-1 flex flex-col">
          {/* Title Row */}
          <div className="min-h-[100px] flex flex-col items-center justify-center border-b border-border-subtle px-10 py-[10px] gap-2">
            <motion.h2 
              className="text-[65px] font-brush italic tracking-wide leading-none text-transparent bg-clip-text bg-gradient-to-r from-[#CC33FF] via-[#EE88FF] to-[#CC33FF] bg-[length:200%_auto]"
              animate={{ 
                backgroundPosition: ["0% center", "200% center"],
                textShadow: [
                  "0 0 10px rgba(204, 51, 255, 0.4)",
                  "0 0 25px rgba(204, 51, 255, 0.7)",
                  "0 0 10px rgba(204, 51, 255, 0.4)"
                ]
              }}
              transition={{
                backgroundPosition: {
                  duration: 4,
                  repeat: Infinity,
                  ease: "linear"
                },
                textShadow: {
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
            >
              Toon and Go together
            </motion.h2>
            <p 
              className="text-[20px] font-display font-bold uppercase tracking-[8px]"
              style={{ 
                color: '#33FF33', 
                textShadow: '0 0 10px rgba(51, 255, 51, 0.3)' 
              }}
            >
              TRAVEL ANIMATE VIDEO STUDIO
            </p>
          </div>

          {/* Menu Bar Row */}
          <nav className="w-full h-[60px] bg-secondary-bg/50 backdrop-blur-md border-b border-border-subtle px-[50px] py-0 flex items-center justify-between">
            <div className="flex gap-6 overflow-x-auto no-scrollbar py-[10px]">
              {sections.map((section) => (
                <motion.button
                  key={section.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => scrollToSection(section.id)}
                  className={`px-10 py-2 rounded-sm text-sm font-semibold uppercase tracking-wider transition-all duration-300 border bg-white/5 shrink-0 ${
                    activeSection === section.id 
                      ? 'border-[#ee3333] text-[#ee3333] cold-blue-glow' 
                      : 'border-border-subtle hover:border-[#ee3333]/50 text-text-primary/70 hover:text-white'
                  }`}
                >
                  {section.title.split(' ')[0]}
                </motion.button>
              ))}
            </div>

            <div className="flex gap-2 ml-4 py-[10px]">
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="px-3 py-1 bg-white/10 border border-border-subtle hover:border-accent hover:text-accent transition-colors text-xs uppercase"
                title="Add Section"
              >
                Add Section
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-3 py-1 bg-white/10 border border-border-subtle hover:border-red-500 hover:text-red-500 transition-colors text-xs uppercase"
                title="Delete Section"
              >
                Delete Section
              </button>
              <button 
                onClick={handleOpenApiKeyDialog}
                className={`px-3 py-1 flex items-center gap-2 transition-all text-xs uppercase font-bold border rounded-lg ${
                  needsApiKey 
                    ? 'bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.3)]' 
                    : 'bg-yellow-500/20 border-yellow-500 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]'
                }`}
                title={needsApiKey ? "Please enter API Key" : "API Key is ready"}
              >
                <Key size={14} className={needsApiKey ? 'animate-pulse' : ''} />
                {needsApiKey ? 'Enter API Key' : 'Active'}
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Body */}
      <main className="w-full max-w-full mx-auto min-w-[1260px]">
        <AnimatePresence>
          {sections.map((section) => (
            <section 
              key={section.id} 
              id={section.id}
              ref={(el) => (sectionRefs.current[section.id] = el)}
              className="w-full min-h-[1260px] border border-border-subtle bg-section-bg mb-5"
            >
              {/* Section Header */}
              <div className="w-full h-[60px] border-y border-border-subtle bg-secondary-bg flex items-center justify-between px-10">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#ee3333] rounded-full shadow-[0_0_10px_#ee3333]"></div>
                  <h2 className="text-lg font-display font-bold uppercase tracking-wider text-[#ee3333]">
                    {section.title}
                  </h2>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-text-primary/40">Module Active</span>
                </div>
              </div>

              {/* Section Content */}
              <div className="flex flex-col w-full min-h-[1200px]">
                {section.id === 'prompt' ? (
                  <div className="flex flex-col w-full p-10 bg-black/20 gap-8">
                    {/* Input Controls */}
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                    >
                      {/* Left: Settings */}
                      <div className="bg-secondary-bg/50 p-8 rounded-3xl border border-white/5 space-y-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-accent flex items-center gap-2">
                          <Settings2 size={16} /> Script Configuration
                        </h3>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block font-mono">Script Type</label>
                            <div className="grid grid-cols-2 gap-2">
                              {['Whisk', 'Json'].map((type) => (
                                <button
                                  key={type}
                                  onClick={() => setScriptType(type as any)}
                                  className={`py-2 text-[10px] font-bold uppercase rounded border transition-all ${
                                    scriptType === type 
                                      ? 'bg-accent/20 border-accent text-accent' 
                                      : 'bg-white/5 border-white/10 text-text-primary/40'
                                  }`}
                                >
                                  {type === 'Whisk' ? 'Image to Video' : 'Text to Video'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-end gap-4">
                            <div className="w-[30%]">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block font-mono">Number of Scenes</label>
                              <input 
                                type="number"
                                min="0"
                                max="50"
                                value={numberOfScenes}
                                onChange={(e) => setNumberOfScenes(parseInt(e.target.value) || 0)}
                                onFocus={() => setNumberOfScenes(0)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-accent font-mono"
                              />
                            </div>
                            <div className="flex-1 pb-3">
                              <span className="text-xs font-bold text-accent/60 uppercase tracking-wider">
                                Estimated Duration: <span className="text-lg text-white ml-2">{numberOfScenes === 0 ? 'Auto' : `${numberOfScenes * 8} seconds`}</span>
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block font-mono">Aspect Ratio</label>
                            <div className="grid grid-cols-3 gap-2">
                              {['1:1', '9:16', '16:9'].map((ratio) => (
                                <button
                                  key={ratio}
                                  onClick={() => setPromptAspectRatio(ratio)}
                                  className={`py-2 text-[10px] font-bold uppercase rounded border transition-all ${
                                    promptAspectRatio === ratio 
                                      ? 'bg-accent/20 border-accent text-accent font-black' 
                                      : 'bg-white/5 border-white/10 text-text-primary/40'
                                  }`}
                                >
                                  {ratio}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3 block font-mono">Style</label>
                            <div className="grid grid-cols-3 gap-2">
                              {['Cinematic', 'Anime', 'Real', '3D Pixar', 'Cartoon', 'Storybook'].map((style) => (
                                <button
                                  key={style}
                                  onClick={() => setPromptStyle(style)}
                                  className={`py-2 text-[10px] font-bold uppercase rounded border transition-all ${
                                    promptStyle === style 
                                      ? 'bg-accent/20 border-accent text-accent' 
                                      : 'bg-white/5 border-white/10 text-text-primary/40'
                                  }`}
                                >
                                  {style}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Middle & Right: Idea Input */}
                      <div className="lg:col-span-2 bg-secondary-bg/50 p-8 rounded-3xl border border-white/5 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-accent flex items-center gap-2">
                            <Sparkles size={16} /> Video Script Idea
                          </h3>
                        </div>
                        
                        <div className="relative flex-1 flex flex-col group">
                          <textarea 
                            value={userIdea}
                            onChange={(e) => setUserIdea(e.target.value)}
                            placeholder="Describe your idea: E.g., An astronaut walking on Mars, discovering a glowing ancient relic..."
                            className="flex-1 w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm text-white focus:outline-none focus:border-accent resize-none custom-scrollbar leading-relaxed"
                          />
                          {userIdea && (
                            <motion.button
                              onClick={() => setUserIdea('')}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ 
                                opacity: [1, 0.4, 1],
                                scale: 1,
                                boxShadow: [
                                  "0 0 10px rgba(168, 85, 247, 0.2)",
                                  "0 0 25px rgba(168, 85, 247, 0.6)",
                                  "0 0 10px rgba(168, 85, 247, 0.2)"
                                ]
                              }}
                              transition={{ 
                                opacity: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                                boxShadow: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                                scale: { duration: 0.2 }
                              }}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center bg-[#240046]/80 border border-[#a855f7] rounded-full text-[#a855f7] hover:bg-[#a855f7] hover:text-white transition-colors backdrop-blur-sm shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)]"
                              title="Clear all text"
                            >
                              <X size={16} strokeWidth={3} />
                            </motion.button>
                          )}
                        </div>

                        <button
                          onClick={handlePromptGenerate}
                          disabled={isProcessingPrompt}
                          className={`w-full py-5 rounded-2xl bg-[#240046] border border-[#a855f7] text-white font-display font-bold uppercase tracking-[0.2em] shadow-[0_0_20px_#c875ff66] hover:shadow-[0_0_35px_#c875ff] transition-all flex items-center justify-center gap-3 text-sm relative overflow-hidden group ${isProcessingPrompt ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                          {isProcessingPrompt ? (
                            <>
                              <RefreshCw size={20} className="animate-spin" />
                              ANALYZING...
                            </>
                          ) : (
                            <>
                              <Zap size={20} fill="currentColor" />
                              ANALYZE & GENERATE SCRIPT
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>

                    {/* Results Table */}
                    <AnimatePresence>
                      {generatedScript && (
                        <motion.div
                          initial={{ y: 30, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="space-y-8"
                        >
                          <div className="p-8 bg-accent/5 border border-accent/20 rounded-3xl">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                              <h3 className="text-lg font-display font-bold text-white uppercase tracking-widest flex items-center gap-3">
                                <Activity className="text-accent" /> Story Overview
                              </h3>
                              <div className="flex gap-2">
                                <button 
                                  onClick={handleDownloadDoc}
                                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-text-primary/60 hover:bg-accent/20 hover:border-accent hover:text-white transition-all"
                                >
                                  <Download size={14} /> Download Word (.doc)
                                </button>
                              </div>
                            </div>
                            <p className="text-sm text-text-primary/80 leading-relaxed italic">{generatedScript.overview}</p>
                          </div>

                          <div className="bg-secondary-bg/50 rounded-3xl border border-white/5 overflow-hidden">
                            <div className="overflow-x-auto custom-scrollbar">
                              <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                  <tr className="bg-black/40 border-b border-white/5">
                                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-accent w-[15%]">Số TT/Phân cảnh</th>
                                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-accent w-[15%]">Thời gian (8 giây)</th>
                                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-accent w-[30%]">Mô tả kịch bản chi tiết</th>
                                    {scriptType === 'Whisk' ? (
                                      <>
                                        <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-accent w-[35%]">Prompt tạo ảnh (Whisk AI)</th>
                                        <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-accent w-[35%]">Prompt tạo chuyển động (Veo 3.1)</th>
                                      </>
                                    ) : (
                                      <>
                                        <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-accent w-[35%]">Prompt tạo video (Veo 3.1)</th>
                                        <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-accent w-[35%]">Prompt tạo video (JSON-Veo 3.1)</th>
                                      </>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {generatedScript.scenes.map((scene, idx) => (
                                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                      <td className="p-6 align-top">
                                        <span className="text-xs font-mono font-bold text-white/40">{scene.id}</span>
                                      </td>
                                      <td className="p-6 align-top">
                                        <span className="px-2 py-1 bg-accent/10 border border-accent/20 rounded text-[10px] font-bold text-accent">{scene.time}</span>
                                      </td>
                                      <td className="p-6 align-top">
                                        <div className="text-[11px] text-text-primary/80 leading-relaxed whitespace-pre-wrap">
                                          {scene.description}
                                        </div>
                                      </td>
                                      {scriptType === 'Whisk' ? (
                                        <>
                                          <td className="p-6 align-top">
                                            <div className="relative group/cell h-full">
                                              <div className="text-[11px] font-mono p-5 rounded-2xl bg-black/60 text-white/70 border border-white/5 h-full min-h-[120px] overflow-visible leading-relaxed whitespace-pre-wrap break-words">
                                                {scene.whiskPrompt}
                                              </div>
                                              <button 
                                                onClick={() => handleCopy(scene.whiskPrompt || '', `whisk-${idx}`)}
                                                className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-accent hover:text-text-dark transition-all opacity-0 group-hover/cell:opacity-100"
                                                title="Copy Prompt"
                                              >
                                                {copiedId === `whisk-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                                              </button>
                                            </div>
                                          </td>
                                          <td className="p-6 align-top">
                                            <div className="relative group/cell h-full">
                                              <div className="text-[11px] font-mono p-5 rounded-2xl bg-black/60 text-white/50 italic border border-white/5 h-full min-h-[120px] overflow-visible leading-relaxed whitespace-pre-wrap break-words">
                                                {scene.movementPrompt}
                                              </div>
                                              <button 
                                                onClick={() => handleCopy(scene.movementPrompt || '', `move-${idx}`)}
                                                className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-accent hover:text-text-dark transition-all opacity-0 group-hover/cell:opacity-100"
                                                title="Copy Prompt"
                                              >
                                                {copiedId === `move-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                                              </button>
                                            </div>
                                          </td>
                                        </>
                                      ) : (
                                        <>
                                         <td className="p-6 align-top">
                                           <div className="relative group/cell h-full">
                                             <div className="text-[11px] font-mono p-5 rounded-2xl bg-black/60 text-white/70 border border-white/5 h-full min-h-[120px] overflow-visible leading-relaxed whitespace-pre-wrap break-words">
                                               {scene.videoPrompt}
                                             </div>
                                             <button 
                                               onClick={() => handleCopy(scene.videoPrompt || '', `video-${idx}`)}
                                               className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-accent hover:text-text-dark transition-all opacity-0 group-hover/cell:opacity-100"
                                               title="Copy Prompt"
                                             >
                                               {copiedId === `video-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                                             </button>
                                           </div>
                                         </td>
                                         <td className="p-6 align-top">
                                           <div className="relative group/cell h-full">
                                             <div className="text-[11px] font-mono p-5 rounded-2xl bg-black/60 text-white/70 border border-white/5 h-full min-h-[120px] overflow-visible leading-relaxed whitespace-pre-wrap break-words">
                                               {scene.jsonVideoPrompt}
                                             </div>
                                             <button 
                                               onClick={() => handleCopy(scene.jsonVideoPrompt || '', `jsonvideo-${idx}`)}
                                               className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-accent hover:text-text-dark transition-all opacity-0 group-hover/cell:opacity-100"
                                               title="Copy Prompt"
                                             >
                                               {copiedId === `jsonvideo-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                                             </button>
                                           </div>
                                         </td>
                                        </>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : section.id === 'image' ? (
                  <div className="flex flex-col lg:flex-row w-full h-full min-h-[1200px]">
                    {/* Left Column: Control Panel */}
                    <div className="w-full lg:w-1/2 p-10 border-r border-border-subtle flex flex-col gap-8 bg-black/10">
                      <div className="mb-2">
                        <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-2">CHARACTER IDENTITY TOOLS</h2>
                        <p className="text-xs text-text-primary/60">Create consistent images for cartoon characters based on Gemini Nano Banana AI.</p>
                      </div>

                      {/* Character Reference */}
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
                          <Layers size={16} /> Character Reference Images
                        </h3>
                        <div className="grid grid-cols-4 gap-4">
                          {characterImages.map((img, idx) => (
                            <div key={idx} className="flex flex-col gap-3">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 text-center">C{idx + 1}</span>
                              <div 
                                onClick={() => handleImageUpload(idx, 'character')}
                                className={`${
                                  aspectRatio === '1:1' ? 'aspect-square' : 
                                  aspectRatio === '4:3' ? 'aspect-[4/3]' : 
                                  aspectRatio === '9:16' ? 'aspect-[9/16]' : 
                                  'aspect-video'
                                } border border-dashed border-border-subtle bg-black/40 flex flex-col items-center justify-center cursor-pointer hover:border-accent transition-all relative overflow-hidden group p-2`}
                              >
                                {img ? (
                                  <>
                                    <img src={img} alt={`C${idx + 1}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setZoomedImage(img);
                                        }}
                                        className="p-1.5 rounded-full bg-white/10 hover:bg-accent hover:text-text-dark transition-all"
                                        title="Preview"
                                      >
                                        <Maximize2 size={14} />
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleImageUpload(idx, 'character');
                                        }}
                                        className="p-1.5 rounded-full bg-white/10 hover:bg-accent hover:text-text-dark transition-all"
                                        title="Reload"
                                      >
                                        <RefreshCw size={14} />
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <Upload size={20} className="text-text-primary/20 group-hover:text-accent mb-2" />
                                    <span className="text-[9px] uppercase font-bold text-text-primary/30 group-hover:text-accent text-center">Upload Image</span>
                                  </>
                                )}
                              </div>
                              <label className="flex items-center justify-center gap-2 cursor-pointer group bg-white/5 py-1.5 rounded border border-transparent hover:border-accent/30 transition-all">
                                <input 
                                  type="checkbox" 
                                  checked={selectedCharacters[idx]}
                                  onChange={() => {
                                    const next = [...selectedCharacters];
                                    next[idx] = !next[idx];
                                    setSelectedCharacters(next);
                                  }}
                                  className="w-3.5 h-3.5 accent-accent"
                                />
                                <span className="text-[9px] uppercase font-bold tracking-tighter text-text-primary/60 group-hover:text-white">Use</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Background Reference */}
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
                          <Monitor size={16} /> Background Reference
                        </h3>
                        <div className="flex items-center gap-6">
                          <div className="w-full max-w-[calc(25%-12px)]">
                            <div 
                              onClick={() => handleImageUpload(0, 'background')}
                              className={`${
                                aspectRatio === '1:1' ? 'aspect-square' : 
                                aspectRatio === '4:3' ? 'aspect-[4/3]' : 
                                aspectRatio === '9:16' ? 'aspect-[9/16]' : 
                                'aspect-video'
                              } border border-dashed border-border-subtle bg-black/40 flex items-center justify-center cursor-pointer hover:border-accent transition-all relative overflow-hidden group p-2`}
                            >
                            {backgroundImage ? (
                              <>
                                <img src={backgroundImage} alt="Background" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setZoomedImage(backgroundImage);
                                    }}
                                    className="p-2 rounded-full bg-white/10 hover:bg-accent hover:text-text-dark transition-all"
                                    title="Preview"
                                  >
                                    <Maximize2 size={18} />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleImageUpload(0, 'background');
                                    }}
                                    className="p-2 rounded-full bg-white/10 hover:bg-accent hover:text-text-dark transition-all"
                                    title="Reload"
                                  >
                                    <RefreshCw size={18} />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center">
                                <Upload size={24} className="text-text-primary/20 group-hover:text-accent mb-1" />
                                <span className="text-[9px] uppercase font-bold text-text-primary/30">Upload Background</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col gap-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <div 
                                onClick={() => setUseBackground(!useBackground)}
                                className={`w-12 h-6 rounded-full p-1 transition-colors ${useBackground ? 'bg-accent' : 'bg-white/10'}`}
                              >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${useBackground ? 'translate-x-6' : 'translate-x-0'}`}></div>
                              </div>
                              <span className="text-xs uppercase font-bold text-white/80">Use this background</span>
                            </label>
                            <p className="text-[10px] text-text-primary/40 italic">AI will keep the background and only change characters/actions.</p>
                          </div>
                        </div>
                      </div>

                      {/* Prompt */}
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-accent">Prompt</h3>
                        </div>
                        <div className="relative group flex flex-col">
                          <textarea 
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder="Describe the desired action or composition..."
                            className="w-full h-32 bg-black/40 border border-border-subtle rounded-lg p-4 text-sm text-white focus:outline-none focus:border-accent resize-none custom-scrollbar"
                          />
                          {imagePrompt && (
                            <motion.button
                              onClick={() => setImagePrompt('')}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ 
                                opacity: [1, 0.4, 1],
                                scale: 1,
                                boxShadow: [
                                  "0 0 10px rgba(168, 85, 247, 0.2)",
                                  "0 0 25px rgba(168, 85, 247, 0.6)",
                                  "0 0 10px rgba(168, 85, 247, 0.2)"
                                ]
                              }}
                              transition={{ 
                                opacity: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                                boxShadow: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                                scale: { duration: 0.2 }
                              }}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="absolute top-2 right-2 z-20 w-7 h-7 flex items-center justify-center bg-[#240046]/80 border border-[#a855f7] rounded-full text-[#a855f7] hover:bg-[#a855f7] hover:text-white transition-colors backdrop-blur-sm shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)]"
                              title="Clear Prompt"
                            >
                              <X size={14} strokeWidth={3} />
                            </motion.button>
                          )}
                        </div>
                        
                        {/* Model & Resolution Info */}
                        <div className="flex gap-4 mb-4">
                          <div className="flex-1">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">AI Model</h4>
                            <select 
                              value={imageModel}
                              onChange={(e) => setImageModel(e.target.value)}
                              className="w-full bg-black/40 border border-border-subtle rounded-lg p-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                            >
                              <option value="Nano Banana">Nano Banana</option>
                              <option value="Nano Banana 2">Nano Banana 2</option>
                              <option value="Nano Banana Pro">Nano Banana Pro</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Resolution</h4>
                            <div className="grid grid-cols-3 gap-2">
                              {['720p', '1080p', '4K'].map((res) => (
                                <button
                                  key={res}
                                  onClick={() => setResolution(res)}
                                  className={`py-2 text-[10px] font-bold uppercase rounded border transition-all ${
                                    resolution === res 
                                      ? 'bg-accent/20 border-accent text-accent shadow-[0_0_10px_rgba(238,136,0,0.3)]' 
                                      : 'bg-white/5 border-transparent text-text-primary/40 hover:bg-white/10'
                                  }`}
                                >
                                  {res}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Style Options */}
                        <div className="mt-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Image Style</h4>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { name: 'Cinematic', icon: '🎬' },
                              { name: 'Anime', icon: '🌸' },
                              { name: 'Digital Art', icon: '🎨' },
                              { name: '3D Render', icon: '🧊' },
                              { name: 'Realistic', icon: '📸' },
                              { name: 'Cyberpunk', icon: '🤖' },
                              { name: 'Fantasy', icon: '🦄' },
                              { name: 'Oil Painting', icon: '🖌️' },
                              { name: '3D Pixar', icon: '🧸' },
                              { name: 'Cartoon', icon: '🗯️' }
                            ].map((style) => (
                              <button
                                key={style.name}
                                onClick={() => setSelectedStyle(style.name)}
                                className={`flex flex-col items-center justify-center gap-0.5 p-1 rounded border transition-all ${
                                  selectedStyle === style.name 
                                    ? 'bg-accent/20 border-accent text-accent' 
                                    : 'bg-white/5 border-transparent text-text-primary/40 hover:bg-white/10'
                                }`}
                              >
                                <span className="text-base">{style.icon}</span>
                                <span className="text-[7px] font-bold uppercase tracking-tighter text-center">{style.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Resolution & Aspect Ratio */}
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
                            <Settings2 size={16} /> Resolution
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {['AUTO', '720p', '1080p', '4K'].map((res) => (
                              <button
                                key={res}
                                onClick={() => setResolution(res)}
                                className={`px-4 py-2.5 rounded border text-[12px] font-bold uppercase transition-all ${
                                  resolution === res ? 'bg-accent text-text-dark border-accent' : 'border-border-subtle hover:border-accent/50'
                                }`}
                              >
                                {res} 
                                {res === 'AUTO' && resolution === 'AUTO' && (
                                  <span className="block text-[8px] mt-0.5 normal-case opacity-80">({getAutoResolution(aspectRatio)})</span>
                                )}
                                {res === '1080p' && '(1K)'} 
                                {res === '4K' && '(Ultra HD)'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
                            <ImageIcon size={16} /> Aspect Ratio
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {['1:1', '4:3', '9:16', '16:9'].map((ratio) => (
                              <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                className={`px-4 py-2.5 rounded border text-[12px] font-bold uppercase transition-all ${
                                  aspectRatio === ratio ? 'bg-accent text-text-dark border-accent' : 'border-border-subtle hover:border-accent/50'
                                }`}
                              >
                                {ratio}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Instructions */}
                      <div className="mt-4 p-6 rounded-xl border border-border-subtle bg-white/5">
                        <h4 className="text-xs font-bold text-white uppercase mb-4">Instructions:</h4>
                        <ul className="space-y-3">
                          {[
                            "Click on the Character or Background boxes to upload images.",
                            "Check the \"Use this character\" box for characters you want to appear in the new image.",
                            "Enter the action description in the Prompt box.",
                            "Press Generate Image and wait for AI to process your selected versions."
                          ].map((text, i) => (
                            <li key={i} className="flex gap-3 text-[11px] text-text-primary/70 leading-relaxed">
                              <span className="w-4 h-4 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[9px] font-bold shrink-0">{i+1}</span>
                              {text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Right Column: Results */}
                    <div className="w-full lg:w-1/2 p-10 flex flex-col gap-6">
                      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
                          Results Output 
                          <span className="text-accent/60 text-[10px]">
                            ({getResolutionDisplay()})
                          </span>
                        </h3>

                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-tighter text-text-primary/40">
                          <Cpu size={12} />
                          Powered by Gemini Nano Banana
                        </div>
                      </div>

                      <div className={`grid ${resultCount === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-x-6 gap-y-4 self-center w-full`}>
                        {Array.from({ length: resultCount }).map((_, idx) => (
                          <div key={idx} className={`${
                            aspectRatio === '1:1' ? 'aspect-square' : 
                            aspectRatio === '4:3' ? 'aspect-[4/3]' : 
                            aspectRatio === '9:16' ? 'aspect-[9/16]' : 
                            'aspect-video'
                          } border border-dashed border-border-subtle bg-black/20 relative group overflow-hidden`}>
                            {generatedImages[idx] ? (
                              <>
                                <img src={generatedImages[idx]} alt={`Result ${idx}`} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                  <button 
                                    onClick={() => setZoomedImage(generatedImages[idx])}
                                    className="p-3 rounded-full bg-white/10 hover:bg-accent hover:text-text-dark transition-all"
                                    title="Zoom In"
                                  >
                                    <Maximize2 size={20} />
                                  </button>
                                  <button 
                                    onClick={() => handleDownload(generatedImages[idx])}
                                    className="p-3 rounded-full bg-white/10 hover:bg-accent hover:text-text-dark transition-all"
                                    title="Download"
                                  >
                                    <Download size={20} />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-text-primary/10">
                                <ImageIcon size={40} className="mb-2" />
                                <span className="text-[10px] uppercase tracking-widest">Waiting for generation...</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Controls moved to right column */}
                      <div className="flex flex-col gap-6 mt-4">
                        <div className="flex items-center justify-between gap-8">
                          {/* Result Count */}
                          <div className="flex-1">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-accent mb-3">Output Result Count</h3>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4].map((num) => (
                                <button
                                  key={num}
                                  onClick={() => setResultCount(num)}
                                  className={`w-10 h-10 rounded border text-xs font-bold transition-all ${
                                    resultCount === num ? 'bg-accent text-text-dark border-accent' : 'border-border-subtle hover:border-accent/50'
                                  }`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Cost Estimation */}
                          <div className="flex-1 p-3 rounded-lg bg-secondary-bg/30 border border-accent/20 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-accent">
                              <DollarSign size={16} />
                              <span className="text-[10px] uppercase font-bold tracking-widest">Cost</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-display font-bold text-white">${calculateCost().usd}</p>
                              <p className="text-[9px] text-text-primary/50 uppercase tracking-tighter">~ {calculateCost().vnd} VND</p>
                            </div>
                          </div>
                        </div>

                        {/* Generate Button */}
                        <button 
                          onClick={handleGenerate}
                          disabled={isGenerating}
                          className={`w-full py-5 rounded-xl bg-[#240046] border border-[#a855f7] text-white font-display font-bold uppercase tracking-[0.2em] shadow-[0_0_20px_#c875ff66] hover:shadow-[0_0_35px_#c875ff] transition-all flex items-center justify-center gap-3 relative overflow-hidden group ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                          {isGenerating ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              Processing...
                            </>
                          ) : (
                            <>
                              <ImageIcon size={20} />
                              {isGenerating ? "Processing..." : "IMAGE GENERATE"}
                            </>
                          )}
                        </button>
                      </div>

                      {/* AI Integration Info */}
                      <div className="mt-auto p-4 rounded-lg border border-accent/10 bg-accent/5 flex items-start gap-4">
                        <div className="p-2 rounded bg-accent/20 text-accent">
                          <Check size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white uppercase mb-1">Advanced AI Integration</p>
                          <p className="text-[10px] text-text-primary/60 leading-relaxed">
                            Using Gemini Nano Banana technology to ensure character consistency.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : section.id === 'audio' ? (
                  <div className="w-full flex flex-col p-10 bg-black/20 font-sans overflow-hidden">
                    {/* Title */}
                    <motion.div 
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="w-full flex justify-center mb-12"
                    >
                      <motion.h2 
                        className="text-4xl font-display font-black text-center uppercase tracking-[8px] text-transparent bg-clip-text bg-gradient-to-r from-accent via-[#FFB74D] to-accent bg-[length:200%_auto]"
                        animate={{ 
                          backgroundPosition: ["0% center", "200% center"],
                          textShadow: [
                            "0 0 10px rgba(238, 136, 0, 0.3)",
                            "0 0 25px rgba(238, 136, 0, 0.6)",
                            "0 0 10px rgba(238, 136, 0, 0.3)"
                          ]
                        }}
                        transition={{
                          backgroundPosition: {
                            duration: 4,
                            repeat: Infinity,
                            ease: "linear"
                          },
                          textShadow: {
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }
                        }}
                      >
                        Text To Speech Master
                      </motion.h2>
                    </motion.div>

                    <div className="flex flex-col lg:flex-row gap-10 w-full flex-1">
                      {/* Column 1: Input & Config */}
                      <motion.div 
                        initial={{ x: -30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex-1 flex flex-col gap-8 bg-secondary-bg/50 p-8 rounded-3xl border border-white/5 backdrop-blur-xl"
                      >
                        {/* Audio Generation Mode Toggle */}
                        <div className="space-y-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                             <Layers size={14} /> Generation Workflow
                          </label>
                          <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                            <button
                              onClick={() => setTtsMode('single')}
                              className={`flex-1 py-3 px-4 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                                ttsMode === 'single' 
                                  ? 'bg-accent/20 text-accent border border-accent/30 shadow-[0_0_15px_rgba(238,136,0,0.1)]' 
                                  : 'text-white/30 hover:text-white hover:bg-white/5'
                              }`}
                            >
                               Single Speaker
                            </button>
                            <button
                              onClick={() => setTtsMode('multiple')}
                              className={`flex-1 py-3 px-4 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                                ttsMode === 'multiple' 
                                  ? 'bg-accent/20 text-accent border border-accent/30 shadow-[0_0_15px_rgba(238,136,0,0.1)]' 
                                  : 'text-white/30 hover:text-white hover:bg-white/5'
                              }`}
                            >
                               Multiple Speaker (Conversation)
                            </button>
                          </div>
                        </div>

                        {/* AI Model Selection */}
                        <div className="space-y-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-accent flex items-center gap-2">
                            <Cpu size={14} /> AI TTS Technology
                          </label>
                          <div className="flex gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5">
                            {ttsAiModels.map(m => (
                              <button
                                key={m.id}
                                onClick={() => setTtsAiModel(m.id)}
                                className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-bold uppercase transition-all ${
                                  ttsAiModel === m.id 
                                    ? 'bg-accent text-text-dark shadow-lg' 
                                    : 'text-white/40 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                {m.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Region Selection (Global) */}
                        <div className="space-y-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                            <ExternalLink size={14} /> Global Region & Accent
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {ttsRegions.map(r => {
                              const tooltipMap: { [key: string]: string } = {
                                'Default': 'Tự nhiên',
                                'North': 'Miền Bắc',
                                'Hue': 'HUẾ',
                                'Central': 'MIỀN TRUNG',
                                'South': 'Miền Nam'
                              };
                              return (
                                <div key={r} className="flex-1 min-w-[80px] relative group/tooltip">
                                  <button
                                    onClick={() => setTtsRegion(r)}
                                    className={`w-full py-3 rounded-xl text-[10px] font-bold transition-all border uppercase tracking-wider ${
                                      ttsRegion === r 
                                        ? 'bg-accent/10 border-accent text-accent shadow-[0_0_15px_rgba(238,136,0,0.2)]' 
                                        : 'bg-black/40 border-white/10 text-white/40 hover:border-white/30'
                                    }`}
                                  >
                                    {r}
                                  </button>
                                  
                                  {/* Animated Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-accent text-text-dark text-[9px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none scale-90 group-hover/tooltip:scale-100 origin-bottom whitespace-nowrap z-50 shadow-[0_4px_15px_rgba(238,136,0,0.4)]">
                                    {tooltipMap[r]}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-accent" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <AnimatePresence mode="wait">
                          {ttsMode === 'single' ? (
                            <motion.div
                              key="single-speaker"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="contents"
                            >
                              {/* Single Speaker Config */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                                    <MessageCircle size={14} /> Select Voice (Gemini Pro)
                                  </label>

                                  <div className="flex gap-2">
                                    <div className="relative flex-1">
                                      <select 
                                        value={geminiVoice}
                                        onChange={(e) => setGeminiVoice(e.target.value)}
                                        className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-3 text-white text-sm focus:border-accent appearance-none cursor-pointer"
                                      >
                                        {geminiVoices.map(v => (
                                          <option key={v.id} value={v.id} className="bg-secondary-bg font-sans">{v.name}</option>
                                        ))}
                                      </select>
                                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                    </div>
                                    <button 
                                      onClick={handlePreviewVoice}
                                      disabled={isTtsProcessing}
                                      className="px-4 bg-white/10 hover:bg-accent hover:text-text-dark text-white rounded-xl transition-all border border-white/10 flex items-center justify-center disabled:opacity-30"
                                      title="Preview this voice"
                                    >
                                      <Play size={16} />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                                    <Smile size={14} /> Expressions
                                  </label>
                                  <div className="relative">
                                    <select 
                                      value={ttsStyle}
                                      onChange={(e) => setTtsStyle(e.target.value)}
                                      className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-3 text-white text-sm focus:border-accent appearance-none cursor-pointer custom-scrollbar overflow-y-auto"
                                    >
                                      {ttsExpressions.map(group => (
                                        <optgroup 
                                          key={group.category} 
                                          label={group.category}
                                          className="bg-secondary-bg text-accent font-bold text-[10px] uppercase tracking-widest py-2"
                                        >
                                          {group.items.map(item => (
                                            <option 
                                              key={item.name} 
                                              value={item.name}
                                              className="bg-secondary-bg text-white font-sans text-sm py-2"
                                            >
                                              {item.name}
                                            </option>
                                          ))}
                                        </optgroup>
                                      ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                   <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                                     <Settings2 size={14} /> Audio Customization
                                   </label>
                                  <div className="grid grid-cols-2 gap-6 pt-2">
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase">
                                        <span>Speed</span>
                                        <span className="text-accent">{ttsSpeed}x</span>
                                      </div>
                                      <input 
                                        type="range" min="0.25" max="4.0" step="0.05"
                                        value={ttsSpeed}
                                        onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                                        className="w-full accent-accent h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase">
                                        <span>Pitch</span>
                                        <span className="text-accent">{ttsPitch >= 0 ? `+${ttsPitch}` : ttsPitch}</span>
                                      </div>
                                      <input 
                                        type="range" min="-20" max="20" step="1"
                                        value={ttsPitch}
                                        onChange={(e) => setTtsPitch(parseInt(e.target.value))}
                                        className="w-full accent-accent h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                                    <DollarSign size={14} /> Estimated Total Cost
                                  </label>
                                  <div className="h-full bg-black/40 border border-accent/20 rounded-2xl p-4 flex items-center justify-around">
                                    <div className="text-center">
                                      <p className="text-[10px] text-white/30 uppercase mb-1">Cost (USD)</p>
                                      <p className="text-xl font-display font-bold text-accent">${calculateTtsCost(ttsMode === 'single' ? ttsText : conversationNodes.map(n => n.text).join('')).usd}</p>
                                    </div>
                                    <div className="w-[1px] h-8 bg-white/5" />
                                    <div className="text-center">
                                      <p className="text-[10px] text-white/30 uppercase mb-1">Cost (VND)</p>
                                      <p className="text-xl font-display font-bold text-white">~{calculateTtsCost(ttsMode === 'single' ? ttsText : conversationNodes.map(n => n.text).join('')).vnd}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Text Area & File Upload */}
                              <div className="space-y-4 flex-1 flex flex-col">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                                    <FileText size={14} /> Text Content
                                  </label>
                                  <label className="cursor-pointer text-[10px] font-bold text-accent hover:underline flex items-center gap-2 bg-accent/5 px-3 py-1.5 rounded-lg border border-accent/20">
                                    <Upload size={14} /> Upload File (.pdf/.docx)
                                    <input type="file" className="hidden" accept=".pdf,.docx" onChange={handleTtsFileUpload} />
                                  </label>
                                </div>
                                <div className="relative flex-1 flex flex-col group">
                                  <textarea 
                                    value={ttsText}
                                    onChange={(e) => setTtsText(e.target.value)}
                                    placeholder="Enter the text content you want to convert to speech..."
                                    className="w-full flex-1 bg-black/60 border border-white/10 rounded-2xl p-6 text-white text-sm focus:outline-none focus:border-accent transition-all resize-none leading-relaxed custom-scrollbar min-h-[300px]"
                                  />
                                  {ttsText && (
                                    <motion.button
                                      onClick={() => setTtsText('')}
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ 
                                        opacity: [1, 0.4, 1],
                                        scale: 1,
                                        boxShadow: [
                                          "0 0 10px rgba(168, 85, 247, 0.2)",
                                          "0 0 25px rgba(168, 85, 247, 0.6)",
                                          "0 0 10px rgba(168, 85, 247, 0.2)"
                                        ]
                                      }}
                                      transition={{ 
                                        opacity: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                                        boxShadow: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                                        scale: { duration: 0.2 }
                                      }}
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center bg-[#240046]/80 border border-[#a855f7] rounded-full text-[#a855f7] hover:bg-[#a855f7] hover:text-white transition-colors backdrop-blur-sm shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)]"
                                      title="Clear all text"
                                    >
                                      <X size={16} strokeWidth={3} />
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="multi-speaker"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="flex flex-col gap-6"
                            >
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-accent flex items-center gap-2">
                                  <Sparkles size={14} /> Conversation Nodes (Gemini TTS)
                                </label>
                                <button 
                                  onClick={addConversationNode}
                                  className="text-[10px] uppercase font-black bg-accent text-text-dark px-4 py-2 rounded-lg flex items-center gap-2 hover:scale-105 transition-all shadow-[0_0_15px_rgba(238,136,0,0.3)]"
                                >
                                  <Plus size={14} /> Add Conversation Node
                                </button>
                              </div>

                              <div className="space-y-6 max-h-[600px] overflow-y-auto px-2 custom-scrollbar">
                                {conversationNodes.map((node, index) => (
                                  <motion.div 
                                    key={node.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="bg-black/40 border border-white/10 rounded-[32px] p-6 space-y-4 relative group"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent flex items-center justify-center text-accent text-xs font-bold font-mono">
                                          {index + 1}
                                        </div>
                                        <div className="relative">
                                          <select 
                                            value={node.speaker}
                                            onChange={(e) => updateConversationNode(node.id, { speaker: e.target.value })}
                                            className="bg-black/60 border border-white/10 rounded-xl px-4 py-1.5 text-white/80 text-xs focus:border-accent appearance-none cursor-pointer pr-8"
                                          >
                                            {geminiVoices.map(v => (
                                              <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                          </select>
                                          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                        </div>
                                        
                                        <div className="relative">
                                          <select 
                                            value={node.style}
                                            onChange={(e) => updateConversationNode(node.id, { style: e.target.value })}
                                            className="bg-black/60 border border-white/10 rounded-xl px-4 py-1.5 text-white/60 text-[10px] focus:border-accent appearance-none cursor-pointer pr-8 uppercase font-bold tracking-wider"
                                          >
                                            {ttsExpressions.flatMap(g => g.items).map(item => (
                                              <option key={item.name} value={item.name} className="bg-secondary-bg text-white lowercase font-sans">{item.name}</option>
                                            ))}
                                          </select>
                                          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                        </div>

                                        <div className="relative">
                                          <select 
                                            value={node.region}
                                            onChange={(e) => updateConversationNode(node.id, { region: e.target.value })}
                                            className="bg-black/60 border border-white/10 rounded-xl px-4 py-1.5 text-accent/60 text-[10px] focus:border-accent appearance-none cursor-pointer pr-8 uppercase font-bold tracking-wider"
                                          >
                                            {ttsRegions.map(r => (
                                              <option key={r} value={r} className="bg-secondary-bg text-white lowercase font-sans">{r}</option>
                                            ))}
                                          </select>
                                          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                        </div>
                                      </div>

                                      <button 
                                        onClick={() => removeConversationNode(node.id)}
                                        className="p-2 text-white/20 hover:text-red-500 transition-colors"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>

                                    <textarea 
                                      value={node.text}
                                      onChange={(e) => updateConversationNode(node.id, { text: e.target.value })}
                                      placeholder={`Nội dung thoại cho ${node.speaker}...`}
                                      className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-accent/40 transition-all resize-none leading-relaxed h-[100px] custom-scrollbar"
                                    />
                                  </motion.div>
                                ))}
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2">
                                  <label className="text-[9px] uppercase font-black text-white/40 tracking-widest">Global Speed</label>
                                  <input 
                                    type="range" min="0.5" max="2.0" step="0.1"
                                    value={ttsSpeed}
                                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                                    className="w-full accent-accent h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>
                                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2 text-center flex flex-col justify-center">
                                  <p className="text-[10px] text-white/30 uppercase mb-1">Est. Cost</p>
                                  <p className="text-lg font-display font-bold text-accent">${calculateTtsCost(conversationNodes.map(n => n.text).join('')).usd}</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Action Buttons */}
                        <div className="flex gap-4">
                          <button 
                            onClick={() => handleTtsConvert(true)}
                            disabled={isTtsProcessing}
                            className="flex-1 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold uppercase tracking-wider text-sm hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-30"
                          >
                            <Play size={18} className={isTtsProcessing ? 'animate-spin' : ''} />
                            Preview (1-2 sentences)
                          </button>
                          <button 
                            onClick={() => handleTtsConvert(false)}
                            disabled={isTtsProcessing}
                            className={`flex-[2] py-4 rounded-2xl bg-[#240046] border border-[#a855f7] text-white font-display font-bold uppercase tracking-[0.2em] shadow-[0_0_20px_#c875ff66] hover:shadow-[0_0_35px_#c875ff] transition-all flex items-center justify-center gap-3 text-sm relative overflow-hidden group ${isTtsProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                            <Zap size={20} fill="currentColor" className={isTtsProcessing ? 'animate-pulse' : ''} />
                            CONVERT ALL
                          </button>
                        </div>
                      </motion.div>

                      {/* Column 2: Result & Output */}
                      <motion.div 
                        initial={{ x: 30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="w-full lg:w-[40%] flex flex-col gap-8"
                      >
                        <div className="flex-1 bg-secondary-bg/50 p-10 rounded-3xl border border-white/5 backdrop-blur-xl flex flex-col items-center justify-center text-center">
                          {isTtsProcessing ? (
                            <div className="w-full space-y-10">
                              <div className="relative w-48 h-48 mx-auto">
                                <div className="absolute inset-0 border-4 border-accent/20 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-4xl font-display font-bold text-white">{ttsProgress}%</span>
                                </div>
                              </div>
                              <div className="space-y-4">
                                <h3 className="text-2xl font-display font-bold text-accent uppercase tracking-widest">Processing...</h3>
                                <p className="text-sm text-text-primary/40 italic">Analyzing and converting using Gemini AI technology...</p>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div 
                                    className="h-full bg-accent"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${ttsProgress}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full space-y-8">
                              {!ttsAudioUrl ? (
                                <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="space-y-6 group"
                                >
                                  <motion.div
                                    animate={{ 
                                      scale: [1, 1.05, 1],
                                      rotate: [0, 5, -5, 0]
                                    }}
                                    transition={{ duration: 4, repeat: Infinity }}
                                    className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10"
                                  >
                                    <Music size={60} className="text-white/20 group-hover:text-accent transition-colors" />
                                  </motion.div>
                                  <div>
                                    <h3 className="text-xl font-display font-bold text-white/40 uppercase tracking-widest mb-2">Ready to Convert</h3>
                                    <p className="text-[10px] text-text-primary/30 uppercase tracking-[0.2em]">Select configuration & click convert</p>
                                  </div>
                                </motion.div>
                              ) : (
                                <motion.div 
                                  initial={{ scale: 0.9, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className="space-y-6"
                                >
                                  <div className="w-24 h-24 bg-accent/20 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(238,136,0,0.3)]">
                                    <PlayCircle size={48} className="text-accent" />
                                  </div>
                                  <div>
                                    <h3 className="text-2xl font-display font-bold text-white uppercase tracking-widest mb-1">Success!</h3>
                                    <p className="text-[10px] text-text-primary/40 uppercase tracking-[0.2em]">Your recording is ready</p>
                                  </div>
                                </motion.div>
                              )}

                              {/* Vibrant Waveform Audio Player - Always shown */}
                              <div className={!ttsAudioUrl ? "opacity-20 pointer-events-none grayscale" : "relative"}>
                                <WaveformPlayer url={ttsAudioUrl} />
                                {!ttsAudioUrl && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">No Audio Loaded</span>
                                  </div>
                                )}
                              </div>

                              {ttsAudioUrl && (
                                <motion.div 
                                  initial={{ y: 20, opacity: 0 }}
                                  animate={{ y: 0, opacity: 1 }}
                                  className="grid grid-cols-2 gap-4"
                                >
                                  <button 
                                    onClick={() => handleDownloadTts('mp3')}
                                    className="py-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/10 hover:border-accent transition-all group"
                                  >
                                    <Download size={24} className="group-hover:text-accent transition-colors" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Download MP3</span>
                                  </button>
                                  <button 
                                    onClick={() => handleDownloadTts('wav')} 
                                    className="py-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/10 hover:border-accent transition-all group"
                                  >
                                    <FileText size={24} className="group-hover:text-accent transition-colors" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Download WAV</span>
                                  </button>
                                </motion.div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Extra Info */}
                        <div className="p-6 rounded-2xl border border-white/5 bg-black/20 flex items-start gap-4">
                          <div className="p-2 rounded-lg bg-accent/20 text-accent">
                            <BrainCircuit size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white uppercase mb-1">AI Smart Technology</p>
                            <p className="text-[10px] text-text-primary/50 leading-relaxed">
                              Uses "Chunking & Merge" algorithm to overcome API character limits, ensuring optimal flow for long texts.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                ) : section.id === 'video' ? (
                  <div className="flex flex-col lg:flex-row w-full min-h-[1200px]">
                    {/* Left Column: Job Configuration & Bulk Entry */}
                    <div className="w-full lg:w-[30%] p-8 border-r border-border-subtle bg-black/10 flex flex-col gap-6 font-sans">
                      <div className="space-y-1">
                        <h2 className="text-xl font-display font-bold text-accent uppercase tracking-wider">Configure Batch Jobs</h2>
                        <p className="text-[10px] text-text-primary/60">Define parameters for 20-50 simultaneous tasks</p>
                      </div>

                      <div className="space-y-4">
                        {/* Bulk Prompts Area */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 block font-mono">Prompts List (One per line)</label>
                          </div>
                          <div className="relative group flex flex-col">
                            <textarea 
                              value={bulkPrompts}
                              onChange={(e) => setBulkPrompts(e.target.value)}
                              placeholder="A sunset over Mars...&#10;Cyberpunk city flyover...&#10;Ancient ruins in the jungle..."
                              className="w-full h-64 bg-black/40 border border-border-subtle rounded-lg p-4 text-sm text-white focus:outline-none focus:border-accent resize-none custom-scrollbar font-sans"
                            />
                            {bulkPrompts && (
                              <motion.button
                                onClick={() => setBulkPrompts('')}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ 
                                  opacity: [1, 0.4, 1],
                                  scale: 1,
                                  boxShadow: [
                                    "0 0 10px rgba(168, 85, 247, 0.2)",
                                    "0 0 25px rgba(168, 85, 247, 0.6)",
                                    "0 0 10px rgba(168, 85, 247, 0.2)"
                                  ]
                                }}
                                transition={{ 
                                  opacity: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                                  boxShadow: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                                  scale: { duration: 0.2 }
                                }}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="absolute top-2 right-2 z-20 w-7 h-7 flex items-center justify-center bg-[#240046]/80 border border-[#a855f7] rounded-full text-[#a855f7] hover:bg-[#a855f7] hover:text-white transition-colors backdrop-blur-sm shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)]"
                                title="Clear List"
                              >
                                <X size={14} strokeWidth={3} />
                              </motion.button>
                            )}
                          </div>
                        </div>

                        {/* Input Type Selector */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block font-mono">Input Type</label>
                          <div className="grid grid-cols-3 gap-2">
                            {['text', 'image', 'frame'].map((type) => (
                          <button
                                key={type}
                                onClick={() => setNewJobSettings(prev => ({ ...prev, inputType: type as any }))}
                                className={`py-2 text-[10px] font-bold uppercase rounded border transition-all ${
                                  newJobSettings.inputType === type 
                                    ? 'bg-accent/20 border-accent text-accent shadow-[0_0_15px_rgba(238,136,0,0.4)]' 
                                    : 'bg-black/20 border-border-subtle text-text-primary/40 hover:border-accent/30 hover:shadow-[0_0_10px_rgba(238,136,0,0.2)]'
                                }`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Conditional Image Upload */}
                        {(newJobSettings.inputType === 'image' || newJobSettings.inputType === 'frame') && (
                          <div 
                            onClick={handleVideoInputImageUpload}
                            className="aspect-video border border-dashed border-border-subtle bg-black/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-accent transition-all overflow-hidden group"
                          >
                            {newJobSettings.inputImage ? (
                              <div className="relative w-full h-full">
                                <img src={newJobSettings.inputImage} alt="Reference" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Upload size={20} className="text-white" />
                                </div>
                              </div>
                            ) : (
                              <>
                                <Upload size={24} className="text-text-primary/20 mb-2" />
                                <span className="text-[10px] uppercase font-bold text-text-primary/40 font-mono">Upload Reference Image</span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Model & Aspect Ratio */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block font-mono">AI Model</label>
                            <select 
                              value={newJobSettings.model}
                              onChange={(e) => setNewJobSettings(prev => ({ ...prev, model: e.target.value }))}
                              className="w-full bg-black/40 border border-border-subtle rounded-lg p-3 text-sm text-white focus:outline-none focus:border-accent font-mono appearance-none"
                            >
                              <option value="veo-3.1-lite-generate-preview">Veo 3.1 Lite</option>
                              <option value="veo-3.1-generate-preview">Veo 3.1 Pro</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block font-mono">Aspect Ratio</label>
                            <select 
                              value={newJobSettings.aspectRatio}
                              onChange={(e) => setNewJobSettings(prev => ({ ...prev, aspectRatio: e.target.value as any }))}
                              className="w-full bg-black/40 border border-border-subtle rounded-lg p-3 text-sm text-white focus:outline-none focus:border-accent font-mono"
                            >
                              <option value="16:9">16:9 (Landscape)</option>
                              <option value="9:16">9:16 (Portrait)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block font-mono">Output Count</label>
                            <input 
                              type="number" 
                              min="1" 
                              max="10"
                              value={newJobSettings.outputCount}
                              onChange={(e) => setNewJobSettings(prev => ({ ...prev, outputCount: parseInt(e.target.value) }))}
                              className="w-full bg-black/40 border border-border-subtle rounded-lg p-3 text-sm text-white focus:outline-none focus:border-accent font-mono"
                            />
                          </div>
                        </div>

                        <button 
                          onClick={handleBulkSubmit}
                          disabled={!bulkPrompts.trim()}
                          className={`w-full py-5 rounded-xl bg-[#240046] border border-[#a855f7] text-white font-display font-bold uppercase tracking-[0.2em] shadow-[0_0_20px_#c875ff66] hover:shadow-[0_0_35px_#c875ff] transition-all flex items-center justify-center gap-3 relative overflow-hidden group ${!bulkPrompts.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                          <Zap size={20} fill="currentColor" />
                          Submit to Queue
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Queue & Monitor */}
                    <div className="flex-1 p-8 flex flex-col gap-6 bg-black/5 font-sans">
                      <div className="flex items-center justify-between border-b border-white/5 pb-6">
                        <div className="flex items-center gap-8">
                          <div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-2 font-mono">Queue Management</h3>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1.5 text-[9px] uppercase font-mono px-2 py-1 rounded bg-accent/10 text-accent border border-accent/20">
                                <Activity size={12} /> {videoJobs.filter(j => j.status === 'processing').length}/{concurrencyLimit} Running
                              </span>
                              <span className="flex items-center gap-1.5 text-[9px] uppercase font-mono px-2 py-1 rounded bg-white/5 text-text-primary/40 border border-white/10">
                                <Clock size={12} /> {videoJobs.filter(j => j.status === 'pending').length} Queued
                              </span>
                              <span className="flex items-center gap-1.5 text-[9px] uppercase font-mono px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                                <Check size={12} /> {videoJobs.filter(j => j.status === 'completed').length} Done
                              </span>
                            </div>
                            <div className="mt-3 flex items-center gap-3 p-2 rounded bg-white/5 border border-white/10 w-fit">
                              <span className="text-[10px] uppercase font-bold text-white/40 font-mono">Total Estimated Cost:</span>
                              <span className="text-xs font-bold text-accent font-mono">${calculateVideoQueueCost().usd}</span>
                              <span className="text-[9px] text-text-primary/40 font-mono uppercase tracking-tighter"> / {calculateVideoQueueCost().vnd} VND</span>
                              <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 font-mono uppercase">{calculateVideoQueueCost().count} Videos</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button 
                            onClick={handleDownloadAllVideos}
                            disabled={videoJobs.filter(j => j.status === 'completed').length === 0}
                            className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-20 font-mono"
                          >
                            <Download size={14} /> Download All
                          </button>
                          <button 
                            onClick={() => setIsQueueRunning(!isQueueRunning)}
                            className={`p-3 rounded-lg border transition-all ${isQueueRunning ? 'bg-red-500/20 border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-green-500/20 border-green-500/50 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]'}`}
                          >
                            {isQueueRunning ? <Pause size={20} /> : <Play size={20} />}
                          </button>
                        </div>
                      </div>

                      {/* Jobs Table/Stream */}
                      <div className="flex-1 overflow-y-auto pr-4 space-y-4 custom-scrollbar">
                        {videoJobs.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-text-primary/10 grayscale">
                            <List size={80} className="mb-6 opacity-5" />
                            <p className="uppercase tracking-[0.3em] font-mono text-[10px]">No active jobs in queue</p>
                          </div>
                        ) : (
                          [...videoJobs].reverse().map((job) => (
                            <div 
                              key={job.id} 
                              className={`group bg-black/30 border border-white/5 rounded-2xl p-5 flex gap-6 transition-all hover:border-white/20 ${
                                job.status === 'processing' ? 'border-accent/50 bg-accent/5' : ''
                              }`}
                            >
                              {/* Video Play Form (Directly on row) */}
                              <div className="w-56 aspect-[16/10] bg-black/60 rounded-xl overflow-hidden border border-white/5 relative flex-shrink-0 flex items-center justify-center">
                                {job.status === 'completed' && job.resultUrl ? (
                                  <video 
                                    src={job.resultUrl} 
                                    className="w-full h-full object-cover" 
                                    controls 
                                    playsInline
                                    loop
                                  />
                                ) : job.status === 'processing' ? (
                                  <div className="flex flex-col items-center gap-4">
                                    <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-[10px] uppercase font-black text-accent animate-pulse font-mono tracking-tighter">Processing...</span>
                                  </div>
                                ) : job.status === 'failed' ? (
                                  <div className="flex flex-col items-center gap-2 text-red-500">
                                    <AlertCircle size={24} />
                                    <span className="text-[9px] uppercase font-bold font-mono">Failed</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-2 text-white/5">
                                    <Clock size={24} />
                                    <span className="text-[9px] uppercase font-bold font-mono">Waiting</span>
                                  </div>
                                )}
                              </div>

                              {/* Job Info */}
                              <div className="flex-1 flex flex-col justify-between py-1">
                                <div>
                                  <div className="flex items-center justify-between mb-3">
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                                      job.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                      job.status === 'processing' ? 'bg-accent/20 text-accent border-accent/30' :
                                      job.status === 'failed' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                      'bg-white/5 text-text-primary/30 border-white/10'
                                    } font-mono`}>
                                      {job.status}
                                    </span>
                                    <span className="text-xs text-text-primary/20 font-mono">
                                      {new Date(job.createdAt).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-white/80 line-clamp-2 leading-relaxed">
                                    {job.prompt}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex gap-4">
                                    <div className="text-[9px] uppercase font-mono text-text-primary/40">
                                      Engine: <span className="text-white/60">{job.model.split('-')[0].toUpperCase()}</span>
                                    </div>
                                    <div className="text-[9px] uppercase font-mono text-text-primary/40">
                                      Ratio: <span className="text-white/60">{job.aspectRatio}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {job.status === 'completed' && (
                                      <button 
                                        onClick={() => handleVideoDownload(job.resultUrl!, job.id)}
                                        className="px-4 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all font-mono flex items-center gap-2"
                                        title="Download Video"
                                      >
                                        <Download size={14} />
                                        <span className="text-[10px] uppercase font-bold">Download</span>
                                      </button>
                                    )}
                                    {job.status === 'failed' && (
                                      <button 
                                        onClick={() => handleRetryJob(job.id)}
                                        className="p-2.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 transition-all font-mono"
                                      >
                                        <RefreshCw size={14} />
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => handleDeleteJob(job.id)}
                                      className="p-2.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/10 transition-all font-mono"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : section.id === 'prompt' ? (
                  <div className="w-full px-20 py-10 flex flex-col gap-10 font-sans">
                    {/* Row 1: Header and Configuration */}
                    <div className="flex flex-col gap-8 bg-white/5 p-10 rounded-3xl border border-white/10">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
                          <BrainCircuit size={28} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-tight">AI Video Script Expert</h2>
                          <p className="text-[10px] text-text-primary/40 uppercase tracking-[0.2em] font-mono">Advanced Scripting & Prompt Engineering Engine</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Idea Input */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2 font-mono">
                              <FileText size={14} /> Ý tưởng của bạn
                            </label>
                            <label className="cursor-pointer text-[10px] font-bold text-accent hover:underline flex items-center gap-1">
                              <Upload size={12} /> Upload File (.word/pdf)
                              <input type="file" className="hidden" accept=".doc,.docx,.pdf,.txt" />
                            </label>
                          </div>
                          <textarea 
                            value={userIdea}
                            onChange={(e) => setUserIdea(e.target.value)}
                            placeholder="***NHẬP Ý TƯỞNG CỦA BẠN VÀO ĐÂY***"
                            className="w-full h-64 bg-black/40 border border-white/10 rounded-2xl p-6 text-white text-sm focus:outline-none focus:border-accent transition-all resize-none leading-relaxed"
                          />
                        </div>

                         {/* Settings */}
                         <div className="flex flex-col gap-5">
                            <div>
                               <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2.5 block font-mono">Số phân cảnh</label>
                               <div className="flex items-center gap-6">
                                 <div className="relative group w-[30%]">
                                   <input 
                                     type="number" 
                                     min="0"
                                     value={numberOfScenes}
                                     onChange={(e) => setNumberOfScenes(parseInt(e.target.value) || 0)}
                                     onFocus={() => setNumberOfScenes(0)}
                                     className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-mono focus:border-accent focus:shadow-[0_0_15px_rgba(238,136,0,0.2)] transition-all"
                                   />
                                   <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-[10px] font-mono group-focus-within:text-accent transition-colors uppercase">SCN</span>
                                 </div>
                                 <p className="text-[11px] text-accent/70 font-mono uppercase tracking-[0.15em] flex items-center gap-2 animate-pulse font-bold">
                                   <Sparkles size={14} className="text-accent" /> Thời lượng dự kiến: {numberOfScenes === 0 ? 'Tự động' : `${numberOfScenes * 8} Giây (8s/cảnh)`}
                                 </p>
                               </div>
                            </div>

                           <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2.5 block font-mono flex items-center gap-2">
                                  <Palette size={12} className="text-accent" /> Style
                                </label>
                                <div className="relative">
                                  <select 
                                    value={promptStyle}
                                    onChange={(e) => setPromptStyle(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs font-bold focus:border-accent appearance-none cursor-pointer hover:border-white/20 transition-all uppercase tracking-wide px-4"
                                  >
                                    {['Cinematic', '3D Render', 'Anime', 'Cyberpunk', 'Realistic', 'Vintage', 'Artistic'].map(s => (
                                      <option key={s} value={s} className="bg-secondary-bg text-white">{s}</option>
                                    ))}
                                  </select>
                                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                </div>
                             </div>
                             <div>
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2.5 block font-mono flex items-center gap-2">
                                  <Monitor size={12} className="text-accent" /> Aspect Ratio
                                </label>
                                <div className="flex gap-2 h-[42px]">
                                  {['1:1', '9:16', '16:9'].map((ratio) => (
                                    <button
                                      key={ratio}
                                      onClick={() => setPromptAspectRatio(ratio)}
                                      className={`flex-1 rounded-xl border text-[9px] font-black uppercase transition-all duration-300 ${
                                        promptAspectRatio === ratio 
                                          ? 'bg-accent/20 border-accent text-accent shadow-[0_0_15px_rgba(238,136,0,0.4)] scale-105' 
                                          : 'bg-black/20 border-white/10 text-white/40 hover:border-white/30'
                                      }`}
                                    >
                                      {ratio}
                                    </button>
                                  ))}
                                </div>
                             </div>
                           </div>

                           <div>
                              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2.5 block font-mono">Kiểu kịch bản</label>
                              <div className="grid grid-cols-2 gap-3">
                                {['Whisk', 'Json'].map((type) => (
                                  <button
                                    key={type}
                                    onClick={() => setScriptType(type as any)}
                                    className={`py-3.5 rounded-xl border text-[9px] font-black uppercase tracking-[0.1em] transition-all duration-500 ${
                                      scriptType === type 
                                        ? 'bg-accent/25 border-accent text-accent shadow-[0_0_20px_rgba(238,136,0,0.5)] scale-[1.02]' 
                                        : 'bg-black/20 border-white/10 text-white/40 hover:border-white/30'
                                    }`}
                                  >
                                    {type === 'Whisk' ? 'IMG TO VIDEO' : 'TEXT TO VIDEO'}
                                  </button>
                                ))}
                              </div>
                           </div>

                           <div className="relative p-[2px] rounded-2xl bg-gradient-to-r from-accent/50 via-white/80 to-accent/50 bg-[length:200%_auto] animate-[shimmer-flow_3s_linear_infinite] mt-2 group">
                             <button 
                               onClick={handlePromptGenerate}
                               disabled={isProcessingPrompt || !userIdea.trim()}
                               className="w-full py-5 bg-accent text-text-dark font-black uppercase tracking-[0.4em] rounded-2xl shadow-[0_10px_40px_rgba(238,136,0,0.3)] hover:shadow-[0_0_30px_rgba(238,136,0,0.6)] hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:shadow-none neon-glow-button overflow-hidden relative"
                             >
                                {/* Flow overlay effect inside the button too */}
                                <div className="absolute inset-0 animate-glow-flow pointer-events-none opacity-20"></div>
                                
                                {isProcessingPrompt ? (
                                  <RefreshCw className="animate-spin" size={20} />
                                ) : (
                                  <Zap size={20} fill="currentColor" className="animate-bounce" />
                                )}
                                <span className="relative z-10">Phân tích & Tạo kịch bản</span>
                             </button>
                           </div>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Results Display */}
                    {generatedScript && (
                      <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-10"
                      >
                         {/* Script Overview Card */}
                         <div className="relative p-10 rounded-[2.5rem] bg-secondary-bg/60 border border-white/10 overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
                            <h3 className="text-accent text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                              <Film size={18} /> 01. Tổng quan kịch bản
                            </h3>
                            <p className="text-xl text-white/90 font-sans leading-relaxed italic font-light">
                              "{generatedScript.overview}"
                            </p>
                         </div>

                         {/* Storyboard Table Row */}
                         <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between px-2">
                               <h3 className="text-accent text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
                                 <Table size={18} /> 02. Bảng phân cảnh chi tiết
                               </h3>
                               <div className="text-[10px] text-white/30 font-mono uppercase">
                                 {generatedScript.scenes.length} Phân cảnh • {generatedScript.scenes.length * 8} Giây tổng cộng
                               </div>
                            </div>

                            <div className="w-full bg-black/20 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm">
                               <table className="w-full text-left border-collapse">
                                  <thead>
                                     <tr className="bg-white/5 border-b border-white/10">
                                        <th className="p-8 text-[10px] font-black uppercase text-white/30 tracking-widest border-r border-white/10 w-24">STT</th>
                                        <th className="p-8 text-[10px] font-black uppercase text-white/30 tracking-widest border-r border-white/10 w-32">Time</th>
                                        <th className="p-8 text-[10px] font-black uppercase text-white/30 tracking-widest border-r border-white/10 w-1/4">Mô tả kịch bản chi tiết:</th>
                                        {scriptType === 'Whisk' ? (
                                          <>
                                            <th className="p-8 text-[10px] font-black uppercase text-white/30 tracking-widest border-r border-white/10">Prompt tạo ảnh (Whisk AI):</th>
                                            <th className="p-8 text-[10px] font-black uppercase text-white/30 tracking-widest">Prompt tạo chuyển động (Veo 3.1):</th>
                                          </>
                                        ) : (
                                          <th className="p-8 text-[10px] font-black uppercase text-white/30 tracking-widest">Prompt Veo 3.1 (tạo video):</th>
                                        )}
                                     </tr>
                                  </thead>
                                  <tbody>
                                     {generatedScript.scenes.map((scene, idx) => (
                                        <tr key={idx} className="border-b border-white/5 group hover:bg-white/[0.03] transition-all">
                                           <td className="p-8 border-r border-white/10 align-top">
                                              <div className="text-3xl font-display font-black text-accent/50 group-hover:text-accent transition-colors">
                                                {String(scene.id).padStart(2, '0')}
                                              </div>
                                           </td>
                                           <td className="p-8 border-r border-white/10 align-top">
                                              <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 font-mono text-[9px] uppercase tracking-tighter inline-block">
                                                {scene.id * 8 - 8}s - {scene.id * 8}s
                                              </div>
                                           </td>
                                           <td className="p-8 border-r border-white/10 align-top">
                                              <p className="text-sm text-white/70 leading-relaxed font-sans">
                                                {scene.description}
                                              </p>
                                           </td>
                                           
                                           {scriptType === 'Whisk' ? (
                                             <>
                                               <td className="p-8 border-r border-white/10 align-top">
                                                  <div className="relative group/cell">
                                                    <div className="text-[11px] font-mono p-5 rounded-2xl bg-black/60 text-white/80 border border-white/5 min-h-[120px] max-h-[180px] overflow-y-auto custom-scrollbar leading-relaxed">
                                                      {scene.whiskPrompt}
                                                    </div>
                                                    <button 
                                                      onClick={() => handleCopy(scene.whiskPrompt || '', `whisk-${idx}`)}
                                                      className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-accent hover:text-text-dark transition-all opacity-0 group-hover/cell:opacity-100"
                                                      title="Copy Prompt"
                                                    >
                                                      {copiedId === `whisk-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                                                    </button>
                                                  </div>
                                               </td>
                                               <td className="p-8 align-top">
                                                  <div className="relative group/cell">
                                                    <div className="text-[11px] font-mono p-5 rounded-2xl bg-black/60 text-white/50 italic border border-white/5 min-h-[120px] max-h-[180px] overflow-y-auto custom-scrollbar leading-relaxed">
                                                      {scene.movementPrompt}
                                                    </div>
                                                    <button 
                                                      onClick={() => handleCopy(scene.movementPrompt || '', `move-${idx}`)}
                                                      className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-accent hover:text-text-dark transition-all opacity-0 group-hover/cell:opacity-100"
                                                      title="Copy Prompt"
                                                    >
                                                      {copiedId === `move-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                                                    </button>
                                                  </div>
                                               </td>
                                             </>
                                           ) : (
                                              <td className="p-8 align-top">
                                                 <div className="relative group/cell">
                                                    <div className="text-[11px] font-mono p-6 rounded-2xl bg-black/60 text-accent/80 border border-accent/10 min-h-[120px] max-h-[220px] overflow-y-auto custom-scrollbar leading-relaxed">
                                                      {scene.jsonPrompt}
                                                    </div>
                                                    <button 
                                                      onClick={() => handleCopy(scene.jsonPrompt || '', `json-${idx}`)}
                                                      className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-accent hover:text-text-dark transition-all opacity-0 group-hover/cell:opacity-100"
                                                      title="Copy Prompt"
                                                    >
                                                      {copiedId === `json-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                                                    </button>
                                                 </div>
                                              </td>
                                           )}
                                        </tr>
                                     ))}
                                  </tbody>
                               </table>
                            </div>
                         </div>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Left Column */}
                    <div className="w-full lg:w-1/2 p-10 border-r border-border-subtle min-h-[600px] flex flex-col gap-4 font-sans">
                      <div className="flex gap-2">
                        <span className="module-badge">GEMINI 2.0 PRO</span>
                        <span className="module-badge">NANO BANANA</span>
                      </div>
                      <div className="flex-1 rounded-lg border border-dashed border-white/10 bg-black/20 flex flex-col items-center justify-center text-text-primary/30 group hover:border-accent/30 transition-colors">
                        <Cpu size={48} className="mb-4 opacity-20 group-hover:opacity-40 group-hover:text-accent transition-all" />
                        <p className="uppercase tracking-widest text-xs font-mono">Module Configuration</p>
                        <p className="mt-2 text-sm italic">(Content to be added later)</p>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="w-full lg:w-1/2 p-10 min-h-[600px] flex flex-col gap-4 font-sans">
                      <div className="flex gap-2">
                        <span className="module-badge">VEO ENGINE</span>
                        <span className="module-badge">ULTRA LATENCY</span>
                      </div>
                      <div className="flex-1 rounded-lg border border-dashed border-white/10 bg-black/20 flex flex-col items-center justify-center text-text-primary/30 group hover:border-accent/30 transition-colors">
                        <ExternalLink size={48} className="mb-4 opacity-20 group-hover:opacity-40 group-hover:text-accent transition-all" />
                        <p className="uppercase tracking-widest text-xs font-mono">Output Preview</p>
                        <p className="mt-2 text-sm italic">(Content to be added later)</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          ))}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="w-full min-h-[150px] bg-secondary-bg border-t border-border-subtle px-10 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col text-center md:text-left">
          <p className="text-[16px] font-medium text-white mb-2">
            Copyright by: <strong className="text-accent">NGUYEN QUANG PHUONG</strong>
          </p>
          <p className="text-[14px] text-text-primary/50">
            &copy; 2024 All Rights Reserved. AI Character Consistency Generation System.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-8">
          <a href="#" className="text-accent text-[14px] font-bold hover:underline flex items-center gap-2">
            <MessageCircle size={20} />
            Zalo Connect
          </a>
          <a href="#" className="text-accent text-[14px] font-bold hover:underline flex items-center gap-2">
            <Youtube size={20} />
            Youtube Channel
          </a>
        </div>
      </footer>

      {/* Add Section Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-secondary-bg border border-accent p-8 rounded-2xl w-full max-w-md cold-blue-glow"
          >
            <h3 className="text-2xl font-display font-bold text-white mb-6 uppercase tracking-wider">Add New Section</h3>
            <input 
              type="text" 
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="Enter section name..."
              className="w-full bg-main-bg border border-border-subtle rounded-lg p-4 text-white focus:outline-none focus:border-accent mb-6"
              autoFocus
            />
            <div className="flex gap-4">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 py-3 rounded-lg border border-border-subtle hover:bg-white/5 transition-colors uppercase text-sm font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={addSection}
                className="flex-1 py-3 rounded-lg bg-accent text-text-dark hover:bg-accent/90 transition-colors uppercase text-sm font-bold"
              >
                Create
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Section Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-secondary-bg border border-red-500/50 p-8 rounded-2xl w-full max-w-md"
          >
            <h3 className="text-2xl font-display font-bold text-white mb-6 uppercase tracking-wider">Delete Section</h3>
            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 mb-6 custom-scrollbar">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => deleteSection(s.id)}
                  className="w-full text-left p-4 rounded-lg border border-border-subtle hover:border-red-500 hover:bg-red-500/10 transition-all flex justify-between items-center group"
                >
                  <span className="font-medium">{s.title}</span>
                  <Trash2 size={16} className="opacity-0 group-hover:opacity-100 text-red-500 transition-opacity" />
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsDeleteModalOpen(false)}
              className="w-full py-3 rounded-lg border border-border-subtle hover:bg-white/5 transition-colors uppercase text-sm font-bold"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}

      {/* Zoom Image Lightbox */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-10"
            onClick={() => setZoomedImage(null)}
          >
            <button 
              className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-[210]"
              onClick={() => setZoomedImage(null)}
            >
              <X size={32} />
            </button>
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={zoomedImage} 
                alt="Zoomed" 
                className="max-w-full max-h-[90vh] object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
              />
              <div className="absolute bottom-[-50px] left-0 right-0 flex justify-center gap-4">
                <button 
                  onClick={() => handleDownload(zoomedImage)}
                  className="px-6 py-2 bg-accent text-text-dark font-bold rounded-full flex items-center gap-2 hover:scale-105 transition-transform"
                >
                  <Download size={20} />
                  Download Original
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key Modal */}
      <AnimatePresence>
        {isApiKeyModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg bg-secondary-bg border border-accent/20 rounded-3xl p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-accent/20 text-accent">
                    <Key size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold text-white uppercase tracking-tighter italic">
                      CẤU HÌNH API KEY
                    </h3>
                    <p className="text-[10px] text-accent font-bold uppercase tracking-[0.2em]">Manual Input Mode</p>
                  </div>
                </div>
                <button onClick={() => setIsApiKeyModalOpen(false)} className="text-white/40 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-text-primary/70 leading-relaxed">
                  Vui lòng nhập API Key từ <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent-hover transition-colors font-bold">Google AI Studio</a> để sử dụng các mô hình (Gemini 3.1, Veo 3.1).
                </p>
                
                <div className="relative group">
                  <input 
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="Dán API Key của bạn tại đây..."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-white focus:outline-none focus:border-accent transition-all font-mono text-sm pr-12 group-hover:border-white/20"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20">
                    <Lock size={18} />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    onClick={() => setIsApiKeyModalOpen(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-bold text-sm hover:bg-white/10 transition-all uppercase tracking-widest"
                  >
                    HỦY BỎ
                  </button>
                  <button 
                    onClick={() => saveCustomApiKey(customApiKey)}
                    className="flex-[2] py-4 rounded-2xl bg-accent text-text-dark font-black uppercase tracking-widest text-sm shadow-[0_10px_20px_rgba(238,136,0,0.3)] hover:shadow-[0_0_30px_rgba(238,136,0,0.5)] hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    LƯU API KEY
                  </button>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 flex items-start gap-4">
                <div className="p-2 rounded-lg bg-white/10 text-text-primary/60">
                  <Settings2 size={20} />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-white/80 uppercase tracking-widest mb-1 italic">Hướng dẫn bảo mật</h4>
                  <p className="text-[10px] text-text-primary/40 leading-relaxed">
                    API Key của bạn được lưu trữ an toàn trong <span className="text-accent/60">LocalStorage</span> của trình duyệt. Ứng dụng không bao giờ thu thập hay lưu trữ Key của bạn trên bất kỳ máy chủ nào khác.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(238, 136, 0, 0.3);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
