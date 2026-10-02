# AI Chat

A minimal, static AI chat web app — no build step, no dependencies, no CDNs.
Just three files (`index.html`, `styles.css`, `app.js`), so it deploys as-is
to Vercel as a static site.

## How it works

- Enter your own API key in **Settings** (gear icon, top right).
- The app sends your messages to `{Base URL}/chat/completions` with an
  OpenAI-compatible request body (`model`, `messages`, `temperature: 0.7`).
- Any OpenAI-compatible endpoint works — OpenAI, OpenRouter, local servers
  like Ollama/LM Studio, etc. Just change the **Base URL** and **Model**.

## Your API key

- The key is stored **only in your browser's `localStorage`**. It never leaves
  your device except in requests to the Base URL you configured.
- The app makes **no analytics calls and no other network requests** — the only
  fetch the page ever performs is the chat-completions call.
- Clearing your browser's site data removes the key and chat history.

## Features

- Chat thread with user/assistant bubbles, auto-scroll, and a typing indicator
- Enter to send, Shift+Enter for newline
- Markdown rendering: code blocks with a Copy button, inline code, bold,
  italic, line breaks (all HTML escaped first)
- Chat history persisted in `localStorage`; "New chat" starts a fresh thread
- Bring-your-own-key settings: API key, Base URL, model, system prompt
- Plain-language error notices (missing key, 401 rejected key, network failure)
- Responsive dark UI with a mobile-friendly composer
