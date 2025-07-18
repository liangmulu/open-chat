use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, CommunityCanisterChannelSummary};

#[ts_export(community, channel_summary)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub invite_code: Option<u64>,
}

#[ts_export(community, channel_summary)]
// Allow the large size difference because essentially all responses are the large variant anyway
#[expect(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CommunityCanisterChannelSummary),
    Error(OCError),
}
