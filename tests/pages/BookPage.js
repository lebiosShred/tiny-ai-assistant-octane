// Aegis v2 -- Page Object: BookPage (Booking Flow)

class BookPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    this.meetingReason = page.locator('#meeting-reason');
    this.hostTitle = page.locator('#hosts-display-title');
    this.hostSubtitle = page.locator('#hosts-display-subtitle');
  }

  /**
   * Navigate to the booking page and wait for the meeting reason element.
   */
  async goto() {
    await this.page.goto('/book.html');
    await this.meetingReason.waitFor({ state: 'attached' });
  }

  /**
   * Set the meeting type by directly assigning the value and dispatching
   * a change event. This bypasses native select interaction to handle
   * custom dropdown implementations.
   * @param {string} type -- the value to set on the meeting reason element
   */
  async selectMeetingType(type) {
    await this.page.evaluate(
      ({ selector, value }) => {
        const el = document.querySelector(selector);
        if (el) {
          el.value = value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      },
      { selector: '#meeting-reason', value: type }
    );
  }

  /**
   * Retrieve the host display details.
   * @returns {Promise<{title: string, subtitle: string}>}
   */
  async getHostDetails() {
    const title = await this.hostTitle.innerText();
    const subtitle = await this.hostSubtitle.innerText();
    return { title, subtitle };
  }
}

module.exports = { BookPage };
