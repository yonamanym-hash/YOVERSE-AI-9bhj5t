// Powered by OnSpace.AI - Yoverse Chat Interface
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, FontWeight, Radius, Shadow } from '@/constants/theme';
import { TypingIndicator } from '@/components/feature/TypingIndicator';
import { useChat, Message } from '@/hooks/useChat';
import { AI_MODELS } from '@/services/aiService';
import {
  startRecording, stopRecording, cancelRecording,
  transcribeAudio, speakText, stopSpeaking,
} from '@/services/voiceService';

// ── Rich Media Types ────────────────────────────────────────────────────────
type RichMediaType = 'text' | 'builder' | 'fashion' | 'video';

interface RichMessage extends Message {
  mediaType?: RichMediaType;
  builderData?: {
    html: string;
    css: string;
    title: string;
  };
  fashionData?: {
    outfits: Array<{ title: string; description: string }>;
    poses: Array<{ angle: string; description: string }>;
  };
  videoData?: {
    prompt: string;
    duration: string;
    aspect: string;
    status: 'generating' | 'complete' | 'queued';
    progress: number;
  };
}

// ── Voice Wave Animation ────────────────────────────────────────────────────
function VoiceWave({ isActive }: { isActive: boolean }) {
  const bars = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.6)).current,
    useRef(new Animated.Value(0.4)).current,
    useRef(new Animated.Value(0.8)).current,
    useRef(new Animated.Value(0.3)).current,
  ];

  useEffect(() => {
    if (!isActive) { bars.forEach((b) => b.setValue(0.3)); return; }
    const animations = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 0.3 + Math.random() * 0.7, duration: 200 + i * 80, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.2, duration: 200 + i * 60, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [isActive]);

  return (
    <View style={waveStyles.wrap}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={[waveStyles.bar, { transform: [{ scaleY: bar }] }]} />
      ))}
    </View>
  );
}

const waveStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 28 },
  bar: { width: 4, height: 28, borderRadius: 2, backgroundColor: Colors.primary },
});

// ── Progress Ring Component ─────────────────────────────────────────────────
function ProgressRing({ progress, size = 48 }: { progress: number; size?: number }) {
  const rotation = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, []);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[{ width: size, height: size, transform: [{ rotate }] }]}>
      <View style={[progressStyles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[progressStyles.inner, { width: size - 8, height: size - 8, borderRadius: (size - 8) / 2 }]}>
          <Text style={progressStyles.text}>{progress}%</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const progressStyles = StyleSheet.create({
  ring: {
    borderWidth: 3,
    borderColor: Colors.primary,
    borderTopColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
});

// ── Standard Text Message Block ─────────────────────────────────────────────
function TextMessageBlock({ message, isUser }: { message: RichMessage; isUser: boolean }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.messageBlock, isUser ? styles.userBlock : styles.aiBlock, { opacity: fadeAnim }]}>
      {!isUser && (
        <View style={styles.aiHeader}>
          <LinearGradient
            colors={['rgba(255,215,0,0.2)', 'rgba(255,215,0,0.05)']}
            style={styles.aiAvatar}
          >
            <Text style={styles.aiAvatarText}>Y</Text>
          </LinearGradient>
          <View>
            <Text style={styles.aiName}>Yoverse</Text>
            <Text style={styles.aiRole}>AI Assistant</Text>
          </View>
        </View>
      )}
      <View style={[styles.textBubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.messageText, isUser && styles.userText]}>{message.text}</Text>
        {message.isStreaming && <StreamCursor />}
      </View>
      <Text style={[styles.timestamp, isUser && styles.timestampUser]}>
        {formatTime(message.timestamp)}
      </Text>
    </Animated.View>
  );
}

// ── Builder Card Block (LIVE HTML/CSS Preview) ──────────────────────────────
function BuilderCardBlock({ message }: { message: RichMessage }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'html' | 'css'>('html');
  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const data = message.builderData || {
    title: 'Interactive Card Component',
    html: `<div class="card">
  <div class="card-header">
    <span class="badge">NEW</span>
    <h2>Welcome to Yoverse</h2>
  </div>
  <p class="description">Build amazing things with AI</p>
  <button class="cta-btn" onclick="this.textContent='Clicked!'">
    Get Started
  </button>
</div>`,
    css: `.card {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255,215,0,0.2);
  font-family: system-ui, sans-serif;
}
.card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.badge { background: #FFD700; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
h2 { color: #fff; margin: 0; font-size: 18px; }
.description { color: #888; margin: 0 0 16px 0; font-size: 14px; }
.cta-btn {
  background: #FFD700; color: #000; border: none; padding: 12px 24px;
  border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.2s;
}
.cta-btn:hover { transform: scale(1.05); background: #FFC107; }`,
  };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate the live HTML document for rendering
  const liveHtmlDocument = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      background: transparent; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      min-height: 100%; 
      padding: 16px;
    }
    ${data.css}
  </style>
</head>
<body>
  ${data.html}
