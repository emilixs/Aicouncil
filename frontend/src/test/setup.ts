import '@testing-library/jest-dom/vitest';

// Radix UI requires pointer capture APIs that jsdom doesn't implement
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});

// Radix Select uses scrollIntoView which jsdom doesn't implement
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

// ResizeObserver mock for virtualization and Radix components
globalThis.ResizeObserver = globalThis.ResizeObserver || class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
