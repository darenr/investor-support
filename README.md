# Investor Support AI

An Electron app that uses AI to help investors analyze documents like cap tables and pitch decks.

## Features

- **PDF Analysis**: Open PDF documents and ask questions about them.
- **AI-Powered Chat**: Uses OpenAI (GPT-4) or Google Gemini to answer questions based on the document content.
- **Predefined Tasks**: Run common analysis tasks:
    - **Summarize**: Get a comprehensive overview of the document.
    - **Tech Questions**: Generate technical due diligence questions.

## Prerequisites

- Node.js installed.
- **API Keys**: You need either an `OPENAI_API_KEY` or `GEMINI_API_KEY` set in your environment variables.

## Installation

```bash
make install
```

## Running the App

Ensure you have your API key exported:

```bash
export OPENAI_API_KEY="your-key-here"
# OR
export GEMINI_API_KEY="your-key-here"

make run
```

## Building

To create a distributable binary (e.g., .dmg on macOS):

```bash
make build
```
The output will be in the `dist` folder.

## Project Structure

- `src/main.js`: Main Electron process, handles file operations and AI API calls.
- `src/renderer.js`: Frontend logic.
- `src/index.html`: Main UI.
