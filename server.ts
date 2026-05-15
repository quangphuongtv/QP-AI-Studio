import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, GenerateVideosOperation, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined");
  }
  return new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/generate-prompt", async (req, res) => {
    try {
      const { promptText } = req.body;
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseMimeType: "application/json"
        }
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Prompt generation error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/generate-image", async (req, res) => {
    try {
      const { model, contents, aspectRatio, imageSize } = req.body;
      const ai = getAI();
      
      // Map aliases to actual backend models if necessary
      let activeModel = model;
      if (model.includes('gemini-3')) {
        activeModel = 'gemini-3.1-flash-image-preview'; 
      } else if (model.includes('gemini-1.5-pro')) {
        activeModel = 'gemini-1.5-pro';
      } else if (model.includes('gemini-1.5-flash')) {
        activeModel = 'gemini-1.5-flash';
      }

      const response = await ai.models.generateContent({
        model: activeModel,
        contents,
        config: {
          imageConfig: {
            aspectRatio,
            imageSize
          }
        }
      });
      
      const images = response.candidates?.[0]?.content?.parts
        ?.filter(part => part.inlineData)
        .map(part => `data:image/png;base64,${part.inlineData?.data}`);

      res.json({ images });
    } catch (error: any) {
      console.error("Image generation error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/generate-tts", async (req, res) => {
    try {
      const { model, text, voiceName } = req.body;
      const ai = getAI();
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
          },
        },
      });
      
      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      res.json({ audio: audioBase64 });
    } catch (error: any) {
      console.error("TTS generation error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Video Generation Lifecycle
  app.post("/api/generate-video", async (req, res) => {
    try {
      const { model, prompt, image, config } = req.body;
      
      const videoParams: any = { model, prompt, config };
      if (image) {
        videoParams.image = image;
      }

      const ai = getAI();
      const operation = await ai.models.generateVideos(videoParams);
      res.json({ operationName: operation.name });
    } catch (error: any) {
      console.error("Video start error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/video-status", async (req, res) => {
    try {
      const { operationName } = req.body;
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const ai = getAI();
      const updated = await ai.operations.getVideosOperation({ operation: op });
      res.json({ done: updated.done, error: updated.error });
    } catch (error: any) {
      console.error("Video status check error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/video-download", async (req, res) => {
    try {
      const { operationName } = req.body;
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const ai = getAI();
      const updated = await ai.operations.getVideosOperation({ operation: op });
      const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
      
      if (!uri) {
        return res.status(404).json({ error: "Video URI not found" });
      }

      const videoRes = await fetch(uri, {
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY || '' },
      });
      
      if (!videoRes.ok) {
        throw new Error(`Failed to fetch video: ${videoRes.statusText}`);
      }

      res.setHeader('Content-Type', 'video/mp4');
      const reader = videoRes.body?.getReader();
      if (!reader) throw new Error("Could not get video stream reader");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (error: any) {
      console.error("Video download error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
