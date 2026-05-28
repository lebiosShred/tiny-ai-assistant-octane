// Aegis v2 -- Page Object: IndexPage (Sales Assistant)

class IndexPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // Prep panel controls
    this.sampleBtn = page.locator('#prep-load-sample-btn');
    this.submitBtn = page.locator('#prep-submit-btn');
    this.nameInput = page.locator('#prep-name');
    this.companyInput = page.locator('#prep-company');

    // Output panel
    this.outputContent = page.locator('#output-doc-content');

    // Navigation
    this.nextBtn = page.locator('#step-1-next-btn');

    // Playbook panel
    this.variantSelector = page.locator('#battlecard-selector');
    this.teleprompterCounter = page.locator('#teleprompter-counter');
    this.battlecardBody = page.locator('#battlecard-body');

    // Layout
    this.leftPanelTitle = page.locator('#left-panel-title');
  }

  /**
   * Navigate to the index page and wait for the body to render.
   */
  async goto() {
    await this.page.goto('/');
    await this.page.locator('body').waitFor({ state: 'attached' });
  }

  /**
   * Click the sample data loader button.
   */
  async loadSample() {
    await this.sampleBtn.scrollIntoViewIfNeeded();
    await this.sampleBtn.click();
  }

  /**
   * Click the form submission button.
   */
  async submitForm() {
    await this.submitBtn.click();
  }

  /**
   * Wait until the dossier output contains substantive content.
   * @param {number} timeout -- max wait in ms (default 15000)
   */
  async waitForDossier(timeout = 15000) {
    await this.outputContent.waitFor({ state: 'attached', timeout });
    await this.page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && el.innerText && el.innerText.length > 100;
      },
      '#output-doc-content',
      { timeout }
    );
  }

  /**
   * Retrieve the dossier output text content.
   * @returns {Promise<string>}
   */
  async getDossierText() {
    return this.outputContent.innerText();
  }

  /**
   * Advance to the Playbook step by clicking the next button.
   */
  async goToPlaybook() {
    await this.nextBtn.click();
  }

  /**
   * Switch the battlecard variant via the selector dropdown.
   * @param {string} variant -- option value to select
   */
  async switchVariant(variant) {
    await this.variantSelector.selectOption(variant);
  }

  /**
   * Read the teleprompter counter and parse out the numeric question count.
   * Expects text like "3 / 10" or "Question 3" -- extracts the first integer.
   * @returns {Promise<number>}
   */
  async getQuestionCount() {
    const text = await this.teleprompterCounter.innerText();
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Check whether the battlecard body contains italicized tips (<i> or <em>).
   * @returns {Promise<boolean>}
   */
  async hasItalicizedTips() {
    const count = await this.battlecardBody.locator('i, em').count();
    return count > 0;
  }

  /**
   * Retrieve current form input values.
   * @returns {Promise<{name: string, company: string}>}
   */
  async getFormValues() {
    const name = await this.nameInput.inputValue();
    const company = await this.companyInput.inputValue();
    return { name, company };
  }
}

module.exports = { IndexPage };
