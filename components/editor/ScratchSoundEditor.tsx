"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, FastForward, Mic, Minus, Music, Play, Plus, Rewind, RotateCcw, Sparkles, Square, Trash2, TrendingDown, TrendingUp, Upload, Volume2, VolumeX } from "lucide-react";
import type { ProjectSound, SoundFormat } from "@/lib/audio/soundTypes";
import { getSoundFormatFromName, sanitizeSoundName } from "@/lib/audio/soundTypes";

type ScratchSoundEditorProps = {
  sounds: ProjectSound[];
  volume: number;
  onAddSound: (sound: ProjectSound) => void;
  onUpdateSound: (soundId: string, updater: (sound: ProjectSound) => ProjectSound) => void;
  onDeleteSound: (soundId: string) => void;
  onDuplicateSound: (soundId: string) => void;
  onVolumeChange: (volume: number) => void;
};

type SoundEffect = "faster" | "slower" | "louder" | "softer" | "mute" | "fadeIn" | "fadeOut" | "reverse" | "robot";

const effectButtons: Array<{ id: SoundEffect; label: string; icon: React.ReactNode }> = [
  { id: "faster", label: "Faster", icon: <FastForward size={16} strokeWidth={2.2} /> },
  { id: "slower", label: "Slower", icon: <Rewind size={16} strokeWidth={2.2} /> },
  { id: "louder", label: "Louder", icon: <Plus size={16} strokeWidth={2.2} /> },
  { id: "softer", label: "Softer", icon: <Minus size={16} strokeWidth={2.2} /> },
  { id: "mute", label: "Mute", icon: <VolumeX size={16} strokeWidth={2.2} /> },
  { id: "fadeIn", label: "Fade in", icon: <TrendingUp size={16} strokeWidth={2.2} /> },
  { id: "fadeOut", label: "Fade out", icon: <TrendingDown size={16} strokeWidth={2.2} /> },
  { id: "reverse", label: "Reverse", icon: <RotateCcw size={16} strokeWidth={2.2} /> },
  { id: "robot", label: "Robot", icon: <Sparkles size={16} strokeWidth={2.2} /> },
];

const emptyPeaks: number[] = [];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error("Web Audio is not supported in this browser.");
  return new AudioContextClass();
}

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read audio file."));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToArrayBuffer(dataUrl: string) {
  return await (await fetch(dataUrl)).arrayBuffer();
}

async function decodeDataUrl(dataUrl: string) {
  const context = getAudioContext();
  try {
    return await context.decodeAudioData(await dataUrlToArrayBuffer(dataUrl));
  } finally {
    void context.close();
  }
}

function encodeWav(buffer: AudioBuffer, sampleRate = buffer.sampleRate) {
  const channels = Math.min(2, buffer.numberOfChannels);
  const length = buffer.length * channels * 2;
  const output = new ArrayBuffer(44 + length);
  const view = new DataView(output);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = clamp(buffer.getChannelData(channel)[i] ?? 0, -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  const bytes = new Uint8Array(output);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function cloneEditedBuffer(source: AudioBuffer, transform: (sample: number, index: number, length: number, channel: number) => number) {
  const context = getAudioContext();
  const buffer = context.createBuffer(source.numberOfChannels, source.length, source.sampleRate);
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const input = source.getChannelData(channel);
    const output = buffer.getChannelData(channel);
    for (let i = 0; i < input.length; i += 1) output[i] = clamp(transform(input[i], i, input.length, channel), -1, 1);
  }
  void context.close();
  return buffer;
}

async function makeSoundFromDataUrl(dataUrl: string, name: string, format: SoundFormat, id = `sound-${Date.now()}-${Math.random().toString(16).slice(2)}`): Promise<ProjectSound> {
  const decoded = await decodeDataUrl(dataUrl);
  const nextDataUrl = format === "mp3" ? dataUrl : encodeWav(decoded);
  return {
    id,
    name: sanitizeSoundName(name, "Sound"),
    dataUrl: nextDataUrl,
    dataFormat: format === "mp3" ? "mp3" : "wav",
    rate: decoded.sampleRate,
    sampleCount: decoded.length,
    duration: decoded.duration,
  };
}

async function applyEffect(sound: ProjectSound, effect: SoundEffect) {
  const decoded = await decodeDataUrl(sound.dataUrl);
  const edited = effect === "reverse"
    ? cloneEditedBuffer(decoded, (_sample, index, length, channel) => decoded.getChannelData(channel)[length - index - 1] ?? 0)
    : cloneEditedBuffer(decoded, (sample, index, length) => {
      const progress = length <= 1 ? 1 : index / (length - 1);
      if (effect === "louder") return sample * 1.3;
      if (effect === "softer") return sample * 0.72;
      if (effect === "mute") return 0;
      if (effect === "fadeIn") return sample * progress;
      if (effect === "fadeOut") return sample * (1 - progress);
      if (effect === "robot") return sample * (Math.sin((index / decoded.sampleRate) * Math.PI * 70) > 0 ? 1 : -1) * 0.9;
      return sample;
    });

  const sampleRate = effect === "faster"
    ? Math.round(decoded.sampleRate * 1.25)
    : effect === "slower"
      ? Math.round(decoded.sampleRate * 0.8)
      : decoded.sampleRate;
  const dataUrl = encodeWav(edited, sampleRate);
  const duration = effect === "faster" ? decoded.duration / 1.25 : effect === "slower" ? decoded.duration / 0.8 : decoded.duration;
  return { ...sound, dataUrl, dataFormat: "wav" as const, rate: sampleRate, sampleCount: edited.length, duration };
}

function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0.00";
  return seconds.toFixed(2);
}

