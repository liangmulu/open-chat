use crate::model::cached_hot_groups::CachedPublicGroupSummary;
use crate::model::private_groups::PrivateGroupInfo;
use crate::{CACHED_HOT_GROUPS_COUNT, MARK_ACTIVE_DURATION};
use constants::DAY_IN_MS;
use search::weighted::*;
use serde::{Deserialize, Serialize};
use std::cmp;
use std::collections::HashMap;
use types::{
    AccessGate, AccessGateConfig, AccessGateConfigInternal, BuildVersion, ChatId, FrozenGroupInfo, GroupMatch, GroupSubtype,
    PublicGroupActivity, PublicGroupSummary, TimestampMillis,
};
use utils::iterator_extensions::IteratorExtensions;

#[derive(Serialize, Deserialize, Default)]
pub struct PublicGroups {
    groups: HashMap<ChatId, PublicGroupInfo>,
}

impl PublicGroups {
    pub fn len(&self) -> usize {
        self.groups.len()
    }

    pub fn get(&self, chat_id: &ChatId) -> Option<&PublicGroupInfo> {
        self.groups.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut PublicGroupInfo> {
        self.groups.get_mut(chat_id)
    }

    #[expect(clippy::too_many_arguments)]
    pub fn add(
        &mut self,
        chat_id: ChatId,
        name: String,
        description: String,
        subtype: Option<GroupSubtype>,
        avatar_id: Option<u128>,
        gate_config: Option<AccessGateConfig>,
        created: TimestampMillis,
    ) {
        self.groups.insert(
            chat_id,
            PublicGroupInfo::new(chat_id, name, description, subtype, avatar_id, gate_config, created),
        );
    }

    pub fn search(&self, search_term: Option<String>, page_index: u32, page_size: u8) -> (Vec<GroupMatch>, u32) {
        let query = search_term.map(Query::parse);

        let mut matches: Vec<_> = self
            .iter()
            .filter(|c| !c.is_frozen())
            .map(|c| {
                let score = if let Some(query) = &query {
                    let document: Document = c.into();
                    document.calculate_score(query)
                } else if c.hotness_score > 0 {
                    c.hotness_score
                } else {
                    cmp::max(1, c.activity.member_count)
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
            .map(|(_, c)| c.into())
            .skip(page_index as usize * page_size as usize)
            .take(page_size as usize)
            .collect();

        (matches, total)
    }

    pub fn hydrate_cached_summary(&self, summary: CachedPublicGroupSummary) -> Option<PublicGroupSummary> {
        self.groups.get(&summary.chat_id).map(|group| PublicGroupSummary {
            chat_id: summary.chat_id,
            local_user_index_canister_id: summary.local_user_index_canister_id,
            last_updated: summary.last_updated,
            name: group.name.clone(),
            description: group.description.clone(),
            subtype: group.subtype.clone(),
            history_visible_to_new_joiners: true,
            avatar_id: group.avatar_id,
            latest_message: summary.latest_message,
            latest_event_index: summary.latest_event_index,
            latest_message_index: summary.latest_message_index,
            participant_count: summary.participant_count,
            is_public: true,
            messages_visible_to_non_members: false,
            frozen: None,
            events_ttl: summary.events_ttl,
            events_ttl_last_updated: summary.events_ttl_last_updated,
            gate_config: summary.gate_config,
            wasm_version: BuildVersion::default(),
        })
    }

    pub fn update_group(
        &mut self,
        chat_id: &ChatId,
        name: String,
        description: String,
        avatar_id: Option<u128>,
        gate_config: Option<AccessGateConfig>,
    ) -> UpdateGroupResult {
        match self.groups.get_mut(chat_id) {
            None => UpdateGroupResult::ChatNotFound,
            Some(group) => {
                if !name.eq_ignore_ascii_case(&group.name) {
                    group.verified = false;
                }
                group.name = name;
                group.description = description;
                group.avatar_id = avatar_id;
                group.gate_config = gate_config.map(|g| g.into());
                UpdateGroupResult::Success
            }
        }
    }

    pub fn delete(&mut self, chat_id: &ChatId) -> Option<PublicGroupInfo> {
        self.groups.remove(chat_id)
    }

    pub fn iter(&self) -> impl Iterator<Item = &PublicGroupInfo> {
        self.groups.values()
    }

    pub fn iter_mut(&mut self) -> impl Iterator<Item = &mut PublicGroupInfo> {
        self.groups.values_mut()
    }

    pub fn calculate_hot_groups(&self, now: TimestampMillis) -> Vec<ChatId> {
        let one_day_ago = now - DAY_IN_MS;

        self.iter()
            .filter(|g| !g.is_frozen() && g.has_been_active_since(one_day_ago) && !g.exclude_from_hotlist)
            .max_n_by(CACHED_HOT_GROUPS_COUNT, |g| g.hotness_score as usize)
            .map(|g| g.id)
            .collect()
    }
}

#[derive(Serialize, Deserialize)]
pub struct PublicGroupInfo {
    // Fields common to PrivateGroupInfo
    id: ChatId,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    frozen: Option<FrozenGroupInfo>,

    // Fields particular to PublicGroupInfo
    name: String,
    description: String,
    subtype: Option<GroupSubtype>,
    avatar_id: Option<u128>,
    activity: PublicGroupActivity,
    hotness_score: u32,
    exclude_from_hotlist: bool,
    gate_config: Option<AccessGateConfigInternal>,
    verified: bool,
}

pub enum UpdateGroupResult {
    Success,
    ChatNotFound,
}

impl PublicGroupInfo {
    pub fn new(
        id: ChatId,
        name: String,
        description: String,
        subtype: Option<GroupSubtype>,
        avatar_id: Option<u128>,
        gate_config: Option<AccessGateConfig>,
        now: TimestampMillis,
    ) -> PublicGroupInfo {
        PublicGroupInfo {
            id,
            name,
            description,
            subtype,
            avatar_id,
            gate_config: gate_config.map(|gc| gc.into()),
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            activity: PublicGroupActivity::new(now),
            hotness_score: 0,
            frozen: None,
            exclude_from_hotlist: false,
            verified: false,
        }
    }

    pub fn id(&self) -> ChatId {
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

    pub fn activity(&self) -> &PublicGroupActivity {
        &self.activity
    }

    pub fn mark_active(&mut self, until: TimestampMillis, activity: PublicGroupActivity) {
        self.marked_active_until = until;
        self.activity = activity;
    }

    pub fn has_been_active_since(&self, since: TimestampMillis) -> bool {
        self.marked_active_until > since
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn frozen_info(&self) -> Option<&FrozenGroupInfo> {
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

    pub fn set_frozen(&mut self, info: Option<FrozenGroupInfo>) {
        self.frozen = info;
    }

    pub fn is_excluded_from_hotlist(&self) -> bool {
        self.exclude_from_hotlist
    }

    pub fn set_excluded_from_hotlist(&mut self, exclude: bool) {
        self.exclude_from_hotlist = exclude;
    }

    pub fn set_hotness_score(&mut self, hotness_score: u32) {
        self.hotness_score = hotness_score;
    }

    pub fn gate(&self) -> Option<&AccessGate> {
        self.gate_config.as_ref().map(|g| &g.gate)
    }
}

impl From<&PublicGroupInfo> for GroupMatch {
    fn from(group: &PublicGroupInfo) -> Self {
        GroupMatch {
            id: group.id,
            name: group.name.clone(),
            description: group.description.clone(),
            avatar_id: group.avatar_id,
            member_count: group.activity.member_count,
            gate: group.gate_config.as_ref().map(|g| g.gate.clone()),
            subtype: group.subtype.clone(),
            verified: group.verified(),
        }
    }
}

impl From<&PublicGroupInfo> for Document {
    fn from(group: &PublicGroupInfo) -> Self {
        let mut document = Document::default();
        document
            .add_field(group.name.clone(), 5.0, true)
            .add_field(group.description.clone(), 1.0, true);
        document
    }
}

impl From<PublicGroupInfo> for PrivateGroupInfo {
    fn from(public_group_info: PublicGroupInfo) -> Self {
        let mut private_group_info = PrivateGroupInfo::new(public_group_info.id, public_group_info.created);
        private_group_info.mark_active(public_group_info.marked_active_until);
        private_group_info.set_frozen(public_group_info.frozen);
        private_group_info
    }
}
