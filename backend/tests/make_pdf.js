const fs = require('fs');
const path = require('path');

// Minimal PDF 1.4 representing a single page with text "Cortex is an advanced offline-first student AI tool."
// Created and encoded to base64 for reliable testing across platforms.
const pdfBase64 = "JVBERi0xLjQKJdPr6eEKMSAwIG9iaiA8PC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiAvUGFnZU1vZGUgL1VzZU5vbmU+PiBlbmRvYmogMiAwIG9iaiA8PC9UeXBlIC9QYWdlcyAvQ291bnQgMSAvS2lkcyBbIDMgMCBSIF0gPj4gZW5kb2JqIDMgMCBvYmogPDwvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9SZXNvdXJjZXMgPDwvRm9udCA8PC9GMSA0IDAgUj4+Pj4gL01lZGlhQm94IFswIDAgNTk1LjI4IDg0MS44OV0gL0NvbnRlbnRzIDUgMCBSPj4gZW5kb2JqIDQgMCBvYmogPDwvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2E+PiBlbmRvYmogNSAwIG9iaiA8PC9MZW5ndGggNzU+PnN0cmVhbQpCVEQKL0YxIDEyIFRmCjEwMCA3MDAgVGQKKENvcnRleCBpcyBhbiBhZHZhbmNlZCBvZmZsaW5lLWZpcnN0IHN0dWRlbnQgQUkgdG9vbC4pIFRqCkVUDQplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDc5IDAwMDAwIG4gCjAwMDAwMDAxMzYgMDAwMDAgbiAKMDAwMDAwMDI1OCAwMDAwMCBuIAowMDAwMDAwMzQ2IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2IC9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjQ3MQolJUVPRgo=";

const fixturesDir = path.join(__dirname, 'fixtures');
if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
}

fs.writeFileSync(
    path.join(fixturesDir, 'dummy.pdf'),
    Buffer.from(pdfBase64, 'base64')
);

console.log('dummy.pdf successfully created in tests/fixtures/');
