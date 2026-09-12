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
// referrer/userAgent are forwarded via xhrSetup so CORS-checked CDNs (uzayterligi, Sakatv) don't 403.
function buildHlsHtml(streamUrl: string, httpReferrer?: string, userAgent?: string): string {
  const ref = httpReferrer ? httpReferrer.replace(/"/g, '&quot;') : '';
  const ua = userAgent ? userAgent.replace(/"/g, '&quot;') : '';
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
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 90,
              xhrSetup: function(xhr, url) {
                if ("${ref}") xhr.setRequestHeader('Referer', "${ref}");
                if ("${ua}") xhr.setRequestHeader('User-Agent', "${ua}");
                // allow http -> https mixed content via proxy
                xhr.withCredentials = false;
              }
            });
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

// Generic web / Yacine TV iframe player — for non-HLS pages (yacine-tv.com, koora, etc).
// These sites render their own HLS player inside the page; we just embed them full-screen.
function buildWebHtml(pageUrl: string, referrer?: string): string {
  const safeUrl = pageUrl.replace(/"/g, '&quot;');
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; background: #000; }
          body, html { width: 100%; height: 100%; overflow: hidden; background: #000; }
          iframe { width: 100%; height: 100%; border: none; background: #000; }
        </style>
      </head>
      <body>
        <iframe
          src="${safeUrl}"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowfullscreen
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
        <script>
          function post(type, payload) {
            try {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {})));
              }
            } catch(e) {}
          }
          // Yacine pages take a moment to start — report playing after load
          window.addEventListener('load', function(){ setTimeout(function(){ post('signal', { state: 'playing' }); }, 2000); });
          window.addEventListener('error', function(){ post('fatal', { error: 'webview' }); });
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
  httpReferrer?: string;
  userAgent?: string;
  /** Called with stream health updates (buffering / bitrate). */
  onSignal?: (signal: StreamSignal) => void;
  /** Called when the stream fatally errors (trigger auto-failover). */
  onFatal?: () => void;
}

function isHlsUrl(url: string): boolean {
  return /\.m3u8?(\?|#|$)/i.test(url);
}

function isYacineOrWebUrl(url: string): boolean {
  return /yacine|yacin|koora|alkass|bein/i.test(url) && !isHlsUrl(url);
}

export default function LiveStreamPlayer({ streamUrl, httpReferrer, userAgent, onSignal, onFatal }: Props) {
  const webViewRef = useRef<WebView>(null);
  const youtubeId = useMemo(() => extractYoutubeId(streamUrl), [streamUrl]);

  const html = useMemo(() => {
    if (youtubeId) return buildYoutubeHtml(youtubeId);
    if (isHlsUrl(streamUrl)) return buildHlsHtml(streamUrl, httpReferrer, userAgent);
    // Yacine TV and other web players: embed as iframe (they handle their own HLS internally)
    if (isYacineOrWebUrl(streamUrl) || !isHlsUrl(streamUrl)) {
      // If it's a plain https URL without .m3u8, treat as web embed
      if (/^https?:\/\//i.test(streamUrl) && !isHlsUrl(streamUrl)) return buildWebHtml(streamUrl, httpReferrer);
      return buildHlsHtml(streamUrl, httpReferrer, userAgent);
    }
    return buildHlsHtml(streamUrl, httpReferrer, userAgent);
  }, [youtubeId, streamUrl, httpReferrer, userAgent]);

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
        source={{ html, baseUrl: 'https://localhost' }}
        style={styles.webview}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
        mixedContentMode="always"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        userAgent={userAgent}
        onMessage={onMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
});
