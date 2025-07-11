use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AccessGateConfig, ChannelId, Document, GroupPermissions, GroupSubtype, Milliseconds, Rules};

#[ts_export(community, create_channel)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: Rules,
    pub subtype: Option<GroupSubtype>,
    pub avatar: Option<Document>,
    pub history_visible_to_new_joiners: bool,
    pub messages_visible_to_non_members: Option<bool>,
    pub permissions_v2: Option<GroupPermissions>,
    pub events_ttl: Option<Milliseconds>,
    pub gate_config: Option<AccessGateConfig>,
    pub external_url: Option<String>,
}

#[ts_export(community, create_channel)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, create_channel)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub channel_id: ChannelId,
}
