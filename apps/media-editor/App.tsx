import React, { useState } from 'react';
import { ActivityIndicator, Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { audioToVideo, changeVoice, convert, imageAudioToVideo } from './src/ffmpeg';

export default function App() {
  const [audio, setAudio] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('');

  const pick = async (set: (f: File) => void, mime: string) => {
    const r = await File.pickFileAsync({ mimeTypes: mime });
    if (!r.canceled) set(r.result);
  };

  const go = async (job: () => Promise<string>) => {
    setBusy(true);
    setLog('');
    try {
      const out = await job();
      setLog(`Done: ${out}`);
      await Sharing.shareAsync(out);
    } catch (e: any) {
      setLog(prev => `${e.message}\n${prev}`);
    } finally {
      setBusy(false);
    }
  };

  const a = audio?.uri ?? '';
  const disabled = busy || !audio;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.h1}>Media Editor</Text>

        <Text style={s.h2}>1. Audio</Text>
        <Button title={audio ? audio.name : 'Pick audio (WhatsApp, Telegram, mp3…)'} onPress={() => pick(setAudio, 'audio/*')} />

        <Text style={s.h2}>2. Convert</Text>
        <View style={s.row}>
          {(['mp3', 'm4a', 'wav'] as const).map(f => (
            <Button key={f} title={f.toUpperCase()} disabled={disabled} onPress={() => go(() => convert(a, f))} />
          ))}
        </View>

        <Text style={s.h2}>3. Change voice</Text>
        <View style={s.row}>
          <Button title="Deep" disabled={disabled} onPress={() => go(() => changeVoice(a, 0.75))} />
          <Button title="Low" disabled={disabled} onPress={() => go(() => changeVoice(a, 0.9))} />
          <Button title="High" disabled={disabled} onPress={() => go(() => changeVoice(a, 1.15))} />
          <Button title="Chipmunk" disabled={disabled} onPress={() => go(() => changeVoice(a, 1.4))} />
        </View>

        <Text style={s.h2}>4. Make video</Text>
        <Button title={image ? image.name : 'Pick image (optional)'} onPress={() => pick(setImage, 'image/*')} />
        <View style={s.row}>
          <Button title="Image + audio → video" disabled={disabled || !image} onPress={() => go(() => imageAudioToVideo(image!.uri, a, setLog))} />
          <Button title="Waveform video" disabled={disabled} onPress={() => go(() => audioToVideo(a, setLog))} />
        </View>

        {busy && <ActivityIndicator style={s.spin} size="large" />}
        {!!log && <Text style={s.log}>{log}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  body: { padding: 16, gap: 8 },
  h1: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  h2: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spin: { marginTop: 24 },
  log: { marginTop: 16, fontFamily: 'monospace', fontSize: 12, color: '#444' },
});
