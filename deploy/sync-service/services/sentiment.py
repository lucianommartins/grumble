import google.generativeai as genai
from typing import List, Dict, Any
import logging
import asyncio
import json

logger = logging.getLogger(__name__)


class SentimentService:
    """Service for sentiment analysis and translation using Gemini."""
    
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-3-flash-preview")
        self.batch_size = 10
        self.max_retries = 3
    
    async def analyze_batch(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyze sentiment for a batch of items."""
        analyzed = []
        
        for i in range(0, len(items), self.batch_size):
            batch = items[i:i + self.batch_size]
            
            try:
                results = await self._analyze_items(batch)
                for item, result in zip(batch, results):
                    item["sentiment"] = result.get("sentiment", "neutral")
                    item["category"] = result.get("category", "other")
                    item["summary"] = result.get("summary", "")
                    item["analyzed"] = True
                    analyzed.append(item)
                
                logger.info(f"[Sentiment] Analyzed batch {i // self.batch_size + 1}")
            
            except Exception as e:
                logger.error(f"[Sentiment] Batch error: {e}")
                # Mark as analyzed with neutral sentiment on error
                for item in batch:
                    item["sentiment"] = "neutral"
                    item["category"] = "other"
                    item["analyzed"] = True
                    analyzed.append(item)
        
        return analyzed
    
    async def _analyze_items(self, items: List[Dict[str, Any]]) -> List[Dict]:
        """Analyze a batch of items using Gemini."""
        prompt = self._build_analysis_prompt(items)
        
        for attempt in range(self.max_retries):
            try:
                response = await asyncio.to_thread(
                    self.model.generate_content, prompt
                )
                
                text = response.text.strip()
                # Extract JSON from response
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0]
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0]
                
                return json.loads(text)
            
            except Exception as e:
                logger.warning(f"[Sentiment] Retry {attempt + 1}: {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise
        
        return [{"sentiment": "neutral", "category": "other"} for _ in items]
    
    def _build_analysis_prompt(self, items: List[Dict[str, Any]]) -> str:
        """Build the analysis prompt for Gemini."""
        items_text = "\n\n".join([
            f"Item {i+1}:\n{item.get('content', '')[:500]}"
            for i, item in enumerate(items)
        ])
        
        return f"""Analyze the sentiment and category of each feedback item below.

For each item, provide:
- sentiment: "positive", "neutral", or "negative"
- category: "bug", "feature_request", "question", "praise", "complaint", or "other"
- summary: A brief 1-sentence summary in English

Return a JSON array with one object per item:

```json
[
  {{"sentiment": "...", "category": "...", "summary": "..."}},
  ...
]
```

Items to analyze:

{items_text}"""
    
    async def translate_batch(self, items: List[Dict[str, Any]], languages: List[str]) -> List[Dict[str, Any]]:
        """Translate summaries to multiple languages."""
        for i in range(0, len(items), self.batch_size):
            batch = items[i:i + self.batch_size]
            
            try:
                await self._translate_items(batch, languages)
                logger.info(f"[Translation] Translated batch {i // self.batch_size + 1}")
            except Exception as e:
                logger.error(f"[Translation] Error: {e}")
        
        return items
    
    async def _translate_items(self, items: List[Dict[str, Any]], languages: List[str]):
        """Translate summaries for a batch of items."""
        summaries = [item.get("summary", "") for item in items]
        
        prompt = f"""Translate the following summaries to {', '.join(languages)}.

Summaries:
{chr(10).join([f'{i+1}. {s}' for i, s in enumerate(summaries)])}

Return a JSON array where each item has translations:
```json
[
  {{"en": "...", "pt": "...", "es": "..."}},
  ...
]
```"""
        
        for attempt in range(self.max_retries):
            try:
                response = await asyncio.to_thread(
                    self.model.generate_content, prompt
                )
                
                text = response.text.strip()
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0]
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0]
                
                translations = json.loads(text)
                
                for item, trans in zip(items, translations):
                    item["translations"] = trans
                
                return
            
            except Exception as e:
                logger.warning(f"[Translation] Retry {attempt + 1}: {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
