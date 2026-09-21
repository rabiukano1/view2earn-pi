import { FFmpegKit, FFmpegKitConfig, ReturnCode } from 'kroog-ffmpeg-kit-react-native';
import { Paths } from 'expo-file-system';

// Every feature is one ffmpeg command. Inputs are content:// URIs from the
// system picker (WhatsApp .opus, Telegram .ogg, mp3, m4a, wav, video… ffmpeg
// decodes them all); outputs land in the app cache as plain files.

const outPath = (ext: string) =>
  `${Paths.cache.uri.replace('file://', '')}/out-${Date.now()}.${ext}`;

async function run(args: string, ext: string, onLog?: (l: string) => void) {
  const out = outPath(ext);
  const session = await FFmpegKit.execute(`-y ${args} "${out}"`);
  const code = await session.getReturnCode();
  if (!ReturnCode.isSuccess(code)) {
    onLog?.(await session.getOutput());
    throw new Error(`ffmpeg failed (${code})`);
  }
  return 'file://' + out;
}

// ffmpeg-kit reads SAF URIs through a pipe it registers per call.
const saf = (uri: string) => FFmpegKitConfig.getSafParameterForRead(uri);

export type AudioFormat = 'mp3' | 'm4a' | 'wav';

export async function convert(uri: string, fmt: AudioFormat) {
  return run(`-i ${await saf(uri)} -vn`, fmt);
}

// pitch > 1 = higher (chipmunk), < 1 = deeper. Tempo is corrected so length stays the same.
export async function changeVoice(uri: string, pitch: number) {
  const af = `asetrate=48000*${pitch},aresample=48000,atempo=${1 / pitch}`;
  return run(`-i ${await saf(uri)} -vn -af "${af}"`, 'mp3');
}

// The 16KB ffmpeg build has no x264, so H.264 comes from the phone's hardware
// encoder; mpeg4 is the software fallback for devices whose MediaCodec balks.
async function toVideo(inputs: string, filter: string, onLog?: (l: string) => void) {
  // audio is always input 0 so the maps stay fixed
  const base = `${inputs} -filter_complex "${filter},format=nv12[v]" -map "[v]" -map 0:a -c:a aac -b:a 128k -shortest -movflags +faststart`;
  try {
    return await run(`${base} -c:v h264_mediacodec -b:v 1500k`, 'mp4');
  } catch {
    return run(`${base} -c:v mpeg4 -q:v 4`, 'mp4', onLog);
  }
}

// Still image + audio -> mp4 (the "add image on audio" feature).
export async function imageAudioToVideo(imageUri: string, audioUri: string, onLog?: (l: string) => void) {
  const inputs = `-i ${await saf(audioUri)} -loop 1 -framerate 10 -i ${await saf(imageUri)}`;
  // scale to 720p max, pad to even dimensions (hardware encoders require it)
  return toVideo(inputs, "[1:v]scale='min(1280,iw)':-2,pad=ceil(iw/2)*2:ceil(ih/2)*2", onLog);
}

// Audio only -> mp4 with an animated waveform.
export async function audioToVideo(audioUri: string, onLog?: (l: string) => void) {
  const inputs = `-i ${await saf(audioUri)}`;
  return toVideo(inputs, '[0:a]showwaves=s=720x720:mode=cline:colors=white:rate=15', onLog);
}
