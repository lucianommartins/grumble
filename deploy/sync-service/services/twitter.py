import httpx
from typing import List, Dict, Any
from datetime import datetime
import logging
import asyncio

logger = logging.getLogger(__name__)


class TwitterService:
    """Service for fetching tweets via Twitter API v2."""
    
    def __init__(self, bearer_token: str):
        self.bearer_token = bearer_token
        self.base_url = "https://api.twitter.com/2"
        self.max_retries = 3
    
    async def search(self, keywords: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Search tweets for given keywords."""
        all_items = []
        
        enabled_keywords = [k for k in keywords if k.get("enabled", True)]
        
        for keyword in enabled_keywords:
            term = keyword.get("term", "")
            if not term:
                continue
            
            try:
                items = await self._search_term(term)
                all_items.extend(items)
            except Exception as e:
                logger.error(f"[Twitter] Error searching '{term}': {e}")
        
        return all_items
    
    async def _search_term(self, term: str) -> List[Dict[str, Any]]:
        """Search for a single term with retry logic."""
        query = f"{term} -is:retweet lang:en"
        url = f"{self.base_url}/tweets/search/recent"
        
        params = {
            "query": query,
            "max_results": 100,
            "tweet.fields": "created_at,public_metrics,author_id",
            "expansions": "author_id",
            "user.fields": "username,name"
        }
        
        headers = {
            "Authorization": f"Bearer {self.bearer_token}"
        }
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, params=params, headers=headers, timeout=30)
                    
                    if response.status_code == 429:
                        # Rate limited - wait and retry
                        wait_time = 2 ** attempt
                        logger.warning(f"[Twitter] Rate limited, waiting {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    
                    response.raise_for_status()
                    data = response.json()
                    
                    return self._parse_tweets(data, term)
            
            except httpx.HTTPStatusError as e:
                if e.response.status_code in [500, 502, 503, 504]:
                    wait_time = 2 ** attempt
                    logger.warning(f"[Twitter] Server error {e.response.status_code}, retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                else:
                    raise
            except Exception as e:
                logger.error(f"[Twitter] Request error: {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise
        
        return []
    
    def _parse_tweets(self, data: Dict[str, Any], keyword: str) -> List[Dict[str, Any]]:
        """Parse Twitter API response into feedback items."""
        items = []
        tweets = data.get("data", [])
        users = {u["id"]: u for u in data.get("includes", {}).get("users", [])}
        
        for tweet in tweets:
            author_id = tweet.get("author_id")
            author = users.get(author_id, {})
            metrics = tweet.get("public_metrics", {})
            
            items.append({
                "id": f"twitter-{tweet['id']}",
                "sourceType": "twitter-search",
                "content": tweet.get("text", ""),
                "author": author.get("username", "unknown"),
                "authorName": author.get("name", ""),
                "url": f"https://twitter.com/{author.get('username')}/status/{tweet['id']}",
                "createdAt": tweet.get("created_at", datetime.now().isoformat()),
                "likes": metrics.get("like_count", 0),
                "comments": metrics.get("reply_count", 0),
                "keyword": keyword,
                "analyzed": False
            })
        
        return items
