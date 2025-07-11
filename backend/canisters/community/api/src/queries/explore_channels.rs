use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelMatch, TimestampMillis};

#[ts_export(community, explore_channels)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
    pub search_term: Option<String>,
    pub page_index: u32,
    pub page_size: u8,
}

#[ts_export(community, explore_channels)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, explore_channels)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub matches: Vec<ChannelMatch>,
    pub total: u32,
}
