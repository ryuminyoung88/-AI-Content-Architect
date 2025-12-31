
export enum WorkflowStep {
  PLANNING = 1,
  VIDEO_PROMPT = 2,
  PROOFREADING = 3,
  MARKETING = 4,
  THUMBNAIL_GEN = 5,
  FINAL_REVIEW = 6
}

export interface Scene {
  sceneNumber: number;
  visualDirection: string;
  japaneseNarration: string;
  japaneseSubtitles: string;
  koreanTranslation: string;
  koreanGuide: string;
}

export interface VideoPrompt {
  sceneNumber: number;
  englishPrompt: string;
}

export interface MarketingData {
  titles: string[];
  thumbnailCopy: string;
  hashtags: string[];
}

export interface ThumbnailResult {
  longFormUrl: string;
  shortsUrl: string;
  analysis: string;
}

export interface TopicSource {
  uri: string;
  title: string;
}

export interface TopicResult {
  originalTitle: string;
  topics: string[];
  sources: TopicSource[];
}

export interface ProjectState {
  topic: string;
  scenes: Scene[];
  videoPrompts: VideoPrompt[];
  proofreadNotes: string;
  marketing: MarketingData | null;
  thumbnailResult: ThumbnailResult | null;
  currentStep: WorkflowStep;
  loading: boolean;
  protagonistDescription: string;
}

export const VISUAL_CONSTANTS = "A Japanese elderly man, 72 years old, wise and kind face, round tortoise-shell glasses, small mole under left eye, beige cashmere cardigan, white shirt, silver hair neatly combed back, gentle Duchenne smile.";

export const THUMBNAIL_COLOR_STRATEGY = `
[Thumbnail Professional Color Skill]
1. 위험, 경고 (Danger/Warning) = 빨간색 (Red: #FF0000)
2. 숫자, 특정 부위 (Numbers/Focus Area) = 노란색 (Yellow: #FFFF00)
3. 해결책, 희망사항 (Solution/Hope) = 연두색 (Green: #00FF00)
4. 배경 및 자막 (Background & Text): 대비를 위해 검정/어두운 배경 위 굵은 폰트 필수.
`;

// FIX: Defined an explicit AIStudio interface to resolve declaration conflicts for window.aistudio.
// This addresses the TypeScript error about subsequent property declarations having different types.
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

// AI Studio 환경과의 통신을 위해 `window.aistudio` 객체의 타입을 전역으로 선언합니다.
// 이 타입이 없으면 TypeScript 컴파일러가 `window.aistudio`를 인식하지 못해 빌드 오류가 발생합니다.
declare global {
  interface Window {
    aistudio: AIStudio;
  }
}
