// Aegis v2 -- Page Object: IndexPage (Chat-First Sales Assistant)

class IndexPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // Sidebar and Navigation
    this.newChatBtn = page.locator('#btn-new-chat, #btn-new-chat-active').filter({ visible: true });
    this.chatSearchInput = page.locator('#chat-search');
    this.recentChatsList = page.locator('#recent-chats-list');

    // Chat Header and Actions
    this.toggleSourcesBtn = page.locator('#btn-toggle-sources');
    this.clientTitle = page.locator('#active-chat-client-title');
    this.clientMeta = page.locator('#active-chat-client-meta');

    // Sources Drawer Controls
    this.drawer = page.locator('#sources-drawer');
    this.closeDrawerBtn = page.locator('#btn-close-drawer');
    this.nameInput = page.locator('#meta-name');
    this.companyInput = page.locator('#meta-company');
    this.titleInput = page.locator('#meta-title');
    this.emailInput = page.locator('#meta-email');
    this.phoneInput = page.locator('#meta-phone');
    this.repSelect = page.locator('#meta-rep');
    this.trackSelect = page.locator('#meta-track'); // hidden input (backward compat)
    this.trackTm1Checkbox = page.locator('#track-tm1');
    this.trackAiCheckbox = page.locator('#track-ai');
    this.gdriveSelect = page.locator('#source-gdrive-file');
    
    // Action Buttons
    this.sampleBtn = page.locator('#btn-load-sample');
    this.submitBtn = page.locator('#btn-save-sources');

    // Chat Console Controls
    this.chatInput = page.locator('#chat-user-input');
    this.sendBtn = page.locator('#chat-send-btn');
    this.messagesLog = page.locator('#chat-messages-log');
    this.loadingIndicator = page.locator('#chat-loading-indicator');
  }

  /**
   * Navigate to the index page.
   */
  async goto() {
    await this.page.goto('/?demo=true');
    await this.page.locator('body').waitFor({ state: 'attached' });
  }

  /**
   * Open the sources drawer if it is not already visible.
   */
  async openDrawer() {
    // No-op for visual drawer, expand advanced section
    await this.page.evaluate(() => {
      const details = document.getElementById('advanced-sources-details');
      if (details) details.open = true;
    });
  }

  /**
   * Close the sources drawer if it is visible.
   */
  async closeDrawer() {
    // No-op
  }

  /**
   * Click the sample data loader button inside the drawer.
   */
  async loadSample() {
    await this.page.evaluate(() => {
      const btn = document.getElementById('btn-load-sample');
      if (btn) btn.click();
    });
  }

  /**
   * Fill the metadata form in the drawer.
   */
  async fillMetadata(name, company, email) {
    await this.page.evaluate(({ name, company, email }) => {
      const n = document.getElementById('meta-name');
      const c = document.getElementById('meta-company');
      const e = document.getElementById('meta-email');
      if (n) { n.value = name; n.dispatchEvent(new Event('input', { bubbles: true })); }
      if (c) { c.value = company; c.dispatchEvent(new Event('input', { bubbles: true })); }
      if (e) { e.value = email; e.dispatchEvent(new Event('input', { bubbles: true })); }
    }, { name, company, email });
  }

  /**
   * Submit the sources form to initialize the session.
   */
  async submitForm() {
    await this.page.evaluate(() => {
      const btn = document.getElementById('btn-save-sources');
      if (btn) btn.click();
    });
  }

  /**
   * Wait for the chat workspace to initialize.
   */
  async waitForChatInit() {
    await this.page.waitForFunction(
      () => {
        const titleEl = document.querySelector('#active-chat-client-title');
        const titleText = titleEl ? titleEl.innerText.trim() : '';
        return titleText !== '' && titleText !== 'Loading...' && titleText !== 'New Chat';
      },
      null,
      { timeout: 15000 }
    );
  }

  /**
   * Send a chat message.
   */
  async sendMessage(text) {
    this._lastAssistantCount = await this.page.evaluate(() => {
      return document.querySelectorAll('#chat-messages-log .chat-message-card.assistant').length;
    });
    await this.chatInput.fill(text);
    await this.sendBtn.click();
  }

  /**
   * Wait for assistant response to be rendered in the log.
   */
  async waitForResponse(timeout = 15000) {
    try {
      // First ensure we catch the streaming state emitted by the UI during fetch
      await this.page.waitForSelector('#chat-messages-log[data-state="streaming"]', { timeout: 5000 });
    } catch (e) {
      // If it responded instantly (cached) and is already idle, ignore
    }
    // Now wait for the stream to gracefully end
    await this.page.waitForSelector('#chat-messages-log[data-state="idle"]', { timeout });
    
    // Ensure the response has actual content
    await this.page.waitForFunction(() => {
        const cards = document.querySelectorAll('#chat-messages-log .chat-message-card.assistant');
        if (cards.length === 0) return false;
        const lastCard = cards[cards.length - 1];
        return lastCard && lastCard.innerText && lastCard.innerText.length > 5;
    }, { timeout: 5000 });
  }

  /**
   * Get the last assistant message content.
   */
  async getLastResponseText() {
    return this.page.evaluate(() => {
      const cards = document.querySelectorAll('#chat-messages-log .chat-message-card.assistant');
      if (cards.length === 0) return '';
      const lastCard = cards[cards.length - 1];
      // Exclude actions buttons text if present
      const pre = lastCard.querySelector('pre');
      if (pre) return pre.innerText;
      return lastCard.innerText;
    });
  }

  /**
   * Retrieve current form values from the drawer.
   */
  async getFormValues() {
    return this.page.evaluate(() => {
      const name = document.getElementById('meta-name')?.value || '';
      const company = document.getElementById('meta-company')?.value || '';
      const email = document.getElementById('meta-email')?.value || '';
      return { name, company, email };
    });
  }
}

module.exports = { IndexPage };
