import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * AI 응답에서 JSON 부분을 안전하게 추출합니다.
 */
function extractJSON(text) {
  try {
    // 1. ```json ... ``` 블록 추출 시도
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = match ? match[1] : text;
    
    // 2. 혹시나 있을지 모르는 마크다운 기호 제거 후 파싱
    return JSON.parse(jsonStr.replace(/^[^{]*|[^}]*$/g, ""));
  } catch (e) {
    console.error("JSON Parsing failed for text:", text);
    throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }
}

// 1. 기본 정보 추출
export async function getBasicInfo(apiKey, transcriptText) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    다음 회의 녹취록을 분석하여 회의 요약과 참석자 등 기본 정보를 JSON으로 반환하세요.
    반드시 유효한 JSON 형식으로만 응답하세요.
    - 출력 JSON: { "title": "제목", "date": "YYYY-MM-DD", "attendees": ["이름1", "이름2"] }
    - 녹취록: ${transcriptText.substring(0, 8000)}
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return extractJSON(text);
  } catch (err) {
    if (err.message.includes("API key")) throw new Error("유효하지 않은 API Key입니다.");
    throw err;
  }
}

// 2. 주요 내용 요약 생성
export async function getSummary(apiKey, transcriptText) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `회의 녹취록을 3-4문장으로 요약하세요. 녹취록: ${transcriptText.substring(0, 10000)}`;
  
  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    throw new Error("요약 생성 중 오류가 발생했습니다.");
  }
}

// 3. Action Item 추출
export async function getActionItems(apiKey, transcriptText) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    다음 회의 녹취록에서 실행 가능한 Action Item들을 추출하여 JSON 배열로 반환하세요.
    - 출력 JSON 배열: [ { "title": "할 일", "owner": "담당자", "deadline": "기한" } ]
    - 녹취록: ${transcriptText.substring(0, 10000)}
  `;

  try {
    const result = await model.generateContent(prompt);
    return extractJSON(result.response.text());
  } catch (err) {
    throw new Error("Action Item 분석 중 오류가 발생했습니다.");
  }
}
