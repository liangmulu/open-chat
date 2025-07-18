use crate::MARK_ACTIVE_DURATION;
use crate::model::moderation_flags::ModerationFlags;
use crate::model::private_communities::PrivateCommunityInfo;
use search::weighted::{Document, Query};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{
    AccessGate, AccessGateConfig, AccessGateConfigInternal, CommunityId, CommunityMatch, FrozenCommunityInfo,
    PublicCommunityActivity, TimestampMillis,
};

#[derive(Serialize, Deserialize, Default)]
pub struct PublicCommunities {
    communities: HashMap<CommunityId, PublicCommunityInfo>,
}

impl PublicCommunities {
    pub fn len(&self) -> usize {
        self.communities.len()
    }

    pub fn get(&self, community_id: &CommunityId) -> Option<&PublicCommunityInfo> {
        self.communities.get(community_id)
    }

    pub fn get_mut(&mut self, community_id: &CommunityId) -> Option<&mut PublicCommunityInfo> {
        self.communities.get_mut(community_id)
    }

    #[expect(clippy::too_many_arguments)]
    pub fn add(
        &mut self,
        community_id: CommunityId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
        banner_id: Option<u128>,
        gate_config: Option<AccessGateConfig>,
        primary_language: String,
        channel_count: u32,
        created: TimestampMillis,
    ) {
        self.communities.insert(
            community_id,
            PublicCommunityInfo::new(
                community_id,
                name,
                description,
                avatar_id,
                banner_id,
                gate_config.map(|gc| gc.into()),
                primary_language,
                channel_count,
                created,
            ),
        );
    }

    pub fn search(
        &self,
        search_term: Option<String>,
        include_moderation_flags: ModerationFlags,
        languages: Vec<String>,
        page_index: u32,
        page_size: u8,
    ) -> (Vec<CommunityMatch>, u32) {
        let query = search_term.map(Query::parse);

        let mut matches: Vec<_> = self
            .iter()
            .filter(|c| !c.is_frozen())
            .filter(|c| include_moderation_flags.contains(*c.moderation_flags()))
            .filter(|c| languages.is_empty() || languages.contains(&c.primary_language))
            .map(|c| {
                let score = if let Some(query) = &query {
                    let document: Document = c.into();
                    document.calculate_score(query)
                } else if c.hotness_score > 0 {
                    c.hotness_score
                } else {
                    c.activity.member_count
                };
                (score, c)
            })
            .filter(|(score, _)| *score > 0)
            .collect();

        let total = matches.len() as u32;

        matches.sort_by_key(|(score, _)| *score);

        let matches = matches
            .into_iter()
            .rev()
            .map(|(s, c)| c.to_match(s))
            .skip(page_index as usize * page_size as usize)
            .take(page_size as usize)
            .collect();

        (matches, total)
    }

    #[expect(clippy::too_many_arguments)]
    pub fn update_community(
        &mut self,
        community_id: &CommunityId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
        banner_id: Option<u128>,
        gate_config: Option<AccessGateConfig>,
        primary_language: String,
    ) -> UpdateCommunityResult {
        match self.communities.get_mut(community_id) {
            None => UpdateCommunityResult::CommunityNotFound,
            Some(community) => {
                if !name.eq_ignore_ascii_case(&community.name) {
                    community.verified = false;
                }
                community.name = name;
                community.description = description;
                community.avatar_id = avatar_id;
                community.banner_id = banner_id;
                community.gate_config = gate_config.map(|gc| gc.into());
                community.primary_language = primary_language;
                UpdateCommunityResult::Success
            }
        }
    }

    pub fn delete(&mut self, community_id: &CommunityId) -> Option<PublicCommunityInfo> {
        self.communities.remove(community_id)
    }

    pub fn iter(&self) -> impl Iterator<Item = &PublicCommunityInfo> {
        self.communities.values()
    }

    pub fn iter_mut(&mut self) -> impl Iterator<Item = &mut PublicCommunityInfo> {
        self.communities.values_mut()
    }
}

#[derive(Serialize, Deserialize)]
pub struct PublicCommunityInfo {
    // Fields common to PrivateCommunityInfo
    id: CommunityId,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    frozen: Option<FrozenCommunityInfo>,

