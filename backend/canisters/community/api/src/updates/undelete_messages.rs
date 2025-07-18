use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, Message, MessageId, MessageIndex};

#[ts_export(community, undelete_messages)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
}

#[ts_export(community, undelete_messages)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, undelete_messages)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub messages: Vec<Message>,
}
