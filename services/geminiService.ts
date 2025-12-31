
import { GoogleGenAI, Type } from "@google/genai";
import { Scene, VideoPrompt, MarketingData, VISUAL_CONSTANTS, ThumbnailResult, THUMBNAIL_COLOR_STRATEGY, TopicResult, TopicSource } from "../types";

export const extractTopicsFromUrl = async (url: string): Promise<TopicResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // 구글 검색(googleSearch) 사용 시 responseMimeType: "application/json"은 지원되지 않으므로 제거함
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      [CRITICAL TASK] 
      제공된 URL (${url})을 구글 검색 도구로 직접 방문하여 해당 유튜브 영상의 "실제 원본 제목"을 추출하고, 알고리즘 최적화 제목들을 생성하세요.
      
      결과는 반드시 아래의 JSON 형식으로만 응답하세요. 다른 설명은 생략하세요:
      {
        "originalTitle": "추출된 실제 제목",
        "topics": ["최적화된 주제 1", "최적화된 주제 2", "최적화된 주제 3"]
      }
    `,
    config: {
      tools: [{ googleSearch: {} }],
      // responseMimeType 및 responseSchema는 검색 도구와 동시 사용 불가하여 제거
    },
  });

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources: TopicSource[] = groundingChunks
    .filter((chunk: any) => chunk.web)
    .map((chunk: any) => ({
      uri: chunk.web.uri,
      title: chunk.web.title || chunk.web.uri,
    }));

  try {
    // 텍스트에서 JSON 부분만 추출 (마크다운 코드 블록 제거 등)
    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const data = JSON.parse(jsonStr);
    
    return { 
      originalTitle: data.originalTitle || "제목 추출 실패", 
      topics: data.topics || [], 
      sources 
    };
  } catch (e) {
    console.error("JSON Parsing Error during extraction:", e);
    return { originalTitle: "분석 완료 (파싱 오류)", topics: [], sources };
  }
};

export const generateScript = async (topic: string): Promise<Scene[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `
      # Role: 일본 시니어 헬스케어 방송 작가 (Persona: 야마모토 켄지)
      # Target: 70대 일본 시니어 (외로움과 건강 염려가 있음)
      # Input Topic: ${topic}

      # Critical Instructions for Korean Producer:
      1. **일본어 대본 구성**: 시니어의 공감을 얻을 수 있는 따뜻한 구어체로 작성 (japaneseNarration).
      2. **한국어 제작 가이드 (koreanGuide)**: 이 장면에서 왜 이런 표현을 썼는지, 시니어의 어떤 심리를 공략했는지, 한국인 제작자가 이해할 수 있게 **한국어로 아주 상세히 설명**하십시오.
      3. **구조**: 8초 단위 씬으로 구성.

      # Output format: JSON Array
    `,
    config: {
      thinkingConfig: { thinkingBudget: 2000 },
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
  return JSON.parse(response.text || "[]");
};

export const generateVideoPrompts = async (scenes: Scene[]): Promise<VideoPrompt[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const promptInput = scenes.map(s => `Scene ${s.sceneNumber}: ${s.visualDirection}`).join("\n");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `변환 규칙: "${VISUAL_CONSTANTS}"를 모든 프롬프트 시작에 넣으세요. 다음 씬들을 AI 비디오용 영문 프롬프트로 변환하세요: \n${promptInput}`,
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
  return JSON.parse(response.text || "[]");
};

export const proofreadJapanese = async (scenes: Scene[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const textToProof = scenes.map(s => s.japaneseNarration).join("\n");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `시니어 접근성 관점에서 다음 일본어 대본을 교열하세요: \n${textToProof}`
  });
  return response.text || "";
};

export const generateMarketing = async (topic: string, script: string): Promise<MarketingData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `주제 "${topic}"에 대해 일본 시니어 타겟 유튜브 제목 3종, 썸네일 카피(반드시 일본어로만!), 해시태그 10개를 생성하세요. 모든 텍스트 결과물(제목, 카피, 해시태그)은 반드시 일본어로만 작성해야 하며, 한국어는 단 한 글자도 포함하지 마십시오. JSON으로 반환하세요.`,
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
  return JSON.parse(response.text || "{}");
};

export const generateThumbnails = async (topic: string, benchmarkUrl: string, marketing: MarketingData): Promise<ThumbnailResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const analysisResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `유튜브 영상 벤치마킹 분석 리포트를 작성하세요. 대상: ${benchmarkUrl}, 주제: ${topic}. 시니어 시장 관점에서 서술하세요.`
  });
  const analysis = analysisResponse.text || "분석 리포트를 생성할 수 없습니다.";

  const basePrompt = `YouTube thumbnail for "${topic}". ONLY Japanese text shown: "${marketing.thumbnailCopy}". ABSOLUTELY NO KOREAN CHARACTERS OR HANGUL. USE JAPANESE ONLY. Style: "${VISUAL_CONSTANTS}". ${THUMBNAIL_COLOR_STRATEGY} 4k, photorealistic, professional lighting.`;

  try {
    const [longFormResponse, shortsResponse] = await Promise.all([
      ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Aspect ratio 16:9, landscape: ${basePrompt}` }] },
        config: { imageConfig: { aspectRatio: "16:9" } }
      }),
      ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Aspect ratio 9:16, portrait: ${basePrompt}` }] },
        config: { imageConfig: { aspectRatio: "9:16" } }
      })
    ]);

    const extractImage = (response: any) => {
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return "";
    };

    return { analysis, longFormUrl: extractImage(longFormResponse), shortsUrl: extractImage(shortsResponse) };
  } catch (error) {
    return { analysis: analysis + "\n\n(이미지 생성 엔진 오류)", longFormUrl: "", shortsUrl: "" };
  }
};
