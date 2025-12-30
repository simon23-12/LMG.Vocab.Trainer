// PWA Installation Script
// Leibniz Montessori Gymnasium Düsseldorf

(function() {
  'use strict';

  let deferredPrompt;
  let installButton;

  // Service Worker registrieren
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('[PWA] Service Worker registered:', registration.scope);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[PWA] New Service Worker found');
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Neue Version verfügbar
                console.log('[PWA] New version available - refresh to update');
                showUpdateNotification();
              }
            });
          });
        })
        .catch(err => {
          console.error('[PWA] Service Worker registration failed:', err);
        });
    });
  }

  // Install Prompt abfangen
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] Install prompt triggered');
    e.preventDefault();
    deferredPrompt = e;
    
    // Zeige Install-Button
    showInstallButton();
  });

  // Nach Installation
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;
    hideInstallButton();
    
    // Optional: Analytics Event
    if (typeof gtag !== 'undefined') {
      gtag('event', 'app_installed', {
        event_category: 'PWA',
        event_label: 'LMG Vokabeltrainer'
      });
    }
  });

  // Install-Button anzeigen
  function showInstallButton() {
    // Prüfe ob Button bereits existiert
    installButton = document.getElementById('pwa-install-button');
    
    if (!installButton) {
      // Erstelle Button dynamisch
      installButton = document.createElement('button');
      installButton.id = 'pwa-install-button';
      installButton.className = 'pwa-install-btn';
      installButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        App installieren
      `;
      installButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #0066CC, #0052A3);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 9999;
        transition: transform 0.2s, box-shadow 0.2s;
        animation: slideIn 0.3s ease-out;
      `;
      
      // Hover-Effekt
      installButton.onmouseover = () => {
        installButton.style.transform = 'translateY(-2px)';
        installButton.style.boxShadow = '0 6px 16px rgba(0, 102, 204, 0.4)';
      };
      installButton.onmouseout = () => {
        installButton.style.transform = 'translateY(0)';
        installButton.style.boxShadow = '0 4px 12px rgba(0, 102, 204, 0.3)';
      };
      
      installButton.onclick = installApp;
      document.body.appendChild(installButton);
      
      // Animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @media (max-width: 480px) {
          .pwa-install-btn {
            bottom: 10px !important;
            right: 10px !important;
            left: 10px !important;
            justify-content: center;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    installButton.style.display = 'flex';
  }

  // Install-Button verstecken
  function hideInstallButton() {
    if (installButton) {
      installButton.style.display = 'none';
    }
  }

  // App installieren
  async function installApp() {
    if (!deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return;
    }

    // Zeige Browser-Install-Dialog
    deferredPrompt.prompt();

    // Warte auf User-Entscheidung
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted installation');
    } else {
      console.log('[PWA] User dismissed installation');
    }

    deferredPrompt = null;
    hideInstallButton();
  }

  // Update-Benachrichtigung
  function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #0066CC;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 16px;
      animation: slideDown 0.3s ease-out;
    `;
    
    notification.innerHTML = `
      <span>Neue Version verfügbar!</span>
      <button id="pwa-update-btn" style="
        background: white;
        color: #0066CC;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
      ">Aktualisieren</button>
    `;
    
    document.body.appendChild(notification);
    
    document.getElementById('pwa-update-btn').onclick = () => {
      window.location.reload();
    };
    
    // Auto-dismiss nach 10 Sekunden
    setTimeout(() => {
      notification.remove();
    }, 10000);
  }

  // iOS Installations-Hinweis
  function checkIOSInstallPrompt() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isIOS && !isStandalone && !localStorage.getItem('ios-install-dismissed')) {
      showIOSInstallHint();
    }
  }

  function showIOSInstallHint() {
    const hint = document.createElement('div');
    hint.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #0066CC, #0052A3);
      color: white;
      padding: 20px;
      box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      animation: slideUp 0.3s ease-out;
    `;
    
    hint.innerHTML = `
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <strong style="font-size: 18px;">📱 App installieren</strong>
          <button id="ios-hint-close" style="
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
          ">×</button>
        </div>
        <p style="margin: 0 0 8px 0; opacity: 0.95;">
          Tippe auf <strong>Teilen</strong> 
          <svg style="display: inline; width: 20px; height: 20px; vertical-align: middle; margin: 0 4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
            <polyline points="16 6 12 2 8 6"></polyline>
            <line x1="12" y1="2" x2="12" y2="15"></line>
          </svg>
          und dann <strong>"Zum Home-Bildschirm"</strong>
        </p>
      </div>
    `;
    
    document.body.appendChild(hint);
    
    document.getElementById('ios-hint-close').onclick = () => {
      hint.remove();
      localStorage.setItem('ios-install-dismissed', 'true');
    };
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  // Check iOS nach DOM-Load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkIOSInstallPrompt);
  } else {
    checkIOSInstallPrompt();
  }

  // Prüfe ob App bereits installiert ist
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('[PWA] App is running in standalone mode');
  }

})();