    // Fields particular to PublicCommunityInfo
    name: String,
    description: String,
    avatar_id: Option<u128>,
    banner_id: Option<u128>,
    activity: PublicCommunityActivity,
    hotness_score: u32,
    #[serde(alias = "gate")]
    gate_config: Option<AccessGateConfigInternal>,
    moderation_flags: ModerationFlags,
    primary_language: String,
    verified: bool,
}

pub enum UpdateCommunityResult {
    Success,
    CommunityNotFound,
}

impl PublicCommunityInfo {
    #[expect(clippy::too_many_arguments)]
    pub fn new(
        id: CommunityId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
        banner_id: Option<u128>,
        gate_config: Option<AccessGateConfigInternal>,
        primary_language: String,
        channel_count: u32,
        now: TimestampMillis,
    ) -> PublicCommunityInfo {
        PublicCommunityInfo {
            id,
            name,
            description,
            avatar_id,
            banner_id,
            gate_config,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            activity: PublicCommunityActivity::new(channel_count, now),
            hotness_score: 0,
            frozen: None,
            moderation_flags: ModerationFlags::default(),
            primary_language,
            verified: false,
        }
    }

    pub fn id(&self) -> CommunityId {
        self.id
    }

    pub fn name(&self) -> &str {
        self.name.as_str()
    }

    pub fn created(&self) -> TimestampMillis {
        self.created
    }

    pub fn marked_active_until(&self) -> TimestampMillis {
        self.marked_active_until
    }

    pub fn activity(&self) -> &PublicCommunityActivity {
        &self.activity
    }

    pub fn mark_active(&mut self, until: TimestampMillis, activity: PublicCommunityActivity) {
        self.marked_active_until = until;
        self.activity = activity;
    }

    pub fn has_been_active_since(&self, since: TimestampMillis) -> bool {
        self.marked_active_until > since
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn frozen_info(&self) -> Option<&FrozenCommunityInfo> {
        self.frozen.as_ref()
    }

    pub fn verified(&self) -> bool {
        self.verified
    }

    pub fn set_name(&mut self, name: String) {
        self.name = name;
    }

    pub fn set_verified(&mut self, verified: bool) {
        self.verified = verified;
    }

    pub fn set_frozen(&mut self, info: Option<FrozenCommunityInfo>) {
        self.frozen = info;
    }

    pub fn set_hotness_score(&mut self, hotness_score: u32) {
        self.hotness_score = hotness_score;
    }

    pub fn moderation_flags(&self) -> &ModerationFlags {
        &self.moderation_flags
    }

    pub fn set_moderation_flags(&mut self, flags: ModerationFlags) {
        self.moderation_flags = flags;
    }

    pub fn gate(&self) -> Option<&AccessGate> {
        self.gate_config.as_ref().map(|gc| &gc.gate)
    }

    pub fn to_match(&self, score: u32) -> CommunityMatch {
        CommunityMatch {
            id: self.id,
            score,
            name: self.name.clone(),
            description: self.description.clone(),
            avatar_id: self.avatar_id,
            banner_id: self.banner_id,
            member_count: self.activity.member_count,
            channel_count: self.activity.channel_count,
            gate_config: self.gate_config.as_ref().map(|gc| gc.clone().into()),
            moderation_flags: self.moderation_flags.bits(),
            primary_language: self.primary_language.clone(),
            verified: self.verified,
        }
    }
}

impl From<&PublicCommunityInfo> for Document {
    fn from(community: &PublicCommunityInfo) -> Self {
        let mut document = Document::default();
        document
            .add_field(community.name.clone(), 5.0, true)
            .add_field(community.description.clone(), 1.0, true);
        document
    }
}

impl From<PublicCommunityInfo> for PrivateCommunityInfo {
    fn from(public_community_info: PublicCommunityInfo) -> Self {
        let mut private_community_info = PrivateCommunityInfo::new(public_community_info.id, public_community_info.created);
        private_community_info.mark_active(public_community_info.marked_active_until);
        private_community_info.set_frozen(public_community_info.frozen);
        private_community_info
    }
}