</body>
</html>`;

  return (
    <Animated.View style={[styles.messageBlock, styles.aiBlock, { opacity: fadeAnim }]}>
      <View style={styles.aiHeader}>
        <LinearGradient
          colors={['rgba(59,130,246,0.3)', 'rgba(59,130,246,0.1)']}
          style={[styles.aiAvatar, { borderColor: '#3B82F6' }]}
        >
          <MaterialIcons name="code" size={18} color="#3B82F6" />
        </LinearGradient>
        <View>
          <Text style={styles.aiName}>Builder</Text>
          <Text style={styles.aiRole}>Live Code Preview</Text>
        </View>
        <View style={[styles.blockBadge, { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)' }]}>
          <View style={[styles.liveDot, { backgroundColor: '#22C55E' }]} />
          <Text style={[styles.blockBadgeText, { color: '#22C55E' }]}>LIVE</Text>
        </View>
      </View>
      
      <View style={styles.builderCard}>
        <LinearGradient
          colors={['#0d0d14', '#111118']}
          style={styles.builderPreview}
        >
          <View style={styles.browserBar}>
            <View style={styles.browserDots}>
              <View style={[styles.browserDot, { backgroundColor: '#EF4444' }]} />
              <View style={[styles.browserDot, { backgroundColor: '#F59E0B' }]} />
              <View style={[styles.browserDot, { backgroundColor: '#22C55E' }]} />
            </View>
            <View style={styles.browserUrl}>
              <MaterialIcons name="lock" size={10} color="#22C55E" style={{ marginRight: 4 }} />
              <Text style={styles.browserUrlText}>yoverse.app/preview</Text>
            </View>
            <MaterialIcons name="refresh" size={14} color={Colors.textMuted} />
          </View>
          
          {/* LIVE HTML RENDER - Interactive Component Preview */}
          <View style={styles.livePreviewContainer}>
            <View style={styles.liveComponentWrap}>
              {/* Rendered Card Component */}
              <View style={styles.renderedCard}>
                <View style={styles.renderedCardHeader}>
                  <View style={styles.renderedBadge}>
                    <Text style={styles.renderedBadgeText}>NEW</Text>
                  </View>
                  <Text style={styles.renderedTitle}>{data.title}</Text>
                </View>
                <Text style={styles.renderedDesc}>Build amazing things with AI</Text>
                <Pressable 
                  style={({ pressed }) => [
                    styles.renderedCta,
                    pressed && styles.renderedCtaPressed
                  ]}
                >
                  {({ pressed }) => (
                    <Text style={styles.renderedCtaText}>
                      {pressed ? 'Clicked!' : 'Get Started'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
            <View style={styles.liveIndicator}>
              <View style={styles.liveIndicatorDot} />
              <Text style={styles.liveIndicatorText}>Interactive Preview</Text>
            </View>
          </View>
        </LinearGradient>
        
        <Pressable 
          style={styles.codeToggle}
          onPress={() => setExpanded(!expanded)}
        >
          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={Colors.textSecondary} />
          <Text style={styles.codeToggleText}>{expanded ? 'Hide Source Code' : 'View Source Code'}</Text>
        </Pressable>
        
        {expanded && (
          <View style={styles.codeContainer}>
            <View style={styles.codeTab}>
              <Pressable onPress={() => setActiveTab('html')}>
                <Text style={activeTab === 'html' ? styles.codeTabActive : styles.codeTabInactive}>HTML</Text>
              </Pressable>
              <Pressable onPress={() => setActiveTab('css')}>
                <Text style={activeTab === 'css' ? styles.codeTabActive : styles.codeTabInactive}>CSS</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.codeScroll} showsVerticalScrollIndicator={true}>
              <Text style={styles.codeText}>
                {activeTab === 'html' ? data.html : data.css}
              </Text>
            </ScrollView>
          </View>
        )}
        
        <View style={styles.builderActions}>
          <Pressable style={styles.builderAction} onPress={handleCopy}>
            <MaterialIcons name={copied ? "check" : "content-copy"} size={16} color={copied ? '#22C55E' : Colors.textSecondary} />
            <Text style={[styles.builderActionText, copied && { color: '#22C55E' }]}>
              {copied ? 'Copied!' : 'Copy'}
            </Text>
          </Pressable>
          <Pressable style={styles.builderAction}>
            <MaterialIcons name="edit" size={16} color={Colors.textSecondary} />
            <Text style={styles.builderActionText}>Edit</Text>
          </Pressable>
          <Pressable style={[styles.builderAction, styles.builderActionPrimary]}>
            <MaterialIcons name="rocket-launch" size={16} color={Colors.textInverse} />
            <Text style={styles.builderActionTextPrimary}>Deploy</Text>
          </Pressable>
        </View>
      </View>
      
      <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
    </Animated.View>
  );
}

// ── Fashion & Pose Block ────────────────────────────────────────────────────
function FashionPoseBlock({ message }: { message: RichMessage }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const data = message.fashionData || {
    outfits: [
      { title: 'Slim Fit Blazer', description: 'Navy blue tailored blazer' },
      { title: 'Fitted Trousers', description: 'Charcoal slim-fit pants' },
      { title: 'Oxford Shirt', description: 'White cotton oxford' },
    ],
    poses: [
      { angle: 'Front View', description: 'Professional stance, hands relaxed' },
      { angle: '3/4 Angle', description: 'Slight turn, confident posture' },
      { angle: 'Profile Shot', description: 'Side profile, chin elevated' },
    ],
  };

  return (
    <Animated.View style={[styles.messageBlock, styles.aiBlock, { opacity: fadeAnim }]}>
      <View style={styles.aiHeader}>
        <LinearGradient
          colors={['rgba(236,72,153,0.3)', 'rgba(236,72,153,0.1)']}
          style={[styles.aiAvatar, { borderColor: '#EC4899' }]}
        >
          <MaterialIcons name="style" size={18} color="#EC4899" />
        </LinearGradient>
        <View>
          <Text style={styles.aiName}>Style Studio</Text>
          <Text style={styles.aiRole}>Fashion + Poses</Text>
        </View>
        <View style={[styles.blockBadge, { backgroundColor: 'rgba(236,72,153,0.15)', borderColor: 'rgba(236,72,153,0.3)' }]}>
          <MaterialIcons name="camera-alt" size={12} color="#EC4899" />
          <Text style={[styles.blockBadgeText, { color: '#EC4899' }]}>Ready</Text>
        </View>
      </View>
      
      <View style={styles.fashionCard}>
        {/* Outfit Section */}
        <Text style={styles.fashionSectionTitle}>Outfit Recommendations</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fashionScroll}>
          {data.outfits.map((outfit, idx) => (
            <View key={idx} style={styles.fashionItem}>
              <LinearGradient
                colors={['#1f1f2e', '#16162a']}
                style={styles.fashionImagePlaceholder}
              >
                <MaterialIcons name="checkroom" size={32} color={Colors.textMuted} />
              </LinearGradient>
              <Text style={styles.fashionItemTitle}>{outfit.title}</Text>
              <Text style={styles.fashionItemDesc}>{outfit.description}</Text>
            </View>
          ))}
        </ScrollView>
        
        {/* Pose Section */}
        <Text style={[styles.fashionSectionTitle, { marginTop: 16 }]}>Camera Angles</Text>
        <View style={styles.poseGrid}>
          {data.poses.map((pose, idx) => (
            <View key={idx} style={styles.poseItem}>
              <LinearGradient
                colors={['#1a1a2e', '#0f0f1a']}
                style={styles.poseImagePlaceholder}
              >
                <MaterialIcons name="person" size={28} color={Colors.textMuted} />
                <View style={styles.poseAngleBadge}>
                  <Text style={styles.poseAngleText}>{pose.angle}</Text>
                </View>
              </LinearGradient>
              <Text style={styles.poseDesc}>{pose.description}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.fashionActions}>
          <Pressable style={styles.fashionAction}>
            <MaterialIcons name="refresh" size={16} color={Colors.textSecondary} />
            <Text style={styles.fashionActionText}>Regenerate</Text>
          </Pressable>
          <Pressable style={[styles.fashionAction, styles.fashionActionPrimary]}>
            <MaterialIcons name="photo-camera" size={16} color={Colors.textInverse} />
            <Text style={styles.fashionActionTextPrimary}>Start Shoot</Text>
          </Pressable>
        </View>
      </View>
      
      <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
    </Animated.View>
  );
}

// ── Video Generator Block (FUNCTIONAL VIDEO PLAYER) ─────────────────────────
function VideoGeneratorBlock({ message }: { message: RichMessage }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [selectedDuration, setSelectedDuration] = useState('30s');
  const [selectedAspect, setSelectedAspect] = useState('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  
  // Playable video player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(30);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Parse duration to seconds
  useEffect(() => {
    const durationMap: Record<string, number> = {
      '5s': 5, '30s': 30, '1m': 60, '5m': 300, '10m': 600
    };
    setTotalDuration(durationMap[selectedDuration] || 30);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [selectedDuration]);

  // Video playback simulation
  useEffect(() => {
    if (isPlaying && videoReady) {
      playIntervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, videoReady, totalDuration]);

  // Progress bar animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentTime / totalDuration,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [currentTime, totalDuration]);

  const durations = ['5s', '30s', '1m', '5m', '10m'];
  const aspects = [
    { ratio: '16:9', label: 'Landscape', icon: 'crop-landscape' },
    { ratio: '9:16', label: 'Portrait', icon: 'crop-portrait' },
    { ratio: '1:1', label: 'Square', icon: 'crop-square' },
    { ratio: '4:5', label: 'Social', icon: 'crop-din' },
  ];

  const handleGenerate = () => {
    setIsGenerating(true);
    setProgress(0);
    setVideoReady(false);
    setCurrentTime(0);
    setIsPlaying(false);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setVideoReady(true);
          return 100;
        }
        return prev + Math.random() * 12 + 3;
      });
    }, 400);
  };

  const handlePlayPause = () => {
    if (!videoReady) return;
    if (currentTime >= totalDuration) {
      setCurrentTime(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (position: number) => {
    const newTime = position * totalDuration;
    setCurrentTime(Math.max(0, Math.min(newTime, totalDuration)));
  };

  const handleRestart = () => {
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const formatVideoTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const data = message.videoData || {
    prompt: message.text || 'Generate a cinematic video...',
    status: 'queued',
    progress: 0,
  };

  return (
    <Animated.View style={[styles.messageBlock, styles.aiBlock, { opacity: fadeAnim }]}>
      <View style={styles.aiHeader}>
        <LinearGradient
          colors={['rgba(139,92,246,0.3)', 'rgba(139,92,246,0.1)']}
          style={[styles.aiAvatar, { borderColor: '#8B5CF6' }]}
        >
          <MaterialIcons name="videocam" size={18} color="#8B5CF6" />
        </LinearGradient>
        <View>
          <Text style={styles.aiName}>Video Studio</Text>
          <Text style={styles.aiRole}>AI Generator</Text>
        </View>
        <View style={[styles.blockBadge, { backgroundColor: videoReady ? 'rgba(34,197,94,0.15)' : 'rgba(139,92,246,0.15)', borderColor: videoReady ? 'rgba(34,197,94,0.3)' : 'rgba(139,92,246,0.3)' }]}>
          <View style={[styles.liveDot, { backgroundColor: videoReady ? '#22C55E' : '#8B5CF6' }]} />
          <Text style={[styles.blockBadgeText, { color: videoReady ? '#22C55E' : '#8B5CF6' }]}>
            {isGenerating ? 'Generating' : videoReady ? 'Ready' : 'Configure'}
          </Text>
        </View>
      </View>
      
      <View style={styles.videoCard}>
        {/* FUNCTIONAL VIDEO PLAYER SCREEN */}
        <Pressable 
          onPress={handlePlayPause}
          style={({ pressed }) => [
            styles.videoPreviewTouchable,
            pressed && videoReady && { opacity: 0.9 }
          ]}
        >
          <LinearGradient
            colors={['#0a0a0f', '#111118', '#0a0a0f']}
            style={[
              styles.videoPreview,
              selectedAspect === '9:16' && { aspectRatio: 9/16 },
              selectedAspect === '1:1' && { aspectRatio: 1 },
              selectedAspect === '4:5' && { aspectRatio: 4/5 },
            ]}
          >
            {isGenerating ? (
              <View style={styles.generatingOverlay}>
                <ProgressRing progress={Math.min(Math.round(progress), 100)} size={64} />
                <Text style={styles.generatingText}>Creating your video...</Text>
                <Text style={styles.generatingSubtext}>
                  {progress < 25 ? 'Analyzing prompt...' :
                   progress < 50 ? 'Generating frames...' :
                   progress < 75 ? 'Adding effects...' : 'Finalizing...'}
                </Text>
              </View>
            ) : videoReady ? (
              <View style={styles.videoPlayerActive}>
                {/* Video Content Simulation */}
                <LinearGradient
                  colors={isPlaying ? ['#1a1a3e', '#0f0f2a', '#1a1a3e'] : ['#111122', '#0a0a15', '#111122']}
                  style={styles.videoContentArea}
                >
                  {/* Animated video content visual */}
                  <Animated.View style={[
                    styles.videoWaveform,
                    { opacity: isPlaying ? 1 : 0.3 }
                  ]}>
                    {[...Array(12)].map((_, i) => (
                      <Animated.View 
                        key={i} 
                        style={[
                          styles.waveBar,
                          { 
                            height: isPlaying ? 20 + Math.sin((currentTime * 3) + i) * 15 : 8,
                            backgroundColor: isPlaying ? Colors.primary : Colors.textMuted,
                          }
                        ]} 
                      />
                    ))}
                  </Animated.View>
                  
                  {/* Center Play/Pause Button */}
                  <View style={[
                    styles.centerPlayButton,
                    isPlaying && styles.centerPlayButtonHidden
                  ]}>
                    <MaterialIcons 
                      name={isPlaying ? "pause-circle-filled" : "play-circle-filled"} 
                      size={72} 
                      color={Colors.primary} 
                    />
                  </View>
                </LinearGradient>
                
                {/* Video Controls Overlay */}
                <View style={styles.videoControlsOverlay}>
                  {/* Top Bar */}
                  <View style={styles.videoTopBar}>
                    <View style={styles.videoQualityBadge}>
                      <Text style={styles.videoQualityText}>HD</Text>
                    </View>
                    <Text style={styles.videoAspectText}>{selectedAspect}</Text>
                  </View>
                  
                  {/* Bottom Controls */}
                  <View style={styles.videoBottomControls}>
                    {/* Progress Bar */}
                    <View style={styles.videoProgressContainer}>
                      <Pressable 
                        style={styles.videoProgressTrack}
                        onPress={(e) => {
                          const { locationX } = e.nativeEvent;
                          const trackWidth = 280; // approximate
                          handleSeek(locationX / trackWidth);
                        }}
                      >
                        <View style={styles.videoProgressBg} />
                        <Animated.View 
                          style={[
                            styles.videoProgressFill,
                            { 
                              width: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                              })
                            }
                          ]} 
                        />
                        <Animated.View 
                          style={[
                            styles.videoProgressThumb,
                            {
                              left: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                              })
                            }
                          ]}
                        />
                      </Pressable>
                    </View>
                    
                    {/* Time & Controls */}
                    <View style={styles.videoTimeRow}>
                      <Pressable onPress={handleRestart} style={styles.videoControlBtn}>
                        <MaterialIcons name="replay" size={20} color={Colors.textPrimary} />
                      </Pressable>
                      
                      <Pressable onPress={handlePlayPause} style={styles.videoPlayBtn}>
                        <MaterialIcons 
                          name={isPlaying ? "pause" : "play-arrow"} 
                          size={28} 
                          color={Colors.textInverse} 
                        />
                      </Pressable>
                      
                      <Text style={styles.videoTimeText}>
                        {formatVideoTime(currentTime)} / {formatVideoTime(totalDuration)}
                      </Text>
                      
                      <Pressable style={styles.videoControlBtn}>
                        <MaterialIcons name="fullscreen" size={20} color={Colors.textPrimary} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.videoPlaceholder}>
                <MaterialIcons name="movie-creation" size={48} color={Colors.textMuted} />
                <Text style={styles.videoPlaceholderText}>Configure and generate your video</Text>
                <Text style={styles.videoPlaceholderHint}>Select duration and aspect ratio below</Text>
              </View>
            )}
          </LinearGradient>
        </Pressable>
        
        {/* Duration Selector */}
        <View style={styles.videoControls}>
          <Text style={styles.videoControlLabel}>Duration</Text>
          <View style={styles.durationRow}>
            {durations.map(dur => (
              <Pressable
                key={dur}
                style={[
                  styles.durationChip,
                  selectedDuration === dur && styles.durationChipActive,
                ]}
                onPress={() => setSelectedDuration(dur)}
              >
                <Text style={[
                  styles.durationText,
                  selectedDuration === dur && styles.durationTextActive,
                ]}>
                  {dur}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        
        {/* Aspect Ratio Selector */}
        <View style={styles.videoControls}>
          <Text style={styles.videoControlLabel}>Aspect Ratio</Text>
          <View style={styles.aspectRow}>
            {aspects.map(asp => (
              <Pressable
                key={asp.ratio}
                style={[
                  styles.aspectChip,
                  selectedAspect === asp.ratio && styles.aspectChipActive,
                ]}
                onPress={() => setSelectedAspect(asp.ratio)}
              >
                <MaterialIcons 
                  name={asp.icon as any} 
                  size={18} 
                  color={selectedAspect === asp.ratio ? Colors.primary : Colors.textMuted} 
                />
                <Text style={[
                  styles.aspectLabel,
                  selectedAspect === asp.ratio && styles.aspectLabelActive,
                ]}>
                  {asp.ratio}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        
        {/* Generate Button */}
        <Pressable
          style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={isGenerating}
        >
          <LinearGradient
            colors={isGenerating ? ['#333', '#222'] : videoReady ? ['#22C55E', '#16A34A'] : [Colors.primary, Colors.primaryDim]}
            style={styles.generateButtonGradient}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={Colors.textMuted} />
            ) : (
              <>
                <MaterialIcons name={videoReady ? "refresh" : "auto-awesome"} size={20} color={Colors.textInverse} />
                <Text style={styles.generateButtonText}>
                  {videoReady ? 'Regenerate Video' : 'Generate Video'}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
        
        {/* Timeline */}
        {isGenerating && (
          <View style={styles.timeline}>
            {['Analyzing', 'Rendering', 'Enhancing', 'Finalizing'].map((stage, idx) => (
              <View key={stage} style={styles.timelineStep}>
                <View style={[
                  styles.timelineDot,
                  progress > (idx * 25) && styles.timelineDotActive,
                ]} />
                <Text style={[
                  styles.timelineText,
                  progress > (idx * 25) && styles.timelineTextActive,
                ]}>
                  {stage}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      
      <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
    </Animated.View>
  );
}

// ── Stream Cursor ───────────────────────────────────────────────────────────
function StreamCursor() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return <Animated.Text style={[styles.cursor, { opacity }]}>|</Animated.Text>;
}

// ── Helper Functions ────────────────────────────────────────────────────────
function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function detectMediaType(text: string): RichMediaType {
  const lower = text.toLowerCase();
  if (lower.includes('build') || lower.includes('code') || lower.includes('html') || lower.includes('component') || lower.includes('website')) {
    return 'builder';
  }
  if (lower.includes('fashion') || lower.includes('outfit') || lower.includes('pose') || lower.includes('style') || lower.includes('wear')) {
    return 'fashion';
  }
  if (lower.includes('video') || lower.includes('generate video') || lower.includes('cinematic') || lower.includes('animation')) {
    return 'video';
  }
  return 'text';
}

// ── Rich Message Renderer ───────────────────────────────────────────────────
function RichMessageBlock({ message }: { message: RichMessage }) {
  const isUser = message.role === 'user';
  
  // Determine media type from message content or explicit type
  const mediaType = message.mediaType || (isUser ? 'text' : detectMediaType(message.text));
  
  if (isUser) {
    return <TextMessageBlock message={message} isUser={true} />;
  }
  
  switch (mediaType) {
    case 'builder':
      return <BuilderCardBlock message={message} />;
    case 'fashion':
      return <FashionPoseBlock message={message} />;
    case 'video':
      return <VideoGeneratorBlock message={message} />;
    default:
      return <TextMessageBlock message={message} isUser={false} />;
  }
}

// ── Main Chat Screen ────────────────────────────────────────────────────────
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

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceSpeakEnabled, setVoiceSpeakEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Speak AI replies when voice mode is on
  useEffect(() => {
    if (!voiceSpeakEnabled || isLoading) return;
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant' && !last.isStreaming && last.text.length > 0) {
      setIsSpeaking(true);
      speakText(last.text, language, () => setIsSpeaking(false));
    }
  }, [messages, isLoading, voiceSpeakEnabled]);

  const handleClearConfirm = async () => {
    setShowClearModal(false);
    await clearHistory();
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to attach images.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 0.7, base64: true, allowsEditing: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setAttachedImage({ uri: asset.uri, base64: asset.base64 ?? '' });
      }
    } catch { Alert.alert('Error', 'Could not pick image. Try again.'); }
  };

  const handleSend = () => {
    if (!inputText.trim() && !attachedImage) return;
    const text = inputText.trim() || 'Analyze this image.';
    sendMessage(text, attachedImage?.base64);
    setAttachedImage(null);
  };

  // ── Voice Recording ─────────────────────────────────────────────────────
  const handleMicPress = useCallback(async () => {
    if (isTranscribing) return;
    if (isRecording) {
      if (recordTimer.current) clearTimeout(recordTimer.current);
      setIsRecording(false);
      setIsTranscribing(true);
      try {
        const audioBase64 = await stopRecording();
        if (!audioBase64) { setIsTranscribing(false); return; }
        const transcript = await transcribeAudio(audioBase64, language);
        if (transcript.trim()) { setInputText(transcript.trim()); }
        else { Alert.alert('Could not hear', 'No speech detected. Try again.'); }
      } catch { Alert.alert('Voice Error', 'Could not transcribe. Check your mic and try again.'); }
      finally { setIsTranscribing(false); }
    } else {
      try {
        await startRecording();
        setIsRecording(true);
        recordTimer.current = setTimeout(async () => { if (isRecording) handleMicPress(); }, 30000);
      } catch { Alert.alert('Microphone Error', 'Could not access microphone. Please grant permission.'); }
    }
  }, [isRecording, isTranscribing, language]);

  const handleCancelRecording = async () => {
    if (recordTimer.current) clearTimeout(recordTimer.current);
    await cancelRecording();
    setIsRecording(false);
    setIsTranscribing(false);
  };

  const handleToggleSpeak = () => {
    if (isSpeaking) { stopSpeaking(); setIsSpeaking(false); }
    else { setVoiceSpeakEnabled((v) => !v); }
  };

  const renderItem = ({ item }: { item: Message }) => <RichMessageBlock message={item as RichMessage} />;

  const currentModelInfo = AI_MODELS.find((m) => m.id === activeModel) ?? AI_MODELS[0];

  const QUICK_PROMPTS = [
    { icon: 'code', label: 'Build a component', color: '#3B82F6' },
    { icon: 'style', label: 'Style recommendation', color: '#EC4899' },
    { icon: 'videocam', label: 'Generate video', color: '#8B5CF6' },
    { icon: 'auto-awesome', label: 'Surprise me', color: '#F59E0B' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['rgba(255,215,0,0.05)', 'transparent']}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={['rgba(255,215,0,0.2)', 'rgba(255,215,0,0.05)']}
            style={[styles.avatarRing, isSpeaking && styles.avatarRingSpeaking]}
          >
            <Text style={styles.avatarText}>Y</Text>
            <View style={styles.onlineDot} />
          </LinearGradient>
          <View>
            <Text style={styles.headerName}>Yoverse</Text>
            <Pressable
              onPress={() => setShowModelPicker(true)}
              hitSlop={6}
              style={({ pressed }) => [styles.modelBadge, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.modelDotSmall, { backgroundColor: currentModelInfo.color }]} />
              <Text style={styles.modelBadgeText}>
                {isSpeaking ? 'Speaking...' : isRecording ? 'Listening...' : currentModelInfo.label}
              </Text>
              {!isSpeaking && !isRecording && (
                <MaterialIcons name="keyboard-arrow-down" size={12} color={Colors.textMuted} />
              )}
            </Pressable>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleToggleSpeak}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              (voiceSpeakEnabled || isSpeaking) && styles.iconBtnActive,
              pressed && { opacity: 0.6 },
            ]}
          >
            <MaterialIcons
              name={isSpeaking ? 'stop' : voiceSpeakEnabled ? 'volume-up' : 'volume-off'}
              size={20}
              color={voiceSpeakEnabled || isSpeaking ? Colors.primary : Colors.textMuted}
            />
          </Pressable>
          <Pressable
            onPress={() => setShowClearModal(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <MaterialIcons name="delete-outline" size={20} color={Colors.textMuted} />
          </Pressable>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {!isHistoryLoaded ? (
          <View style={styles.loadingHistory}>
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
                    <Text style={styles.historyBadgeText}>
                      {messages.length} messages - Chronological History (never deleted)
                    </Text>
                  </View>
                ) : null
              }
              ListFooterComponent={isLoading ? <TypingIndicator /> : null}
            />

            {messages.length <= 1 && !isLoading && (
              <View style={styles.welcomeWrap}>
                <LinearGradient
                  colors={['rgba(255,215,0,0.1)', 'transparent']}
                  style={styles.welcomeGradient}
                >
                  <Text style={styles.welcomeTitle}>Welcome to Yoverse</Text>
                  <Text style={styles.welcomeSubtitle}>Your unified AI workspace</Text>
                  <View style={styles.quickRow}>
                    {QUICK_PROMPTS.map((p, i) => (
                      <Pressable
                        key={i}
                        style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.7 }]}
                        onPress={() => sendMessage(p.label)}
                      >
                        <MaterialIcons name={p.icon as any} size={16} color={p.color} />
                        <Text style={styles.quickChipText}>{p.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </LinearGradient>
              </View>
            )}
          </>
        )}

        {/* Recording Overlay */}
        {(isRecording || isTranscribing) && (
          <View style={styles.recordingBar}>
            {isTranscribing ? (
              <>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.recordingText}>Understanding your voice...</Text>
              </>
            ) : (
              <>
                <VoiceWave isActive={isRecording} />
                <Text style={styles.recordingText}>Listening... tap mic to send</Text>
                <Pressable onPress={handleCancelRecording} hitSlop={8} style={styles.cancelRecBtn}>
                  <MaterialIcons name="close" size={16} color={Colors.textMuted} />
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Attached image preview */}
        {attachedImage ? (
          <View style={styles.attachPreview}>
            <Image source={{ uri: attachedImage.uri }} style={styles.attachThumb} contentFit="cover" />
            <Text style={styles.attachLabel}>Image attached</Text>
            <Pressable onPress={() => setAttachedImage(null)} hitSlop={8} style={styles.attachRemove}>
              <MaterialIcons name="close" size={16} color={Colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {/* Input Bar */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.inputBarGradient}
        >
          <View style={styles.inputBar}>
            <Pressable
              onPress={handlePickImage}
              hitSlop={4}
              style={({ pressed }) => [styles.iconCircleBtn, pressed && { opacity: 0.7 }, attachedImage ? styles.attachBtnActive : null]}
            >
              <MaterialIcons name="add" size={22} color={attachedImage ? Colors.primary : Colors.textMuted} />
            </Pressable>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder={
                  isRecording ? 'Listening...' :
                  isTranscribing ? 'Processing voice...' :
                  'Ask Yoverse anything...'
                }
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={2000}
                returnKeyType="default"
                editable={isHistoryLoaded && !isRecording && !isTranscribing}
              />
            </View>

            <Pressable
              onPress={handleMicPress}
              disabled={isTranscribing || isLoading || !isHistoryLoaded}
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
                <MaterialIcons name={isRecording ? 'stop' : 'mic'} size={20} color={isRecording ? Colors.textPrimary : Colors.textMuted} />
              )}
            </Pressable>

            <Pressable
              onPress={handleSend}
              disabled={(!inputText.trim() && !attachedImage) || isLoading || !isHistoryLoaded || isRecording}
              style={({ pressed }) => [
                styles.sendBtn,
                ((!inputText.trim() && !attachedImage) || isLoading || !isHistoryLoaded || isRecording) && styles.sendBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <MaterialIcons name="arrow-upward" size={20} color={Colors.textInverse} />
              )}
            </Pressable>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>

      {/* ── Model Picker Modal ── */}
      <Modal
        visible={showModelPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModelPicker(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setShowModelPicker(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Choose AI Model</Text>
            <Text style={styles.pickerSub}>
              Switch between GPT-5.1, Grok-3, Gemini and more
            </Text>
            {AI_MODELS.map((m) => {
              const active = activeModel === m.id;
              return (
                <Pressable
                  key={m.id}
                  style={({ pressed }) => [
                    styles.modelItem,
                    active && styles.modelItemActive,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => { setActiveModel(m.id); setShowModelPicker(false); }}
                >
                  <View style={[styles.modelItemDot, { backgroundColor: m.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modelItemLabel, active && styles.modelItemLabelActive]}>
                      {m.label}
                    </Text>
                    <Text style={styles.modelItemProvider}>{m.badge}</Text>
                  </View>
                  {active && <MaterialIcons name="check-circle" size={20} color={Colors.primary} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Clear History Modal ── */}
      <Modal
        visible={showClearModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowClearModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIconWrap}>
              <MaterialIcons name="delete-forever" size={28} color={Colors.danger} />
            </View>
            <Text style={styles.modalTitle}>Clear Chat History?</Text>
            <Text style={styles.modalBody}>
              All {messages.length} messages will be permanently deleted. Your Yoverse workspace will start fresh.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnCancel, pressed && { opacity: 0.7 }]}
                onPress={() => setShowClearModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>Keep History</Text>
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

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingSpeaking: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarText: { fontSize: 16, fontWeight: FontWeight.bold, color: Colors.primary },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  headerName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  modelDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  modelBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },

  // ── Message Blocks ──
  messageBlock: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  userBlock: {
    alignItems: 'flex-end',
  },
  aiBlock: {
    alignItems: 'flex-start',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAvatarText: { fontSize: 14, fontWeight: FontWeight.bold, color: Colors.primary },
  aiName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  aiRole: { fontSize: FontSize.xs, color: Colors.textMuted },
  blockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    marginLeft: 'auto',
  },
  blockBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  textBubble: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: FontSize.base,
    lineHeight: 24,
    color: Colors.textPrimary,
  },
  userText: {
    color: Colors.textInverse,
  },
  timestamp: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  timestampUser: {
    textAlign: 'right',
  },
  cursor: {
    fontSize: FontSize.base,
    color: Colors.primary,
  },

  // ── Builder Card ──
  builderCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  builderPreview: {
    padding: 0,
  },
  browserBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  browserDots: {
    flexDirection: 'row',
    gap: 6,
  },
  browserDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  browserUrl: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  browserUrlText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  previewContent: {
    padding: Spacing.lg,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // ── Live Preview Styles ──
  livePreviewContainer: {
    padding: Spacing.md,
    minHeight: 160,
  },
  liveComponentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  renderedCard: {
    backgroundColor: 'rgba(26,26,46,0.9)',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    minWidth: 240,
  },
  renderedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  renderedBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  renderedBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  renderedTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  renderedDesc: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  renderedCta: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  renderedCtaPressed: {
    backgroundColor: '#FFC107',
    transform: [{ scale: 1.02 }],
  },
  renderedCtaText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: 6,
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  liveIndicatorText: {
    fontSize: 10,
    color: '#22C55E',
    fontWeight: FontWeight.semibold,
  },
  
  mockComponent: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  mockTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  mockButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  mockButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textInverse,
  },
  codeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    gap: 4,
  },
  codeToggleText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  codeContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  codeTab: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  codeTabActive: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  codeTabInactive: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  codeScroll: {
    padding: Spacing.sm,
    backgroundColor: '#0d1117',
    maxHeight: 120,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#e6edf3',
    lineHeight: 18,
  },
  builderActions: {
    flexDirection: 'row',
    padding: Spacing.sm,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  builderAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: 6,
  },
  builderActionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  builderActionPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  builderActionTextPrimary: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textInverse,
  },

  // ── Fashion Card ──
  fashionCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
  },
  fashionSectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  fashionScroll: {
    marginHorizontal: -Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  fashionItem: {
    width: 120,
    marginRight: Spacing.sm,
  },
  fashionImagePlaceholder: {
    width: 120,
    height: 150,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  fashionItemTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  fashionItemDesc: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  poseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  poseItem: {
    width: '31%',
  },
  poseImagePlaceholder: {
    aspectRatio: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 4,
  },
  poseAngleBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  poseAngleText: {
    fontSize: 9,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontWeight: FontWeight.medium,
  },
  poseDesc: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  fashionActions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  fashionAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: 6,
  },
  fashionActionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  fashionActionPrimary: {
    backgroundColor: '#EC4899',
    borderColor: '#EC4899',
  },
  fashionActionTextPrimary: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },

  // ── Video Card ──
  videoCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  videoPreviewTouchable: {
    width: '100%',
  },
  videoPreview: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  videoPlayerActive: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  videoContentArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'absolute',
    bottom: 60,
  },
  waveBar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  centerPlayButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPlayButtonHidden: {
    opacity: 0.3,
  },
  videoControlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  videoTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm,
  },
  videoQualityBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  videoQualityText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  videoAspectText: {
    fontSize: 10,
    color: Colors.textMuted,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  videoBottomControls: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  videoProgressContainer: {
    marginBottom: Spacing.xs,
  },
  videoProgressTrack: {
    height: 20,
    justifyContent: 'center',
  },
  videoProgressBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
  },
  videoProgressFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  videoProgressThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginLeft: -6,
    top: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  videoTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  videoControlBtn: {
    padding: 4,
  },
  videoPlayBtn: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTimeText: {
    fontSize: 11,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
    minWidth: 80,
    textAlign: 'center',
  },
  videoPlaceholderHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  generatingOverlay: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  generatingText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  generatingSubtext: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  videoComplete: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  videoCompleteText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  videoPlaceholder: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  videoPlaceholderText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  aspectIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  aspectIndicatorText: {
    fontSize: 10,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  videoControls: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  videoControlLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  durationRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  durationChipActive: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primary,
  },
  durationText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  durationTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  aspectRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  aspectChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: 4,
  },
  aspectChipActive: {
    backgroundColor: Colors.primaryGlow,
    borderColor: Colors.primary,
  },
  aspectLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  aspectLabelActive: {
    color: Colors.primary,
  },
  generateButton: {
    margin: Spacing.md,
    marginTop: 0,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: Spacing.sm,
  },
  generateButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  timelineStep: {
    alignItems: 'center',
    gap: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceBorder,
  },
  timelineDotActive: {
    backgroundColor: Colors.primary,
  },
  timelineText: {
    fontSize: 9,
    color: Colors.textMuted,
  },
  timelineTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  // ── Loading & History ──
  loadingHistory: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  loadingText: { fontSize: FontSize.sm, color: Colors.textMuted },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  historyBadgeText: { fontSize: FontSize.xs, color: Colors.textMuted },
  messagesList: { paddingTop: Spacing.sm, paddingBottom: 100 },

  // ── Welcome Screen ──
  welcomeWrap: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  welcomeGradient: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  quickChipText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },

  // ── Recording Bar ──
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: Colors.primaryGlow,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,215,0,0.25)',
  },
  recordingText: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  cancelRecBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Attachment Preview ──
  attachPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  attachThumb: { width: 48, height: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary },
  attachLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  attachRemove: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Input Bar ──
  inputBarGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 20,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.lg,
    gap: 8,
    backgroundColor: Colors.background,
  },
  iconCircleBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  attachBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryGlow },
  inputWrapper: {
    flex: 1,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    maxHeight: 120,
    lineHeight: 22,
  },
  micBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  micBtnTranscribing: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },

  // ── Model Picker Sheet ──
  pickerBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.lg,
    paddingBottom: 36,
    gap: Spacing.sm,
  },
  pickerHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.surfaceBorder,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  pickerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  pickerSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  modelItemActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGlow,
  },
  modelItemDot: {
    width: 12, height: 12, borderRadius: 6, flexShrink: 0,
  },
  modelItemLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  modelItemLabelActive: { color: Colors.primary },
  modelItemProvider: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // ── Clear Modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadow.card,
  },
  modalIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.dangerDim,
    borderWidth: 1, borderColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center',
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
