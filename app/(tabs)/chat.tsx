// Powered by OnSpace.AI — Chat v3.0 | All-Capabilities + Hands-Free Voice-to-Voice
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Modal,
  ActivityIndicator, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '@/constants/theme';
import { ChatBubble } from '@/components/feature/ChatBubble';
import { TypingIndicator } from '@/components/feature/TypingIndicator';
import { useChat, Message } from '@/hooks/useChat';
import { AI_MODELS, AIModelInfo, VOICE_MODEL } from '@/services/aiService';
import {
  startRecording, stopRecording, cancelRecording,
  transcribeAudio, speakText, stopSpeaking,
} from '@/services/voiceService';

// ── Capability categories shown in the empty state ──────────────────────────
const CAPABILITY_CHIPS = [
  { emoji: '💻', label: 'Write Code', query: 'Help me write code.' },
  { emoji: '📊', label: 'XAUUSD Setup', query: 'Give me the current XAUUSD CRT setup on the 5m chart.' },
  { emoji: '✍️', label: 'Write Essay', query: 'Help me write a compelling essay.' },
  { emoji: '🔢', label: 'Solve Math', query: 'Solve this step by step:' },
  { emoji: '🌍', label: 'Translate', query: 'Translate this for me:' },
  { emoji: '🏦', label: 'Prop Firm Tips', query: 'What are the best prop firms and passing strategies?' },
  { emoji: '🎨', label: 'Photo Editing', query: 'Give me photo editing tips using Lightroom.' },
  { emoji: '💼', label: 'Business Plan', query: 'Help me build a business plan.' },
];

// ── Voice Wave Animation ─────────────────────────────────────────────────────
function VoiceWave({ isActive, color = Colors.primary }: { isActive: boolean; color?: string }) {
  const bars = Array.from({ length: 5 }, (_, i) => useRef(new Animated.Value(0.3 + i * 0.1)).current);

  useEffect(() => {
    if (!isActive) { bars.forEach((b) => b.setValue(0.25)); return; }
    const anims = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 0.3 + Math.random() * 0.7, duration: 180 + i * 70, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.2, duration: 180 + i * 50, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [isActive]);

  return (
    <View style={waveStyles.wrap}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={[waveStyles.bar, { backgroundColor: color, transform: [{ scaleY: bar }] }]} />
      ))}
    </View>
  );
}
const waveStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 26 },
  bar: { width: 4, height: 26, borderRadius: 2 },
});

// ── Hands-Free Mode Overlay ──────────────────────────────────────────────────
function HandsFreeOverlay({
  phase,
  onStop,
}: {
  phase: 'listening' | 'thinking' | 'speaking';
  onStop: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const phaseConfig = {
    listening: { icon: 'mic' as const, color: Colors.danger, label: 'Listening...', sub: 'Speak now. Tap stop to end.' },
    thinking:  { icon: 'psychology' as const, color: Colors.primary, label: 'Thinking...', sub: 'Digital Twin is composing a response.' },
    speaking:  { icon: 'volume-up' as const, color: Colors.success, label: 'Speaking...', sub: 'Tap stop to interrupt and listen again.' },
  };
  const cfg = phaseConfig[phase];

  return (
    <View style={hfStyles.backdrop}>
      <View style={hfStyles.card}>
        <Text style={hfStyles.title}>🎙️ Hands-Free Mode</Text>
        <Animated.View style={[hfStyles.iconRing, { borderColor: cfg.color, backgroundColor: cfg.color + '22', transform: [{ scale: pulse }] }]}>
          <MaterialIcons name={cfg.icon} size={40} color={cfg.color} />
        </Animated.View>
        <Text style={[hfStyles.phaseLabel, { color: cfg.color }]}>{cfg.label}</Text>
        <Text style={hfStyles.phaseSub}>{cfg.sub}</Text>
        {phase === 'listening' && <VoiceWave isActive color={Colors.danger} />}
        <Pressable
          style={({ pressed }) => [hfStyles.stopBtn, pressed && { opacity: 0.8 }]}
          onPress={onStop}
        >
          <MaterialIcons name="stop-circle" size={20} color={Colors.textPrimary} />
          <Text style={hfStyles.stopBtnText}>Stop Hands-Free</Text>
        </Pressable>
      </View>
    </View>
  );
}
const hfStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    paddingHorizontal: Spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadow.card,
  },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  iconRing: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
  },
  phaseLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  phaseSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.danger,
    paddingHorizontal: Spacing.lg, paddingVertical: 13,
    borderRadius: Radius.lg, marginTop: Spacing.sm,
  },
  stopBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
});

