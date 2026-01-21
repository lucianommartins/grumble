from google.cloud import firestore
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class FirestoreService:
    """Service for interacting with Firestore."""
    
    def __init__(self):
        self.db = firestore.Client()
        self.config_collection = "grumble-config"
        self.feedback_collection = "grumble-feedback"
        self.groups_collection = "grumble-groups"
    
    def get_last_sync_time(self) -> datetime | None:
        """Get the timestamp of the last successful sync."""
        ref = self.db.collection(self.config_collection).document("sync-state")
        doc = ref.get()
        if doc.exists:
            data = doc.to_dict()
            last_sync = data.get("lastSyncAt")
            if last_sync:
                # Firestore returns datetime directly
                return last_sync if isinstance(last_sync, datetime) else None
        return None
    
    def get_config(self) -> Dict[str, Any]:
        """Get sync configuration from Firestore."""
        config = {}
        
        # Get Twitter config
        twitter_doc = self.db.collection(self.config_collection).document("twitter").get()
        if twitter_doc.exists:
            config["twitter"] = twitter_doc.to_dict()
        
        # Get GitHub config
        github_doc = self.db.collection(self.config_collection).document("github").get()
        if github_doc.exists:
            config["github"] = github_doc.to_dict()
        
        # Get Discourse config
        discourse_doc = self.db.collection(self.config_collection).document("discourse").get()
        if discourse_doc.exists:
            config["discourse"] = discourse_doc.to_dict()
        
        return config
    
    def get_existing_items(self) -> Dict[str, Any]:
        """Get all existing feedback items keyed by ID."""
        items = {}
        docs = self.db.collection(self.feedback_collection).stream()
        for doc in docs:
            items[doc.id] = doc.to_dict()
        return items
    
    def get_existing_groups(self) -> List[Dict[str, Any]]:
        """Get all existing groups."""
        groups = []
        docs = self.db.collection(self.groups_collection).stream()
        for doc in docs:
            group = doc.to_dict()
            group["id"] = doc.id
            groups.append(group)
        return groups
    
    def merge_items(self, new_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Merge new items with existing, returning only truly new ones."""
        existing = self.get_existing_items()
        merged = []
        
        for item in new_items:
            item_id = item.get("id")
            if item_id and item_id not in existing:
                merged.append(item)
        
        logger.info(f"[Firestore] Merged: {len(merged)} new items out of {len(new_items)} total")
        return merged
    
    def save_items(self, items: List[Dict[str, Any]]):
        """Save feedback items to Firestore."""
        batch = self.db.batch()
        count = 0
        
        for item in items:
            item_id = item.get("id")
            if not item_id:
                continue
            
            ref = self.db.collection(self.feedback_collection).document(item_id)
            batch.set(ref, item, merge=True)
            count += 1
            
            # Firestore batch limit is 500
            if count >= 450:
                batch.commit()
                batch = self.db.batch()
                count = 0
        
        if count > 0:
            batch.commit()
        
        logger.info(f"[Firestore] Saved {len(items)} items")
    
    def save_groups(self, groups: List[Dict[str, Any]]):
        """Save groups to Firestore."""
        batch = self.db.batch()
        count = 0
        
        for group in groups:
            group_id = group.get("id")
            if not group_id:
                continue
            
            ref = self.db.collection(self.groups_collection).document(group_id)
            batch.set(ref, group, merge=True)
            count += 1
            
            if count >= 450:
                batch.commit()
                batch = self.db.batch()
                count = 0
        
        if count > 0:
            batch.commit()
        
        logger.info(f"[Firestore] Saved {len(groups)} groups")
    
    def update_sync_timestamp(self):
        """Update the last sync timestamp."""
        ref = self.db.collection(self.config_collection).document("sync-state")
        ref.set({
            "lastSyncAt": datetime.now(),
            "status": "completed"
        }, merge=True)
