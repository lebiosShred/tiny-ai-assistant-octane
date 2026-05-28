// Aegis v2 -- Page Object: DocsPage (Documentation)

class DocsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    this.headers = page.locator('h1, h2');
  }

  /**
   * Navigate to the documentation page and wait for the body to render.
   */
  async goto() {
    await this.page.goto('/docs.html');
    await this.page.locator('body').waitFor({ state: 'attached' });
  }

  /**
   * Retrieve all top-level header texts from the documentation page.
   * @returns {Promise<string[]>}
   */
  async getHeaders() {
    return this.headers.allInnerTexts();
  }
}

module.exports = { DocsPage };