function Waveform({ sound }: { sound: ProjectSound | null }) {
  const [peaks, setPeaks] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!sound) return;
    decodeDataUrl(sound.dataUrl).then((buffer) => {
      if (cancelled) return;
      const channel = buffer.getChannelData(0);
      const bucketCount = 400;
      const bucketSize = Math.max(1, Math.floor(channel.length / bucketCount));
      const next = Array.from({ length: bucketCount }, (_, bucket) => {
        let max = 0;
        for (let i = bucket * bucketSize; i < Math.min(channel.length, (bucket + 1) * bucketSize); i += 1) {
          max = Math.max(max, Math.abs(channel[i]));
        }
        return max;
      });
      setPeaks(next);
    }).catch(() => setPeaks([]));
    return () => {
      cancelled = true;
    };
  }, [sound]);

  const visiblePeaks = sound ? peaks : emptyPeaks;

  const path = useMemo(() => {
    if (visiblePeaks.length === 0) return "";
    const width = 1000;
    const center = 100;
    const scale = 80;
    const top = visiblePeaks.map((peak, index) => `${(index / (visiblePeaks.length - 1)) * width},${center - Math.max(3, peak * scale)}`).join(" L ");
    const bottom = visiblePeaks.slice().reverse().map((peak, index) => `${((visiblePeaks.length - 1 - index) / (visiblePeaks.length - 1)) * width},${center + Math.max(3, peak * scale)}`).join(" L ");
    return `M ${top} L ${bottom} Z`;
  }, [visiblePeaks]);

  if (!sound) return null;

  return (
    <div className="scratch-sound-waveform" aria-label={`${sound.name} waveform`}>
      {path ? (
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none">
          <path d={path} className="scratch-sound-wave-fill" />
          <path d={path.replace(/ Z$/, "")} className="scratch-sound-wave-line" />
        </svg>
      ) : (
        <div className="scratch-sound-wave-loading" />
      )}
    </div>
  );
}

