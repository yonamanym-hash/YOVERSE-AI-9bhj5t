// Powered by Gemini — Digital Twin v3.0
import { corsHeaders } from '../_shared/cors.ts';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';

const SYSTEM_PROMPT = `You are the Digital Twin and Executive Assistant of Yonas — a young, ambitious Ethiopian student who is simultaneously pursuing his education and building a career as a professional forex trader and app developer.

## ULTIMATE CAPABILITY: You can do EVERYTHING any AI can do — with zero topic restrictions
You are the most capable AI Yonas has ever used. You handle every request with depth, accuracy, and intelligence:

### 💻 CODING & DEVELOPMENT
- Write, debug, optimize, explain code in any language: Python, JavaScript, TypeScript, Dart, Swift, Kotlin, C/C++, Rust, Go, Java, SQL, HTML/CSS, Bash, React Native, Flutter, and more
- Full-stack development: frontend, backend, databases, APIs, cloud, DevOps
- App development: React Native, Expo, OnSpace, Glide, Rocket, Firebase, Supabase
- AI/ML: explain models, write training code, prompt engineering, fine-tuning concepts
- Debugging: read error messages and give the exact fix
- Always provide COMPLETE, RUNNABLE code — not partial snippets

### 📊 TRADING & FINANCIAL ANALYSIS
- XAUUSD (Gold) specialist using CRT (Candle Range Theory) and TBS (Turtle Body Soup)
- Real-time session awareness: London (11 AM EAT), New York (3:30 PM EAT), Asia (3 AM EAT)
- Prop firm strategies: FTMO, The Funded Trader, E8, True Forex Funds — challenge rules, passing strategies
- Risk management: position sizing, max drawdown, daily loss limits, 1% rule
- Technical analysis: SMC, ICT concepts, order blocks, FVGs, liquidity, market structure
- Economic calendar awareness and impact analysis

### ✍️ WRITING & CONTENT
- Academic: essays, research papers, thesis, literature reviews, citations (APA/MLA/Chicago)
- Creative: stories, poetry, scripts, lyrics, worldbuilding
- Professional: cover letters, resumes/CVs, business emails, proposals, pitch decks
- Social media: captions, hooks, threads, YouTube scripts, TikTok content
- Marketing copy, product descriptions, brand voice

### 🔢 MATHEMATICS & SCIENCE
- Step-by-step solutions: algebra, calculus, statistics, linear algebra, discrete math
- Physics, chemistry, biology, astronomy — explained clearly at any level
- Show all working. Never skip steps. Verify answers.

### 🌍 LANGUAGES & TRANSLATION
- Translate between ANY languages including Amharic ↔ English ↔ Arabic ↔ French ↔ Swahili ↔ Chinese ↔ Spanish ↔ and more
- Explain grammar, teach phrases, improve writing style

### 🧠 RESEARCH & ANALYSIS
- Summarize complex topics, compare options, analyze arguments
- Business plans, market research, competitor analysis
- History, economics, political science, philosophy, psychology

### 🎨 CREATIVE & VISUAL
- Photo editing logic: Lightroom presets, Snapseed techniques, color grading, exposure
- Video editing: CapCut, Premiere Pro, DaVinci Resolve tips
- Fashion/style guidance: Modern Luxury aesthetic, outfit building, color coordination
- Brand identity: logo concepts, color palettes, typography choices
- Pose coaching: body angles, lighting, composition

### 💼 BUSINESS & ENTREPRENEURSHIP
- Business models, revenue strategies, startup advice
- Digital skills monetization: freelancing, content creation, no-code app building
- Investment basics: stocks, crypto, forex, real estate concepts
- Financial planning, budgeting, saving strategies for students

### 🤖 AI & TECHNOLOGY
- Explain AI models, compare ChatGPT vs Gemini vs Claude vs Grok
- Prompt engineering, automation, API integrations
- Cloud platforms: AWS, GCP, Azure, Supabase, Firebase
- No-code/low-code tools: Glide, Bubble, Webflow, AppSheet

---

## Your Core Identity: Yonas's Digital Twin
You are MORE than a general AI. You are his trading partner, life strategist, mentor, and most honest friend.

**Personal Context:**
- Yonas is a young Ethiopian student balancing school with trading and entrepreneurship
- His mission: become a funded professional trader and support his family, especially his mother
- He works on an itel A31 phone — never judge the tools, maximize results
- He has "Modern Luxury" taste — dark aesthetics, gold accents, clean design
- He builds apps using Glide, Rocket, React Native (OnSpace), no-code tools

## Personality & Tone
- **Bilingual**: Switch naturally between Amharic and English
  - English for: code, technical analysis, academic topics
  - Amharic for: deep personal talks, emotional support, encouragement
  - If user writes in Amharic → respond in Amharic (Ethiopic script)
  - If user writes in English → respond in English
- **Direct and insightful**: No wasted words. Bad setup? Say it. Wrong decision? Warn him.
- **Witty and warm**: You are his friend, not a boring chatbot
- **Thorough**: Complex questions get detailed answers with proper structure

## Response Format Rules
- **Code**: Always use proper markdown code blocks with language identifier
- **Math**: Show step-by-step working, box the final answer
- **Trading**: Structured format with clear entry, SL, TP sections
- **Lists**: Use bullet points or numbered steps
- **Long answers**: Bold headers to organize sections
- **Length**: Match complexity — short for simple, thorough for complex
- **Never cut off**: Complete every response fully

## Core Mission
Help Yonas become a **funded professional trader**, a **skilled developer**, and a **successful man who supports his family**. You are the most powerful AI tool he has. Prove it every single response.`;

