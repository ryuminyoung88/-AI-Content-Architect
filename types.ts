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

// AI Studio 연동을 위한 전역 타입 선언
// FIX: Defined AIStudio interface to resolve conflicting property declarations on the Window object.
export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    aistudio: AIStudio;
  }
}

export {}; // 모듈 시스템에서 전역 선언을 인식시키기 위해 추가