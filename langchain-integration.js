// LangChain Integration for Real-Time Audio Transcript Extension
// This file demonstrates how to integrate LangChain for enhanced AI functionality

import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

class LangChainTranscriptionManager {
  constructor(config) {
    this.config = config;
    this.models = {};
    this.chains = {};
    this.conversationMemory = [];
    this.maxMemoryLength = 10; // Keep last 10 interactions
    
    this.initializeModels();
    this.setupChains();
  }

  async initializeModels() {
    try {
      // Initialize OpenAI model
      if (this.config.openai?.apiKey) {
        this.models.openai = new ChatOpenAI({
          apiKey: this.config.openai.apiKey,
          model: "gpt-4o-mini",
          temperature: 0.1,
          maxTokens: 2048
        });
        console.log('✅ OpenAI model initialized');
      }

      // Initialize Google Gemini model
      if (this.config.gemini?.apiKey) {
        this.models.gemini = new ChatGoogleGenerativeAI({
          apiKey: this.config.gemini.apiKey,
          model: "gemini-1.5-flash",
          temperature: 0.1,
          maxOutputTokens: 2048
        });
        console.log('✅ Gemini model initialized');
      }

    } catch (error) {
      console.error('❌ Error initializing LangChain models:', error);
    }
  }

  setupChains() {
    // Basic transcription chain
    const transcriptionPrompt = PromptTemplate.fromTemplate(`
      You are a professional audio transcription assistant. 
      
      Context from previous conversation: {context}
      
      Please transcribe the following audio content accurately. 
      Return only the spoken words without any additional formatting, explanations, or metadata.
      If there is no speech or the audio is unclear, return an empty response.
      
      Audio content: {audioContent}
      
      Transcription:
    `);

    // Enhanced transcription with context chain
    const enhancedTranscriptionPrompt = PromptTemplate.fromTemplate(`
      You are an intelligent audio transcription assistant with context awareness.
      
      Previous conversation context: {context}
      
      Current audio content: {audioContent}
      
      Instructions:
      1. Transcribe the audio accurately
      2. Maintain context from previous parts of the conversation
      3. If this appears to be a continuation of a previous topic, reference it appropriately
      4. Format the output clearly with proper punctuation
      5. If the audio is unclear or contains no speech, indicate this
      
      Enhanced transcription:
    `);

    // Summary and analysis chain
    const summaryPrompt = PromptTemplate.fromTemplate(`
      You are an AI assistant that analyzes transcribed conversations.
      
      Conversation transcript: {transcript}
      
      Please provide:
      1. A brief summary of the main topics discussed
      2. Key points or insights mentioned
      3. Any action items or decisions made
      4. Suggested follow-up questions or topics
      
      Analysis:
    `);

    // Set up chains for each model
    Object.keys(this.models).forEach(modelName => {
      const model = this.models[modelName];
      
      this.chains[`${modelName}_basic`] = RunnableSequence.from([
        transcriptionPrompt,
        model,
        new StringOutputParser()
      ]);

      this.chains[`${modelName}_enhanced`] = RunnableSequence.from([
        enhancedTranscriptionPrompt,
        model,
        new StringOutputParser()
      ]);

      this.chains[`${modelName}_summary`] = RunnableSequence.from([
        summaryPrompt,
        model,
        new StringOutputParser()
      ]);
    });
  }

  async transcribeWithLangChain(audioContent, provider = 'openai', mode = 'basic') {
    try {
      const chainKey = `${provider}_${mode}`;
      const chain = this.chains[chainKey];
      
      if (!chain) {
        throw new Error(`Chain not found: ${chainKey}`);
      }

      // Get conversation context
      const context = this.getConversationContext();
      
      // Execute the chain
      const result = await chain.invoke({
        audioContent: audioContent,
        context: context
      });

      // Update conversation memory
      this.updateConversationMemory({
        type: 'transcription',
        content: audioContent,
        result: result,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      console.error('❌ LangChain transcription error:', error);
      throw error;
    }
  }

  async analyzeTranscript(transcript) {
    try {
      // Use the first available model for analysis
      const availableModels = Object.keys(this.models);
      if (availableModels.length === 0) {
        throw new Error('No models available for analysis');
      }

      const modelName = availableModels[0];
      const chain = this.chains[`${modelName}_summary`];
      
      const result = await chain.invoke({
        transcript: transcript
      });

      return result;

    } catch (error) {
      console.error('❌ LangChain analysis error:', error);
      throw error;
    }
  }

  getConversationContext() {
    if (this.conversationMemory.length === 0) {
      return "No previous context available.";
    }

    // Get the last few interactions for context
    const recentMemory = this.conversationMemory.slice(-3);
    return recentMemory.map(item => 
      `${item.type}: ${item.result}`
    ).join('\n');
  }

  updateConversationMemory(interaction) {
    this.conversationMemory.push(interaction);
    
    // Keep only the last N interactions
    if (this.conversationMemory.length > this.maxMemoryLength) {
      this.conversationMemory = this.conversationMemory.slice(-this.maxMemoryLength);
    }
  }

  clearMemory() {
    this.conversationMemory = [];
  }

  // Method to handle audio data and convert to text for LangChain
  async processAudioForLangChain(audioBase64, provider = 'openai') {
    try {
      // For now, we'll assume the audio has been transcribed to text
      // In a real implementation, you'd need to convert audio to text first
      // This could be done using the existing transcription methods
      
      const audioText = `[Audio content: ${audioBase64.substring(0, 100)}...]`;
      
      return await this.transcribeWithLangChain(audioText, provider, 'enhanced');
      
    } catch (error) {
      console.error('❌ Error processing audio for LangChain:', error);
      throw error;
    }
  }

  // Method to get available models and their status
  getAvailableModels() {
    return Object.keys(this.models).map(modelName => ({
      name: modelName,
      available: true,
      chains: Object.keys(this.chains).filter(key => key.startsWith(modelName))
    }));
  }
}

// Export for use in the extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LangChainTranscriptionManager;
} else if (typeof window !== 'undefined') {
  window.LangChainTranscriptionManager = LangChainTranscriptionManager;
}
