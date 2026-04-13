import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Presentation, 
  CheckCircle2, 
  Circle, 
  Loader2, 
  Download, 
  ChevronRight,
  ListTodo,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

const STEPS = [
  { id: 'parsing', label: '파일 파싱' },
  { id: 'segmenting', label: '세그먼트 분리' },
  { id: 'agenda', label: '안건 및 중요도 분석' },
  { id: 'action_items', label: 'Action Item 추출' },
  { id: 'hwpx', label: 'HWPX 생성' }
];

import { getBasicInfo, getSummary, getActionItems } from './ai';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [transcript, setTranscript] = useState(null);
  const [slides, setSlides] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, processing, completed, error
  const [progress, setProgress] = useState({});
  const [result, setResult] = useState({
    title: "",
    date: "",
    attendees: [],
    summary: "",
    action_items: []
  });

  const handleUpload = async () => {
    if (!transcript || !slides || !apiKey) {
      alert("API 키와 파일들을 모두 입력해주세요.");
      return;
    }

    setStatus('processing');
    const newJobId = `job_${Date.now()}`;
    setJobId(newJobId);
    setProgress({ parsing: 20 });

    try {
      const transcriptText = await transcript.text();
      
      // 1. 기본 정보 추출 (가장 먼저 수행)
      setProgress(prev => ({ ...prev, parsing: 40 }));
      const basicInfo = await getBasicInfo(apiKey, transcriptText);
      setResult(prev => ({ ...prev, ...basicInfo }));
      
      // 상태 전환 (기본 정보가 보이기 시작함)
      setStatus('completed'); 

      // 2. 요약 생성 (비동기 병렬 느낌으로 수행 가능하지만 순서상 두 번째)
      setProgress(prev => ({ ...prev, agenda: 60 }));
      const summary = await getSummary(apiKey, transcriptText);
      setResult(prev => ({ ...prev, summary }));

      // 3. Action Item 추출 (마지막 단계)
      setProgress(prev => ({ ...prev, action_items: 80 }));
      const actionItems = await getActionItems(apiKey, transcriptText);
      setResult(prev => ({ ...prev, action_items: actionItems }));

      setProgress({ parsing: 100, agenda: 100, action_items: 100, hwpx: 100 });

    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-12 text-center">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 mb-4"
        >
          AI Meeting Minutes
        </motion.h1>
        <p className="text-gray-400 text-lg mb-8">녹취록과 발표자료를 기반으로 실행 가능한 회의록을 생성합니다.</p>
        
        {/* API Key Input */}
        <div className="max-w-md mx-auto relative group">
          <input 
            type="password"
            placeholder="Gemini API Key를 입력하세요"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full px-6 py-3 focus:outline-none focus:border-blue-500/50 transition-all text-center"
          />
          <div className="absolute inset-0 rounded-full bg-blue-500/5 blur-xl group-focus-within:bg-blue-500/10 transition-all -z-10"></div>
        </div>
      </header>

      <main>
        {status === 'idle' || status === 'uploading' ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid md:grid-cols-2 gap-8"
          >
            {/* Upload Area 1: Transcript */}
            <FileCard 
              icon={<FileText className="w-8 h-8 text-blue-400" />}
              title="녹취록 (TXT)"
              description="화자명과 발언 내용이 포함된 텍스트 파일"
              onFileSelect={setTranscript}
              file={transcript}
            />
            
            {/* Upload Area 2: Slides */}
            <FileCard 
              icon={<Presentation className="w-8 h-8 text-indigo-400" />}
              title="회의자료 (PPTX)"
              description="안건 추출을 위한 발표 자료"
              onFileSelect={setSlides}
              file={slides}
            />

            <div className="md:col-span-2 flex justify-center mt-8">
              <button 
                onClick={handleUpload}
                disabled={!transcript || !slides || status === 'uploading'}
                className={`px-10 py-4 rounded-full font-bold text-lg transition-all ${
                  (!transcript || !slides) 
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] transform hover:-translate-y-1'
                }`}
              >
                {status === 'uploading' ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin" /> 업로드 중...
                  </span>
                ) : '회의록 생성 시작'}
              </button>
            </div>
          </motion.div>
        ) : status === 'processing' ? (
          <div className="glass-card p-10 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-8 flex items-center gap-3">
              <Loader2 className="animate-spin text-blue-400" /> 회의록 분석 중...
            </h2>
            <div className="space-y-6">
              {STEPS.map((step, idx) => (
                <StepItem 
                  key={step.id} 
                  label={step.label} 
                  progress={progress[step.id] || 0}
                  isFirst={idx === 0}
                  isLast={idx === STEPS.length - 1}
                />
              ))}
            </div>
          </div>
        ) : status === 'completed' && result ? (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="glass-card p-8 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-blue-100">{result.title}</h2>
                    <p className="text-gray-400 mt-1">{result.date} | 참석자: {result.attendees.join(', ')}</p>
                </div>
                <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors">
                    <Download size={20} /> HWPX 다운로드
                </button>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-8">
                    <section className="glass-card p-8">
                        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <FileText size={22} className="text-blue-400" /> 주요 내용 요약
                        </h3>
                        {result.summary ? (
                            <p className="leading-relaxed text-gray-300">{result.summary}</p>
                        ) : (
                            <div className="flex items-center gap-2 text-gray-500 italic">
                                <Loader2 className="animate-spin" size={16} /> 요약 분석 중...
                            </div>
                        )}
                    </section>
                </div>
                
                <section className="glass-card p-8">
                    <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <ListTodo size={22} className="text-indigo-400" /> Action Items
                    </h3>
                    {result.action_items.length > 0 ? (
                        <div className="space-y-4">
                            {result.action_items.map((item, i) => (
                                <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10">
                                    <p className="font-medium mb-2">{item.title}</p>
                                    <div className="flex justify-between text-sm text-gray-400">
                                        <span>👤 {item.owner}</span>
                                        <span>📅 {item.deadline}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-gray-500 italic">
                            <Loader2 className="animate-spin" size={16} /> 할 일 추출 중...
                        </div>
                    )}
                </section>
            </div>
            
            <div className="text-center mt-12">
                <button 
                    onClick={() => setStatus('idle')}
                    className="text-gray-500 hover:text-white transition-colors"
                >
                    처음으로 돌아가기
                </button>
            </div>
          </motion.div>
        ) : (
          <div className="text-center p-20 glass-card">
              <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
              <h2 className="text-2xl font-bold mb-2">오류가 발생했습니다</h2>
              <p className="text-gray-400 mb-6">파일 처리 중 문제가 발생했습니다. 다시 시도해 주세요.</p>
              <button onClick={() => setStatus('idle')} className="bg-white text-black px-6 py-2 rounded-full font-medium">재시도</button>
          </div>
        )}
      </main>
    </div>
  );
}

function FileCard({ icon, title, description, onFileSelect, file }) {
  return (
    <div className="glass-card p-8 hover:border-white/20 transition-all group relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        {icon}
      </div>
      <div className="flex flex-col items-center text-center">
        <div className="p-4 rounded-2xl bg-white/5 mb-6 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-6">{description}</p>
        
        <label className="w-full">
          <input 
            type="file" 
            className="hidden" 
            onChange={(e) => onFileSelect(e.target.files[0])}
            accept={title.includes('TXT') ? '.txt' : '.pptx'}
          />
          <div className={`cursor-pointer w-full py-3 rounded-xl border-2 border-dashed transition-all flex items-center justify-center gap-2 ${
            file ? 'border-blue-500/50 bg-blue-500/10 text-blue-300' : 'border-white/10 hover:border-white/30 text-gray-400'
          }`}>
            {file ? <CheckCircle2 size={18} /> : <Upload size={18} />}
            {file ? file.name : '파일 선택'}
          </div>
        </label>
      </div>
    </div>
  );
}

function StepItem({ label, progress, isFirst, isLast }) {
    const isCompleted = progress === 100;
    const isProcessing = progress > 0 && progress < 100;

    return (
        <div className="relative flex items-center gap-6">
            {!isLast && (
                <div className="absolute left-[15px] top-[30px] w-[2px] h-[calc(100%+24px)] bg-gray-800">
                    <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: isCompleted ? '100%' : '0%' }}
                        className="w-full bg-blue-500"
                    />
                </div>
            )}
            <div className={`z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isCompleted ? 'bg-blue-500' : isProcessing ? 'bg-blue-500/20 border-2 border-blue-500' : 'bg-gray-800'
            }`}>
                {isCompleted ? <CheckCircle2 size={18} /> : isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Circle size={10} className="text-gray-600" />}
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                    <span className={`font-medium ${isCompleted ? 'text-white' : isProcessing ? 'text-blue-300' : 'text-gray-500'}`}>{label}</span>
                    {isProcessing && <span className="text-xs text-blue-400">{progress}%</span>}
                </div>
                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-blue-500"
                    />
                </div>
            </div>
        </div>
    );
}
