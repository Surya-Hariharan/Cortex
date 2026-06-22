import '@testing-library/jest-dom';

// jsdom doesn't implement matchMedia — provide a minimal stub
// Guard with typeof check so node-environment tests don't crash
if (typeof window !== 'undefined') {
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
});

// ResizeObserver stub (used by some layout components)
global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

// IntersectionObserver stub
global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};
} // end typeof window check