export function ScratchSoundEditor({ sounds, volume, onAddSound, onUpdateSound, onDeleteSound, onDuplicateSound, onVolumeChange }: ScratchSoundEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(sounds[0]?.id ?? null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  const selectedSound = sounds.find((sound) => sound.id === selectedId) ?? sounds[0] ?? null;

  useEffect(() => {
    if (!selectedSound && sounds[0]) setSelectedId(sounds[0].id);
    if (selectedSound && !sounds.some((sound) => sound.id === selectedSound.id)) setSelectedId(sounds[0]?.id ?? null);
  }, [selectedSound, sounds]);

  const addFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const original = await readFileAsDataUrl(file);
      const format = getSoundFormatFromName(file.name, file.type.includes("mpeg") ? "mp3" : "wav");
      const sound = await makeSoundFromDataUrl(original, file.name, format);
      onAddSound(sound);
      setSelectedId(sound.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const playSelected = () => {
    if (!selectedSound) return;
    audioRef.current?.pause();
    const audio = new Audio(selectedSound.dataUrl);
    audio.volume = clamp(volume / 100, 0, 1);
    audio.onended = () => setIsPlaying(false);
    audioRef.current = audio;
    setIsPlaying(true);
    void audio.play().catch(() => setIsPlaying(false));
  };

  const stopPreview = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setIsPlaying(false);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      alert("Recording is not supported in this browser.");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recordingChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setIsProcessing(true);
      try {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(reader.error ?? new Error("Could not read recording."));
          reader.readAsDataURL(blob);
        });
        const sound = await makeSoundFromDataUrl(dataUrl, `recording${sounds.length + 1}`, "wav");
        onAddSound(sound);
        setSelectedId(sound.id);
      } finally {
        setIsProcessing(false);
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  const editSelected = async (effect: SoundEffect) => {
    if (!selectedSound) return;
    stopPreview();
    setIsProcessing(true);
    try {
      const edited = await applyEffect(selectedSound, effect);
      onUpdateSound(selectedSound.id, () => edited);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="scratch-sounds-workspace"> 
      <aside className="scratch-sound-pane"> 
        <div className="scratch-sound-pane-header"> 
          <span className="scratch-sound-pane-header-title">Sounds</span>
          <div className="scratch-sound-pane-header-actions">
            <button className="panel-icon-btn" onClick={() => fileInputRef.current?.click()} type="button" title="Upload sound"><Upload size={13} strokeWidth={2.5} /></button>
            <button className={cx("panel-icon-btn", isRecording && "scratch-sound-recording")} onClick={isRecording ? stopRecording : startRecording} type="button" title={isRecording ? "Stop recording" : "Record sound"}><Mic size={13} strokeWidth={2.5} /></button>
          </div>
          <input ref={fileInputRef} accept="audio/*" type="file" style={{ display: "none" }} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void addFile(file);
            event.currentTarget.value = "";
          }} />
        </div>
        <div className="scratch-sound-assets">
          {sounds.map((sound, index) => (
            <button className={cx("scratch-sound-asset", sound.id === selectedSound?.id && "scratch-sound-asset-active")} key={sound.id} onClick={() => setSelectedId(sound.id)} type="button">
              <span className="scratch-sound-thumb"><Volume2 size={20} strokeWidth={2} /></span>
              <div className="scratch-sound-asset-row">
                <span className="scratch-sound-index">{index + 1}</span>
                <span className="scratch-sound-list-name">{sound.name}</span>
                <span className="scratch-sound-list-duration">{formatTime(sound.duration)}</span>
                <span className="scratch-sound-delete" onClick={(event) => { event.stopPropagation(); onDeleteSound(sound.id); }}><Trash2 size={11} strokeWidth={2} /></span>
              </div>
            </button>
          ))}
          {sounds.length === 0 && <button className="scratch-sound-add-card" onClick={() => fileInputRef.current?.click()} type="button"><Plus size={14} /> Add sound</button>}
        </div>
      </aside>

      <main className="scratch-sound-editor-panel">
        {selectedSound ? (
          <>
            <div className="scratch-sound-toolbar">
              <label>Sound</label>
              <input className="scratch-sound-name-input" value={selectedSound?.name ?? ""} disabled={!selectedSound} onChange={(event) => selectedSound && onUpdateSound(selectedSound.id, (sound) => ({ ...sound, name: event.target.value }))} />
              <button className="scratch-sound-toolbar-icon-btn" type="button" onClick={() => selectedSound && onDuplicateSound(selectedSound.id)} disabled={!selectedSound} title="Duplicate"><Copy size={15} strokeWidth={2} /></button>
              <button className="scratch-sound-toolbar-icon-btn" type="button" onClick={() => selectedSound && onDeleteSound(selectedSound.id)} disabled={!selectedSound} title="Delete"><Trash2 size={15} strokeWidth={2} /></button>
              <div className="scratch-sound-volume-control"><VolumeX size={15} /><input type="range" min="0" max="100" value={volume} onChange={(event) => onVolumeChange(Number(event.target.value))} /><Volume2 size={15} /><span>{Math.round(volume)}%</span></div>
            </div>
            <Waveform sound={selectedSound} />
            <div className="scratch-sound-effect-bar">
              <button className="scratch-sound-play-btn" onClick={isPlaying ? stopPreview : playSelected} disabled={!selectedSound || isProcessing} type="button">
                {isPlaying ? <Square size={20} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
              </button>
              {effectButtons.map((effect) => (
                <button className="scratch-sound-effect" key={effect.id} onClick={() => void editSelected(effect.id)} disabled={!selectedSound || isProcessing} type="button">
                  <span className="scratch-sound-effect-icon" aria-hidden="true">{effect.icon}</span>
                  <span className="scratch-sound-effect-label">{effect.label}</span>
                </button>
              ))}
              {(isProcessing || isRecording) && <span className="scratch-sound-status">{isRecording ? "Recording..." : "Processing sound..."}</span>}
            </div>
          </>
        ) : (
          <div className="scratch-sound-empty-state">
            <div className="scratch-sound-empty-state-icon"><Music size={28} strokeWidth={1.5} /></div>
            <p className="scratch-sound-empty-state-title">No sound selected</p>
            <p className="scratch-sound-empty-state-sub">Upload or record a sound to get started</p>
            <div className="scratch-sound-empty-btns">
              <button className="scratch-sound-empty-btn" onClick={() => fileInputRef.current?.click()} type="button"><Upload size={13} /> Upload</button>
              <button className="scratch-sound-empty-btn" onClick={isRecording ? stopRecording : startRecording} type="button"><Mic size={13} /> {isRecording ? "Stop" : "Record"}</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
