import httpx
from typing import List, Dict, Any
from datetime import datetime
import logging
import asyncio

logger = logging.getLogger(__name__)


class DiscourseService:
    """Service for fetching topics from Discourse forums."""
    
    def __init__(self):
        self.max_retries = 3
    
    async def fetch_topics(self, forum: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Fetch topics from a Discourse forum."""
        if not forum.get("enabled", True):
            return []
        
        base_url = forum.get("url", "").rstrip("/")
        if not base_url:
            return []
        
        items = []
        
        # Fetch latest topics
        try:
            topics = await self._fetch_latest_topics(base_url)
            for topic in topics:
                posts = await self._fetch_topic_posts(base_url, topic["id"])
                if posts:
                    items.append(self._create_item(topic, posts, base_url))
        except Exception as e:
            logger.error(f"[Discourse] Error fetching from {base_url}: {e}")
        
        return items
    
    async def _fetch_latest_topics(self, base_url: str) -> List[Dict]:
        """Fetch latest topics from Discourse."""
        url = f"{base_url}/latest.json"
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, timeout=30)
                    
                    if response.status_code == 429:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    
                    response.raise_for_status()
                    data = response.json()
                    return data.get("topic_list", {}).get("topics", [])[:50]
            
            except Exception as e:
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise
        
        return []
    
    async def _fetch_topic_posts(self, base_url: str, topic_id: int) -> List[Dict]:
        """Fetch posts for a topic."""
        url = f"{base_url}/t/{topic_id}.json"
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, timeout=30)
                    
                    if response.status_code == 429:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    
                    response.raise_for_status()
                    data = response.json()
                    return data.get("post_stream", {}).get("posts", [])[:5]
            
            except Exception as e:
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    return []
        
        return []
    
    def _create_item(self, topic: Dict, posts: List[Dict], base_url: str) -> Dict[str, Any]:
        """Create a feedback item from a Discourse topic."""
        first_post = posts[0] if posts else {}
        
        return {
            "id": f"discourse-{topic['id']}",
            "sourceType": "discourse",
            "content": f"{topic['title']}\n\n{first_post.get('cooked', '')}",
            "title": topic["title"],
            "author": first_post.get("username", "unknown"),
            "url": f"{base_url}/t/{topic['slug']}/{topic['id']}",
            "createdAt": topic.get("created_at", datetime.now().isoformat()),
            "likes": topic.get("like_count", 0),
            "comments": topic.get("posts_count", 0) - 1,
            "forum": base_url,
            "analyzed": False
        }
