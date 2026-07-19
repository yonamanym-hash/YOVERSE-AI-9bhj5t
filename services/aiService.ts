// Powered by Gemini
import { getSupabaseClient } from '@/template';

export type Language = 'en' | 'am';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AIModel =
  | 'gemini-2.5-pro-preview-06-05'
  | 'gemini-2.5-flash-preview-05-20'
  | 'gemini-2.0-flash';

export interface AIModelInfo {
  id: AIModel;
  label: string;
  badge: string;
  color: string;
  description: string;
  speed: 'fast' | 'balanced' | 'powerful';
  capabilities: string[];
}

export const AI_MODELS: AIModelInfo[] = [
  {
    id: 'gemini-2.5-pro-preview-06-05',
    label: 'Gemini 2.5 Pro',
    badge: 'Google',
    color: '#0F9D58',
    description: 'Most powerful. Deep reasoning, long context, complex tasks.',
    speed: 'powerful',
    capabilities: ['code', 'trading', 'writing', 'vision', 'math', 'research'],
  },
  {
    id: 'gemini-2.5-flash-preview-05-20',
    label: 'Gemini 2.5 Flash',
    badge: 'Google',
    color: '#4285F4',
    description: 'Best balance of speed and intelligence. Great for everything.',
    speed: 'balanced',
    capabilities: ['code', 'trading', 'writing', 'vision', 'translation'],
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    badge: 'Google',
    color: '#FBBC05',
    description: 'Ultra fast. Ideal for voice mode and quick answers.',
    speed: 'fast',
    capabilities: ['voice', 'quick', 'translation'],
  },
];

/** Recommended model for hands-free voice-to-voice */
export const VOICE_MODEL: AIModel = 'gemini-2.0-flash';

/**
 * Calls the Digital Twin Edge Function with streaming.
 */
export async function streamAIResponse(
  conversationHistory: ChatMessage[],
  language: Language,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  imageBase64?: string,
  model: AIModel = 'gemini-2.5-flash-preview-05-20'
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const backendUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const response = await fetch(`${backendUrl}/functions/v1/digital-twin-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey ?? '',
      'Authorization': `Bearer ${token ?? anonKey ?? ''}`,
    },
    body: JSON.stringify({
      messages: conversationHistory,
      language,
      model,
      ...(imageBase64 ? { imageBase64 } : {}),
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI request failed: ${errText}`);
  }

  let fullText = '';
  const reader = response.body?.getReader();

  if (reader) {
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(trimmed.slice(6));
          const chunk = json.choices?.[0]?.delta?.content ?? '';
          if (chunk) {
            fullText += chunk;
            onChunk(chunk);
          }
        } catch {
          // Malformed line — skip
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim() && buffer.trim() !== 'data: [DONE]' && buffer.trim().startsWith('data: ')) {
      try {
        const json = JSON.parse(buffer.trim().slice(6));
        const chunk = json.choices?.[0]?.delta?.content ?? '';
        if (chunk) { fullText += chunk; onChunk(chunk); }
      } catch {}
    }
  } else {
    // Fallback: full response
    const text = await response.text();
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        const chunk = json.choices?.[0]?.delta?.content ?? '';
        if (chunk) { fullText += chunk; onChunk(chunk); }
      } catch {}
    }
  }

  return fullText;
}

export const STARTER_MESSAGES = {
  en: "Selam! I'm your Digital Twin — powered by Gemini 2.5 Pro.\n\nI can handle **anything**:\n• 💻 Code in any language\n• 📊 XAUUSD & forex trading analysis\n• ✍️ Essays, CVs, creative writing\n• 🔢 Math step-by-step\n• 🌍 Translation (Amharic ↔ English ↔ any language)\n• 🏦 Prop firm strategies\n• 🎨 Photo editing & style advice\n• 🎙️ Voice-to-voice hands-free mode\n\nTap the mic for voice, or type anything. What are we doing today?",
  am: "ሰላም! እኔ ዲጂታል ትዊን ነኝ — Gemini 2.5 Pro ሃይል።\n\nሁሉንም ማድረግ እችላለሁ:\n• 💻 ማናቸውም ቋንቋ ኮድ\n• 📊 XAUUSD ትንተና\n• ✍️ ጽሑፍ፣ CV፣ ፈጠራ\n• 🔢 ሒሳብ ደረጃ በደረጃ\n• 🌍 ትርጉም (አማርኛ ↔ እንግሊዝኛ)\n• 🎙️ ድምጽ-ወደ-ድምጽ ሃንድስ ፍሪ ሁነታ\n\nለድምጽ ማይክ ይጫኑ ወይም ይጻፉ። ዛሬ ምን እናድርግ?",
};
