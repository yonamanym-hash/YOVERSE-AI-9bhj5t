// Powered by OnSpace.AI
import { getSupabaseClient } from '@/template';

export type Language = 'en' | 'am';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AIModel =
  | 'openai/gpt-5.1'
  | 'x-ai/grok-3'
  | 'x-ai/grok-3-mini'
  | 'google/gemini-3-flash-preview'
  | 'google/gemini-3-pro-preview'
  | 'openai/gpt-5-mini'
  | 'openai/gpt-5-nano';

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
    id: 'openai/gpt-5.1',
    label: 'GPT-5.1',
    badge: 'OpenAI',
    color: '#10a37f',
    description: 'Most capable. Best for complex code, deep analysis, essays.',
    speed: 'powerful',
    capabilities: ['code', 'trading', 'writing', 'vision', 'math'],
  },
  {
    id: 'x-ai/grok-3',
    label: 'Grok-3',
    badge: 'xAI',
    color: '#FF6B35',
    description: 'Real-time aware. Excellent for trading, news, wit.',
    speed: 'powerful',
    capabilities: ['trading', 'research', 'writing', 'vision'],
  },
  {
    id: 'google/gemini-3-pro-preview',
    label: 'Gemini Pro',
    badge: 'Google',
    color: '#0F9D58',
    description: 'Long context. Great for documents, research, Amharic.',
    speed: 'powerful',
    capabilities: ['translation', 'research', 'code', 'math'],
  },
  {
    id: 'google/gemini-3-flash-preview',
    label: 'Gemini Flash',
    badge: 'Google',
    color: '#4285F4',
    description: 'Fastest responses. Best for voice and quick answers.',
    speed: 'fast',
    capabilities: ['voice', 'quick', 'translation'],
  },
  {
    id: 'x-ai/grok-3-mini',
    label: 'Grok-3 Mini',
    badge: 'xAI',
    color: '#FF8C5A',
    description: 'Fast Grok. Good for quick trading and market checks.',
    speed: 'fast',
    capabilities: ['trading', 'quick'],
  },
  {
    id: 'openai/gpt-5-mini',
    label: 'GPT-5 Mini',
    badge: 'OpenAI',
    color: '#20c997',
    description: 'Balanced speed and quality. Great all-rounder.',
    speed: 'balanced',
    capabilities: ['code', 'writing', 'math'],
  },
  {
    id: 'openai/gpt-5-nano',
    label: 'GPT-5 Nano',
    badge: 'OpenAI',
    color: '#6ee7b7',
    description: 'Ultra fast. Best for voice-to-voice hands-free mode.',
    speed: 'fast',
    capabilities: ['voice', 'quick'],
  },
];

/** Recommended model for hands-free voice-to-voice (fast + good quality) */
export const VOICE_MODEL: AIModel = 'openai/gpt-5-mini';

/**
 * Calls the Digital Twin Edge Function with streaming.
 * Supports optional imageBase64 for multimodal (vision) requests.
 */
export async function streamAIResponse(
  conversationHistory: ChatMessage[],
  language: Language,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  imageBase64?: string,
  model: AIModel = 'openai/gpt-5.1'
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
    // Fallback: full response (non-streaming environments)
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
  en: "Selam! I'm your Digital Twin — powered by GPT-5.1, Grok-3, Gemini and more.\n\nI can handle **anything**:\n• 💻 Code in any language\n• 📊 XAUUSD & forex trading analysis\n• ✍️ Essays, CVs, creative writing\n• 🔢 Math step-by-step\n• 🌍 Translation (Amharic ↔ English ↔ any language)\n• 🏦 Prop firm strategies\n• 🎨 Photo editing & style advice\n• 🎙️ Voice-to-voice hands-free mode\n\nTap the mic for voice, or type anything. What are we doing today?",
  am: "ሰላም! እኔ ዲጂታል ትዊን ነኝ — GPT-5.1፣ Grok-3፣ Gemini ሃይል።\n\nሁሉንም ማድረግ እችላለሁ:\n• 💻 ማናቸውም ቋንቋ ኮድ\n• 📊 XAUUSD ትንተና\n• ✍️ ጽሑፍ፣ CV፣ ፈጠራ\n• 🔢 ሒሳብ ደረጃ በደረጃ\n• 🌍 ትርጉም (አማርኛ ↔ እንግሊዝኛ)\n• 🎙️ ድምጽ-ወደ-ድምጽ ሃንድስ ፍሪ ሁነታ\n\nለድምጽ ማይክ ይጫኑ ወይም ይጻፉ። ዛሬ ምን እናድርግ?",
};
