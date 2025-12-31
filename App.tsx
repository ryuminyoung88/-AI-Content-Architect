
import React, { useState, useEffect } from 'react';
import { 
  WorkflowStep, 
  ProjectState, 
  Scene,
  VideoPrompt,
  MarketingData,
  ThumbnailResult,
  TopicSource
} from './types';
import { 
  generateScript, 
  generateVideoPrompts, 
  proofreadJapanese, 
  generateMarketing,
  generateThumbnails,
  extractTopicsFromUrl
} from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<ProjectState>({
    topic: '',
    scenes: [],
    videoPrompts: [],
    proofreadNotes: '',
    marketing: null,
    thumbnailResult: null,
    currentStep: WorkflowStep.PLANNING,
    loading: false
  });

  const [benchmarkUrl, setBenchmarkUrl] = useState('');
  const [extractUrl, setExtractUrl] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [copyType, setCopyType] = useState<string | null>(null);
  const [error, setError] = useState<{message: string, isQuota: boolean} | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const isYoutube = extractUrl.includes('youtube.com/') || extractUrl.includes('youtu.be/');
      if (isYoutube && extractUrl.length > 15) {
        handleExtractTopics();
      }
    }, 1500); 
    return () => clearTimeout(timer);
  }, [extractUrl]);

  const steps = [
    { id: 1, label: '전략 기획', code: 'STRAT' },
    { id: 2, label: '대본 마스터', code: 'SCRIPT' },
    { id: 3, label: '영상추출 가이드', code: 'VISUAL' },
    { id: 4, label: '마케팅 리포트', code: 'MARKET' },
    { id: 5, label: '임팩트 디자인', code: 'DESIGN' },
    { id: 6, label: '최종 대시보드', code: 'FINAL' }
  ];

  const handleApiKeyError = async (err: any) => {
    console.error("API Error Detail:", err);
    const errorMsg = err.message || "";
    const isQuota = errorMsg.includes("quota") || errorMsg.includes("429") || errorMsg.includes("limit");
    
    if (isQuota) {
      setError({
        message: "현재 무료 티어 API 사용 한도를 초과했습니다. Gemini 3 Pro 및 검색 도구는 무료 계정에서 매우 엄격한 제한(RPM)이 적용됩니다. 중단 없는 작업을 위해 '결제가 연결된 유료 프로젝트의 API 키'를 사용하시는 것을 강력히 권장합니다.",
        isQuota: true
      });
    } else if (errorMsg.includes("Requested entity was not found")) {
      setError({
        message: "선택된 API 키가 유효하지 않거나 삭제되었습니다. 아래 버튼을 눌러 키를 다시 설정해주세요.",
        isQuota: false
      });
      // @ts-ignore
      if (window.aistudio) await window.aistudio.openSelectKey();
    } else {
      setError({
        message: "시스템 통신 중 예기치 못한 오류가 발생했습니다: " + errorMsg,
        isQuota: false
      });
    }
  };

  const openKeyDialog = async () => {
    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setError(null);
      // 키 선택 후 바로 재시도를 안내하거나 자동으로 재시도하게 할 수 있음
    }
  };

  const handleExtractTopics = async () => {
    if (!extractUrl.trim() || isExtracting) return;
    setIsExtracting(true);
    setOriginalTitle('');
    setSuggestedTopics([]);
    setError(null);
    try {
      const result = await extractTopicsFromUrl(extractUrl);
      setOriginalTitle(result.originalTitle);
      setSuggestedTopics(result.topics);
      if (result.topics.length > 0) {
        setState(prev => ({ ...prev, topic: result.topics[0] }));
      }
    } catch (err) { 
      handleApiKeyError(err);
    } finally { 
      setIsExtracting(false); 
    }
  };

  const handleStartPlanning = async () => {
    if (!state.topic.trim()) return;
    setState(prev => ({ ...prev, loading: true }));
    setError(null);
    try {
      const result = await generateScript(state.topic);
      setState(prev => ({ ...prev, scenes: result, currentStep: WorkflowStep.VIDEO_PROMPT, loading: false }));
    } catch (err) { 
      handleApiKeyError(err);
      setState(prev => ({ ...prev, loading: false })); 
    }
  };

  const handleToStep3 = async () => {
    setState(prev => ({ ...prev, loading: true }));
    setError(null);
    try {
      const prompts = await generateVideoPrompts(state.scenes);
      setState(prev => ({ ...prev, videoPrompts: prompts, currentStep: WorkflowStep.PROOFREADING, loading: false }));
    } catch (err) { 
      handleApiKeyError(err);
      setState(prev => ({ ...prev, loading: false })); 
    }
  };

  const handleToStep4 = async () => {
    setState(prev => ({ ...prev, loading: true }));
    setError(null);
    try {
      const [notes, marketing] = await Promise.all([
        proofreadJapanese(state.scenes),
        generateMarketing(state.topic, state.scenes[0]?.japaneseNarration || "")
      ]);
      setState(prev => ({ ...prev, proofreadNotes: notes, marketing, currentStep: WorkflowStep.MARKETING, loading: false }));
    } catch (err) { 
      handleApiKeyError(err);
      setState(prev => ({ ...prev, loading: false })); 
    }
  };

  const handleGenThumbnails = async () => {
    if (!state.marketing) return;
    setState(prev => ({ ...prev, loading: true }));
    setError(null);
    try {
      const result = await generateThumbnails(state.topic, benchmarkUrl, state.marketing);
      setState(prev => ({ ...prev, thumbnailResult: result, loading: false }));
    } catch (err) { 
      handleApiKeyError(err);
      setState(prev => ({ ...prev, loading: false })); 
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopyType(type);
    setTimeout(() => setCopyType(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0c10]">
      <header className="app-header h-16 fixed top-0 w-full no-print flex items-center px-8 border-b border-slate-800">
        <div className="max-w-[1400px] mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-sky-500 rounded-md flex items-center justify-center">
              <span className="text-slate-900 font-extrabold text-sm">D</span>
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm tracking-tight">DEEPSCARA <span className="text-sky-500">ENTERPRISE</span></span>
              <span className="text-[10px] text-slate-500 font-medium mono uppercase tracking-wider">Session Admin v5.8.0-stable</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">AI Core Ready</span>
             </div>
             <button onClick={() => window.location.reload()} className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors uppercase">초기화</button>
          </div>
        </div>
      </header>

      <div className="flex-grow pt-24 pb-20 px-8 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">
        <aside className="no-print">
          <div className="sticky top-24 space-y-1.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mb-4">Pipeline Workflow</p>
            {steps.map((s) => (
              <div 
                key={s.id} 
                className={`nav-item ${state.currentStep === s.id ? 'active' : ''}`}
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold mono ${state.currentStep === s.id ? 'bg-sky-500 text-slate-900' : 'bg-slate-800 text-slate-500'}`}>
                  {s.id}
                </div>
                <span>{s.label}</span>
                {state.currentStep > s.id && (
                  <span className="ml-auto text-sky-500 text-[10px] font-bold">DONE</span>
                )}
              </div>
            ))}
          </div>
        </aside>

        <main className="animate-fade">
          {error && (
            <div className="mb-8 p-6 bg-rose-500/10 border-2 border-rose-500/50 rounded-xl animate-fade flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20">
                  <span className="text-white font-black text-xl">!</span>
                </div>
                <div>
                  <h4 className="text-rose-500 font-bold text-lg mb-1">{error.isQuota ? "리소스 한도 초과 (Quota Exceeded)" : "통신 오류"}</h4>
                  <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">{error.message}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-sky-400 text-xs font-bold underline hover:text-sky-300 transition-colors italic">Google Cloud 유료 결제 설정 가이드</a>
                    <span className="text-slate-600 text-[10px] mono">ERR_CODE: {error.isQuota ? "429_LIMIT" : "SYS_FAIL"}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={openKeyDialog}
                  className="px-6 py-3 bg-white text-slate-900 rounded-lg font-bold text-sm hover:bg-sky-500 hover:text-white transition-all whitespace-nowrap shadow-xl"
                >
                  본인 유료 API 키 연결하기
                </button>
                {error.isQuota && (
                   <p className="text-[10px] text-rose-400 text-center font-bold animate-pulse">※ 무료 티어는 분당 요청 수가 매우 낮습니다.</p>
                )}
              </div>
            </div>
          )}

          {(state.loading || isExtracting) && (
            <div className="fixed inset-0 bg-slate-950/90 z-[100] flex flex-col items-center justify-center backdrop-blur-sm">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-2 h-2 bg-sky-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                 <div className="w-2 h-2 bg-sky-500 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                 <div className="w-2 h-2 bg-sky-500 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
               </div>
               <div className="flex flex-col items-center">
                 <p className="text-white font-bold text-sm tracking-widest uppercase mb-2">
                   {isExtracting ? 'Analyzing URL Architecture...' : 'Processing Deep Intelligence...'}
                 </p>
                 <div className="w-48 h-[2px] bg-slate-800 rounded-full overflow-hidden relative">
                   <div className="absolute inset-0 bg-sky-500 animate-[shimmer_1.5s_infinite_linear]" style={{
                     width: '40%',
                     left: '-40%',
                     backgroundImage: 'linear-gradient(90deg, transparent, #38bdf8, transparent)',
                   }}></div>
                 </div>
                 <p className="text-slate-600 text-[10px] mt-4 mono tracking-tighter">Please wait while the AI handles high-complexity tasks.</p>
               </div>
            </div>
          )}

          {state.currentStep === WorkflowStep.PLANNING && (
            <div className="space-y-10">
              <div className="border-b border-slate-800 pb-8">
                <span className="badge badge-accent mb-4 inline-block">Architecture Analysis</span>
                <h2 className="heading-xl mb-4">콘텐츠 비즈니스 <br/> <span className="text-sky-500">전략 수립</span></h2>
              </div>
              <div className="pro-card p-8 space-y-8">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={extractUrl} 
                    onChange={e => setExtractUrl(e.target.value)} 
                    placeholder="분석할 유튜브 URL 입력" 
                    className="pro-input flex-grow"
                  />
                  <button onClick={handleExtractTopics} className="btn-primary" disabled={isExtracting}>추출</button>
                </div>

                {originalTitle && (
                  <div className="p-6 bg-slate-900 border border-sky-500/30 rounded-lg animate-fade">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase mb-2 tracking-widest">Source Context (원본 제목)</p>
                    <h4 className="text-2xl font-black text-white italic">"{originalTitle}"</h4>
                  </div>
                )}

                {suggestedTopics.length > 0 && (
                  <div className="space-y-4 animate-fade">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Algorithm Suggested Topics (추천 주제)</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {suggestedTopics.map((t, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => setState(p => ({...p, topic: t}))} 
                          className={`p-6 rounded-lg border-2 text-left transition-all ${state.topic === t ? 'border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}
                        >
                          <span className="text-slate-300 font-bold block">{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Final Project Topic (최종 확정 주제)</p>
                  <textarea 
                    value={state.topic} 
                    onChange={e => setState(p => ({...p, topic: e.target.value}))}
                    className="pro-input w-full min-h-[120px] text-xl font-bold"
                    placeholder="프로젝트 주제를 확정하세요"
                  />
                </div>
                <button onClick={handleStartPlanning} disabled={!state.topic.trim()} className="btn-primary w-full py-4">대본 및 시나리오 생성</button>
              </div>
            </div>
          )}

          {state.currentStep === WorkflowStep.VIDEO_PROMPT && (
            <div className="space-y-10 animate-fade">
              <div className="border-b border-slate-800 pb-8 flex justify-between items-end">
                <h2 className="heading-xl">야마모토 켄지의 <span className="text-sky-500">심층 대본</span></h2>
                <button 
                  onClick={() => copyToClipboard(state.scenes.map(s => s.japaneseNarration).join('\n'), 'all-script')}
                  className={`px-6 py-3 rounded-full font-bold text-xs transition-all shadow-lg ${copyType === 'all-script' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900 hover:bg-sky-500 hover:text-white'}`}
                >
                  {copyType === 'all-script' ? '전체 대본 복사 완료!' : '일본어 전체 내레이션 복사 (ElevenLabs용)'}
                </button>
              </div>
              <div className="space-y-6">
                {state.scenes.map(s => (
                  <div key={s.sceneNumber} className="pro-card p-8 space-y-6 border-l-4 border-sky-500">
                    <div className="flex justify-between items-center">
                      <span className="mono text-2xl font-black text-slate-700">SCENE #0{s.sceneNumber}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-2">Japanese Narration</p>
                      <p className="text-2xl font-bold text-white leading-relaxed italic">"{s.japaneseNarration}"</p>
                    </div>
                    <div className="bg-emerald-500/5 p-6 rounded-lg border border-emerald-500/30">
                      <div className="flex items-center gap-2 mb-3">
                         <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                         <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest">Kenji's Production Guide (제작 가이드)</span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed font-medium">{s.koreanGuide}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 mb-1 uppercase">Visual Subtitle</p>
                        <p className="text-sm text-slate-300 font-bold">{s.japaneseSubtitles}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 mb-1 uppercase">KR Translation</p>
                        <p className="text-sm text-slate-500 italic">{s.koreanTranslation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleToStep3} className="btn-primary w-full py-4 shadow-xl shadow-sky-500/10">영상 추출 프롬프트 생성</button>
            </div>
          )}

          {state.currentStep === WorkflowStep.PROOFREADING && (
             <div className="space-y-10 animate-fade">
                <div className="border-b border-slate-800 pb-8">
                  <h2 className="heading-xl">영상추출 <span className="text-sky-500">파라미터</span></h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {state.videoPrompts.map(vp => (
                    <div key={vp.sceneNumber} className="pro-card p-6">
                      <p className="bg-slate-950 p-4 rounded text-xs mono text-slate-400 leading-relaxed">{vp.englishPrompt}</p>
                    </div>
                  ))}
                </div>
                <button onClick={handleToStep4} className="btn-primary w-full py-4">마케팅 분석 실행</button>
             </div>
          )}

          {state.currentStep === WorkflowStep.MARKETING && (
             <div className="space-y-10 animate-fade">
                <div className="border-b border-slate-800 pb-8">
                  <h2 className="heading-xl">성과 최적화 <span className="text-sky-500">데이터</span></h2>
                </div>
                <div className="pro-card p-8 border-l-4 border-sky-500 space-y-10">
                   <div className="space-y-4">
                      <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest">Kenji's Strategy Note</p>
                      <p className="text-lg text-slate-300 italic bg-slate-950 p-4 rounded border border-slate-800">"{state.proofreadNotes}"</p>
                   </div>
                   
                   <div className="space-y-4">
                      <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest">Optimized Titles (유튜브 제목)</p>
                      <div className="space-y-3">
                        {state.marketing?.titles.map((t, i) => (
                          <div key={i} className="group flex justify-between items-center p-4 bg-slate-900 border border-slate-800 rounded hover:border-sky-500/50 transition-colors">
                            <span className="text-white font-bold">{t}</span>
                            <button 
                              onClick={() => copyToClipboard(t, `title-${i}`)}
                              className={`text-[10px] px-3 py-1 rounded font-bold transition-all ${copyType === `title-${i}` ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-sky-500 group-hover:text-slate-900'}`}
                            >
                              {copyType === `title-${i}` ? '복사됨!' : '제목 복사'}
                            </button>
                          </div>
                        ))}
                      </div>
                   </div>

                   <div className="space-y-4 pt-6 border-t border-slate-800">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest">Viral Hashtags (해시태그)</p>
                        <button 
                          onClick={() => copyToClipboard(state.marketing?.hashtags.join(' ') || '', 'hashtags')}
                          className={`text-[11px] px-4 py-2 rounded-full font-bold transition-all ${copyType === 'hashtags' ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-slate-900 shadow-lg shadow-sky-500/20'}`}
                        >
                          {copyType === 'hashtags' ? '모든 태그 복사 완료!' : '해시태그 전체 복사'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 p-6 bg-slate-950 rounded-lg border border-slate-900">
                         {state.marketing?.hashtags.map((tag, i) => (
                           <span key={i} className="px-3 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-400 mono">{tag}</span>
                         ))}
                      </div>
                   </div>
                </div>
                <button onClick={() => setState(p => ({...p, currentStep: WorkflowStep.THUMBNAIL_GEN}))} className="btn-primary w-full py-4">썸네일 디자인 터미널 오픈</button>
             </div>
          )}

          {state.currentStep === WorkflowStep.THUMBNAIL_GEN && (
             <div className="space-y-10 animate-fade">
                <div className="border-b border-slate-800 pb-8">
                  <h2 className="heading-xl">썸네일 <span className="text-sky-500">디자인 결과</span></h2>
                </div>
                <div className="pro-card p-8 space-y-4">
                  <input type="text" value={benchmarkUrl} onChange={e => setBenchmarkUrl(e.target.value)} className="pro-input w-full" placeholder="벤치마킹 URL" />
                  <button onClick={handleGenThumbnails} className="btn-primary w-full">썸네일 생성 및 분석</button>
                </div>
                {state.thumbnailResult && (
                  <div className="space-y-8 animate-fade">
                     <div className="pro-card p-8 bg-rose-500/5 border-l-4 border-rose-500">
                        <p className="text-slate-200 italic leading-relaxed">{state.thumbnailResult.analysis}</p>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <img src={state.thumbnailResult.longFormUrl} className="pro-card p-2 w-full" alt="16:9" />
                        <img src={state.thumbnailResult.shortsUrl} className="pro-card p-2 w-full max-w-[300px] mx-auto" alt="9:16" />
                     </div>
                     <button onClick={() => setState(p => ({...p, currentStep: WorkflowStep.FINAL_REVIEW}))} className="btn-primary w-full py-6 text-xl bg-white text-slate-900">최종 리포트 컴파일링</button>
                  </div>
                )}
             </div>
          )}

          {state.currentStep === WorkflowStep.FINAL_REVIEW && (
            <div className="space-y-10 animate-fade py-6 printable-report-section">
              <div className="print-only mb-12 border-b-8 border-sky-500 pb-8">
                <h1 className="text-4xl font-black text-sky-900">DEEPSCARA ANALYSIS REPORT</h1>
              </div>

              <div className="pro-card p-10 space-y-8">
                <h3 className="text-xl font-bold text-sky-500 border-b border-slate-800 pb-6">01. 프로젝트 개요</h3>
                <p className="text-lg font-bold text-sky-500 bg-sky-500/5 p-4 rounded border border-sky-500/30 italic">"{state.topic}"</p>
              </div>

              <div className="pro-card p-10 space-y-8">
                <h3 className="text-xl font-bold text-sky-500 border-b border-slate-800 pb-6">02. 켄지 스타일 시나리오 및 한국어 가이드</h3>
                <div className="space-y-6">
                  {state.scenes.map(s => (
                    <div key={s.sceneNumber} className="bg-slate-950/30 p-6 rounded border border-slate-800 space-y-4">
                      <p className="text-[10px] font-bold text-slate-600 mono">SCENE #0{s.sceneNumber}</p>
                      <p className="text-xl font-bold text-white italic">"{s.japaneseNarration}"</p>
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded text-sm text-emerald-100">
                        <strong>제작 가이드:</strong> {s.koreanGuide}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="no-print pt-10 flex gap-4">
                <button onClick={handlePrint} className="flex-grow btn-primary py-6 text-xl">PDF 분석 리포트 저장</button>
                <button onClick={() => window.location.reload()} className="px-10 py-6 border border-slate-800 rounded-lg text-slate-500 font-bold">시스템 재부팅</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
