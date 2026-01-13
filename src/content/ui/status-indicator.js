/**
 * Status Indicator using Shadow DOM
 * Injects a visual feedback component into HubSpot pages
 * Uses Shadow DOM for complete style isolation
 */

export class StatusIndicator {
  constructor() {
    this.container = null;
    this.shadowRoot = null;
    this.isVisible = false;
  }

  /**
   * Create the Shadow DOM container
   */
  createContainer() {
    if (this.container) return;

    // Create host element
    this.container = document.createElement('div');
    this.container.id = 'hubspot-extractor-status';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Attach Shadow DOM
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' });

    // Add styles to Shadow DOM
    const styles = document.createElement('style');
    styles.textContent = `
      .status-indicator {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
        max-width: 320px;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes slideOut {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(20px);
        }
      }

      .status-indicator.hiding {
        animation: slideOut 0.3s ease-in forwards;
      }

      .status-indicator.extracting {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .status-indicator.success {
        background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        color: white;
      }

      .status-indicator.error {
        background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        color: white;
      }

      .status-indicator.warning {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
      }

      .icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .message {
        flex: 1;
        line-height: 1.4;
      }

      .close-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: background 0.2s;
        flex-shrink: 0;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .progress-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: rgba(255, 255, 255, 0.5);
        border-radius: 0 0 8px 8px;
        animation: progress 2s ease-in-out infinite;
      }

      @keyframes progress {
        0% { width: 0%; }
        50% { width: 70%; }
        100% { width: 100%; }
      }
    `;

    this.shadowRoot.appendChild(styles);

    // Add to page
    document.body.appendChild(this.container);
  }

  /**
   * Show the status indicator
   * @param {string} status - 'extracting', 'success', 'error', 'warning'
   * @param {string} message - Message to display
   */
  show(status, message) {
    this.createContainer();

    const icons = {
      extracting: '<div class="spinner"></div>',
      success: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>`,
      error: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>`,
      warning: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>`
    };

    const indicator = document.createElement('div');
    indicator.className = `status-indicator ${status}`;
    indicator.innerHTML = `
      ${icons[status] || icons.extracting}
      <span class="message">${this.escapeHtml(message)}</span>
      <button class="close-btn" aria-label="Close">×</button>
      ${status === 'extracting' ? '<div class="progress-bar"></div>' : ''}
    `;

    // Clear previous content
    const existingIndicator = this.shadowRoot.querySelector('.status-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    this.shadowRoot.appendChild(indicator);
    this.isVisible = true;

    // Add close button handler
    const closeBtn = indicator.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => this.hide());

    // Notify service worker about status
    chrome.runtime.sendMessage({
      type: 'EXTRACTION_STATUS',
      payload: { status, message }
    }).catch(() => {});
  }

  /**
   * Hide the status indicator
   */
  hide() {
    if (!this.isVisible || !this.shadowRoot) return;

    const indicator = this.shadowRoot.querySelector('.status-indicator');
    if (indicator) {
      indicator.classList.add('hiding');
      setTimeout(() => {
        indicator.remove();
        this.isVisible = false;
      }, 300);
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update progress during extraction
   */
  updateProgress(current, total) {
    if (!this.shadowRoot) return;

    const message = this.shadowRoot.querySelector('.message');
    if (message) {
      message.textContent = `Extracting... ${current}/${total}`;
    }
  }

  /**
   * Destroy the indicator completely
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.shadowRoot = null;
    this.isVisible = false;
  }
}
