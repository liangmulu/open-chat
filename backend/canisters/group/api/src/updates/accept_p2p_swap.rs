use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AcceptSwapSuccess, MessageId, MessageIndex, PinNumberWrapper};

#[ts_export(group, accept_p2p_swap)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub pin: Option<PinNumberWrapper>,
    pub new_achievement: bool,
}

#[ts_export(group, accept_p2p_swap)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(AcceptSwapSuccess),
    Error(OCError),
}
