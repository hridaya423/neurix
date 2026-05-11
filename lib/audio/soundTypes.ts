export type SoundFormat = "wav" | "mp3";

export type ProjectSound = {
  id: string;
  name: string;
  dataUrl: string;
  dataFormat: SoundFormat;
  storageId?: string;
  rate?: number;
  sampleCount?: number;
  duration?: number;
  assetId?: string;
};

export function getAudioMime(format: SoundFormat) {
  return format === "mp3" ? "audio/mpeg" : "audio/wav";
}

export function getSoundFormatFromName(name: string, fallback: SoundFormat = "wav"): SoundFormat {
  return name.toLowerCase().endsWith(".mp3") ? "mp3" : fallback;
}

export function sanitizeSoundName(name: string, fallback = "Sound") {
  return name.replace(/\.[^.]+$/, "").trim() || fallback;
}
