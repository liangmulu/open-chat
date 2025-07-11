use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{CommunityId, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub community_id: CommunityId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64),
    Error(OCError),
}
