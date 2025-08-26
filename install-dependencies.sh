#!/bin/bash

# Installation script for Real-Time Audio Transcript Extension dependencies

echo "🚀 Installing dependencies for Real-Time Audio Transcript Extension..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Install dependencies
echo "📦 Installing LangChain dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Configure your API keys in the extension settings"
    echo "2. Load the extension in Chrome: chrome://extensions/ -> Developer mode -> Load unpacked"
    echo "3. Test the recording functionality"
    echo ""
    echo "🔧 For Gemini API issues, see GEMINI_TROUBLESHOOTING.md"
else
    echo "❌ Failed to install dependencies. Please check the error messages above."
    exit 1
fi

echo "🎉 Setup complete!"
