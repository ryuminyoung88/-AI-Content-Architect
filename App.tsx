
import React, { useState, useEffect } from 'react';
import { WorkflowStep, ProjectState, Scene, TopicSource } from './types';
import { 
  generateScript, 
  generateVideoPrompts, 
  proofreadJapanese, 
  generateMarketing, 
  generateThumbnails,
  extractTopicsFromUrl,
  extractProtagonistDescription
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
    loading: false,
    protagonistDescription: ''
  });

  const [extractUrl, setExtractUrl] = useState('');
  const [benchmarkUrl, setBenchmarkUrl] = useState('');
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [sources, setSources] = useState<TopicSource[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState<boolean>(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const steps = [
    { id: 1, label: '전략 기획' },
    { id: 2, label: '대본 마스터' },
    { id: 3, label: '영상추출 가이드' },
    { id: 4, label: '마케팅 리포트' },
    { id: 5, label: '임팩트 디자인' },
    { id: 6, label: '최종 대시보드' }
  ];

  const pdPrompt = `# Role: 일본 '스캇토(사이다 썰)' 전문 기획 PD
# Target: 60~70대 일본 여성 (며느리 눈치, 황혼 이혼 고민, 과거 시집살이의 한)
# Task:
조회수가 폭발할 '고부 갈등' 또는 '가족 문제' 시나리오 3개를 기획하라.
# Formula: [발암 상황(Goguma)] 80% + [사이다 해결(Cider)] 20%
# Output Format:
1. **제목:** (클릭을 부르는 자극적인 제목, 예: "유통기한 지난 두부를 며느리가 내 밥상에 올렸다")
2. **갈등 구조:** (누가 누구를 어떻게 괴롭히는가?)
3. **결정적 한 방:** (주인공이 어떻게 상황을 역전시키는가? 예: 숨겨둔 건물 등기권리증 공개)`;

  const writerPrompt = `# Role: 나오키상(Naoki Prize) 수상 작가급의 소설가
# Context: [Step 1의 주제]를 바탕으로 1인칭 독백 드라마 대본 작성.
# Writing Rules (Critical):
1. **지시문 금지:** "상황을 설명합니다" 같은 말 빼고, 바로 주인공의 독백으로 시작하라.
2. **이중 화법(Double Speak):**
   - 겉으로 하는 말(Surface)과 속마음(Inner Voice)을 분리하여 긴장감을 주라.
   - 예) 대사: "어머, 며느리야. 바쁜데 내가 설거지하마." (상냥한 척)
         속마음: (부글부글 끓으며) '지가 밥을 처먹었으면 치워야지! 내가 식모야?'
3. **문체:** 70대 여성의 구어체. 사투리나 옛날 단어를 섞어 리얼함을 살릴 것.
# Output Format:
| 구분 | 화자 | 일본어 대본 | 한국어 의미 | 연기 톤 가이드 |
|:---:|:---:|:---|:---|:---|
| 내레이션 | 시어머니 | (ため息) 皆さん、聞いてくださいよ... | (한숨) 여러분, 제 말 좀 들어보세요... | 억울하고 답답하게 |
| 대사 | 며느리 | お義母さん、それ汚いから捨てますね。 | 어머님, 그거 더러우니까 버릴게요. | 차갑고 무시하듯이 |`;

  const artDirectorPrompt = `# Role: AI Art Director (Web-Novel Style)
# Task: Step 2 대본의 주요 감정선을 표현할 '삽화(Illustration)' 프롬프트를 작성하라.
# Style Guide:
- **Genre:** 80s Showa Retro Manga Style (단카이 세대의 향수 자극) OR Semi-realistic Drama.
- **Focus:** 인물의 **'표정(Micro-expression)'**에 집중.
  - Scene 1 (분노): Clenched teeth, trembling hands, dark shadows.
  - Scene 2 (무시): Young woman smirking with arms crossed, cold eyes.
# Output:
각 씬별 [영문 이미지 프롬프트] 작성.`;


  useEffect(() => {
    const init = async () => {
      if (window.aistudio) {
        setApiKeySelected(await window.aistudio.hasSelectedApiKey());
      }
    };
    init();
  }, []);

  const handleError = (err: any) => {
    console.error("APP_ERROR:", err);
    const msg = err.message || "시스템 오류가 발생했습니다.";
    if (msg.includes("entity was not found")) {
      setApiKeySelected(false);
    } else {
      setError(msg);
      setTimeout(() => setError(null), 5000);
    }
  };

  const onExtract = async () => {
    if (!extractUrl.trim() || isExtracting) return;
    setIsExtracting(true);
    setError(null);
    try {
      const result = await extractTopicsFromUrl(extractUrl);
      setSuggestedTopics(result.topics);
      setSources(result.sources);
      if (result.originalTitle && !result.originalTitle.includes("실패")) {
        setState(p => ({ ...p, topic: result.originalTitle }));
      }
    } catch (e) { handleError(e); }
    finally { setIsExtracting(false); }
  };

  const onStart = async () => {
    if (!state.topic.trim()) return;
    setState(p => ({ ...p, loading: true }));
    try {
      const scenes = await generateScript(state.topic);
      if (!scenes.length) throw new Error("대본을 생성할 수 없습니다. 주제를 다시 확인해 주세요.");
      const protagonistDesc = await extractProtagonistDescription(scenes);
      setState(p => ({ ...p, scenes, protagonistDescription: protagonistDesc, currentStep: WorkflowStep.VIDEO_PROMPT, loading: false }));
    } catch (e) { 
      handleError(e);
      setState(p => ({ ...p, loading: false }));
    }
  };

  const onToStep3 = async () => {
    setState(p => ({ ...p, loading: true }));
    try {
      const prompts = await generateVideoPrompts(state.scenes);
      setState(p => ({ ...p, videoPrompts: prompts, currentStep: WorkflowStep.PROOFREADING, loading: false }));
    } catch (e) { handleError(e); setState(p => ({ ...p, loading: false })); }
  };

  const onToStep4 = async () => {
    setState(p => ({ ...p, loading: true }));
    try {
      const [notes, marketing] = await Promise.all([
        proofreadJapanese(state.scenes),
        generateMarketing(state.topic, state.scenes[0]?.japaneseNarration || "")
      ]);
      setState(p => ({ ...p, proofreadNotes: notes, marketing, currentStep: WorkflowStep.MARKETING, loading: false }));
    } catch (e) { handleError(e); setState(p => ({ ...p, loading: false })); }
  };

  const onGenThumbnails = async () => {
    if (!state.marketing) return;
    setState(p => ({ ...p, loading: true }));
    try {
      const res = await generateThumbnails(state.topic, benchmarkUrl, state.marketing, state.protagonistDescription);
      setState(p => ({ ...p, thumbnailResult: res, loading: false }));
    } catch (e) { handleError(e); setState(p => ({ ...p, loading: false })); }
  };

  const copyFullScript = () => {
    const fullText = state.scenes.map(s => s.japaneseNarration).join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const copyPromptToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopiedPrompt(id);
        setTimeout(() => setCopiedPrompt(null), 2000);
    });
  };

  if (!apiKeySelected) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-8 pro-card p-10 border-sky-500/30">
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Access Required</h1>
          <p className="text-slate-400 text-sm leading-relaxed">이 시스템은 고성능 Pro 모델을 사용합니다. 유료 결제가 활성화된 API 키가 필요합니다.</p>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="block text-sky-500 text-xs font-bold hover:underline">Billing 가이드 확인 ↗</a>
          <button onClick={() => window.aistudio.openSelectKey().then(() => setApiKeySelected(true))} className="btn-primary w-full py-4 uppercase tracking-widest font-black">API 키 설정하기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col font-sans">
      <header className="h-16 fixed top-0 w-full z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl flex items-center px-8 no-print">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sky-500 rounded flex items-center justify-center font-black text-slate-900">D</div>
            <span className="text-white font-bold tracking-tight uppercase">Deepscara <span className="text-sky-500">Architect</span></span>
          </div>
          <button onClick={() => window.location.reload()} className="text-[10px] font-bold text-slate-500 hover:text-white bg-slate-900 px-3 py-1 rounded transition-colors">시스템 리셋</button>
        </div>
      </header>

      <div className="flex-grow pt-24 pb-20 px-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
        <aside className="no-print space-y-1">
          {steps.map(s => (
            <div key={s.id} className={`nav-item ${state.currentStep === s.id ? 'active' : ''}`}>
              <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${state.currentStep === s.id ? 'bg-sky-500 text-slate-900' : 'bg-slate-800 text-slate-500'}`}>
                {s.id}
              </span>
              <span className="font-bold">{s.label}</span>
            </div>
          ))}
        </aside>

        <main className="space-y-12 relative">
          {error && (
            <div className="fixed top-20 right-8 z-[100] animate-fade bg-rose-500 text-white px-6 py-4 rounded-lg shadow-2xl font-bold text-sm">
              {error}
            </div>
          )}

          {state.loading && (
            <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-white font-black text-xs uppercase tracking-[0.2em] animate-pulse">Deepscara AI 로직 연산 중...</p>
            </div>
          )}

          {state.currentStep === WorkflowStep.PLANNING && (
            <div className="space-y-10 animate-fade">
              <div className="space-y-2">
                <h2 className="heading-xl">콘텐츠 <span className="text-sky-500">전략 기획</span></h2>
                <p className="text-slate-500 text-sm">분석할 유튜브 URL을 입력하여 시장 우위 전략을 도출합니다.</p>
              </div>

              <div className="pro-card p-10 space-y-8">
                <div className="space-y-4">
                  <p className="label-xs">레퍼런스 URL 분석</p>
                  <div className="flex gap-2">
                    <input type="text" value={extractUrl} onChange={e => setExtractUrl(e.target.value)} placeholder="분석할 유튜브/웹페이지 링크 입력" className="pro-input flex-grow" />
                    <button onClick={onExtract} disabled={isExtracting} className="btn-primary min-w-[120px]">{isExtracting ? '분석 중...' : '분석 시작'}</button>
                  </div>
                </div>

                {suggestedTopics.length > 0 && (
                  <div className="space-y-6 pt-6 border-t border-slate-800">
                    <p className="label-xs">추천 전략 주제</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {suggestedTopics.map((t, i) => (
                        <button key={i} onClick={() => setState(p => ({...p, topic: t}))} className={`p-4 rounded border text-left text-xs transition-all ${state.topic === t ? 'border-sky-500 bg-sky-500/10 text-white' : 'border-slate-800 bg-slate-900/40 text-slate-500 hover:border-slate-700'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                    {sources.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {sources.map((s, i) => (
                          <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="text-[10px] text-sky-500/60 hover:text-sky-400 bg-sky-500/5 px-2 py-1 rounded border border-sky-500/10">
                            출처: {s.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  <p className="label-xs">최종 선정 주제</p>
                  <textarea value={state.topic} onChange={e => setState(p => ({...p, topic: e.target.value}))} className="pro-input w-full min-h-[120px] text-xl font-bold" placeholder="여기에 최종 콘텐츠 주제를 입력하세요." />
                </div>

                <button onClick={onStart} disabled={!state.topic.trim() || state.loading} className="btn-primary w-full py-5 text-lg font-black shadow-2xl shadow-sky-500/20">
                  대본 아키텍처 설계 시작
                </button>
              </div>
            </div>
          )}

          {state.currentStep === WorkflowStep.VIDEO_PROMPT && (
            <div className="space-y-8 animate-fade">
              <h2 className="heading-xl">대본 <span className="text-sky-500">마스터 설계</span></h2>
              
              <div className="pro-card p-8 border-l-4 border-amber-500 space-y-8 mb-8">
                  <div className="space-y-2">
                      <h3 className="text-xl font-black text-amber-400">신규 드라마 전략: '쇼와(昭和)의 뒷방'</h3>
                      <p className="text-sm text-slate-400">
                          사용자님의 채팅 내역을 기반으로, 일본 시니어의 '감정'을 직접 타격하여 조회수 폭발을 유도하는 '스캇토(사이다 썰)' 드라마 제작 가이드를 제안합니다. 아래 프롬프트를 활용하여 대본 생성을 시도해 보세요.
                      </p>
                  </div>

                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                      <p className="label-xs text-amber-500/80">🔧 제미나이 튜닝 (필수)</p>
                      <p className="text-xs text-slate-400 mt-2">
                          AI Studio(또는 API 호출 시) 우측 패널에서 아래와 같이 설정을 변경하여 제미나이를 '막장 드라마 전문 작가'로 변신시킬 수 있습니다.
                      </p>
                      <ul className="text-xs text-slate-300 list-disc list-inside mt-2 space-y-1">
                          {/* FIX: Updated model name from 'Gemini 1.5 Pro' to 'Gemini 3 Pro' to reflect a valid and recommended model. */}
                          <li><strong>Model:</strong> Gemini 3 Pro</li>
                          <li><strong>Temperature (창의성):</strong> 1.7 이상으로 설정 (감정적, 자극적 표현 유도)</li>
                      </ul>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                        <p className="font-bold text-white">Step 1: '도파민' 소재 발굴 (막장 PD 프롬프트)</p>
                        <div className="relative pro-card p-4 bg-slate-950 border-slate-700">
                            <button onClick={() => copyPromptToClipboard(pdPrompt, 'pd')} className={`absolute top-2 right-2 text-[10px] font-black uppercase px-3 py-1 rounded transition-all ${copiedPrompt === 'pd' ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-slate-900 hover:bg-sky-400'}`}>
                                {copiedPrompt === 'pd' ? '복사 완료' : '프롬프트 복사'}
                            </button>
                            <pre className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed font-mono pt-8 sm:pt-0">
                                {pdPrompt}
                            </pre>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="font-bold text-white">Step 2: 감정 몰입형 대본 집필 (드라마 작가 프롬프트)</p>
                        <div className="relative pro-card p-4 bg-slate-950 border-slate-700">
                            <button onClick={() => copyPromptToClipboard(writerPrompt, 'writer')} className={`absolute top-2 right-2 text-[10px] font-black uppercase px-3 py-1 rounded transition-all ${copiedPrompt === 'writer' ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-slate-900 hover:bg-sky-400'}`}>
                                {copiedPrompt === 'writer' ? '복사 완료' : '프롬프트 복사'}
                            </button>
                            <pre className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed font-mono pt-8 sm:pt-0">
                                {writerPrompt}
                            </pre>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="font-bold text-white">Step 3: 비주얼라이징 (얼굴 없는 드라마 기법)</p>
                        <div className="relative pro-card p-4 bg-slate-950 border-slate-700">
                             <button onClick={() => copyPromptToClipboard(artDirectorPrompt, 'art')} className={`absolute top-2 right-2 text-[10px] font-black uppercase px-3 py-1 rounded transition-all ${copiedPrompt === 'art' ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-slate-900 hover:bg-sky-400'}`}>
                                {copiedPrompt === 'art' ? '복사 완료' : '프롬프트 복사'}
                            </button>
                            <pre className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed font-mono pt-8 sm:pt-0">
                                {artDirectorPrompt}
                            </pre>
                        </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-6 space-y-4">
                      <p className="label-xs text-amber-400">💡 필승 전략 요약</p>
                      <ul className="text-sm text-slate-300 list-disc list-inside space-y-2">
                          <li><strong>성우 캐스팅:</strong> '억울한 할머니'와 '앙칼진 젊은 여자' 목소리 2개를 준비하여 대화 형식으로 만들면 몰입도가 5배 증가합니다.</li>
                          <li><strong>썸네일 공식:</strong> 왼쪽(화난 시어머니 + 빨간 자막), 오른쪽(비웃는 며느리 + 파란 자막)의 대비 구도가 클릭을 유도합니다.</li>
                      </ul>
                  </div>
              </div>

              <div className="pro-card p-6 bg-sky-500/5 border-sky-500/20 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="label-xs text-sky-400 mb-0">일레븐랩스(ElevenLabs) 전송용 통합 대본</p>
                  <button 
                    onClick={copyFullScript}
                    className={`text-[10px] font-black uppercase px-4 py-2 rounded transition-all ${copyFeedback ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-slate-900 hover:bg-sky-400'}`}
                  >
                    {copyFeedback ? '복사 완료!' : '전체 대본 복사'}
                  </button>
                </div>
                <div className="bg-slate-950 p-4 rounded border border-slate-800 max-h-40 overflow-y-auto">
                  <pre className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed font-sans">
                    {state.scenes.map(s => s.japaneseNarration).join('\n')}
                  </pre>
                </div>
              </div>

              <div className="space-y-4">
                {state.scenes.map(s => (
                  <div key={s.sceneNumber} className="pro-card p-8 border-l-4 border-sky-500">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-sky-500 font-black text-sm uppercase">SCENE_0{s.sceneNumber}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-1 rounded font-bold">8초 분량</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="space-y-1">
                          <p className="label-xs">일본어 나레이션</p>
                          <p className="text-2xl font-bold text-white italic">"{s.japaneseNarration}"</p>
                        </div>
                        <div className="space-y-1">
                          <p className="label-xs">한국어 번역 (검토용)</p>
                          <p className="text-sm text-slate-300 font-medium">{s.koreanTranslation}</p>
                        </div>
                      </div>
                      <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800 flex flex-col justify-center">
                        <p className="label-xs text-amber-500/50 mb-2 italic underline">연출 가이드</p>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">{s.koreanGuide}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="sticky bottom-10 py-4 bg-gradient-to-t from-[#0a0c10] to-transparent">
                <button onClick={onToStep3} className="btn-primary w-full py-5 text-lg font-black">영상 추출 프롬프트 생성</button>
              </div>
            </div>
          )}

          {state.currentStep === WorkflowStep.PROOFREADING && (
            <div className="space-y-8 animate-fade">
              <h2 className="heading-xl">영상 추출 <span className="text-sky-500">가이드</span></h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.videoPrompts.map(p => (
                  <div key={p.sceneNumber} className="pro-card p-6 border-slate-800 hover:border-sky-500/30 transition-all">
                    <p className="label-xs text-sky-500 mb-3">Scene {p.sceneNumber} 영문 프롬프트</p>
                    <div className="bg-black/50 p-4 rounded text-[11px] mono text-slate-400 leading-relaxed border border-white/5">
                      {p.englishPrompt}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={onToStep4} className="btn-primary w-full py-5 font-black">마케팅 리포트 생성</button>
            </div>
          )}

          {state.currentStep === WorkflowStep.MARKETING && (
            <div className="space-y-8 animate-fade">
              <h2 className="heading-xl">마케팅 <span className="text-sky-500">전략 리포트</span></h2>
              <div className="pro-card p-10 space-y-10">
                <div className="space-y-4">
                  <p className="label-xs">추천 일본어 제목</p>
                  <div className="space-y-2">
                    {state.marketing?.titles.map((t, i) => (
                      <div key={i} className="p-5 bg-slate-900 rounded border border-slate-800 font-bold text-lg flex items-center gap-4">
                        <span className="text-sky-500/20 text-3xl font-black italic">{i+1}</span>
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <p className="label-xs text-amber-500">썸네일 메인 카피</p>
                    <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-lg text-2xl font-black text-amber-100 text-center">
                      {state.marketing?.thumbnailCopy}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="label-xs text-emerald-500">최적화 태그</p>
                    <div className="flex flex-wrap gap-2">
                      {state.marketing?.hashtags.map((h, i) => (
                        <span key={i} className="px-3 py-1 bg-slate-800 rounded-full text-[11px] font-bold text-slate-400">{h}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={() => setState(p => ({...p, currentStep: WorkflowStep.THUMBNAIL_GEN}))} className="btn-primary w-full py-5 font-black">썸네일 디자인 터미널로 이동</button>
              </div>
            </div>
          )}

          {state.currentStep === WorkflowStep.THUMBNAIL_GEN && (
            <div className="space-y-8 animate-fade">
              <h2 className="heading-xl">임팩트 <span className="text-sky-500">디자인 터미널</span></h2>
              <div className="pro-card p-10 space-y-8">
                <div className="space-y-4">
                  <p className="label-xs">AI 추출 주인공 묘사 (수정 가능)</p>
                  <textarea 
                    value={state.protagonistDescription} 
                    onChange={e => setState(p => ({ ...p, protagonistDescription: e.target.value }))} 
                    placeholder="대본의 주인공을 묘사하는 영문 프롬프트가 여기에 표시됩니다."
                    className="pro-input w-full min-h-[100px] text-sm mono" 
                  />
                </div>
                <div className="space-y-2">
                  <p className="label-xs">벤치마킹 레퍼런스</p>
                  <input type="text" value={benchmarkUrl} onChange={e => setBenchmarkUrl(e.target.value)} placeholder="참고할 레퍼런스 이미지 링크 (선택사항)" className="pro-input w-full" />
                </div>
                <button onClick={onGenThumbnails} className="btn-primary w-full py-5 font-black">4K 썸네일 합성 시작</button>
              </div>
              
              {state.thumbnailResult?.longFormUrl && (
                <div className="space-y-8 animate-fade">
                  <div className="pro-card p-2 bg-slate-900 border-sky-500/20">
                    <img src={state.thumbnailResult.longFormUrl} className="w-full h-auto rounded shadow-2xl" alt="AI 디자인" />
                  </div>
                  <button onClick={() => setState(p => ({...p, currentStep: WorkflowStep.FINAL_REVIEW}))} className="btn-primary w-full py-5 font-black">최종 에셋 검토</button>
                </div>
              )}
            </div>
          )}

          {state.currentStep === WorkflowStep.FINAL_REVIEW && (
            <div className="pro-card p-16 space-y-12 animate-fade border-t-8 border-sky-500">
              <div className="space-y-4">
                <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase">PROJECT <span className="text-sky-500">FINALIZED</span></h1>
                <p className="text-slate-500 text-sm font-medium">Deepscara Content Architecture System - 배포 준비 완료</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-y border-slate-800 py-12">
                <div className="space-y-2">
                  <p className="label-xs">프로젝트 주제</p>
                  <p className="text-xl font-bold text-white">{state.topic}</p>
                </div>
                <div className="space-y-2">
                  <p className="label-xs">영상 구조</p>
                  <p className="text-xl font-bold text-white">{state.scenes.length}개 전략 장면 구성</p>
                </div>
                <div className="space-y-2">
                  <p className="label-xs">에셋 상태</p>
                  <p className="text-xl font-bold text-sky-500 font-mono tracking-widest italic">DEPLOYMENT READY</p>
                </div>
              </div>

              <div className="flex gap-4 no-print">
                <button onClick={() => window.print()} className="btn-primary flex-grow py-6 text-2xl font-black shadow-2xl shadow-sky-500/20">PDF 리포트 내보내기</button>
                <button onClick={() => window.location.reload()} className="bg-slate-900 text-slate-500 px-8 py-6 rounded font-black uppercase text-xs hover:text-white transition-colors">신규 설계</button>
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .label-xs { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b; margin-bottom: 0.5rem; display: block; }
      `}</style>
    </div>
  );
};

export default App;