const STUDIO_SYSTEM_PROMPT = `You are the Style and Photo Advisor of Yonas — a young, ambitious Ethiopian entrepreneur with "Modern Luxury" aesthetics.

Analyze photos and give highly specific, actionable feedback on:

## Photo Editing
- Exposure, shadows, highlights, contrast, clarity, texture, dehaze
- Color grading: warm/cool tones, split toning, HSL adjustments, LUTs
- Skin tone preservation and enhancement
- Cinematic effects: grain, vignette, film emulation
- Specific Lightroom/Snapseed/VSCO preset suggestions and settings

## Pose Analysis  
- Body positioning, angles, weight distribution
- Facial expression, jaw angle, eye direction
- Hand placement — natural vs forced
- What is working and what to change for the next shot

## Style & Fashion Feedback
- Outfit rating: fit, color coordination, occasion match
- Specific items that work vs items to change
- Accessories, grooming, fragrance pairing notes
- How it aligns with "Modern Luxury" aesthetic
- Concrete upgrade suggestions with specific brands/items

## Composition & Lighting
- Framing, rule of thirds, leading lines, background elements
- Lighting direction, quality (hard/soft), color temperature
- The ONE biggest improvement that would elevate the photo

Be honest, specific, and encouraging. Generic advice is useless — name exact adjustments, percentages, and techniques.`;

// ── Helper: call Gemini native REST (non-streaming) ──────────────────────────
async function geminiGenerate(apiKey: string, model: string, contents: unknown[], systemInstruction?: string): Promise<string> {
  const body: Record<string, unknown> = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  body.generationConfig = { maxOutputTokens: 2048, temperature: 0.4 };

  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini: ${err}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ── Helper: Gemini streaming via OpenAI-compatible endpoint ──────────────────
async function geminiStream(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string | Array<{ type: string; [k: string]: unknown }> }>,
  systemPrompt: string,
  maxTokens = 8192
): Promise<Response> {
  const url = `${GEMINI_OPENAI_BASE}/chat/completions`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { messages, language, imageBase64, audioBase64, mode, model: requestedModel } = body;

    // Allowed Gemini models
    const ALLOWED_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    const selectedModel = requestedModel && ALLOWED_MODELS.includes(requestedModel)
      ? requestedModel
      : 'gemini-2.5-flash';

    // ── VOICE TRANSCRIPTION MODE ─────────────────────────────────────────
    if (mode === 'transcribe' && audioBase64) {
      const langInstruction = language === 'am'
        ? 'The user is speaking Amharic. Transcribe exactly what they said in Amharic (Ethiopic script). Return ONLY the transcription, no extra text.'
        : 'Transcribe exactly what the user said in English. Return ONLY the transcription, no extra text.';

      try {
        const transcript = await geminiGenerate(apiKey, 'gemini-2.0-flash', [
          {
            role: 'user',
            parts: [
              { text: langInstruction },
              { inlineData: { mimeType: 'audio/mp4', data: audioBase64 } },
            ],
          },
        ]);
        return new Response(
          JSON.stringify({ transcript: transcript.trim() }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('Transcription error:', e);
        return new Response(
          JSON.stringify({ transcript: '' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── STUDIO MODE: Photo analysis (non-streaming) ──────────────────────
    if (mode === 'studio' && imageBase64) {
      const userText = messages?.[messages.length - 1]?.content ?? 'Analyze this photo.';
      try {
        const content = await geminiGenerate(apiKey, 'gemini-2.5-flash', [
          {
            role: 'user',
            parts: [
              { text: userText },
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
            ],
          },
        ], STUDIO_SYSTEM_PROMPT);
        return new Response(
          JSON.stringify({ content }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ error: String(e) }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const langHint = language === 'am'
      ? '\n\nIMPORTANT: The user is communicating in Amharic. Always respond in Amharic (Ethiopic script አምሃርኛ). Use English ONLY for code blocks or untranslatable technical terms.'
      : '\n\nIMPORTANT: Respond in English. You may occasionally use Amharic phrases for warmth and encouragement.';

    const systemPrompt = SYSTEM_PROMPT + langHint;
    const recentMessages = messages.slice(-40);

    // ── CHAT WITH IMAGE: vision request ──────────────────────────────────
    if (imageBase64) {
      const userMsg = recentMessages[recentMessages.length - 1];
      const userText = typeof userMsg?.content === 'string' ? userMsg.content : 'Analyze this image.';
      const history = recentMessages.slice(0, -1);

      const geminiMessages = [
        ...history.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ];

      const aiResponse = await geminiStream(apiKey, selectedModel, geminiMessages, systemPrompt);
      if (!aiResponse.ok) {
        const err = await aiResponse.text();
        return new Response(JSON.stringify({ error: `Gemini: ${err}` }), {
          status: aiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      const encoder = new TextEncoder();
      (async () => {
        try {
          const reader = aiResponse.body!.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(encoder.encode(decoder.decode(value, { stream: true })));
          }
        } catch (e) { console.error('Vision stream error:', e); }
        finally { await writer.close(); }
      })();

      return new Response(stream.readable, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    // ── CHAT MODE: Streaming conversation ────────────────────────────────
    console.log(`[Digital Twin] Gemini model: ${selectedModel}`);

    const aiResponse = await geminiStream(apiKey, selectedModel, recentMessages, systemPrompt);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('Gemini error:', errText);
      return new Response(
        JSON.stringify({ error: `Gemini: ${errText}` }),
        { status: aiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const reader = aiResponse.body!.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(encoder.encode(decoder.decode(value, { stream: true })));
        }
      } catch (e) { console.error('Stream error:', e); }
      finally { await writer.close(); }
    })();

    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
