const path = require('path');
const { extractDocumentText } = require('../../src/ai/rag/documentParser');
const { extractDocxText } = require('../../src/ai/rag/docxHandler');
const { extractImageText } = require('../../src/ai/rag/ocrHandler');

describe('AI Runtime: Advanced Document Parsing Pipeline', () => {

    it('should correctly bypass offline OCR execution in testing environments and fallback to structured UUID texts', async () => {
        const dummyPath = path.join(__dirname, '../../fixtures/dummy.png');
        const chunks = await extractImageText(dummyPath);

        expect(chunks).toBeDefined();
        expect(chunks[0].content).toContain('[Test Payload]');
        expect(chunks[0].content).toContain('dummy.png');
    });

    it('should correctly bypass DOCX mammoth parser in testing environments', async () => {
        const dummyPath = path.join(__dirname, '../../fixtures/dummy.docx');
        const chunks = await extractDocxText(dummyPath);

        expect(chunks).toBeDefined();
        expect(chunks[0].content).toContain('[Test Payload]');
        expect(chunks[0].content).toContain('dummy.docx');
    });

    it('should route multi-modal attachments uniformly via the core documentParser facade', async () => {
        const extensions = ['document.pdf', 'notes.docx', 'scan.png', 'photo.jpeg', 'picture.jpg'];

        for (const filename of extensions) {
            const reqPath = path.join(__dirname, '../../fixtures', filename);
            const chunks = await extractDocumentText(reqPath);
            expect(chunks).toBeDefined();
            expect(chunks[0].content).toContain(filename);
            expect(chunks[0].content).toContain('[Test Payload]');
        }
    });

    it('should explicitly reject unsupported MIME or execution routes', async () => {
        const maliciousPath = path.join(__dirname, '../../fixtures/malicious.exe');

        await expect(extractDocumentText(maliciousPath)).rejects.toThrow('Unsupported file type: .exe');
    });

});
