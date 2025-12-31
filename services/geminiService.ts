import { GoogleGenAI, Type } from "@google/genai";
import { Scene, VideoPrompt, MarketingData, VISUAL_CONSTANTS, ThumbnailResult, THUMBNAIL_COLOR_STRATEGY, TopicResult, TopicSource } from "../types";

/**
 * 어떤 지저분한 텍스트에서도 JSON만 칼같이 도려내는 함수
 */
const robustJsonParse = (text: string | undefined): any => {
  if (!text) return null;
  try {
    // 1. 마크다운 태그 및 앞뒤 잡설 제거
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');

    let start = -1;
    let end = -1;

    // 객체({})와 배열([]) 중 더 바깥쪽에 있는 것을 찾음
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = lastBrace;
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = lastBracket;
    }

    if (start !== -1 && end !== -1 && end > start) {
      const cleanJson = text.substring(start, end + 1);
      return JSON.parse(cleanJson);
    }
    return JSON.parse(text); // 최후의 수단
  } catch (e) {
    console.error("Critical JSON Extraction Failure:", e, "Raw Text:", text);
    return null;
  }
};

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractProtagonistDescription = async (scenes: Scene[]): Promise<string> => {
  const ai = getAiClient();
  const scriptContent = scenes
    .map(s => `Scene ${s.sceneNumber} (Narration: ${s.japaneseNarration}, Direction: ${s.koreanGuide})`)
    .join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `[SYSTEM] Analyze the following script scenes and extract a concise, English description of the main protagonist(s) suitable for an AI image generation prompt. Focus on visual details like age, gender, clothing, and key emotions. Example: 'An angry 70-year-old Japanese grandmother confronting her smirking 30-year-old daughter-in-law.'\n\nScript:\n${scriptContent}`,
  });
  return response.text?.trim() || VISUAL_CONSTANTS;
};

export const extractTopicsFromUrl = async (url: string): Promise<TopicResult> => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `[SYSTEM] Analyze this URL: ${url}. 
    1. Extract the literal webpage title using Google Search. IMPORTANT: Translate this title into Korean.
    2. Suggest 3 viral topics for Japanese seniors based on the content. IMPORTANT: Provide these topics in Korean.
    3. Return ONLY a JSON object with 'originalTitle' and 'topics' keys.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          originalTitle: { type: Type.STRING, description: "Translated Korean title of the webpage" },
          topics: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "3 suggested viral topics in Korean"
          }
        },
        required: ["originalTitle", "topics"]
      }
    },
  });

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources: TopicSource[] = groundingChunks
    .filter((chunk: any) => chunk.web)
    .map((chunk: any) => ({
      uri: chunk.web.uri,
      title: chunk.web.title || chunk.web.uri,
    }));

  const data = robustJsonParse(response.text);
  return { 
    originalTitle: data?.originalTitle || "제목 추출 실패 (직접 입력)", 
    topics: Array.isArray(data?.topics) ? data.topics : ["추천 주제를 불러올 수 없습니다"], 
    sources 
  };
};

export const generateScript = async (topic: string): Promise<Scene[]> => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `[ROLE] Japanese Senior Expert Writer. [TOPIC] ${topic}. [TASK] 8-second scenes, Japanese/Korean bilingual script. Create a detailed script including narration and production guides.`,
    config: {
      thinkingConfig: { thinkingBudget: 4000 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sceneNumber: { type: Type.NUMBER },
            visualDirection: { type: Type.STRING },
            japaneseNarration: { type: Type.STRING },
            japaneseSubtitles: { type: Type.STRING },
            koreanTranslation: { type: Type.STRING },
            koreanGuide: { type: Type.STRING }
          },
          required: ["sceneNumber", "visualDirection", "japaneseNarration", "japaneseSubtitles", "koreanTranslation", "koreanGuide"]
        }
      }
    }
  });
  return robustJsonParse(response.text) || [];
};

export const generateVideoPrompts = async (scenes: Scene[]): Promise<VideoPrompt[]> => {
  const ai = getAiClient();
  const input = scenes.map(s => `Scene ${s.sceneNumber}: ${s.visualDirection}`).join("\n");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Convert the following visual directions into English Video Prompts for AI generation. Style: ${VISUAL_CONSTANTS}.\n${input}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sceneNumber: { type: Type.NUMBER },
            englishPrompt: { type: Type.STRING }
          },
          required: ["sceneNumber", "englishPrompt"]
        }
      }
    }
  });
  return robustJsonParse(response.text) || [];
};

export const proofreadJapanese = async (scenes: Scene[]): Promise<string> => {
  const ai = getAiClient();
  const text = scenes.map(s => s.japaneseNarration).join("\n");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Proofread the following Japanese script to ensure it is natural and respectful for Japanese seniors:\n${text}`
  });
  return response.text || "교열 완료";
};

export const generateMarketing = async (topic: string, script: string): Promise<MarketingData> => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this topic "${topic}" and script summary, generate 3 viral Japanese titles, a main thumbnail copy, and relevant hashtags.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          titles: { type: Type.ARRAY, items: { type: Type.STRING } },
          thumbnailCopy: { type: Type.STRING },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["titles", "thumbnailCopy", "hashtags"]
      }
    }
  });
  return robustJsonParse(response.text) || { titles: [], thumbnailCopy: "", hashtags: [] };
};

export const generateThumbnails = async (topic: string, benchmarkUrl: string, marketing: MarketingData, protagonistDescription: string): Promise<ThumbnailResult> => {
  const ai = getAiClient();
  const characterStyle = protagonistDescription || VISUAL_CONSTANTS;
  const basePrompt = `Professional YouTube thumbnail. Japanese text: "${marketing.thumbnailCopy}". Style: ${characterStyle}. Color Strategy: ${THUMBNAIL_COLOR_STRATEGY}. High contrast, 4K resolution.`;

  try {
    const [longForm, shorts] = await Promise.all([
      ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: `16:9 Landscape aspect ratio: ${basePrompt}` }] },
        config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } }
      }),
      ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: `9:16 Portrait aspect ratio: ${basePrompt}` }] },
        config: { imageConfig: { aspectRatio: "9:16", imageSize: "1K" } }
      })
    ]);

    const extract = (res: any) => {
      const parts = res.candidates?.[0]?.content?.parts || [];
      for (const p of parts) if (p.inlineData?.data) return `data:image/png;base64,${p.inlineData.data}`;
      return "";
    };

    return { analysis: "디자인 분석 완료", longFormUrl: extract(longForm), shortsUrl: extract(shorts) };
  } catch (e) {
    return { analysis: "디자인 생성 오류", longFormUrl: "", shortsUrl: "" };
  }
};