// ── Main Chat Screen ─────────────────────────────────────────────────────────
export default function ChatScreen() {
  const params = useLocalSearchParams<{ query?: string }>();
  const {
    messages, isLoading, inputText, setInputText,
    sendMessage, language, toggleLanguage, clearHistory, isHistoryLoaded,
    activeModel, setActiveModel,
  } = useChat();

  const flatRef = useRef<FlatList>(null);
  const handledQuery = useRef(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ uri: string; base64: string } | null>(null);

  // ── Normal voice state ────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hands-free voice-to-voice state ──────────────────────────────────────
  const [handsFreeActive, setHandsFreeActive] = useState(false);
  const [handsFreePhase, setHandsFreePhase] = useState<'listening' | 'thinking' | 'speaking'>('listening');
  const handsFreeRef = useRef(false); // tracks if loop should continue
  const handsFreeAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (params.query && !handledQuery.current && isHistoryLoaded) {
      handledQuery.current = true;
      sendMessage(params.query);
    }
  }, [params.query, isHistoryLoaded]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, isLoading]);

  // ── Hands-free loop ───────────────────────────────────────────────────────
  const runHandsFreeLoop = useCallback(async () => {
    if (!handsFreeRef.current) return;

    // 1. LISTEN
    setHandsFreePhase('listening');
    try {
      await startRecording();
    } catch {
      stopHandsFree();
      Alert.alert('Microphone Error', 'Could not access microphone.');
      return;
    }

    // Auto-stop after 10 seconds
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => resolve(), 10000);
      handsFreeAbort.current = new AbortController();
      handsFreeAbort.current.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); });
    });

    if (!handsFreeRef.current) {
      await cancelRecording();
      return;
    }

    // 2. TRANSCRIBE
    setHandsFreePhase('thinking');
    let transcript = '';
    try {
      const audioBase64 = await stopRecording();
      if (audioBase64) {
        transcript = await transcribeAudio(audioBase64, language);
      }
    } catch {
      // Transcription failed, restart loop
    }

    if (!handsFreeRef.current) return;

    if (!transcript.trim()) {
      // Nothing heard — restart loop
      setTimeout(() => runHandsFreeLoop(), 500);
      return;
    }

    // 3. SEND TO AI (use fast model for voice)
    const prevModel = activeModel;
    setActiveModel(VOICE_MODEL);
    await sendMessage(transcript.trim());
    setActiveModel(prevModel);

    if (!handsFreeRef.current) return;

    // 4. SPEAK response — wait for the last assistant message
    // Wait for AI to finish generating
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!handsFreeRef.current) { clearInterval(check); resolve(); return; }
        // isLoading will be false when AI finishes
        resolve();
      }, 300);
      // give it time
      setTimeout(() => { clearInterval(check); resolve(); }, 500);
    });

    if (!handsFreeRef.current) return;

    setHandsFreePhase('speaking');
    await new Promise<void>((resolve) => {
      // Get the latest AI message from messages ref  
      setTimeout(() => {
        if (!handsFreeRef.current) { resolve(); return; }
        speakText('', language, resolve); // Will be replaced by actual message below
        resolve();
      }, 100);
    });

    if (!handsFreeRef.current) return;

    // Restart loop after a brief pause
    setTimeout(() => {
      if (handsFreeRef.current) runHandsFreeLoop();
    }, 800);
  }, [language, activeModel, sendMessage, setActiveModel]);

  // Better hands-free: listen to message updates to speak the AI reply
  const lastAIMessageRef = useRef('');
  useEffect(() => {
    if (!handsFreeActive) return;
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant' && !last.isStreaming && last.text && last.text !== lastAIMessageRef.current) {
      lastAIMessageRef.current = last.text;
      setHandsFreePhase('speaking');
      speakText(last.text, language, () => {
        if (handsFreeRef.current) {
          setTimeout(() => runHandsFreeLoop(), 600);
        }
      });
    }
  }, [messages, handsFreeActive, language]);

  const startHandsFree = useCallback(async () => {
    handsFreeRef.current = true;
    setHandsFreeActive(true);
    lastAIMessageRef.current = '';
    setActiveModel(VOICE_MODEL);

    // Start the first listen
    setHandsFreePhase('listening');
    try {
      await startRecording();
      // Auto-stop after 8s
      recordTimer.current = setTimeout(() => handleHandsFreeStopRecording(), 8000);
    } catch {
      stopHandsFree();
      Alert.alert('Microphone Error', 'Could not access microphone for hands-free mode.');
    }
  }, [language]);

  const handleHandsFreeStopRecording = useCallback(async () => {
    if (recordTimer.current) clearTimeout(recordTimer.current);
    setHandsFreePhase('thinking');
    try {
      const audioBase64 = await stopRecording();
      if (!audioBase64 || !handsFreeRef.current) { 
        if (handsFreeRef.current) {
          setTimeout(() => startNewHandsFreeRound(), 500);
        }
        return; 
      }
      const transcript = await transcribeAudio(audioBase64, language);
      if (!handsFreeRef.current) return;
      if (!transcript.trim()) {
        setTimeout(() => startNewHandsFreeRound(), 400);
        return;
      }
      await sendMessage(transcript.trim());
    } catch {
      if (handsFreeRef.current) setTimeout(() => startNewHandsFreeRound(), 500);
    }
  }, [language, sendMessage]);

  const startNewHandsFreeRound = useCallback(async () => {
    if (!handsFreeRef.current) return;
    setHandsFreePhase('listening');
    try {
      await startRecording();
      recordTimer.current = setTimeout(() => handleHandsFreeStopRecording(), 8000);
    } catch {
      stopHandsFree();
    }
  }, [handleHandsFreeStopRecording]);

  const stopHandsFree = useCallback(() => {
    handsFreeRef.current = false;
    setHandsFreeActive(false);
    if (recordTimer.current) clearTimeout(recordTimer.current);
    cancelRecording().catch(() => {});
    stopSpeaking();
    handsFreeAbort.current?.abort();
  }, []);

  // ── Normal voice ──────────────────────────────────────────────────────────
  const handleMicPress = useCallback(async () => {
    if (handsFreeActive || isTranscribing) return;
    if (isRecording) {
      if (recordTimer.current) clearTimeout(recordTimer.current);
      setIsRecording(false);
      setIsTranscribing(true);
      try {
        const audioBase64 = await stopRecording();
        if (!audioBase64) { setIsTranscribing(false); return; }
        const transcript = await transcribeAudio(audioBase64, language);
        if (transcript.trim()) setInputText(transcript.trim());
        else Alert.alert('Not heard', 'No speech detected. Try again.');
      } catch {
        Alert.alert('Voice Error', 'Could not transcribe. Try again.');
      } finally {
        setIsTranscribing(false);
      }
    } else {
      try {
        await startRecording();
        setIsRecording(true);
        recordTimer.current = setTimeout(() => { if (isRecording) handleMicPress(); }, 30000);
      } catch {
        Alert.alert('Microphone Error', 'Grant mic permission and try again.');
      }
    }
  }, [isRecording, isTranscribing, language, handsFreeActive]);

  const handleCancelRecording = async () => {
    if (recordTimer.current) clearTimeout(recordTimer.current);
    await cancelRecording();
    setIsRecording(false);
    setIsTranscribing(false);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 0.7, base64: true, allowsEditing: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setAttachedImage({ uri: asset.uri, base64: asset.base64 ?? '' });
      }
    } catch { Alert.alert('Error', 'Could not pick image.'); }
  };

  const handleSend = () => {
    if (!inputText.trim() && !attachedImage) return;
    const text = inputText.trim() || 'Analyze this image.';
    sendMessage(text, attachedImage?.base64);
    setAttachedImage(null);
  };

  const handleClearConfirm = async () => {
    setShowClearModal(false);
    await clearHistory();
  };

  const renderItem = ({ item }: { item: Message }) => <ChatBubble message={item} />;
  const currentModelInfo: AIModelInfo = AI_MODELS.find((m) => m.id === activeModel) ?? AI_MODELS[0];

  const speedColor = { fast: Colors.success, balanced: Colors.warning, powerful: Colors.primary };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarRing}>
            <Text style={styles.avatarText}>DT</Text>
            <View style={styles.onlineDot} />
          </View>
          <View>
            <Text style={styles.headerName}>Digital Twin</Text>
            <Pressable
              onPress={() => setShowModelPicker(true)}
              hitSlop={6}
              style={({ pressed }) => [styles.modelBadge, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.modelDot, { backgroundColor: currentModelInfo.color }]} />
              <Text style={styles.modelBadgeText}>{currentModelInfo.label}</Text>
              <MaterialIcons name="keyboard-arrow-down" size={12} color={Colors.textMuted} />
            </Pressable>
          </View>
        </View>
        <View style={styles.headerActions}>
          {/* Hands-Free button */}
          <Pressable
            onPress={handsFreeActive ? stopHandsFree : startHandsFree}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              handsFreeActive && styles.iconBtnHandsFree,
              pressed && { opacity: 0.6 },
            ]}
          >
            <MaterialIcons
              name={handsFreeActive ? 'hearing' : 'hearing'}
              size={20}
              color={handsFreeActive ? Colors.danger : Colors.textMuted}
            />
          </Pressable>
          <Pressable
            onPress={toggleLanguage}
            style={({ pressed }) => [styles.langBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.langText}>{language === 'en' ? '🇬🇧' : '🇪🇹'}</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowClearModal(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <MaterialIcons name="delete-outline" size={20} color={Colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {!isHistoryLoaded ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : (
          <>
            <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                messages.length > 2 ? (
                  <View style={styles.historyBadge}>
                    <MaterialIcons name="history" size={12} color={Colors.textMuted} />
                    <Text style={styles.historyText}>{messages.length} messages · {currentModelInfo.label}</Text>
                  </View>
                ) : null
              }
              ListFooterComponent={isLoading ? <TypingIndicator /> : null}
            />

            {/* Capability chips in empty state */}
            {messages.length <= 1 && !isLoading && (
              <View style={styles.capWrap}>
                <Text style={styles.capTitle}>Tap mic for voice · Type anything · All AI in one chat</Text>
                <View style={styles.chipRow}>
                  {CAPABILITY_CHIPS.map((p, i) => (
                    <Pressable
                      key={i}
                      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
                      onPress={() => sendMessage(p.query)}
                    >
                      <Text style={styles.chipText}>{p.emoji} {p.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Hands-free CTA */}
                <Pressable
                  style={({ pressed }) => [styles.handsFreeCard, pressed && { opacity: 0.85 }]}
                  onPress={startHandsFree}
                >
                  <View style={styles.handsFreeIcon}>
                    <MaterialIcons name="hearing" size={22} color={Colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.handsFreeCardTitle}>🎙️ Hands-Free Mode</Text>
                    <Text style={styles.handsFreeCardSub}>Speak → AI thinks → AI speaks back. Fully automatic loop.</Text>
                  </View>
                  <MaterialIcons name="arrow-forward-ios" size={14} color={Colors.textMuted} />
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* Recording bar */}
        {(isRecording || isTranscribing) && (
          <View style={styles.recordingBar}>
            {isTranscribing ? (
              <>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.recordingText}>Transcribing...</Text>
              </>
            ) : (
              <>
                <VoiceWave isActive={isRecording} />
                <Text style={styles.recordingText}>Listening... tap mic to send</Text>
                <Pressable onPress={handleCancelRecording} hitSlop={8} style={styles.cancelBtn}>
                  <MaterialIcons name="close" size={16} color={Colors.textMuted} />
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Attached image preview */}
        {attachedImage ? (
          <View style={styles.attachBar}>
            <Image source={{ uri: attachedImage.uri }} style={styles.attachThumb} contentFit="cover" />
            <Text style={styles.attachLabel}>Image attached</Text>
            <Pressable onPress={() => setAttachedImage(null)} hitSlop={8} style={styles.attachRemove}>
              <MaterialIcons name="close" size={16} color={Colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <Pressable
            onPress={handlePickImage}
            hitSlop={4}
            style={({ pressed }) => [styles.iconCircleBtn, attachedImage && styles.iconCircleBtnActive, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="image" size={22} color={attachedImage ? Colors.primary : Colors.textMuted} />
          </Pressable>

          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={
              handsFreeActive ? 'Hands-free active...' :
              isRecording ? 'Listening...' :
              isTranscribing ? 'Transcribing...' :
              language === 'en' ? 'Ask anything — code, trade, write, translate...' : 'ይናገሩ ወይም ይጻፉ...'
            }
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={2000}
            editable={isHistoryLoaded && !isRecording && !isTranscribing && !handsFreeActive}
          />

          {/* Mic button */}
          <Pressable
            onPress={handleMicPress}
            disabled={isTranscribing || isLoading || !isHistoryLoaded || handsFreeActive}
            style={({ pressed }) => [
              styles.micBtn,
              isRecording && styles.micBtnActive,
              isTranscribing && styles.micBtnTranscribing,
              pressed && { opacity: 0.8 },
            ]}
          >
            {isTranscribing ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <MaterialIcons name={isRecording ? 'stop' : 'mic'} size={22} color={Colors.textInverse} />
            )}
          </Pressable>

          {/* Send button */}
          <Pressable
            onPress={handleSend}
            disabled={(!inputText.trim() && !attachedImage) || isLoading || !isHistoryLoaded || isRecording || handsFreeActive}
            style={({ pressed }) => [
              styles.sendBtn,
              ((!inputText.trim() && !attachedImage) || isLoading || !isHistoryLoaded || isRecording || handsFreeActive) && styles.sendBtnDisabled,
              pressed && { opacity: 0.8 },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <MaterialIcons name="send" size={20} color={Colors.textInverse} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Hands-Free Overlay */}
      {handsFreeActive && (
        <HandsFreeOverlay phase={handsFreePhase} onStop={stopHandsFree} />
      )}

      {/* ── Model Picker Modal ─────────────────────────────────────────── */}
      <Modal visible={showModelPicker} transparent animationType="slide" onRequestClose={() => setShowModelPicker(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setShowModelPicker(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Choose AI Model</Text>
            <Text style={styles.pickerSub}>All models powered by Google Gemini — switch anytime</Text>
            {AI_MODELS.map((m) => {
              const active = activeModel === m.id;
              return (
                <Pressable
                  key={m.id}
                  style={({ pressed }) => [styles.modelItem, active && styles.modelItemActive, pressed && { opacity: 0.75 }]}
                  onPress={() => { setActiveModel(m.id); setShowModelPicker(false); }}
                >
                  <View style={[styles.modelDot2, { backgroundColor: m.color }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.modelItemRow}>
                      <Text style={[styles.modelItemLabel, active && styles.modelItemLabelActive]}>{m.label}</Text>
                      <View style={[styles.speedBadge, { backgroundColor: speedColor[m.speed] + '22', borderColor: speedColor[m.speed] + '44' }]}>
                        <Text style={[styles.speedText, { color: speedColor[m.speed] }]}>{m.speed}</Text>
                      </View>
                    </View>
                    <Text style={styles.modelItemDesc}>{m.description}</Text>
                    <Text style={styles.modelItemBadge}>{m.badge}</Text>
                  </View>
                  {active && <MaterialIcons name="check-circle" size={20} color={Colors.primary} />}
                </Pressable>
              );
            })}
            <View style={styles.voiceTip}>
              <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.voiceTipText}>Hands-Free mode auto-uses Gemini 2.0 Flash for speed</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Clear Modal ───────────────────────────────────────────────── */}
      <Modal visible={showClearModal} transparent animationType="fade" onRequestClose={() => setShowClearModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowClearModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIconWrap}>
              <MaterialIcons name="delete-forever" size={28} color={Colors.danger} />
            </View>
            <Text style={styles.modalTitle}>Clear Chat History?</Text>
            <Text style={styles.modalBody}>
              All {messages.length} messages will be permanently deleted. Digital Twin starts fresh.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnCancel, pressed && { opacity: 0.7 }]}
                onPress={() => setShowClearModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>Keep</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnDelete, pressed && { opacity: 0.8 }]}
                onPress={handleClearConfirm}
              >
                <MaterialIcons name="delete" size={16} color={Colors.textPrimary} />
                <Text style={styles.modalBtnDeleteText}>Clear All</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarRing: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primaryGlow, borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: FontWeight.bold, color: Colors.primary },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.success, borderWidth: 2, borderColor: Colors.background,
  },
  headerName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  modelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  modelDot: { width: 7, height: 7, borderRadius: 3.5 },
  modelBadgeText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },

  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnHandsFree: { borderColor: Colors.danger, backgroundColor: Colors.dangerDim },
  langBtn: {
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.full,
  },
  langText: { fontSize: FontSize.sm, color: Colors.textPrimary },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  loadingText: { fontSize: FontSize.sm, color: Colors.textMuted },

  messagesList: { paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  historyBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: Spacing.sm, marginBottom: Spacing.sm,
  },
  historyText: { fontSize: FontSize.xs, color: Colors.textMuted },

  capWrap: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  capTitle: {
    fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium,
    textAlign: 'center', marginBottom: Spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: Spacing.md },
  chip: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },

  handsFreeCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.dangerDim, borderWidth: 1.5, borderColor: Colors.danger + '44',
    borderRadius: Radius.lg, padding: Spacing.md,
  },
  handsFreeIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.danger + '22', borderWidth: 1.5, borderColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  handsFreeCardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  handsFreeCardSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },

  recordingBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: Colors.primaryGlow, borderTopWidth: 1, borderTopColor: 'rgba(255,215,0,0.25)',
  },
  recordingText: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  cancelBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center',
  },

  attachBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceElevated, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  attachThumb: { width: 48, height: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary },
  attachLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  attachRemove: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, paddingBottom: Spacing.md,
    gap: 8, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder, backgroundColor: Colors.background,
  },
  iconCircleBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  iconCircleBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  input: {
    flex: 1, backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.inputBorder,
    borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.base, color: Colors.textPrimary, maxHeight: 120, lineHeight: 22,
  },
  micBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1.5, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  micBtnTranscribing: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },

  // Model Picker
  pickerBackdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: Colors.surfaceElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: Spacing.lg, paddingBottom: 40, gap: Spacing.sm,
  },
  pickerHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.surfaceBorder,
    alignSelf: 'center', marginBottom: Spacing.sm,
  },
  pickerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  pickerSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.sm },
  modelItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.surfaceBorder, backgroundColor: Colors.surface,
  },
  modelItemActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  modelDot2: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  modelItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modelItemLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  modelItemLabelActive: { color: Colors.primary },
  modelItemDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  modelItemBadge: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  speedBadge: {
    borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2,
  },
  speedText: { fontSize: 10, fontWeight: FontWeight.semibold },
  voiceTip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.surfaceBorder, marginTop: 4,
  },
  voiceTipText: { fontSize: FontSize.xs, color: Colors.textMuted, flex: 1 },

  // Clear Modal
  modalBackdrop: {
    flex: 1, backgroundColor: Colors.overlay,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    width: '100%', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: Spacing.lg,
    alignItems: 'center', gap: Spacing.md, ...Shadow.card,
  },
  modalIconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.dangerDim,
    borderWidth: 1, borderColor: Colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  modalBody: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, width: '100%', marginTop: Spacing.sm },
  modalBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: Radius.lg, gap: 6,
  },
  modalBtnCancel: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder },
  modalBtnCancelText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  modalBtnDelete: { backgroundColor: Colors.danger },
  modalBtnDeleteText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
});
