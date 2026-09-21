// src/utils/youtubeDuration.ts

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * Format total seconds into a clean MM:SS or H:MM:SS duration string.
 */
export function formatDurationSeconds(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const formattedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;

  if (hours > 0) {
    const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${formattedMinutes}:${formattedSeconds}`;
  } else {
    return `${minutes}:${formattedSeconds}`;
  }
}

/**
 * Fetch the exact duration of a YouTube video using the official YouTube Iframe Player API.
 * Spawns a hidden headless player to retrieve duration metadata without playing audio or visual.
 */
export function fetchYouTubeDuration(videoId: string): Promise<string> {
  return new Promise((resolve) => {
    if (!videoId) {
      resolve('');
      return;
    }

    if (typeof window === 'undefined') {
      resolve('');
      return;
    }

    // Ensure YouTube Iframe API script is present in the DOM
    if (!window.YT && !document.getElementById('youtube-iframe-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    let attempts = 0;
    const maxAttempts = 60; // 6 seconds limit

    const checkAndInit = () => {
      attempts++;
      if (window.YT && window.YT.Player) {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        container.style.width = '1px';
        container.style.height = '1px';
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);

        let timeout = setTimeout(() => {
          try {
            container.remove();
          } catch (e) {}
          resolve('');
        }, 6000);

        try {
          new window.YT.Player(container, {
            videoId,
            playerVars: { autoplay: 0, controls: 0, disablekb: 1 },
            events: {
              onReady: (e: any) => {
                clearTimeout(timeout);
                try {
                  const totalSeconds = Math.floor(e.target.getDuration());
                  try {
                    e.target.destroy();
                  } catch (destroyErr) {}
                  try {
                    container.remove();
                  } catch (removeErr) {}

                  if (totalSeconds > 0) {
                    resolve(formatDurationSeconds(totalSeconds));
                  } else {
                    resolve('');
                  }
                } catch (err) {
                  try {
                    container.remove();
                  } catch (e) {}
                  resolve('');
                }
              },
              onError: () => {
                clearTimeout(timeout);
                try {
                  container.remove();
                } catch (e) {}
                resolve('');
              },
            },
          });
        } catch (err) {
          clearTimeout(timeout);
          try {
            container.remove();
          } catch (e) {}
          resolve('');
        }
      } else if (attempts < maxAttempts) {
        setTimeout(checkAndInit, 100);
      } else {
        resolve('');
      }
    };

    checkAndInit();
  });
}
