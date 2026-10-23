import { useState } from 'react';
import { 
  Sparkles, 
  Download, 
  Mic, 
  Radio, 
  CheckCircle2, 
  Copy, 
  Check, 
  Play, 
  RotateCcw, 
  Volume2, 
  Zap,
  Wand2,
  Layers,
  Globe2,
  Sliders,
  CheckCheck,
  QrCode,
  Monitor,
  Video,
  Cast,
  Wifi,
  Users,
  Smartphone,
  Cpu,
  Keyboard,
  Gauge,
  Feather,
  ShieldAlert,
  ChevronDown,
  HardDrive,
  Activity,
  Terminal,
  Lock,
  ArrowRight
} from 'lucide-react';
import { LiveSpeakLogo } from '../components/LiveSpeakLogo';
import './index.css';

export function App() {
  const [activeMode, setActiveMode] = useState<'dictation' | 'live-events'>('dictation');
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const [copiedClean, setCopiedClean] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(100);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [liveEventTab, setLiveEventTab] = useState<'system-audio' | 'obs-overlay' | 'qr-audience'>('obs-overlay');
  const [engineModel, setEngineModel] = useState<'tiny.en' | 'base.en'>('tiny.en');
  const [toneMode, setToneMode] = useState<'formal' | 'casual' | 'very-casual'>('casual');
  const [activePlatform, setActivePlatform] = useState<'mac' | 'win'>('mac');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const rawSnippet = [
    { text: "So ", isFiller: false },
    { text: "um ", isFiller: true },
    { text: "basically what we're building is like ", isFiller: false },
    { text: "you know ", isFiller: true },
    { text: "an ultra-low latency transcription engine that ", isFiller: false },
    { text: "uh ", isFiller: true },
    { text: "runs 100% locally on your machine without sending any audio packets to the cloud.", isFiller: false }
  ];

  const cleanSnippet = "We're building an ultra-low latency transcription engine that runs 100% locally on your machine without sending audio packets to the cloud.";

  const handleCopyClean = () => {
    navigator.clipboard.writeText(cleanSnippet);
    setCopiedClean(true);
    setTimeout(() => setCopiedClean(false), 2000);
  };

  const handleReplay = () => {
    setIsPlayingDemo(true);
    setPlaybackProgress(0);
    const interval = setInterval(() => {
      setPlaybackProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsPlayingDemo(false);
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', paddingBottom: '96px' }}>
      {/* Background Pastel Gradient Blobs */}
      <div className="blob-container">
        <div className="blob blob-peach" />
        <div className="blob blob-lilac" />
        <div className="blob blob-mint" />
      </div>

      {/* 1. Announcement Bar */}
      <aside aria-label="Announcement" style={{ 
        position: 'relative', 
        zIndex: 20, 
        background: 'rgba(255, 255, 255, 0.75)', 
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(28, 25, 23, 0.05)',
        padding: '10px 16px',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            background: 'var(--pastel-mint)', 
            color: '#0E7044', 
            padding: '2px 8px', 
            borderRadius: '9999px', 
            fontSize: '11px', 
            fontWeight: 700, 
            letterSpacing: '0.04em' 
          }}>
            V0.1.0 RELEASE
          </span>
          <span>Zero cloud reliance · Sub-second token streaming · Hardware accelerated on M-Series & Windows</span>
          <a href="#download" style={{ color: 'var(--text-primary)', fontWeight: 700, textDecoration: 'underline', marginLeft: '4px' }}>
            Get early access →
          </a>
        </div>
      </aside>

      {/* 2. Sticky Navbar */}
      <header style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 30, 
        backdropFilter: 'blur(16px)', 
        backgroundColor: 'rgba(250, 248, 244, 0.82)',
        borderBottom: '1px solid rgba(28, 25, 23, 0.06)',
        transition: 'all 0.2s ease'
      }}>
        <div className="container-1200" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '76px' }}>
          {/* Brand Logo */}
          <a href="#" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            <LiveSpeakLogo size={32} animate="hover" color="#1C1917" textColor="#1C1917" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '6px', background: 'var(--pastel-mint)', padding: '2px 8px', borderRadius: '9999px' }}>
              Edge
            </span>
          </a>

          {/* Centered Pill Toggle: Dictation | Live Events */}
          <nav aria-label="Product modes" style={{ 
            background: '#FFFFFF', 
            padding: '4px', 
            borderRadius: 'var(--radius-pill)', 
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <button 
              onClick={() => setActiveMode('dictation')}
              style={{ 
                border: 'none',
                background: activeMode === 'dictation' ? 'var(--primary-accent)' : 'transparent',
                color: activeMode === 'dictation' ? '#FFFFFF' : 'var(--text-secondary)',
                padding: '8px 20px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <Mic size={15} />
              Dictation
            </button>
            <button 
              onClick={() => setActiveMode('live-events')}
              style={{ 
                border: 'none',
                background: activeMode === 'live-events' ? 'var(--primary-accent)' : 'transparent',
                color: activeMode === 'live-events' ? '#FFFFFF' : 'var(--text-secondary)',
                padding: '8px 20px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <Radio size={15} />
              Live Events
            </button>
          </nav>

          {/* Right Action: Download Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>
              v0.1.0 • macOS & Win
            </span>
            <a 
              href="#download" 
              className="pill-button pill-button-primary"
              style={{ padding: '10px 22px', fontSize: '14px' }}
            >
              <Download size={16} />
              Download
            </a>
          </div>
        </div>
      </header>

      {/* 3. Hero Section */}
      <main className="container-1200" style={{ paddingTop: '64px', textAlign: 'center' }}>
        {/* Eyebrow Pill */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <div className="eyebrow-pill">
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: '#10B981',
              boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)' 
            }} />
            <span>On-device · No cloud · Under 200 MB</span>
          </div>
        </div>

        {/* Hero Headline with Clean Sans + Serif-Italic Accent */}
        <h1 style={{ 
          fontSize: '66px', 
          fontWeight: 800, 
          letterSpacing: '-0.035em', 
          lineHeight: 1.08,
          maxWidth: '920px',
          margin: '0 auto 24px',
          color: 'var(--text-primary)'
        }}>
          Don’t wait, just <span className="serif-accent" style={{ color: '#44403C' }}>watch it appear.</span>
        </h1>

        {/* Subtext */}
        <p style={{ 
          fontSize: '20px', 
          lineHeight: 1.55, 
          color: 'var(--text-secondary)', 
          maxWidth: '680px', 
          margin: '0 auto 40px',
          fontWeight: 400
        }}>
          Featherweight, 100% on-device live speech-to-text with real-time sliding window tokens, 
          instant grammar polishing, and zero-latency local audience broadcasting.
        </p>

        {/* Two CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '64px' }}>
          <a href="#download" className="pill-button pill-button-primary" style={{ padding: '14px 32px', fontSize: '16px' }}>
            <Download size={18} />
            Download for Desktop
          </a>
          <button 
            onClick={handleReplay}
            className="pill-button pill-button-secondary" 
            style={{ padding: '14px 28px', fontSize: '16px' }}
          >
            <Play size={17} style={{ fill: 'currentColor' }} />
            Replay Live Demo
          </button>
        </div>

        {/* 4. Large Rounded Card: Raw Messy Transcript vs Clean Polished Version */}
        <section aria-label="Transcript comparison" className="rounded-card" style={{ 
          maxWidth: '1060px', 
          margin: '0 auto', 
          padding: '36px',
          textAlign: 'left',
          boxShadow: 'var(--shadow-floating)'
        }}>
          {/* Card Top Meta / Status Header */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            paddingBottom: '24px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '32px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ 
                width: '34px', 
                height: '34px', 
                borderRadius: '50%', 
                background: 'var(--pastel-peach-soft)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#EA580C'
              }}>
                <Sparkles size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Neural Grammar Remediation Pipeline
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Silero VAD speech slice → Qwen2.5-0.5B local inference (sub-250ms latency)
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                padding: '6px 12px', 
                borderRadius: 'var(--radius-pill)',
                background: isPlayingDemo ? 'var(--pastel-pink)' : 'var(--pastel-mint-soft)',
                color: isPlayingDemo ? '#BE185D' : '#047857'
              }}>
                {isPlayingDemo ? '● Streaming Audio Window (32ms frames)' : '✓ In-Memory WAV Sanitized'}
              </span>
              <button 
                onClick={handleReplay}
                style={{ 
                  background: 'none', 
                  border: '1px solid var(--border-medium)', 
                  padding: '6px 10px', 
                  borderRadius: 'var(--radius-pill)', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)'
                }}
              >
                <RotateCcw size={13} />
                Re-run
              </button>
            </div>
          </div>

          {/* Two-Column Comparison Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            {/* Left Column: Raw Transcript with Pink Highlights */}
            <div style={{ 
              background: '#FAF9F6', 
              borderRadius: '16px', 
              padding: '24px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: '#F43F5E' 
                    }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Raw Real-Time Output
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    3 Disfluencies Detected
                  </span>
                </div>

                <div style={{ 
                  fontSize: '17px', 
                  lineHeight: 1.7, 
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  background: '#FFFFFF',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  {rawSnippet.map((chunk, index) => (
                    <span 
                      key={index}
                      className={chunk.isFiller ? 'highlight-pink' : ''}
                      title={chunk.isFiller ? 'Disfluency removed by local grammar sidecar' : undefined}
                    >
                      {chunk.text}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span className="highlight-pink" style={{ padding: '2px 8px', fontSize: '11px', textDecoration: 'none' }}>
                  Pink tag
                </span>
                <span>Flagged speech hesitations & filler tokens</span>
              </div>
            </div>

            {/* Right Column: Clean Polished Output */}
            <div style={{ 
              background: '#FFFFFF', 
              borderRadius: '16px', 
              padding: '24px',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              boxShadow: '0 8px 24px -6px rgba(16, 185, 129, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: '#10B981' 
                    }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Clean Polished Version
                    </span>
                  </div>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: '#047857', 
                    background: '#D1FAE5', 
                    padding: '3px 8px', 
                    borderRadius: 'var(--radius-pill)' 
                  }}>
                    READY TO PASTE
                  </span>
                </div>

                <div style={{ 
                  fontSize: '18px', 
                  lineHeight: 1.65, 
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  background: 'var(--pastel-mint-soft)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.15)'
                }}>
                  "{cleanSnippet}"
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#047857' }}>
                  <CheckCircle2 size={15} />
                  <span>Casing, punctuation, and intent verified</span>
                </div>

                <button 
                  onClick={handleCopyClean}
                  style={{ 
                    border: '1px solid var(--border-medium)',
                    background: '#FFFFFF',
                    color: 'var(--text-primary)',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {copiedClean ? (
                    <>
                      <Check size={14} color="#059669" />
                      <span style={{ color: '#059669' }}>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy to Clipboard</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Audio Waveform Status Bar at bottom of card */}
          <div style={{ 
            marginTop: '28px', 
            paddingTop: '20px', 
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Volume2 size={16} color="var(--text-muted)" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {[18, 28, 14, 32, 22, 12, 26, 36, 16, 24, 30, 18, 10, 25, 34, 16].map((h, i) => (
                  <span 
                    key={i} 
                    style={{ 
                      width: '3px', 
                      height: `${h}px`, 
                      background: i < (playbackProgress / 6.25) ? '#1C1917' : '#D6D3D1', 
                      borderRadius: '2px',
                      transition: 'background 0.15s ease'
                    }} 
                  />
                ))}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                16kHz 16-bit Mono PCM · Dual-Source Ingestion
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span><strong>Latency:</strong> ~280ms</span>
              <span><strong>Model:</strong> whisper.cpp tiny.en</span>
              <span><strong>Memory:</strong> 170MB RAM</span>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SCREEN 2: Speed + Logo Strip
            - "Built on open foundations" tech logo row
            - Section: "Captions in under a second."
            - Side-by-side cards: "Typing 45 wpm" vs "LiveSpeak" with live waveform
            - Three stat chips
           ========================================================================= */}



        {/* 2. Speed Section: "Captions in under a second." */}
        <section aria-label="Speed performance comparison" style={{ marginTop: '104px', textAlign: 'center' }}>
          {/* Eyebrow Pill */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div className="eyebrow-pill" style={{ background: '#FFFFFF', borderColor: 'rgba(28, 25, 23, 0.08)' }}>
              <Zap size={14} color="#EA580C" />
              <span>Real-Time Sliding Window Architecture</span>
            </div>
          </div>

          {/* Section Headline with Serif-Italic Accent */}
          <h2 style={{ 
            fontSize: '52px', 
            fontWeight: 800, 
            letterSpacing: '-0.03em', 
            lineHeight: 1.12, 
            maxWidth: '800px', 
            margin: '0 auto 16px',
            color: 'var(--text-primary)' 
          }}>
            Captions in <span className="serif-accent" style={{ color: '#44403C' }}>under a second.</span>
          </h2>

          <p style={{ 
            fontSize: '18px', 
            color: 'var(--text-secondary)', 
            maxWidth: '620px', 
            margin: '0 auto 48px',
            lineHeight: 1.6
          }}>
            Human typing caps out at 45 words per minute with spelling slips. 
            LiveSpeak streams speech at conversational speed with continuous sliding window token inference.
          </p>

          {/* Side-by-Side Comparison Cards: "Typing 45 wpm" vs "LiveSpeak" */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '32px',
            maxWidth: '1060px',
            margin: '0 auto 48px',
            textAlign: 'left'
          }}>
            {/* Left Card: "Typing 45 wpm" (Traditional Manual Input) */}
            <div className="rounded-card" style={{ 
              padding: '36px', 
              background: '#FFFFFF', 
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%', 
                      background: '#A8A29E' 
                    }} />
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                      Typing 45 wpm
                    </span>
                  </div>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: 700, 
                    color: '#78716C', 
                    background: '#F5F5F4', 
                    padding: '4px 10px', 
                    borderRadius: 'var(--radius-pill)' 
                  }}>
                    MANUAL KEYSTROKES
                  </span>
                </div>

                <div style={{ 
                  background: 'var(--bg-canvas)', 
                  borderRadius: '16px', 
                  padding: '24px', 
                  border: '1px solid var(--border-subtle)',
                  minHeight: '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <p style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '15px', 
                    color: 'var(--text-muted)', 
                    lineHeight: 1.6 
                  }}>
                    The quick brown fox jumps over the lazy dog and pauses to correct... <span style={{ 
                      display: 'inline-block', 
                      width: '8px', 
                      height: '16px', 
                      background: '#78716C', 
                      verticalAlign: 'middle', 
                      animation: 'blink 1s infinite' 
                    }} />
                  </p>
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#A8A29E' }}>
                    <span>Speed: <strong>0.75 words/sec</strong></span>
                    <span>·</span>
                    <span>Latency: <strong>1,330ms/word</strong></span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '24px', padding: '16px', background: '#FAFAF9', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  ⚠️ Physical fatigue, typo correction, and inability to transcribe fast multi-speaker conversations in real time.
                </p>
              </div>
            </div>

            {/* Right Card: "LiveSpeak" with Waveform */}
            <div className="rounded-card" style={{ 
              padding: '36px', 
              background: '#FFFFFF', 
              border: '1px solid rgba(139, 92, 246, 0.25)',
              boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%', 
                      background: '#8B5CF6',
                      boxShadow: '0 0 0 3px rgba(139, 92, 246, 0.25)' 
                    }} />
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                      LiveSpeak
                    </span>
                  </div>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: 700, 
                    color: '#6D28D9', 
                    background: 'var(--pastel-lilac)', 
                    padding: '4px 12px', 
                    borderRadius: 'var(--radius-pill)' 
                  }}>
                    180+ WPM STREAMING
                  </span>
                </div>

                <div style={{ 
                  background: 'linear-gradient(180deg, #FAF8FF 0%, #FFFFFF 100%)', 
                  borderRadius: '16px', 
                  padding: '24px', 
                  border: '1px solid rgba(139, 92, 246, 0.18)',
                  minHeight: '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <p style={{ 
                    fontSize: '17px', 
                    fontWeight: 600, 
                    color: 'var(--text-primary)', 
                    lineHeight: 1.5 
                  }}>
                    Instantaneous conversational stream <span style={{ color: '#8B5CF6', fontStyle: 'italic', opacity: 0.85 }}>[sub-second partials]</span> with automatic casing and punctuation locked in.
                  </p>

                  {/* Dynamic Sound Waveform Component */}
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '4px', height: '36px' }}>
                    {[8, 16, 28, 20, 32, 14, 26, 36, 18, 30, 22, 34, 12, 24, 30, 16, 26, 32, 18, 10, 24, 14].map((h, i) => (
                      <span 
                        key={i} 
                        style={{ 
                          flex: 1,
                          height: `${h}px`, 
                          background: 'linear-gradient(180deg, #8B5CF6 0%, #C084FC 100%)', 
                          borderRadius: '9999px',
                          opacity: 0.85
                        }} 
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '24px', padding: '16px', background: 'var(--pastel-lilac-soft)', borderRadius: '14px', border: '1px solid rgba(139, 92, 246, 0.12)' }}>
                <p style={{ fontSize: '13px', color: '#5B21B6', lineHeight: 1.5, fontWeight: 500 }}>
                  ⚡ Overlapping 3-second audio windows stepped every 500ms for continuous keynote & event captioning.
                </p>
              </div>
            </div>
          </div>

          {/* Three Stat Chips */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '24px',
            maxWidth: '1060px',
            margin: '0 auto'
          }}>
            {/* Stat Chip 1 */}
            <div className="rounded-card" style={{ 
              padding: '24px', 
              background: '#FFFFFF', 
              textAlign: 'center',
              border: '1px solid var(--border-medium)'
            }}>
              <span style={{ 
                fontSize: '44px', 
                fontWeight: 800, 
                color: 'var(--text-primary)', 
                letterSpacing: '-0.03em', 
                display: 'block',
                lineHeight: 1
              }}>
                &lt; 350ms
              </span>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: 600, 
                color: 'var(--text-secondary)', 
                display: 'block', 
                marginTop: '8px' 
              }}>
                Partial Token Latency
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Tentative words appear on screen as speech occurs
              </span>
            </div>

            {/* Stat Chip 2 */}
            <div className="rounded-card" style={{ 
              padding: '24px', 
              background: '#FFFFFF', 
              textAlign: 'center',
              border: '1px solid var(--border-medium)'
            }}>
              <span style={{ 
                fontSize: '44px', 
                fontWeight: 800, 
                color: '#059669', 
                letterSpacing: '-0.03em', 
                display: 'block',
                lineHeight: 1
              }}>
                0 ms
              </span>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: 600, 
                color: 'var(--text-secondary)', 
                display: 'block', 
                marginTop: '8px' 
              }}>
                Cloud Network Delay
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Zero round-trips to remote cloud transcription APIs
              </span>
            </div>

            {/* Stat Chip 3 */}
            <div className="rounded-card" style={{ 
              padding: '24px', 
              background: '#FFFFFF', 
              textAlign: 'center',
              border: '1px solid var(--border-medium)'
            }}>
              <span style={{ 
                fontSize: '44px', 
                fontWeight: 800, 
                color: '#7C3AED', 
                letterSpacing: '-0.03em', 
                display: 'block',
                lineHeight: 1
              }}>
                4x Faster
              </span>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: 600, 
                color: 'var(--text-secondary)', 
                display: 'block', 
                marginTop: '8px' 
              }}>
                Than Professional Typing
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                180+ words per minute conversational throughput
              </span>
            </div>
          </div>
        </section>


        {/* =========================================================================
            SCREEN 3: How it Works
            - Two-column layout
            - Left: Large sticky visual panel showing live interactive transcript demo
            - Right: Three stacked text blocks:
              1. "Speak naturally"
              2. "Edits as you speak"
              3. "Use it anywhere"
              with a thin vertical progress line connecting them
           ========================================================================= */}
        <section aria-label="How it works" style={{ marginTop: '128px', textAlign: 'left' }}>
          {/* Eyebrow & Headline Header */}
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div className="eyebrow-pill" style={{ background: '#FFFFFF', borderColor: 'rgba(28, 25, 23, 0.08)' }}>
                <Layers size={14} color="#7C3AED" />
                <span>Zero-Friction Workflow</span>
              </div>
            </div>

            <h2 style={{ 
              fontSize: '52px', 
              fontWeight: 800, 
              letterSpacing: '-0.03em', 
              lineHeight: 1.12, 
              maxWidth: '820px', 
              margin: '0 auto 16px',
              color: 'var(--text-primary)' 
            }}>
              Simplicity in three <span className="serif-accent" style={{ color: '#44403C' }}>effortless steps.</span>
            </h2>

            <p style={{ 
              fontSize: '18px', 
              color: 'var(--text-secondary)', 
              maxWidth: '600px', 
              margin: '0 auto',
              lineHeight: 1.6
            }}>
              Engineered as an ambient desktop companion. Hold your shortcut, talk at conversational speed, and release to paste formatted text into any app.
            </p>
          </div>

          {/* Two-Column Layout */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1.08fr 0.92fr', 
            gap: '56px',
            alignItems: 'start',
            maxWidth: '1140px',
            margin: '0 auto'
          }}>
            {/* Left: Large Sticky Visual Panel showing live transcript demo */}
            <div style={{ position: 'sticky', top: '100px' }}>
              <div className="rounded-card" style={{ 
                padding: '36px', 
                background: '#FFFFFF', 
                border: '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-floating)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Visual Panel Top Bar */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  paddingBottom: '20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: '#EF4444' 
                    }} />
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: '#F59E0B' 
                    }} />
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: '#10B981' 
                    }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '12px', fontWeight: 600 }}>
                      LiveSpeak Live Widget · {activeStep === 0 ? 'Audio Slicing' : activeStep === 1 ? 'Neural Remediation' : 'Universal Injection'}
                    </span>
                  </div>

                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    padding: '4px 10px', 
                    borderRadius: 'var(--radius-pill)',
                    background: activeStep === 0 ? 'var(--pastel-peach)' : activeStep === 1 ? 'var(--pastel-lilac)' : 'var(--pastel-mint)',
                    color: activeStep === 0 ? '#C2410C' : activeStep === 1 ? '#6D28D9' : '#047857'
                  }}>
                    STEP 0{activeStep + 1} ACTIVE
                  </span>
                </div>

                {/* Animated Dynamic State Display */}
                {activeStep === 0 && (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginBottom: '16px' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          background: '#EA580C',
                          animation: 'pulse 1.5s infinite' 
                        }} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Microphone Input · CPAL 16kHz Mono Stream
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        VAD Probability: 0.94
                      </span>
                    </div>

                    {/* Audio Spectrogram / Equalizer */}
                    <div style={{ 
                      background: 'linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 100%)', 
                      borderRadius: '16px', 
                      padding: '24px',
                      border: '1px solid rgba(234, 88, 12, 0.15)',
                      marginBottom: '20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '64px', justifyContent: 'center' }}>
                        {[16, 28, 42, 54, 32, 60, 48, 26, 50, 62, 38, 22, 56, 44, 30, 18, 52, 60, 36, 24, 48, 58, 30, 20].map((h, idx) => (
                          <span 
                            key={idx}
                            style={{ 
                              width: '4px', 
                              height: `${h}px`, 
                              background: 'linear-gradient(180deg, #EA580C 0%, #FDBA74 100%)', 
                              borderRadius: '4px',
                              opacity: 0.9
                            }} 
                          />
                        ))}
                      </div>
                      <p style={{ textAlign: 'center', fontSize: '13px', color: '#9A3412', fontWeight: 600, marginTop: '12px' }}>
                        🎙 "Holding shortcut... speaking continuous sentence without stuttering"
                      </p>
                    </div>

                    <div style={{ 
                      background: 'var(--bg-canvas)', 
                      padding: '16px 20px', 
                      borderRadius: '12px', 
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '13px'
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Sliding window chunk:</span>
                      <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>3.0s duration / 500ms step</strong>
                    </div>
                  </div>
                )}

                {activeStep === 1 && (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginBottom: '16px' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Wand2 size={16} color="#7C3AED" />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          On-Device Neural Grammar Cleaning
                        </span>
                      </div>
                      <span style={{ 
                        fontSize: '11px', 
                        background: 'var(--pastel-lilac)', 
                        color: '#6D28D9', 
                        padding: '2px 8px', 
                        borderRadius: '9999px',
                        fontWeight: 700
                      }}>
                        QWEN 2.5 0.5B
                      </span>
                    </div>

                    {/* Before / After Transformation Box */}
                    <div style={{ 
                      background: '#FAF8FF', 
                      borderRadius: '16px', 
                      padding: '24px', 
                      border: '1px solid rgba(124, 58, 237, 0.16)',
                      marginBottom: '20px'
                    }}>
                      <div style={{ marginBottom: '16px' }}>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                          Raw Speech Detection
                        </span>
                        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          "I <span className="highlight-pink">um</span> thought we could <span className="highlight-pink">like</span> review the quarterly deploy today."
                        </p>
                      </div>

                      <div style={{ paddingTop: '16px', borderTop: '1px dashed rgba(124, 58, 237, 0.2)' }}>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#7C3AED', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                          Polished Output (220ms)
                        </span>
                        <p style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: 600 }}>
                          "I thought we could review the quarterly deploy today."
                        </p>
                      </div>
                    </div>

                    <div style={{ 
                      background: 'var(--bg-canvas)', 
                      padding: '16px 20px', 
                      borderRadius: '12px', 
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '13px'
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Remediation execution:</span>
                      <strong style={{ color: '#059669' }}>✓ 2 Fillers Stripped · Proper Punctuation</strong>
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginBottom: '16px' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Globe2 size={16} color="#059669" />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Universal Desktop Injection & LAN Broadcast
                        </span>
                      </div>
                      <span style={{ 
                        fontSize: '11px', 
                        background: 'var(--pastel-mint)', 
                        color: '#047857', 
                        padding: '2px 8px', 
                        borderRadius: '9999px',
                        fontWeight: 700
                      }}>
                        ACTIVE TARGET
                      </span>
                    </div>

                    {/* Target Application Mockup (Slack / Cursor / VS Code / Browser) */}
                    <div style={{ 
                      background: '#18181B', 
                      color: '#F4F4F5', 
                      borderRadius: '16px', 
                      padding: '22px', 
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                      marginBottom: '20px',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.18)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', opacity: 0.6, fontSize: '12px' }}>
                        <Sliders size={13} />
                        <span>Cursor / Slack / Google Docs Focus Window</span>
                      </div>
                      <p style={{ color: '#A1A1AA', lineHeight: 1.6 }}>
                        $ git commit -m <span style={{ color: '#34D399' }}>"refactor(transcriber): add sub-second sliding window buffer"</span><span style={{ display: 'inline-block', width: '8px', height: '14px', background: '#34D399', marginLeft: '4px', verticalAlign: 'middle', animation: 'blink 1s infinite' }} />
                      </p>
                    </div>

                    <div style={{ 
                      background: 'var(--pastel-mint-soft)', 
                      padding: '16px 20px', 
                      borderRadius: '12px', 
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '13px'
                    }}>
                      <span style={{ color: '#065F46' }}>Simultaneous target:</span>
                      <strong style={{ color: '#047857' }}>OBS Overlay & Audience Mobile Stream</strong>
                    </div>
                  </div>
                )}

                {/* Step Switcher Controls */}
                <div style={{ 
                  marginTop: '28px', 
                  paddingTop: '20px', 
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[0, 1, 2].map((idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveStep(idx)}
                        style={{ 
                          width: idx === activeStep ? '32px' : '10px', 
                          height: '10px', 
                          borderRadius: 'var(--radius-pill)', 
                          background: idx === activeStep ? 'var(--primary-accent)' : '#E7E5E4',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.25s ease'
                        }}
                        title={`Switch to Step ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Click steps or hover to preview mechanics
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Three Stacked Text Blocks with Thin Vertical Progress Line */}
            <div style={{ position: 'relative', paddingLeft: '40px' }}>
              {/* Thin Vertical Progress Line */}
              <div style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '24px', 
                bottom: '48px', 
                width: '2px', 
                background: '#E7E5E4' 
              }}>
                <div style={{ 
                  width: '100%', 
                  height: activeStep === 0 ? '18%' : activeStep === 1 ? '60%' : '100%', 
                  background: 'var(--primary-accent)', 
                  transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)' 
                }} />
              </div>

              {/* Block 1: Speak naturally */}
              <div 
                onClick={() => setActiveStep(0)}
                style={{ 
                  position: 'relative', 
                  marginBottom: '48px', 
                  cursor: 'pointer',
                  padding: '24px',
                  borderRadius: '20px',
                  background: activeStep === 0 ? '#FFFFFF' : 'transparent',
                  border: activeStep === 0 ? '1px solid var(--border-medium)' : '1px solid transparent',
                  boxShadow: activeStep === 0 ? 'var(--shadow-card)' : 'none',
                  transition: 'all 0.25s ease'
                }}
              >
                {/* Step Marker Dot */}
                <div style={{ 
                  position: 'absolute', 
                  left: '-40px', 
                  top: '32px', 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  background: activeStep === 0 ? 'var(--primary-accent)' : '#FFFFFF', 
                  border: activeStep === 0 ? 'none' : '2px solid #D6D3D1',
                  color: activeStep === 0 ? '#FFFFFF' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  transform: 'translateX(-1px)',
                  boxShadow: activeStep === 0 ? '0 0 0 4px var(--pastel-peach)' : 'none',
                  transition: 'all 0.25s ease'
                }}>
                  {activeStep > 0 ? <CheckCheck size={13} color="#10B981" /> : '1'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: '#EA580C', 
                    background: 'var(--pastel-peach-soft)', 
                    padding: '2px 8px', 
                    borderRadius: 'var(--radius-pill)' 
                  }}>
                    PUSH-TO-TALK & SLIDING WINDOW
                  </span>
                </div>

                <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Speak naturally
                </h3>

                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Hold <kbd style={{ background: '#F5F5F4', padding: '2px 6px', borderRadius: '4px', border: '1px solid #D6D3D1', fontSize: '13px' }}>Cmd+Shift+Space</kbd> or <kbd style={{ background: '#F5F5F4', padding: '2px 6px', borderRadius: '4px', border: '1px solid #D6D3D1', fontSize: '13px' }}>Ctrl+Shift+Space</kbd>. Speak at your standard conversational cadence. Silero VAD detects voice boundaries while rolling 3-second audio frames stream to the neural engine.
                </p>
              </div>

              {/* Block 2: Edits as you speak */}
              <div 
                onClick={() => setActiveStep(1)}
                style={{ 
                  position: 'relative', 
                  marginBottom: '48px', 
                  cursor: 'pointer',
                  padding: '24px',
                  borderRadius: '20px',
                  background: activeStep === 1 ? '#FFFFFF' : 'transparent',
                  border: activeStep === 1 ? '1px solid var(--border-medium)' : '1px solid transparent',
                  boxShadow: activeStep === 1 ? 'var(--shadow-card)' : 'none',
                  transition: 'all 0.25s ease'
                }}
              >
                {/* Step Marker Dot */}
                <div style={{ 
                  position: 'absolute', 
                  left: '-40px', 
                  top: '32px', 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  background: activeStep === 1 ? 'var(--primary-accent)' : '#FFFFFF', 
                  border: activeStep === 1 ? 'none' : '2px solid #D6D3D1',
                  color: activeStep === 1 ? '#FFFFFF' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  transform: 'translateX(-1px)',
                  boxShadow: activeStep === 1 ? '0 0 0 4px var(--pastel-lilac)' : 'none',
                  transition: 'all 0.25s ease'
                }}>
                  {activeStep > 1 ? <CheckCheck size={13} color="#10B981" /> : '2'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: '#7C3AED', 
                    background: 'var(--pastel-lilac-soft)', 
                    padding: '2px 8px', 
                    borderRadius: 'var(--radius-pill)' 
                  }}>
                    INTELLIGENT REMEDIATION
                  </span>
                </div>

                <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Edits as you speak
                </h3>

                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Say "um", "uh", or "like" without second thoughts. The local grammar engine cleans speech hesitations, restores punctuation, capitalization, and vocabulary formatting in under 250 milliseconds with zero cloud dependencies.
                </p>
              </div>

              {/* Block 3: Use it anywhere */}
              <div 
                onClick={() => setActiveStep(2)}
                style={{ 
                  position: 'relative', 
                  cursor: 'pointer',
                  padding: '24px',
                  borderRadius: '20px',
                  background: activeStep === 2 ? '#FFFFFF' : 'transparent',
                  border: activeStep === 2 ? '1px solid var(--border-medium)' : '1px solid transparent',
                  boxShadow: activeStep === 2 ? 'var(--shadow-card)' : 'none',
                  transition: 'all 0.25s ease'
                }}
              >
                {/* Step Marker Dot */}
                <div style={{ 
                  position: 'absolute', 
                  left: '-40px', 
                  top: '32px', 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  background: activeStep === 2 ? 'var(--primary-accent)' : '#FFFFFF', 
                  border: activeStep === 2 ? 'none' : '2px solid #D6D3D1',
                  color: activeStep === 2 ? '#FFFFFF' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  transform: 'translateX(-1px)',
                  boxShadow: activeStep === 2 ? '0 0 0 4px var(--pastel-mint)' : 'none',
                  transition: 'all 0.25s ease'
                }}>
                  3
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: '#059669', 
                    background: 'var(--pastel-mint-soft)', 
                    padding: '2px 8px', 
                    borderRadius: 'var(--radius-pill)' 
                  }}>
                    ZERO-DRIVER BROADCAST & PASTE
                  </span>
                </div>

                <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Use it anywhere
                </h3>

                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Direct OS injection places cleaned text right at your active cursor across Slack, VS Code, Notion, or terminal. In Live Event Mode, transparent captions stream synchronously to OBS and audience mobile devices via local LAN.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SCREEN 4: Live Events
            - Section: "Caption any event, for everyone in the room."
            - Three tabs:
              1. "System audio"
              2. "OBS overlay"
              3. "QR audience mode"
            - OBS canvas mock with transparent subtitles
            - Phone mockup with a QR code card
           ========================================================================= */}
        <section aria-label="Live event broadcasting" style={{ marginTop: '144px', textAlign: 'center' }}>
          {/* Eyebrow & Headline */}
          <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div className="eyebrow-pill" style={{ background: '#FFFFFF', borderColor: 'rgba(28, 25, 23, 0.08)' }}>
              <Radio size={14} color="#059669" />
              <span>Broadcast Architecture · 0-Driver WASAPI & ScreenCaptureKit</span>
            </div>
          </div>

          <h2 style={{ 
            fontSize: '52px', 
            fontWeight: 800, 
            letterSpacing: '-0.03em', 
            lineHeight: 1.12, 
            maxWidth: '940px', 
            margin: '0 auto 16px',
            color: 'var(--text-primary)' 
          }}>
            Caption any event, <span className="serif-accent" style={{ color: '#44403C' }}>for everyone in the room.</span>
          </h2>

          <p style={{ 
            fontSize: '18px', 
            color: 'var(--text-secondary)', 
            maxWidth: '680px', 
            margin: '0 auto 40px',
            lineHeight: 1.6
          }}>
            Whether you're streaming to thousands via OBS or hosting a room full of people on local Wi-Fi, 
            LiveSpeak broadcasts synchronized live captions with zero cloud dependencies and zero driver installs.
          </p>

          {/* Three Pill Tabs: System audio | OBS overlay | QR audience mode */}
          <div style={{ 
            display: 'inline-flex', 
            background: '#FFFFFF', 
            padding: '6px', 
            borderRadius: 'var(--radius-pill)', 
            border: '1px solid var(--border-medium)',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '48px',
            gap: '6px'
          }}>
            <button
              onClick={() => setLiveEventTab('system-audio')}
              style={{
                border: 'none',
                background: liveEventTab === 'system-audio' ? 'var(--primary-accent)' : 'transparent',
                color: liveEventTab === 'system-audio' ? '#FFFFFF' : 'var(--text-secondary)',
                padding: '10px 24px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <Volume2 size={16} />
              System Audio
            </button>

            <button
              onClick={() => setLiveEventTab('obs-overlay')}
              style={{
                border: 'none',
                background: liveEventTab === 'obs-overlay' ? 'var(--primary-accent)' : 'transparent',
                color: liveEventTab === 'obs-overlay' ? '#FFFFFF' : 'var(--text-secondary)',
                padding: '10px 24px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <Video size={16} />
              OBS Overlay
            </button>

            <button
              onClick={() => setLiveEventTab('qr-audience')}
              style={{
                border: 'none',
                background: liveEventTab === 'qr-audience' ? 'var(--primary-accent)' : 'transparent',
                color: liveEventTab === 'qr-audience' ? '#FFFFFF' : 'var(--text-secondary)',
                padding: '10px 24px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <QrCode size={16} />
              QR Audience Mode
            </button>
          </div>

          {/* Side-by-Side Dual Mockup Display */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1.25fr 0.85fr', 
            gap: '36px', 
            maxWidth: '1160px', 
            margin: '0 auto',
            textAlign: 'left'
          }}>
            {/* Left Mockup: OBS Canvas Mock with Transparent Subtitles */}
            <div className="rounded-card" style={{ 
              padding: '32px', 
              background: '#FFFFFF', 
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-floating)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                {/* OBS Canvas Header */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  paddingBottom: '18px',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '8px', 
                      background: '#18181B', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: '#FAF8F4'
                    }}>
                      <Cast size={16} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        OBS Studio · Browser Source
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Source URL: <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-canvas)', padding: '2px 6px', borderRadius: '4px' }}>http://localhost:8080/broadcast</code>
                      </p>
                    </div>
                  </div>

                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: '#DC2626', 
                    background: '#FEE2E2', 
                    padding: '3px 10px', 
                    borderRadius: 'var(--radius-pill)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#DC2626', animation: 'pulse 1s infinite' }} />
                    LIVE 60 FPS
                  </span>
                </div>

                {/* Simulated Livestream Video Canvas */}
                <div style={{ 
                  height: '280px', 
                  borderRadius: '16px', 
                  background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #0F172A 100%)', 
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  padding: '24px',
                  boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)'
                }}>
                  {/* Speaker Video Silhouette simulation */}
                  <div style={{ 
                    position: 'absolute', 
                    top: '28px', 
                    left: '28px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    background: 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(10px)',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-pill)',
                    color: '#FFFFFF'
                  }}>
                    <Monitor size={14} color="#60A5FA" />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Keynote Stage Audio · System Loopback</span>
                  </div>

                  {/* OBS Transparent Live Subtitles Overlay */}
                  <div style={{ 
                    background: 'rgba(15, 15, 20, 0.72)', 
                    backdropFilter: 'blur(16px)', 
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    color: '#FFFFFF',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#38BDF8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        ● Live Captions (rgba(0,0,0,0) Transparent Layer)
                      </span>
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                        WebSocket Transit: 14ms
                      </span>
                    </div>
                    <p style={{ fontSize: '16px', lineHeight: 1.5, margin: 0 }}>
                      "We are demonstrating real-time on-device speech-to-text with <span style={{ color: '#38BDF8', fontWeight: 600 }}>zero cloud latency</span>, streaming directly to audience screens."
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom OBS Feature Details */}
              <div style={{ 
                marginTop: '20px', 
                paddingTop: '16px', 
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                color: 'var(--text-secondary)'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={15} color="#10B981" />
                  Alpha channel transparency enabled
                </span>
                <span><strong>Resolution:</strong> 1080p / 4K Scalable SVG</span>
              </div>
            </div>

            {/* Right Mockup: Phone Mockup with QR Code Card */}
            <div className="rounded-card" style={{ 
              padding: '32px', 
              background: '#FFFFFF', 
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-floating)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                {/* QR Modal Header */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  paddingBottom: '18px',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wifi size={16} color="#059669" />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Local Wi-Fi Audience Sync
                    </span>
                  </div>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: '#059669', 
                    background: 'var(--pastel-mint-soft)', 
                    padding: '3px 8px', 
                    borderRadius: 'var(--radius-pill)' 
                  }}>
                    NO APP NEEDED
                  </span>
                </div>

                {/* Phone Outer Frame */}
                <div style={{ 
                  background: '#FAF8F4', 
                  border: '8px solid #1C1917', 
                  borderRadius: '32px', 
                  padding: '16px',
                  boxShadow: '0 20px 40px -10px rgba(28, 25, 23, 0.15)',
                  maxWidth: '280px',
                  margin: '0 auto',
                  textAlign: 'center'
                }}>
                  {/* Speaker Notch */}
                  <div style={{ width: '60px', height: '4px', background: '#D6D3D1', borderRadius: '2px', margin: '0 auto 16px' }} />

                  {/* QR Card Container */}
                  <div style={{ 
                    background: '#FFFFFF', 
                    borderRadius: '20px', 
                    padding: '20px', 
                    border: '1px solid var(--border-medium)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {/* Visual QR Code Grid Mockup */}
                    <div style={{ 
                      width: '160px', 
                      height: '160px', 
                      margin: '0 auto 12px',
                      background: '#1C1917',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: '4px'
                    }}>
                      {[...Array(25)].map((_, i) => (
                        <div 
                          key={i} 
                          style={{ 
                            background: [0, 4, 12, 20, 24, 2, 6, 8, 14, 18, 22].includes(i) ? '#FAF8F4' : '#1C1917',
                            borderRadius: '3px'
                          }} 
                        />
                      ))}
                    </div>

                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                      Scan for Live Subtitles
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      192.168.1.45:8080/broadcast
                    </span>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', color: '#047857' }}>
                    <Users size={14} />
                    <span><strong>128</strong> audience connected</span>
                  </div>
                </div>
              </div>

              {/* Bottom Feature Details */}
              <div style={{ 
                marginTop: '20px', 
                paddingTop: '16px', 
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--text-muted)'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smartphone size={14} color="var(--text-primary)" />
                  Works on iOS & Android Safari/Chrome
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SCREEN 5: Feature Bento
            - 2x2 bento grid with four tiles:
              1. Engine toggle (tiny.en / base.en)
              2. Formal / Casual / Very casual toggle
              3. Hotkey keycaps (Cmd+Shift+Space / Ctrl+Shift+Space)
              4. Hardware acceleration chips (CoreML Apple Neural Engine & DirectML DirectX 12)
           ========================================================================= */}
        <section aria-label="Feature bento grid" style={{ marginTop: '144px', textAlign: 'center' }}>
          {/* Eyebrow & Headline */}
          <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div className="eyebrow-pill" style={{ background: '#FFFFFF', borderColor: 'rgba(28, 25, 23, 0.08)' }}>
              <Feather size={14} color="#C2410C" />
              <span>Tailored Precision · Zero Cloud Overhead</span>
            </div>
          </div>

          <h2 style={{ 
            fontSize: '52px', 
            fontWeight: 800, 
            letterSpacing: '-0.03em', 
            lineHeight: 1.12, 
            maxWidth: '900px', 
            margin: '0 auto 16px',
            color: 'var(--text-primary)' 
          }}>
            Engineered for depth, <span className="serif-accent" style={{ color: '#44403C' }}>tuned for your fingertips.</span>
          </h2>

          <p style={{ 
            fontSize: '18px', 
            color: 'var(--text-secondary)', 
            maxWidth: '640px', 
            margin: '0 auto 48px',
            lineHeight: 1.6
          }}>
            Every subsystem is configurable yet requires zero setup. Choose your neural engine weight, 
            remediation tone, global hotkey triggers, and hardware acceleration delegates.
          </p>

          {/* 2x2 Bento Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '28px', 
            maxWidth: '1160px', 
            margin: '0 auto',
            textAlign: 'left'
          }}>
            {/* Tile 1: Engine Toggle (tiny.en / base.en) */}
            <div className="rounded-card" style={{ 
              padding: '36px', 
              background: '#FFFFFF', 
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-floating)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ 
                    width: '42px', 
                    height: '42px', 
                    borderRadius: '12px', 
                    background: 'var(--pastel-peach-soft)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#EA580C'
                  }}>
                    <Gauge size={22} />
                  </div>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: '#C2410C', 
                    background: 'var(--pastel-peach)', 
                    padding: '3px 10px', 
                    borderRadius: 'var(--radius-pill)' 
                  }}>
                    QUANTIZED GGUF
                  </span>
                </div>

                <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Speech-to-Text Model Engine
                </h3>

                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                  Switch between ultra-low memory footprint or enhanced acoustic resolution based on your laptop specs.
                </p>

                {/* Pill Toggle: tiny.en vs base.en */}
                <div style={{ 
                  background: 'var(--bg-canvas)', 
                  padding: '6px', 
                  borderRadius: 'var(--radius-pill)', 
                  display: 'inline-flex',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '20px',
                  width: '100%'
                }}>
                  <button
                    onClick={() => setEngineModel('tiny.en')}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: engineModel === 'tiny.en' ? 'var(--primary-accent)' : 'transparent',
                      color: engineModel === 'tiny.en' ? '#FFFFFF' : 'var(--text-secondary)',
                      padding: '10px 16px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center'
                    }}
                  >
                    tiny.en (75 MB · ~180ms)
                  </button>

                  <button
                    onClick={() => setEngineModel('base.en')}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: engineModel === 'base.en' ? 'var(--primary-accent)' : 'transparent',
                      color: engineModel === 'base.en' ? '#FFFFFF' : 'var(--text-secondary)',
                      padding: '10px 16px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center'
                    }}
                  >
                    base.en (140 MB · ~240ms)
                  </button>
                </div>
              </div>

              {/* Engine Specs Box */}
              <div style={{ 
                background: '#FAF9F6', 
                padding: '16px 20px', 
                borderRadius: '16px', 
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
                    Active RAM Budget
                  </span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {engineModel === 'tiny.en' ? '110 MB Working Memory' : '175 MB Working Memory'}
                  </strong>
                </div>
                <span style={{ 
                  fontSize: '12px', 
                  color: '#059669', 
                  fontWeight: 600,
                  background: 'var(--pastel-mint-soft)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)'
                }}>
                  {engineModel === 'tiny.en' ? 'Sub-200MB Met' : 'High Accuracy'}
                </span>
              </div>
            </div>

            {/* Tile 2: Tone Remediation Toggle (Formal / Casual / Very casual) */}
            <div className="rounded-card" style={{ 
              padding: '36px', 
              background: '#FFFFFF', 
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-floating)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ 
                    width: '42px', 
                    height: '42px', 
                    borderRadius: '12px', 
                    background: 'var(--pastel-lilac-soft)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#7C3AED'
                  }}>
                    <Wand2 size={22} />
                  </div>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: '#6D28D9', 
                    background: 'var(--pastel-lilac)', 
                    padding: '3px 10px', 
                    borderRadius: 'var(--radius-pill)' 
                  }}>
                    AI REMEDIATION
                  </span>
                </div>

                <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Post-Processing Grammar Tone
                </h3>

                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                  Select the editorial voice applied by the local neural model prior to injecting text at your cursor.
                </p>

                {/* 3-Way Pill Toggle: Formal / Casual / Very casual */}
                <div style={{ 
                  background: 'var(--bg-canvas)', 
                  padding: '6px', 
                  borderRadius: 'var(--radius-pill)', 
                  display: 'flex',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '20px'
                }}>
                  {(['formal', 'casual', 'very-casual'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setToneMode(t)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: toneMode === t ? 'var(--primary-accent)' : 'transparent',
                        color: toneMode === t ? '#FFFFFF' : 'var(--text-secondary)',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textTransform: 'capitalize'
                      }}
                    >
                      {t.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sample Output Preview Box */}
              <div style={{ 
                background: '#FAF9F6', 
                padding: '16px 20px', 
                borderRadius: '16px', 
                border: '1px solid var(--border-subtle)',
                fontSize: '13px'
              }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                  Live Preview Output
                </span>
                <p style={{ color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5, margin: 0 }}>
                  {toneMode === 'formal' && '"Please find attached our finalized architectural specification for your review."'}
                  {toneMode === 'casual' && '"Here\'s our updated architecture spec ready for the team to check out."'}
                  {toneMode === 'very-casual' && '"Pushed the new arch spec, take a look when you get a sec!"'}
                </p>
              </div>
            </div>

            {/* Tile 3: Hotkey Keycaps (Cmd+Shift+Space / Ctrl+Shift+Space) */}
            <div className="rounded-card" style={{ 
              padding: '36px', 
              background: '#FFFFFF', 
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-floating)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ 
                    width: '42px', 
                    height: '42px', 
                    borderRadius: '12px', 
                    background: 'var(--pastel-mint-soft)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#059669'
                  }}>
                    <Keyboard size={22} />
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => setActivePlatform('mac')}
                      style={{
                        border: '1px solid var(--border-medium)',
                        background: activePlatform === 'mac' ? 'var(--primary-accent)' : '#FFFFFF',
                        color: activePlatform === 'mac' ? '#FFFFFF' : 'var(--text-secondary)',
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      macOS
                    </button>
                    <button
                      onClick={() => setActivePlatform('win')}
                      style={{
                        border: '1px solid var(--border-medium)',
                        background: activePlatform === 'win' ? 'var(--primary-accent)' : '#FFFFFF',
                        color: activePlatform === 'win' ? '#FFFFFF' : 'var(--text-secondary)',
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Windows
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Global Push-to-Talk Shortcut
                </h3>

                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                  Triggered OS-wide via native low-level keyboard hooks. Release to insert at cursor, double-tap for hands-free.
                </p>

                {/* Tactile Keycap Buttons */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '10px', 
                  padding: '24px', 
                  background: 'var(--bg-canvas)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '20px'
                }}>
                  {(activePlatform === 'mac' 
                    ? ['⌘ Cmd', '⇧ Shift', 'Space'] 
                    : ['Ctrl', 'Shift', 'Space']
                  ).map((keycap, i) => (
                    <div 
                      key={i}
                      style={{ 
                        background: '#FFFFFF', 
                        border: '1px solid #D6D3D1',
                        borderBottom: '4px solid #A8A29E',
                        borderRadius: '10px',
                        padding: '12px 18px',
                        fontSize: '15px',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.04)',
                        userSelect: 'none'
                      }}
                    >
                      {keycap}
                    </div>
                  ))}
                </div>
              </div>

              {/* Behavior Note */}
              <div style={{ 
                background: '#FAF9F6', 
                padding: '14px 20px', 
                borderRadius: '14px', 
                border: '1px solid var(--border-subtle)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span><strong>Hold:</strong> Record buffer</span>
                <span><strong>Release:</strong> Paste formatted text</span>
                <span><strong>Double-tap:</strong> Hands-free</span>
              </div>
            </div>

            {/* Tile 4: Hardware Acceleration Chips */}
            <div className="rounded-card" style={{ 
              padding: '36px', 
              background: '#FFFFFF', 
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-floating)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ 
                    width: '42px', 
                    height: '42px', 
                    borderRadius: '12px', 
                    background: '#F5F5F7', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#1D1D1F'
                  }}>
                    <Cpu size={22} />
                  </div>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: '#1E40AF', 
                    background: '#DBEAFE', 
                    padding: '3px 10px', 
                    borderRadius: 'var(--radius-pill)' 
                  }}>
                    NATIVE ACCELERATION
                  </span>
                </div>

                <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Hardware Neural Engines
                </h3>

                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                  Compiled with native platform backends to preserve battery life and achieve sub-350ms streaming tokens.
                </p>

                {/* Two Hardware Chips Comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                  {/* Apple Silicon Chip Card */}
                  <div style={{ 
                    background: '#FAF9F6', 
                    border: '1px solid var(--border-medium)', 
                    borderRadius: '16px', 
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Apple Silicon M1/M2/M3/M4
                    </span>
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                      ✓ CoreML Neural Engine (ANE)
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Zero fan spin · 15W idle power profile
                    </span>
                  </div>

                  {/* Windows DirectML Chip Card */}
                  <div style={{ 
                    background: '#FAF9F6', 
                    border: '1px solid var(--border-medium)', 
                    borderRadius: '16px', 
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Windows x64 / ARM64
                    </span>
                    <span style={{ fontSize: '11px', color: '#1D4ED8', fontWeight: 700 }}>
                      ✓ DirectML DirectX 12 NPU/GPU
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Snapdragon X Elite & NVIDIA RTX support
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Chip Metric */}
              <div style={{ 
                background: '#FAF9F6', 
                padding: '14px 20px', 
                borderRadius: '14px', 
                border: '1px solid var(--border-subtle)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={15} color="#10B981" />
                  Battery optimized offload
                </span>
                <span><strong>Inference CPU:</strong> &lt; 0.2% on standby</span>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SCREEN 6: Privacy, Specs, Downloads, FAQ, Final CTA & Footer
            1. Privacy section with "Network activity: 0 outbound connections" panel
            2. Row of five stat cards
            3. Three OS download cards (macOS Apple Silicon, Windows x64/ARM64, Linux)
            4. Accordion FAQ
            5. Final pastel gradient CTA
            6. Footer with huge faint wordmark
           ========================================================================= */}

        {/* 1. Privacy Section with 0 Outbound Connections Panel */}
        <section aria-label="Privacy and security" style={{ marginTop: '144px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div className="eyebrow-pill" style={{ background: '#FFFFFF', borderColor: 'rgba(28, 25, 23, 0.08)' }}>
              <Lock size={14} color="#059669" />
              <span>Air-Gapped Compliance · Zero Analytics</span>
            </div>
          </div>

          <h2 style={{ 
            fontSize: '52px', 
            fontWeight: 800, 
            letterSpacing: '-0.03em', 
            lineHeight: 1.12, 
            maxWidth: '920px', 
            margin: '0 auto 16px',
            color: 'var(--text-primary)' 
          }}>
            Absolute privacy, <span className="serif-accent" style={{ color: '#44403C' }}>guaranteed by physics.</span>
          </h2>

          <p style={{ 
            fontSize: '18px', 
            color: 'var(--text-secondary)', 
            maxWidth: '660px', 
            margin: '0 auto 48px',
            lineHeight: 1.6
          }}>
            We don't have terms of service promising we won't listen to your audio. 
            The binary literally has no network client code for speech data.
          </p>

          {/* Network Activity: 0 Outbound Connections Panel */}
          <div className="rounded-card" style={{ 
            maxWidth: '1060px', 
            margin: '0 auto 64px', 
            padding: '36px', 
            background: '#FFFFFF', 
            border: '1px solid var(--border-medium)',
            boxShadow: 'var(--shadow-floating)',
            textAlign: 'left'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              paddingBottom: '20px', 
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '28px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '38px', 
                  height: '38px', 
                  borderRadius: '10px', 
                  background: 'var(--pastel-mint-soft)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#059669'
                }}>
                  <Activity size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    System Socket Monitor
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Active process: <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-canvas)', padding: '2px 6px', borderRadius: '4px' }}>LiveSpeak-edge (PID 4821)</code>
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)' }} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#047857' }}>
                  Network activity: 0 outbound connections
                </span>
              </div>
            </div>

            {/* Socket Table & Memory Ingestion Verification */}
            <div style={{ 
              background: '#18181B', 
              borderRadius: '16px', 
              padding: '24px', 
              fontFamily: 'var(--font-mono)', 
              fontSize: '13px',
              color: '#A1A1AA',
              marginBottom: '24px',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #27272A', color: '#71717A', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>PROTO / REMOTE ADDRESS</span>
                <span>STATUS</span>
                <span>DATA EXFILTRATED</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #27272A' }}>
                <span style={{ color: '#F4F4F5' }}>TCP 0.0.0.0:8080 (LAN WS Broadcast)</span>
                <span style={{ color: '#34D399' }}>LISTENING (LOCAL ONLY)</span>
                <span style={{ color: '#34D399' }}>0 KB</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #27272A' }}>
                <span style={{ color: '#F4F4F5' }}>WAN External Telemetry</span>
                <span style={{ color: '#F87171' }}>DISABLED / STRIPPED</span>
                <span style={{ color: '#34D399' }}>0 KB</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px' }}>
                <span style={{ color: '#F4F4F5' }}>Cloud STT Fallback API</span>
                <span style={{ color: '#F87171' }}>DISCONNECTED (OFFLINE MODE)</span>
                <span style={{ color: '#34D399' }}>0 KB</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={16} color="#059669" />
                Transient In-Memory Buffers only — audio is discarded immediately after inference
              </span>
              <span><strong>HIPAA & GDPR:</strong> Certified Air-Gapped Clean</span>
            </div>
          </div>

          {/* 2. Row of Five Stat Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(5, 1fr)', 
            gap: '18px', 
            maxWidth: '1160px', 
            margin: '0 auto 128px',
            textAlign: 'left'
          }}>
            {[
              { label: 'Total Footprint', value: '< 200 MB', sub: 'Binary + model weights combined', bg: 'var(--pastel-peach-soft)', color: '#C2410C' },
              { label: 'Token Latency', value: '350 ms', sub: 'Partial tokens render live', bg: 'var(--pastel-lilac-soft)', color: '#6D28D9' },
              { label: 'Cloud Cost', value: '$0 / mo', sub: 'Forever free, bare-metal local', bg: 'var(--pastel-mint-soft)', color: '#047857' },
              { label: 'Idle Memory', value: '35 MB', sub: 'Tauri v2 micro host footprint', bg: '#F5F5F7', color: '#1D1D1F' },
              { label: 'Audience Sync', value: '< 50 ms', sub: 'Sub-frame LAN WebSocket ping', bg: '#FFF7ED', color: '#EA580C' },
            ].map((stat, i) => (
              <div 
                key={i}
                className="rounded-card"
                style={{ 
                  padding: '24px 20px', 
                  background: '#FFFFFF', 
                  border: '1px solid var(--border-medium)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em', 
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: '10px'
                }}>
                  {stat.label}
                </span>
                <span style={{ 
                  fontSize: '32px', 
                  fontWeight: 800, 
                  color: stat.color, 
                  letterSpacing: '-0.03em', 
                  display: 'block',
                  lineHeight: 1,
                  marginBottom: '8px'
                }}>
                  {stat.value}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, display: 'block' }}>
                  {stat.sub}
                </span>
              </div>
            ))}
          </div>

          {/* 3. Three OS Download Cards */}
          <div id="download" style={{ textAlign: 'center', marginBottom: '128px' }}>
            <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div className="eyebrow-pill" style={{ background: '#FFFFFF', borderColor: 'rgba(28, 25, 23, 0.08)' }}>
                <HardDrive size={14} color="#7C3AED" />
                <span>Single Executable Installer · No Node/Python Required</span>
              </div>
            </div>

            <h2 style={{ 
              fontSize: '52px', 
              fontWeight: 800, 
              letterSpacing: '-0.03em', 
              lineHeight: 1.12, 
              maxWidth: '820px', 
              margin: '0 auto 16px',
              color: 'var(--text-primary)' 
            }}>
              Ready for your machine, <span className="serif-accent" style={{ color: '#44403C' }}>right out of the box.</span>
            </h2>

            <p style={{ 
              fontSize: '18px', 
              color: 'var(--text-secondary)', 
              maxWidth: '620px', 
              margin: '0 auto 48px',
              lineHeight: 1.6
            }}>
              Zero dependencies. Download the standalone bundle compiled specifically for your operating system's hardware accelerator.
            </p>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '28px', 
              maxWidth: '1160px', 
              margin: '0 auto',
              textAlign: 'left'
            }}>
              {/* macOS Card */}
              <div className="rounded-card" style={{ 
                padding: '36px', 
                background: '#FFFFFF', 
                border: '1px solid rgba(124, 58, 237, 0.2)',
                boxShadow: 'var(--shadow-floating)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <span style={{ fontSize: '28px' }}>🍎</span>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: '#6D28D9', 
                      background: 'var(--pastel-lilac)', 
                      padding: '4px 10px', 
                      borderRadius: 'var(--radius-pill)' 
                    }}>
                      RECOMMENDED
                    </span>
                  </div>

                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    macOS Apple Silicon
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                    M1, M2, M3, M4 Macs with native CoreML Apple Neural Engine acceleration.
                  </p>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#10B981" /> Universal DMG installer (184 MB)
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#10B981" /> ScreenCaptureKit 0-driver loopback
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#10B981" /> macOS 13.0 Ventura or later
                    </li>
                  </ul>
                </div>

                <a 
                  href="#download-mac" 
                  className="pill-button pill-button-primary"
                  style={{ width: '100%', padding: '14px', textAlign: 'center' }}
                >
                  <Download size={16} />
                  Download .dmg (Apple Silicon)
                </a>
              </div>

              {/* Windows Card */}
              <div className="rounded-card" style={{ 
                padding: '36px', 
                background: '#FFFFFF', 
                border: '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <span style={{ fontSize: '28px' }}>🪟</span>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: '#1E40AF', 
                      background: '#DBEAFE', 
                      padding: '4px 10px', 
                      borderRadius: 'var(--radius-pill)' 
                    }}>
                      DIRECTML
                    </span>
                  </div>

                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Windows x64 / ARM64
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                    DirectX 12 GPU & Snapdragon X Elite NPU hardware acceleration.
                  </p>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#10B981" /> Standalone EXE / MSI installer (191 MB)
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#10B981" /> WASAPI loopback system audio
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#10B981" /> Windows 10/11 64-bit
                    </li>
                  </ul>
                </div>

                <a 
                  href="#download-win" 
                  className="pill-button pill-button-secondary"
                  style={{ width: '100%', padding: '14px', textAlign: 'center' }}
                >
                  <Download size={16} />
                  Download .exe (Windows)
                </a>
              </div>

              {/* Linux Card */}
              <div className="rounded-card" style={{ 
                padding: '36px', 
                background: '#FFFFFF', 
                border: '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <span style={{ fontSize: '28px' }}>🐧</span>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: '#047857', 
                      background: 'var(--pastel-mint-soft)', 
                      padding: '4px 10px', 
                      borderRadius: 'var(--radius-pill)' 
                    }}>
                      OPEN SOURCE
                    </span>
                  </div>

                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Linux AppImage / Deb
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                    Bare-metal compilation for Ubuntu, Fedora, Arch with PipeWire audio capture.
                  </p>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#10B981" /> Portable AppImage & .deb (179 MB)
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#10B981" /> PipeWire / ALSA loopback support
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#10B981" /> glibc 2.31+ compatible
                    </li>
                  </ul>
                </div>

                <a 
                  href="#download-linux" 
                  className="pill-button pill-button-secondary"
                  style={{ width: '100%', padding: '14px', textAlign: 'center' }}
                >
                  <Terminal size={16} />
                  Download AppImage (Linux)
                </a>
              </div>
            </div>
          </div>

          {/* 4. Accordion FAQ */}
          <div style={{ maxWidth: '860px', margin: '0 auto 128px', textAlign: 'left' }}>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '16px' }}>
                <div className="eyebrow-pill" style={{ background: '#FFFFFF', borderColor: 'rgba(28, 25, 23, 0.08)' }}>
                  <span>Frequently Answered Questions</span>
                </div>
              </div>

              <h2 style={{ fontSize: '42px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                Everything you need to <span className="serif-accent" style={{ color: '#44403C' }}>know.</span>
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                {
                  q: "How does LiveSpeak achieve sub-second live captioning without pauses?",
                  a: "Unlike traditional speech engines that wait for a speaker to stop talking before processing (Voice Activity Detection slicing), LiveSpeak uses an overlapping 3-second sliding window stepped forward every 500 milliseconds. This emits tentative [PARTIAL] tokens within 350ms and locks in finalized words as speech resolves."
                },
                {
                  q: "Does any audio ever leave my computer?",
                  a: "Never. All inference runs directly on your CPU/NPU using whisper.cpp sidecars and local quantized GGUF weights. The binary doesn't even contain network endpoints for sending audio data. It can operate in complete airplane mode or in disconnected enterprise environments."
                },
                {
                  q: "How does system audio capture work without third-party drivers?",
                  a: "On macOS, we integrate directly with Apple's ScreenCaptureKit API to record application or global system audio without installing virtual drivers like BlackHole. On Windows, we bind natively to the WASAPI loopback device in shared audio render mode."
                },
                {
                  q: "How does the OBS and Audience QR mode work?",
                  a: "LiveSpeak includes a lightweight Tokio WebSocket server running on port 8080. Streamers point OBS to http://localhost:8080/broadcast for a transparent subtitle browser source. In-person attendees scan a QR code resolving the host's local IP to follow live synchronized captions on their phones without installing any software."
                },
                {
                  q: "What are the minimum hardware requirements?",
                  a: "Any Apple Silicon Mac (M1 through M4) with 8GB RAM, or any modern Windows 10/11 machine with an Intel/AMD 64-bit CPU or Snapdragon ARM64 processor. The entire application runs comfortably in under 200MB of RAM."
                }
              ].map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div 
                    key={index}
                    className="rounded-card"
                    style={{ 
                      padding: '24px 28px', 
                      background: '#FFFFFF', 
                      border: '1px solid var(--border-medium)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {faq.q}
                      </h4>
                      <ChevronDown 
                        size={18} 
                        color="var(--text-muted)" 
                        style={{ 
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                          transition: 'transform 0.2s ease' 
                        }} 
                      />
                    </div>

                    {isOpen && (
                      <p style={{ marginTop: '16px', fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.65, paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Final Pastel Gradient CTA */}
          <div style={{ 
            maxWidth: '1160px', 
            margin: '0 auto 128px', 
            background: 'linear-gradient(135deg, var(--pastel-peach) 0%, var(--pastel-lilac) 50%, var(--pastel-mint) 100%)', 
            borderRadius: '32px',
            padding: '72px 48px',
            textAlign: 'center',
            boxShadow: '0 30px 60px -15px rgba(234, 88, 12, 0.15)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ maxWidth: '720px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'inline-flex', padding: '6px 16px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', borderRadius: 'var(--radius-pill)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px' }}>
                ⚡ Get Started in 30 Seconds
              </div>

              <h2 style={{ fontSize: '56px', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.1, color: '#1C1917', marginBottom: '20px' }}>
                Dictate faster. <span className="serif-accent" style={{ color: '#44403C' }}>Own your words.</span>
              </h2>

              <p style={{ fontSize: '19px', color: '#44403C', lineHeight: 1.6, marginBottom: '36px' }}>
                Download LiveSpeak Edge today and experience featherweight, zero-cloud desktop speech-to-text.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <a 
                  href="#download" 
                  className="pill-button pill-button-primary"
                  style={{ padding: '16px 36px', fontSize: '16px' }}
                >
                  <Download size={18} />
                  Download for Free
                </a>
                <a 
                  href="https://github.com/youknowme19/Team-Neaural_ninjas-Gopalan-" 
                  target="_blank" 
                  rel="noreferrer"
                  className="pill-button pill-button-secondary"
                  style={{ padding: '16px 32px', fontSize: '16px' }}
                >
                  View Source on GitHub
                  <ArrowRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Footer with Huge Faint Wordmark */}
        <footer style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '64px 24px 32px', 
          borderTop: '1px solid var(--border-medium)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '64px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LiveSpeakLogo size={28} animate="off" color="#1C1917" textColor="#1C1917" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--pastel-mint)', padding: '2px 8px', borderRadius: '9999px' }}>
                Edge
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '28px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              <a href="#download" style={{ color: 'inherit', textDecoration: 'none' }}>Download</a>
              <a href="#features" style={{ color: 'inherit', textDecoration: 'none' }}>Architecture</a>
              <a href="https://github.com/youknowme19/Team-Neaural_ninjas-Gopalan-" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>GitHub</a>
              <a href="#privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Air-Gap Security</a>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span>© 2026 LiveSpeak Edge. 100% On-Device, Air-Gapped & Free.</span>
            <span>Sub-200MB Distribution · Zero Cloud Reliance</span>
          </div>

          {/* Huge Faint Wordmark */}
          <div style={{ 
            textAlign: 'center', 
            marginTop: '48px', 
            userSelect: 'none', 
            pointerEvents: 'none' 
          }}>
            <span style={{ 
              fontSize: '148px', 
              fontWeight: 900, 
              letterSpacing: '-0.05em', 
              color: 'rgba(28, 25, 23, 0.03)', 
              display: 'block', 
              lineHeight: 0.8 
            }}>
              LiveSpeak
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;






