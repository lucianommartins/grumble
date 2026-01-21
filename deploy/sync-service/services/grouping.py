import google.generativeai as genai
from typing import List, Dict, Any
import logging
import asyncio
import json
import hashlib

logger = logging.getLogger(__name__)


class GroupingService:
    """Service for grouping feedback items by theme."""
    
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-3-flash-preview")
        self.max_retries = 3
    
    async def create_groups(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Group items by theme using Gemini."""
        if not items:
            return []
        
        try:
            groups = await self._group_items(items)
            return groups
        except Exception as e:
            logger.error(f"[Grouping] Error: {e}")
            return []
    
    async def _group_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Use Gemini to identify themes and group items."""
        summaries = [
            f"ID: {item['id']}, Sentiment: {item.get('sentiment', 'neutral')}, "
            f"Category: {item.get('category', 'other')}, Summary: {item.get('summary', '')[:100]}"
            for item in items[:50]  # Limit to 50 items for prompt size
        ]
        
        prompt = f"""Analyze these feedback items and group them by theme.

Items:
{chr(10).join(summaries)}

Create groups where each group has:
- theme: A descriptive title for the group
- sentiment: Overall sentiment (positive/neutral/negative)
- category: Main category
- itemIds: Array of IDs that belong to this group

Return JSON:
```json
[
  {{"theme": "...", "sentiment": "...", "category": "...", "itemIds": ["...", "..."]}},
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
                
                raw_groups = json.loads(text)
                
                # Add IDs and item counts
                groups = []
                for g in raw_groups:
                    group_id = self._generate_group_id(g["theme"])
                    groups.append({
                        "id": group_id,
                        "theme": g["theme"],
                        "sentiment": g.get("sentiment", "neutral"),
                        "category": g.get("category", "other"),
                        "itemIds": g.get("itemIds", []),
                        "itemCount": len(g.get("itemIds", []))
                    })
                
                return groups
            
            except Exception as e:
                logger.warning(f"[Grouping] Retry {attempt + 1}: {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise
        
        return []
    
    def _generate_group_id(self, theme: str) -> str:
        """Generate a stable ID for a group based on theme."""
        return f"group-{hashlib.md5(theme.encode()).hexdigest()[:12]}"
    
    async def deduplicate_groups(
        self, 
        new_groups: List[Dict[str, Any]], 
        existing_groups: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Remove duplicate groups and merge similar ones."""
        if not new_groups:
            return []
        
        if not existing_groups:
            return new_groups
        
        existing_themes = {g.get("theme", "").lower() for g in existing_groups}
        unique = []
        
        for group in new_groups:
            theme_lower = group.get("theme", "").lower()
            
            # Simple dedup by exact theme match
            if theme_lower not in existing_themes:
                unique.append(group)
                existing_themes.add(theme_lower)
        
        logger.info(f"[Grouping] Dedup: {len(new_groups)} -> {len(unique)} groups")
        return unique
