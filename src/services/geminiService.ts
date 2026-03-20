import { GoogleGenAI, Type } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export interface LinkPreviewData {
  title?: string;
  description?: string;
  image?: string;
  url: string;
}

export const fetchLinkPreview = async (url: string): Promise<LinkPreviewData | null> => {
  if (!GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is missing. Link previews will not be available.");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract the Open Graph metadata (title, description, and a representative image URL) for this URL: ${url}. 
      Return the result as a JSON object with keys: title, description, image. 
      If a field is not found, leave it empty.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            image: { type: Type.STRING },
          },
        },
        tools: [{ urlContext: {} }]
      },
    });

    if (!response.text) return null;

    const result = JSON.parse(response.text);
    return { ...result, url };
  } catch (error: any) {
    // Check if it's a fetch error
    if (error.message?.includes("fetch")) {
      console.error("Network error fetching link preview. This might be due to a missing or invalid API key, or a connectivity issue.");
    } else {
      console.error("Error fetching link preview:", error);
    }
    return null;
  }
};
