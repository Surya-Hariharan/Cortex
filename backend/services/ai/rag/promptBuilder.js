function buildPrompt(query, chunks) {
    const maxContextTokens = 2000;
    const maxChars = maxContextTokens * 4; // roughly 4 chars per token
    let contextText = '';

    // Simple trimming to ensure we don't exceed the context window
    for (const chunk of chunks) {
        if (contextText.length + chunk.content.length > maxChars) {
            break;
        }
        contextText += `\n- ${chunk.content.trim()}`;
    }

    if (!contextText.trim()) {
        contextText = "No relevant context found in documents.";
    }

    // Strict ChatML format required by Phi-3 models
    return `<|system|>
You are an offline academic assistant. Answer the User Question strictly using the provided Context. 
If the answer is not found in the Context, say "Not found in documents."
Be concise and clear. Do not hallucinate external facts.
<|end|>
<|user|>
Context:
${contextText.trim()}

User Question:
${query}
<|end|>
<|assistant|>
`;
}

module.exports = { buildPrompt };
