from fastapi import FastAPI, HTTPException, Request
from datetime import datetime, timedelta
import os
import logging

from services.firestore import FirestoreService
from services.twitter import TwitterService
from services.github import GitHubService
from services.discourse import DiscourseService
from services.sentiment import SentimentService
from services.grouping import GroupingService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Grumble Sync Service", version="1.0.0")


# ========== LOCK MANAGEMENT ==========
async def acquire_lock(firestore: FirestoreService) -> bool:
    """Acquire distributed lock to prevent concurrent syncs."""
    lock_ref = firestore.db.collection("grumble-config").document("sync-lock")
    lock = lock_ref.get()
    
    if lock.exists:
        lock_data = lock.to_dict()
        expires_at = lock_data.get("expires_at")
        if expires_at and expires_at > datetime.now():
            return False  # Lock is active
    
    lock_ref.set({
        "acquired_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(minutes=30)
    })
    return True


async def release_lock(firestore: FirestoreService):
    """Release the distributed lock."""
    lock_ref = firestore.db.collection("grumble-config").document("sync-lock")
    lock_ref.delete()


# ========== ENDPOINTS ==========
@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/sync")
async def sync_all(request: Request):
    """
    Main sync endpoint called by Cloud Scheduler.
    Executes the full pipeline: Sync -> Sentiment -> Grouping -> Dedup -> Translation -> Save
    """
    
    # Verify OIDC authentication from Cloud Scheduler
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        logger.warning("[Auth] Missing or invalid authorization header")
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    firestore = FirestoreService()
    
    # ========== CONCURRENCY CHECK ==========
    if not await acquire_lock(firestore):
        logger.info("[Sync] Skipped - another sync is in progress")
        return {"status": "skipped", "reason": "Another sync in progress"}
    
    try:
        config = firestore.get_config()
        
        # Get last sync time for incremental queries
        last_sync = firestore.get_last_sync_time()
        if last_sync:
            logger.info(f"[Sync] Using incremental sync since {last_sync.isoformat()}")
        else:
            logger.info("[Sync] First sync - fetching all available data")
        
        # ========== PHASE 1: SYNC ==========
        logger.info("[Sync] Starting source sync...")
        all_items = []
        
        # Sync Twitter
        if config.get("twitter", {}).get("enabled", False):
            logger.info("[Sync] Fetching Twitter...")
            twitter_token = os.environ.get("TWITTER_BEARER_TOKEN")
            if twitter_token:
                twitter = TwitterService(twitter_token)
                keywords = config.get("twitter", {}).get("keywords", [])
                items = await twitter.search(keywords, since=last_sync)
                all_items.extend(items)
                logger.info(f"[Sync] Twitter: {len(items)} items")
        
        # Sync GitHub
        if config.get("github", {}).get("enabled", False):
            logger.info("[Sync] Fetching GitHub...")
            github_token = os.environ.get("GITHUB_TOKEN")
            if github_token:
                github = GitHubService(github_token)
                repos = config.get("github", {}).get("repos", [])
                github_items = []
                for repo in repos:
                    items = await github.fetch_issues_and_discussions(repo, since=last_sync)
                    github_items.extend(items)
                all_items.extend(github_items)
                logger.info(f"[Sync] GitHub: {len(github_items)} items")
        
        # Sync Discourse
        if config.get("discourse", {}).get("enabled", False):
            logger.info("[Sync] Fetching Discourse...")
            discourse = DiscourseService()
            forums = config.get("discourse", {}).get("forums", [])
            discourse_items = []
            for forum in forums:
                items = await discourse.fetch_topics(forum)
                discourse_items.extend(items)
            all_items.extend(discourse_items)
            logger.info(f"[Sync] Discourse: {len(discourse_items)} items")
        
        # Deduplicate and merge with existing
        new_items = firestore.merge_items(all_items)
        logger.info(f"[Sync] New items after dedup: {len(new_items)}")
        
        if not new_items:
            return {"synced": 0, "groups": 0, "message": "No new items"}
        
        # ========== PHASE 2: SENTIMENT ANALYSIS ==========
        logger.info(f"[Sentiment] Analyzing {len(new_items)} items...")
        gemini_key = os.environ.get("GEMINI_API_KEY")
        sentiment = SentimentService(gemini_key)
        analyzed_items = await sentiment.analyze_batch(new_items)
        logger.info(f"[Sentiment] Analyzed: {len(analyzed_items)} items")
        
        # ========== PHASE 3: GROUPING ==========
        logger.info("[Grouping] Creating groups from analyzed items...")
        grouping = GroupingService(gemini_key)
        groups = await grouping.create_groups(analyzed_items)
        logger.info(f"[Grouping] Created: {len(groups)} groups")
        
        # ========== PHASE 4: GROUP DEDUPLICATION ==========
        logger.info("[Grouping] Deduplicating groups...")
        existing_groups = firestore.get_existing_groups()
        unique_groups = await grouping.deduplicate_groups(groups, existing_groups)
        logger.info(f"[Grouping] Unique groups after dedup: {len(unique_groups)}")
        
        # ========== PHASE 5: TRANSLATION ==========
        logger.info("[Translation] Translating to all languages...")
        target_languages = ["en", "pt", "es"]
        translated_items = await sentiment.translate_batch(analyzed_items, target_languages)
        logger.info(f"[Translation] Translated: {len(translated_items)} items")
        
        # ========== PHASE 6: SAVE TO FIRESTORE ==========
        logger.info("[Firestore] Saving items and groups...")
        firestore.save_items(translated_items)
        firestore.save_groups(unique_groups)
        firestore.update_sync_timestamp()
        
        logger.info(f"[Sync] Complete! Items: {len(translated_items)}, Groups: {len(unique_groups)}")
        
        return {
            "synced": len(translated_items),
            "groups": len(unique_groups),
            "total_fetched": len(all_items)
        }
    
    except Exception as e:
        logger.error(f"[Sync] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        await release_lock(firestore)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
