import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import asyncio

logger = logging.getLogger(__name__)


class GitHubService:
    """Service for fetching GitHub issues and discussions."""
    
    def __init__(self, token: str):
        self.token = token
        self.base_url = "https://api.github.com"
        self.graphql_url = "https://api.github.com/graphql"
        self.max_retries = 3
    
    async def fetch_issues_and_discussions(self, repo: Dict[str, Any], since: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """Fetch both issues and discussions for a repo.
        
        Args:
            repo: Repo config dict
            since: Only fetch items updated after this datetime
        """
        if not repo.get("enabled", True):
            return []
        
        repo_name = repo.get("repo", "")
        if not repo_name or "/" not in repo_name:
            return []
        
        owner, name = repo_name.split("/", 1)
        items = []
        
        # Fetch issues
        try:
            issues = await self._fetch_issues(owner, name, since)
            items.extend(issues)
        except Exception as e:
            logger.error(f"[GitHub] Error fetching issues for {repo_name}: {e}")
        
        # Fetch discussions
        try:
            discussions = await self._fetch_discussions(owner, name)
            items.extend(discussions)
        except Exception as e:
            logger.error(f"[GitHub] Error fetching discussions for {repo_name}: {e}")
        
        return items
    
    async def _fetch_issues(self, owner: str, name: str, since: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """Fetch issues via REST API."""
        url = f"{self.base_url}/repos/{owner}/{name}/issues"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json"
        }
        params = {
            "state": "all",
            "per_page": 100,
            "sort": "updated"
        }
        
        # Add since for incremental sync
        if since:
            params["since"] = since.strftime("%Y-%m-%dT%H:%M:%SZ")
            logger.info(f"[GitHub] Fetching issues since {params['since']}")
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, headers=headers, params=params, timeout=30)
                    
                    if response.status_code == 429:
                        wait_time = 2 ** attempt
                        logger.warning(f"[GitHub] Rate limited, waiting {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    
                    response.raise_for_status()
                    issues = response.json()
                    
                    return self._parse_issues(issues, owner, name)
            
            except httpx.HTTPStatusError as e:
                if e.response.status_code in [500, 502, 503, 504]:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise
            except Exception as e:
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise
        
        return []
    
    async def _fetch_discussions(self, owner: str, name: str) -> List[Dict[str, Any]]:
        """Fetch discussions via GraphQL API."""
        query = """
        query($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
                discussions(first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
                    nodes {
                        id
                        title
                        body
                        url
                        createdAt
                        author { login }
                        comments { totalCount }
                        upvoteCount
                    }
                }
            }
        }
        """
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        self.graphql_url,
                        headers=headers,
                        json={"query": query, "variables": {"owner": owner, "name": name}},
                        timeout=30
                    )
                    response.raise_for_status()
                    data = response.json()
                    
                    discussions = data.get("data", {}).get("repository", {}).get("discussions", {}).get("nodes", [])
                    return self._parse_discussions(discussions, owner, name)
            
            except Exception as e:
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    logger.error(f"[GitHub] GraphQL error: {e}")
                    return []
        
        return []
    
    def _parse_issues(self, issues: List[Dict], owner: str, name: str) -> List[Dict[str, Any]]:
        """Parse GitHub issues into feedback items."""
        items = []
        for issue in issues:
            # Skip pull requests
            if "pull_request" in issue:
                continue
            
            items.append({
                "id": f"github-issue-{issue['id']}",
                "sourceType": "github-issue",
                "content": f"{issue['title']}\n\n{issue.get('body', '')}",
                "title": issue["title"],
                "author": issue.get("user", {}).get("login", "unknown"),
                "url": issue["html_url"],
                "createdAt": issue.get("created_at", datetime.now().isoformat()),
                "likes": issue.get("reactions", {}).get("+1", 0),
                "comments": issue.get("comments", 0),
                "repo": f"{owner}/{name}",
                "analyzed": False
            })
        
        return items
    
    def _parse_discussions(self, discussions: List[Dict], owner: str, name: str) -> List[Dict[str, Any]]:
        """Parse GitHub discussions into feedback items."""
        items = []
        for disc in discussions:
            items.append({
                "id": f"github-discussion-{disc['id']}",
                "sourceType": "github-discussion",
                "content": f"{disc['title']}\n\n{disc.get('body', '')}",
                "title": disc["title"],
                "author": disc.get("author", {}).get("login", "unknown"),
                "url": disc["url"],
                "createdAt": disc.get("createdAt", datetime.now().isoformat()),
                "likes": disc.get("upvoteCount", 0),
                "comments": disc.get("comments", {}).get("totalCount", 0),
                "repo": f"{owner}/{name}",
                "analyzed": False
            })
        
        return items
