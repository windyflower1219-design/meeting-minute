import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * 단계별 분석(A안)을 위해 분석 로직을 여러 함수로 분리했습니다.
 */

// 1. 기본 정보 추출 (제목, 날짜, 참석자 등)
export async function getBasicInfo(apiKey, transcriptText) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    다음 회의 녹취록을 분석하여 회의 요약과 참석자 등 기본 정보를 JSON으로 반환하세요.
    - 출력 JSON: { "title": "제목", "date": "YYYY-MM-DD", "attendees": ["이름1", "이름2"] }
    - 녹취록: ${transcriptText.substring(0, 10000)} // 토큰 제한 고려
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
}

// 2. 주요 내용 요약 생성
export async function getSummary(apiKey, transcriptText) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    다음 회의 녹취록의 핵심 내용을 3-4문장으로 요약하세요.
    - 녹취록: ${transcriptText}
  `;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// 3. Action Item 추출
export async function getActionItems(apiKey, transcriptText) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    다음 회의 녹취록에서 실행 가능한 Action Item(할 일)들을 추출하여 JSON 배열로 반환하세요.
    - 출력 JSON 배열: [ { "title": "할 일", "owner": "담당자", "deadline": "기한" } ]
    - 녹취록: ${transcriptText}
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
}
