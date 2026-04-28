import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set in the environment.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export async function embedText(text: string) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-2-preview",
    contents: [{ parts: [{ text }] }],
  });
  if (!response.embeddings || response.embeddings.length === 0) {
    throw new Error("No embeddings returned from Gemini API");
  }
  return response.embeddings[0].values;
}

export async function embedBatch(texts: string[]) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-2-preview",
    contents: texts.map((text) => ({
      parts: [{ text }],
    })),
  });
  if (!response.embeddings) {
    throw new Error("No embeddings returned from Gemini API");
  }
  return response.embeddings.map((e) => e.values);
}

export async function generateAnswer(prompt: string, context: string, chatHistory: { role: 'user' | 'model', text: string }[] = []) {
  const systemInstruction = `You are NanoRAG (纳米级 RAG 系统), a highly efficient retrieval-augmented generation assistant. 
Language: Always respond in the language used by the user (Chinese if query is Chinese, English if query is English).

Your goal is to provide accurate, concise, and helpful answers based ONLY on the provided context.
If the answer cannot be found in the context, clearly state: "根据当前索引 shared 索引的文档，我无法回答这个问题" or "I cannot answer this based on the current indexed context."

CONTEXT:
${context}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...chatHistory.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      })),
      { role: 'user', parts: [{ text: prompt }] }
    ],
    config: {
      systemInstruction,
    },
  });

  return response.text;
}

export async function evaluateResponse(query: string, answer: string, context: string) {
  const prompt = `You are an expert evaluator for RAG (Retrieval-Augmented Generation) systems.
Analyze the following relationship and provide a JSON response with scores (0.0 to 1.0).

Query: ${query}
Context: ${context}
Answer: ${answer}

Metrics to evaluate:
1. Relevancy: How relevant is the answer to the query?
2. Faithfulness: Is the answer derived strictly from the context?
3. Conciseness: Is the answer clutter-free?

Response Format:
{
  "relevancy": number,
  "faithfulness": number,
  "conciseness": number,
  "reasoning": "string (in Chinese)"
}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
}

export default ai;
