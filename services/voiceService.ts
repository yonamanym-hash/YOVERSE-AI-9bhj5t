// Powered by OnSpace.AI — Voice Service v3.0 (Hands-Free Fixed)
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { getSupabaseClient } from '@/template';

let recording: Audio.Recording | null = null;

export async function startRecording(): Promise<void> {
  try {
    const perm = await Audio.requestPermissionsAsync();
    if (perm.status !== 'granted') throw new Error('Microphone permission denied');

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording: rec } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recording = rec;
  } catch (err) {
    throw new Error('Could not start recording: ' + String(err));
  }
}

export async function stopRecording(): Promise<string | null> {
  if (!recording) return null;
  try {
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    const uri = recording.getURI();
    recording = null;

    if (!uri) return null;

    // ✅ Use expo-file-system instead of FileReader (works on native)
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch {
    recording = null;
    return null;
  }
}

export async function cancelRecording(): Promise<void> {
  if (!recording) return;
  try {
    await recording.stopAndUnloadAsync();
  } catch {}
  recording = null;
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
}

/**
 * Transcribes audio using OnSpace AI (Gemini multimodal audio → text)
 */
export async function transcribeAudio(audioBase64: string, language: 'en' | 'am'): Promise<string> {
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
      mode: 'transcribe',
      audioBase64,
      language,
      messages: [],
    }),
  });

  if (!response.ok) {
    throw new Error('Transcription failed');
  }

  const data = await response.json();
  return data.transcript ?? '';
}

// ── Text-to-Speech ──────────────────────────────────────────────────────────

let _isSpeaking = false;

export function speakText(
  text: string,
  language: 'en' | 'am',
  onDone?: () => void
): void {
  Speech.stop();

  // Strip markdown for cleaner speech
  const clean = text
    .replace(/```[\s\S]*?```/g, 'code block')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/#{1,3}\s+/g, '')
    .replace(/[-*+]\s+/g, '')
    .replace(/\d+[.)]\s+/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();

  // Limit to first 600 chars
  const capped = clean.length > 600 ? clean.slice(0, 600) + '...' : clean;

  _isSpeaking = true;
  Speech.speak(capped, {
    language: language === 'am' ? 'am-ET' : 'en-US',
    rate: 0.95,
    pitch: 1.0,
    onDone: () => {
      _isSpeaking = false;
      onDone?.();
    },
    onStopped: () => { _isSpeaking = false; onDone?.(); },
    onError: () => { _isSpeaking = false; onDone?.(); },
  });
}

export function stopSpeaking(): void {
  Speech.stop();
  _isSpeaking = false;
}

export function getIsSpeaking(): boolean {
  return _isSpeaking;
}
