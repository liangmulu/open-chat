use serde::{Deserialize, Serialize};
use types::{EventWrapper, GroupFrozen, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub caller: UserId,
    pub reason: Option<String>,
    pub return_members: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(EventWrapper<GroupFrozen>),
    SuccessWithMembers(EventWrapper<GroupFrozen>, Vec<UserId>),
    CommunityAlreadyFrozen,
}
