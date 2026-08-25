import React from "react";

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.view2earn";
export const APK_DOWNLOAD_URL = "https://github.com/rabiukano1/view2earn-pi/releases/download/v1.0.0/view2earn.apk";

export function PlayStoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
      <path d="M3.609 1.814L13.792 12 3.61 22.186a2.007 2.007 0 0 1-.61-1.428V3.242c0-.555.228-1.057.61-1.428z" fill="#00C1DE" />
      <path d="M17.18 8.613L4.852.883C4.43.615 3.97.587 3.61.758L13.792 12l3.388-3.387z" fill="#00DA75" />
      <path d="M17.18 15.387L13.792 12 3.61 23.242c.36.171.82.143 1.242-.125l12.328-7.73z" fill="#FF3A44" />
      <path d="M21.365 11.238l-4.185-2.625-3.388 3.387 3.388 3.387 4.185-2.625a1.472 1.472 0 0 0 0-2.524z" fill="#FFC800" />
    </svg>
  );
}

export function ApkDownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.76 1.05-1.81.93-2.88-.9.04-2.02.6-2.66 1.36-.57.66-.99 1.74-.86 2.78 1.01.08 2.01-.54 2.59-1.26z" />
    </svg>
  );
}

export function AppStoreButtons({ className = "" }: { className?: string }) {
  return (
    <div className={`app-badges-group ${className}`.trim()}>
      {/* Google Play Store Button */}
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="store-btn store-btn-play"
        title="Get View2Earn on Google Play"
      >
        <span className="store-btn-icon">
          <PlayStoreIcon />
        </span>
        <span className="store-btn-text">
          <span className="store-btn-sub">GET IT ON</span>
          <span className="store-btn-main">Google Play</span>
        </span>
      </a>

      {/* Direct APK Download Button */}
      <a
        href={APK_DOWNLOAD_URL}
        download
        className="store-btn store-btn-apk"
        title="Download View2Earn APK directly"
      >
        <span className="store-btn-icon">
          <ApkDownloadIcon />
        </span>
        <span className="store-btn-text">
          <span className="store-btn-sub">DIRECT INSTALL</span>
          <span className="store-btn-main">Download APK</span>
        </span>
      </a>

      {/* Apple App Store (Coming Soon) */}
      <div className="store-btn store-btn-disabled" title="iOS App Store coming soon">
        <span className="store-btn-icon" style={{ opacity: 0.8 }}>
          <AppleIcon />
        </span>
        <span className="store-btn-text">
          <span className="store-btn-sub">
            APP STORE <span className="store-badge-soon">SOON</span>
          </span>
          <span className="store-btn-main" style={{ color: "#cbd5e1" }}>
            iOS App
          </span>
        </span>
      </div>
    </div>
  );
}
