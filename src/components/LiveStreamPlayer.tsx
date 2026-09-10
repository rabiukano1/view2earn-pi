import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';

const WebViewPlayer = WebView as any;

export type StreamSignal =
  | { kind: 'buffering' }
  | { kind: 'playing' }
  | { kind: 'bitrate'; bitrate: number };

export function extractYoutubeId(url: string): string | null {
  try {
    const host = url.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
    const isYT = host.includes('youtube.com') || host.includes('youtu.be');
    if (!isYT) return null;
    const u = new URL(url);
    const fromQuery = u.searchParams.get('v');
    if (fromQuery) return fromQuery;
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\/+/, '').split('/')[0] || null;
    }
    const m = u.pathname.match(/\/(?:watch|shorts|embed|live|v)\/([^/?#]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// HLS.js player for .m3u8 streams — posts real health metrics back to RN.
function buildHlsHtml(streamUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; background: #000; }
          body, html { width: 100%; height: 100%; overflow: hidden; display: flex; justify-content: center; align-items: center; background-color: #05050A; }
          video { width: 100%; height: 100%; object-fit: contain; }
          .error-overlay { position: absolute; color: #fff; font-family: sans-serif; font-size: 14px; text-align: center; display: none; padding: 20px; background: transparent; }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
      </head>
      <body>
        <video id="video" controls autoplay playsinline webkit-playsinline preload="auto"></video>
        <div id="error" class="error-overlay">⚠️ Stream offline or slow.<br/>Switching to backup server…</div>
        <script>
          const video = document.getElementById('video');
          const errorDiv = document.getElementById('error');
          const streamUrl = "${streamUrl}";
          function post(type, payload) {
            try {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {})));
              }
            } catch (e) {}
          }
          video.addEventListener('waiting', function () { post('signal', { state: 'buffering' }); });
          video.addEventListener('playing', function () { post('signal', { state: 'playing' }); });
          video.addEventListener('error', function () { post('fatal', { error: 'video' }); });
          if (window.Hls && Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 90 });
            let recoveredOnce = false;
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function () { post('ready', {}); video.play().catch(function () {}); });
            hls.on(Hls.Events.LEVEL_SWITCHED, function (event, data) {
              const level = hls.levels && hls.levels[data.level] ? hls.levels[data.level] : null;
              post('signal', { bitrate: level ? level.bitrate : 0, level: data.level });
            });
            hls.on(Hls.Events.FRAG_BUFFERED, function () {
              const lvl = hls.currentLevel;
              const level = lvl >= 0 && hls.levels && hls.levels[lvl] ? hls.levels[lvl] : null;
              post('signal', { bitrate: level ? level.bitrate : 0, level: lvl });
            });
            hls.on(Hls.Events.ERROR, function (event, data) {
              if (!data.fatal) return;
              if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recoveredOnce) { recoveredOnce = true; hls.recoverMediaError(); return; }
              errorDiv.style.display = 'block';
              post('fatal', { error: data.type });
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', function () { post('ready', {}); video.play().catch(function () {}); });
          } else {
            post('fatal', { error: 'unsupported' });
          }
        </script>
      </body>
    </html>
  `;
}

// YouTube iframe player — plays watch URLs + livestreams inside the WebView.
function buildYoutubeHtml(videoId: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; background: #000; }
          body, html { width: 100%; height: 100%; overflow: hidden; background-color: #05050A; }
          #player { position: absolute; inset: 0; width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <div id="player"></div>
        <script src="https://www.youtube.com/iframe_api"></script>
        <script>
          function post(type, payload) {
            try {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {})));
              }
            } catch (e) {}
          }
          function onReady() {
            new YT.Player('player', {
              videoId: '${videoId}',
              playerVars: { autoplay: 1, playsinline: 1, controls: 1 },
              events: {
                onReady: function (e) { post('ready', {}); e.target.playVideo(); },
                onStateChange: function (e) {
                  if (e.data === YT.PlayerState.PLAYING) post('signal', { state: 'playing' });
                  if (e.data === YT.PlayerState.BUFFERING) post('signal', { state: 'buffering' });
                },
                onError: function () { post('fatal', { error: 'youtube' }); }
              }
            });
          }
          window.onYouTubeIframeAPIReady = onReady;
          if (window.YT && window.YT.Player) onReady();
        </script>
      </body>
    </html>
  `;
}

interface Props {
  streamUrl: string;
  /** Called with stream health updates (buffering / bitrate). */
  onSignal?: (signal: StreamSignal) => void;
  /** Called when the stream fatally errors (trigger auto-failover). */
  onFatal?: () => void;
}

export default function LiveStreamPlayer({ streamUrl, onSignal, onFatal }: Props) {
  const webViewRef = useRef<WebView>(null);
  const youtubeId = useMemo(() => extractYoutubeId(streamUrl), [streamUrl]);

  const html = useMemo(
    () => (youtubeId ? buildYoutubeHtml(youtubeId) : buildHlsHtml(streamUrl)),
    [youtubeId, streamUrl],
  );

  const onMessage = (event: any) => {
    let msg: any;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'signal') {
      if (msg.state === 'buffering') onSignal?.({ kind: 'buffering' });
      else if (msg.state === 'playing') onSignal?.({ kind: 'playing' });
      else if (typeof msg.bitrate === 'number' && msg.bitrate > 0) {
        onSignal?.({ kind: 'bitrate', bitrate: msg.bitrate });
      }
    } else if (msg.type === 'fatal') {
      onFatal?.();
    }
  };

  return (
    <View style={styles.container}>
      <WebViewPlayer
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
        onMessage={onMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
});
