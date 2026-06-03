// Aegis v2 -- Page Object: IndexPage (Chat-First Sales Assistant)

class IndexPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // Sidebar and Navigation
    this.newChatBtn = page.locator('#btn-new-chat');
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
    this.trackSelect = page.locator('#meta-track');
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
    const isVisible = await this.drawer.isVisible();
    if (!isVisible) {
      await this.toggleSourcesBtn.click();
    }
  }

  /**
   * Close the sources drawer if it is visible.
   */
  async closeDrawer() {
    const isVisible = await this.drawer.isVisible();
    if (isVisible) {
      await this.closeDrawerBtn.click();
    }
  }

  /**
   * Click the sample data loader button inside the drawer.
   */
  async loadSample() {
    await this.openDrawer();
    await this.sampleBtn.click();
  }

  /**
   * Fill the metadata form in the drawer.
   */
  async fillMetadata(name, company, email) {
    await this.openDrawer();
    await this.nameInput.fill(name);
    await this.companyInput.fill(company);
    await this.emailInput.fill(email);
  }

  /**
   * Submit the sources form to initialize the session.
   */
  async submitForm() {
    await this.openDrawer();
    await this.submitBtn.click();
  }

  /**
   * Wait for the chat workspace to initialize.
   */
  async waitForChatInit() {
    await this.page.waitForFunction(
      () => {
        const log = document.querySelector('#chat-messages-log');
        return log && log.innerText.includes('Chat session initialized');
      },
      null,
      { timeout: 15000 }
    );
  }

  /**
   * Send a chat message.
   */
  async sendMessage(text) {
    await this.chatInput.fill(text);
    await this.sendBtn.click();
  }

  /**
   * Wait for assistant response to be rendered in the log.
   */
  async waitForResponse(timeout = 15000) {
    await this.page.waitForFunction(
      () => {
        const cards = document.querySelectorAll('#chat-messages-log .chat-message-card.assistant');
        if (cards.length === 0) return false;
        const lastCard = cards[cards.length - 1];
        return lastCard && lastCard.innerText && lastCard.innerText.length > 5;
      },
      null,
      { timeout }
    );
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
    await this.openDrawer();
    const name = await this.nameInput.inputValue();
    const company = await this.companyInput.inputValue();
    const email = await this.emailInput.inputValue();
    return { name, company, email };
  }
}

module.exports = { IndexPage };
